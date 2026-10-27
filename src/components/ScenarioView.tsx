import { useRef, useState } from "react";
import { branch } from "../api";
import { addBranch, continuationAfter, pathTo, removeBranch, selectBranch, toMarkdown, visibleRows, type Scenario } from "../model";
import { EventCard } from "./EventCard";
import { ThinkingPanel } from "./ThinkingPanel";

interface Pending {
  eventId: string;
  thinking: string;
  controller: AbortController;
}

export function ScenarioView(props: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const { scenario } = props;
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<{ eventId: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // Branch results resolve after the user may have switched branches, so always apply them to the latest scenario.
  const latest = useRef(scenario);
  latest.current = scenario;

  const startBranch = async (timelineId: string, eventId: string, twist: string | undefined) => {
    const controller = new AbortController();
    setPending({ eventId, thinking: "", controller });
    setError(null);
    try {
      const result = await branch(
        {
          premise: scenario.premise,
          realism: scenario.realism,
          path: pathTo(scenario, timelineId, eventId).map(({ year, title, description }) => ({ year, title, description })),
          previousContinuation: continuationAfter(scenario, timelineId, eventId),
          twist,
        },
        (text) => setPending((p) => (p ? { ...p, thinking: p.thinking + text } : p)),
        controller.signal,
      );
      props.onChange(addBranch(latest.current, timelineId, eventId, twist, result));
    } catch (err) {
      if (!controller.signal.aborted) setError({ eventId, message: (err as Error).message });
    } finally {
      setPending(null);
    }
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(toMarkdown(scenario));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rows = visibleRows(scenario);

  return (
    <div className="scenario">
      <nav className="scenario-nav">
        <button className="link" onClick={props.onBack}>
          ← New what-if
        </button>
        <div className="spacer" />
        <button className="ghost" onClick={copyMarkdown}>
          {copied ? "Copied!" : "Copy as Markdown"}
        </button>
        <button
          className="ghost danger"
          onClick={() => {
            if (confirm("Delete this scenario and all its branches?")) props.onDelete();
          }}
        >
          Delete
        </button>
      </nav>

      <header className="scenario-head">
        <p className="eyebrow">What if {scenario.premise}?</p>
        <h1>{scenario.title}</h1>
        <p className="summary">{scenario.summary}</p>
        <div className="divergence">
          <span className="divergence-year">{scenario.divergence.year}</span>
          <div>
            <strong>Point of divergence</strong>
            <p>{scenario.divergence.description}</p>
          </div>
        </div>
      </header>

      <section className="timeline">
        {rows.map((row) => {
          if (row.kind === "event") {
            return (
              <div key={row.event.id} className={`row depth-${row.depth % 4}`}>
                <EventCard
                  event={row.event}
                  canBranch={!pending}
                  onBranch={(twist) => startBranch(row.timelineId, row.event.id, twist)}
                />
                {pending?.eventId === row.event.id && (
                  <div className="row-extra">
                    <ThinkingPanel title="Forking the timeline…" text={pending.thinking} onCancel={() => pending.controller.abort()} />
                  </div>
                )}
                {error?.eventId === row.event.id && <div className="row-extra error">{error.message}</div>}
              </div>
            );
          }
          if (row.kind === "fork") {
            const branches = row.event.branchIds.map((id) => scenario.timelines[id]).filter(Boolean);
            return (
              <div key={`fork-${row.event.id}`} className={`row fork depth-${row.depth % 4}`}>
                <div className="fork-label">⑂ Timeline splits</div>
                <div className="fork-options">
                  <button
                    className={`pill ${row.selectedId ? "" : "active"}`}
                    onClick={() => props.onChange(selectBranch(scenario, row.event.id, null))}
                  >
                    {row.timeline.label}
                  </button>
                  {branches.map((b) => (
                    <span key={b.id} className={`pill-group depth-${(row.depth + 1) % 4}`}>
                      <button
                        className={`pill ${row.selectedId === b.id ? "active" : ""}`}
                        title={b.twist ? `What if ${b.twist}?` : "Alternate outcome"}
                        onClick={() => props.onChange(selectBranch(scenario, row.event.id, b.id))}
                      >
                        {b.label}
                      </button>
                      <button
                        className="pill-remove"
                        aria-label={`Remove branch ${b.label}`}
                        title="Remove branch"
                        onClick={() => {
                          if (confirm(`Remove the branch "${b.label}" and everything under it?`)) {
                            props.onChange(removeBranch(scenario, row.timeline.id, row.event.id, b.id));
                          }
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {row.selectedId && scenario.timelines[row.selectedId]?.twist && (
                  <p className="fork-twist">What if {scenario.timelines[row.selectedId].twist}?</p>
                )}
              </div>
            );
          }
          return (
            <div key={`outcome-${row.timeline.id}`} className={`row depth-${row.depth % 4}`}>
              <div className="outcome">
                <strong>Where “{row.timeline.label}” leads</strong>
                <p>{row.timeline.outcome}</p>
              </div>
            </div>
          );
        })}
      </section>

      {scenario.worldToday.length > 0 && (
        <section className="world">
          <h2>Our world vs. the original timeline</h2>
          <div className="world-grid">
            <div className="world-head">Aspect</div>
            <div className="world-head">Our world</div>
            <div className="world-head">This timeline</div>
            {scenario.worldToday.map((w) => (
              <div key={w.aspect} className="world-row">
                <div className="world-aspect">{w.aspect}</div>
                <div className="world-real">{w.real}</div>
                <div className="world-alt">{w.alternate}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
