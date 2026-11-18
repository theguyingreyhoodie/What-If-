import type { BranchResult, Horizon, Realism, ScenarioResult, SimEvent } from "../shared/schema";

export interface TimelineEvent extends SimEvent {
  id: string;
  branchIds: string[];
}

export interface Timeline {
  id: string;
  label: string;
  twist?: string;
  parent?: { timelineId: string; eventId: string };
  events: TimelineEvent[];
  outcome?: string;
}

export interface Scenario {
  id: string;
  premise: string;
  realism: Realism;
  horizon: Horizon;
  title: string;
  divergence: ScenarioResult["divergence"];
  summary: string;
  worldToday: ScenarioResult["worldToday"];
  rootId: string;
  timelines: Record<string, Timeline>;
  // Fork event id -> the branch shown after it. Missing means the original continuation.
  selected: Record<string, string>;
  createdAt: number;
}

const uid = () => crypto.randomUUID();
const toEvents = (events: SimEvent[]): TimelineEvent[] => events.map((e) => ({ ...e, id: uid(), branchIds: [] }));

export function createScenario(
  req: { premise: string; realism: Realism; horizon: Horizon },
  result: ScenarioResult,
): Scenario {
  const root: Timeline = { id: uid(), label: "Original timeline", events: toEvents(result.events) };
  return {
    id: uid(),
    ...req,
    title: result.title,
    divergence: result.divergence,
    summary: result.summary,
    worldToday: result.worldToday,
    rootId: root.id,
    timelines: { [root.id]: root },
    selected: {},
    createdAt: Date.now(),
  };
}

function updateEvent(s: Scenario, timelineId: string, eventId: string, fn: (e: TimelineEvent) => TimelineEvent): Scenario {
  const t = s.timelines[timelineId];
  return {
    ...s,
    timelines: { ...s.timelines, [timelineId]: { ...t, events: t.events.map((e) => (e.id === eventId ? fn(e) : e)) } },
  };
}

export function addBranch(s: Scenario, timelineId: string, eventId: string, twist: string | undefined, result: BranchResult): Scenario {
  const branch: Timeline = {
    id: uid(),
    label: result.label,
    twist,
    parent: { timelineId, eventId },
    events: toEvents(result.events),
    outcome: result.outcome,
  };
  const next = updateEvent(s, timelineId, eventId, (e) => ({ ...e, branchIds: [...e.branchIds, branch.id] }));
  return {
    ...next,
    timelines: { ...next.timelines, [branch.id]: branch },
    selected: { ...next.selected, [eventId]: branch.id },
  };
}

export function removeBranch(s: Scenario, timelineId: string, eventId: string, branchId: string): Scenario {
  let next = updateEvent(s, timelineId, eventId, (e) => ({ ...e, branchIds: e.branchIds.filter((id) => id !== branchId) }));
  const timelines = { ...next.timelines };
  const selected = { ...next.selected };
  const drop = (id: string) => {
    for (const e of timelines[id]?.events ?? []) {
      e.branchIds.forEach(drop);
      delete selected[e.id];
    }
    delete timelines[id];
  };
  drop(branchId);
  if (selected[eventId] === branchId) delete selected[eventId];
  next = { ...next, timelines, selected };
  return next;
}

export function selectBranch(s: Scenario, eventId: string, branchId: string | null): Scenario {
  const selected = { ...s.selected };
  if (branchId) selected[eventId] = branchId;
  else delete selected[eventId];
  return { ...s, selected };
}

// Every event from the divergence up to and including the given one, across parent timelines.
export function pathTo(s: Scenario, timelineId: string, eventId: string): TimelineEvent[] {
  const t = s.timelines[timelineId];
  const own = t.events.slice(0, t.events.findIndex((e) => e.id === eventId) + 1);
  return t.parent ? [...pathTo(s, t.parent.timelineId, t.parent.eventId), ...own] : own;
}

export function continuationAfter(s: Scenario, timelineId: string, eventId: string): string[] {
  const t = s.timelines[timelineId];
  return t.events.slice(t.events.findIndex((e) => e.id === eventId) + 1).map((e) => `${e.year}: ${e.title}`);
}

export type Row =
  | { kind: "event"; event: TimelineEvent; timelineId: string; depth: number }
  | { kind: "fork"; event: TimelineEvent; timeline: Timeline; depth: number; selectedId: string | null }
  | { kind: "outcome"; timeline: Timeline; depth: number };

// Flattens the tree into the rows currently on screen, following the selected branch at each fork.
export function visibleRows(s: Scenario): Row[] {
  const rows: Row[] = [];
  const walk = (timelineId: string, depth: number) => {
    const t = s.timelines[timelineId];
    for (const event of t.events) {
      rows.push({ kind: "event", event, timelineId, depth });
      if (event.branchIds.length) {
        const selectedId = s.selected[event.id] ?? null;
        rows.push({ kind: "fork", event, timeline: t, depth, selectedId });
        if (selectedId && s.timelines[selectedId]) {
          walk(selectedId, depth + 1);
          return;
        }
      }
    }
    if (t.outcome) rows.push({ kind: "outcome", timeline: t, depth });
  };
  walk(s.rootId, 0);
  return rows;
}

export function toMarkdown(s: Scenario): string {
  const lines = [`# ${s.title}`, "", `**What if ${s.premise}?**`, "", `*Divergence (${s.divergence.year}):* ${s.divergence.description}`, "", s.summary, ""];
  for (const row of visibleRows(s)) {
    if (row.kind === "event") {
      const e = row.event;
      lines.push(`### ${e.year} - ${e.title}`, "", e.description, "", `_${e.category} · ${e.impact} · plausibility ${e.plausibility}%_`, "");
    } else if (row.kind === "fork" && row.selectedId) {
      const b = s.timelines[row.selectedId];
      lines.push(`---`, "", `**Branch: ${b.label}**${b.twist ? ` (what if ${b.twist}?)` : ""}`, "");
    } else if (row.kind === "outcome") {
      lines.push(`**Outcome:** ${row.timeline.outcome}`, "");
    }
  }
  if (s.worldToday.length) {
    lines.push("## Our world vs. this one", "", "| Aspect | Our world | This timeline |", "|---|---|---|");
    // A "|" or line break inside a cell would otherwise split or end the table row.
    const cell = (text: string) => text.replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "\\|");
    for (const w of s.worldToday) lines.push(`| ${cell(w.aspect)} | ${cell(w.real)} | ${cell(w.alternate)} |`);
  }
  return lines.join("\n");
}
