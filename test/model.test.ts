import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { BranchResult, ScenarioResult, SimEvent } from "../shared/schema";
import { normalizePremise } from "../server/simulator";
import {
  addBranch,
  continuationAfter,
  createScenario,
  pathTo,
  removeBranch,
  selectBranch,
  toMarkdown,
  visibleRows,
  type Scenario,
} from "../src/model";

const ev = (title: string, year = "1900"): SimEvent => ({
  year,
  title,
  description: `${title} happens.`,
  category: "politics",
  impact: "major",
  plausibility: 60,
});

const result: ScenarioResult = {
  title: "Test Timeline",
  divergence: { year: "1900", description: "Something changes." },
  summary: "A summary.",
  events: [ev("A"), ev("B"), ev("C")],
  worldToday: [{ aspect: "Tech", real: "Real tech.", alternate: "Alt tech." }],
};

const branchResult = (label: string, titles: string[]): BranchResult => ({
  label,
  outcome: `${label} outcome.`,
  events: titles.map((t) => ev(t)),
});

const newScenario = () => createScenario({ premise: "the test passed", realism: "grounded", horizon: "century" }, result);
const root = (s: Scenario) => s.timelines[s.rootId];
const titles = (s: Scenario) => visibleRows(s).flatMap((r) => (r.kind === "event" ? [r.event.title] : []));

describe("createScenario", () => {
  test("builds a single root timeline with unique event ids", () => {
    const s = newScenario();
    assert.equal(Object.keys(s.timelines).length, 1);
    assert.deepEqual(root(s).events.map((e) => e.title), ["A", "B", "C"]);
    assert.equal(new Set(root(s).events.map((e) => e.id)).size, 3);
    assert.ok(root(s).events.every((e) => e.branchIds.length === 0));
  });
});

describe("branching", () => {
  test("addBranch records the fork and selects the new branch", () => {
    let s = newScenario();
    const b = root(s).events[1];
    s = addBranch(s, s.rootId, b.id, "a twist", branchResult("Alt", ["X", "Y"]));

    const fork = root(s).events[1];
    assert.equal(fork.branchIds.length, 1);
    const branch = s.timelines[fork.branchIds[0]];
    assert.equal(branch.twist, "a twist");
    assert.deepEqual(branch.parent, { timelineId: s.rootId, eventId: b.id });
    assert.equal(s.selected[b.id], branch.id);
    assert.deepEqual(titles(s), ["A", "B", "X", "Y"]);
  });

  test("selectBranch(null) returns to the original continuation", () => {
    let s = newScenario();
    const b = root(s).events[1];
    s = addBranch(s, s.rootId, b.id, undefined, branchResult("Alt", ["X"]));
    s = selectBranch(s, b.id, null);
    assert.deepEqual(titles(s), ["A", "B", "C"]);
    assert.equal(visibleRows(s).filter((r) => r.kind === "fork").length, 1);
  });

  test("pathTo follows parent timelines; continuationAfter lists what came next", () => {
    let s = newScenario();
    const a = root(s).events[0];
    s = addBranch(s, s.rootId, a.id, undefined, branchResult("Alt", ["X", "Y", "Z"]));
    const branch = s.timelines[s.selected[a.id]];
    const y = branch.events[1];

    assert.deepEqual(pathTo(s, branch.id, y.id).map((e) => e.title), ["A", "X", "Y"]);
    assert.deepEqual(continuationAfter(s, s.rootId, a.id), ["1900: B", "1900: C"]);
    assert.deepEqual(continuationAfter(s, branch.id, y.id), ["1900: Z"]);
  });

  test("removeBranch drops nested branches and their selections", () => {
    let s = newScenario();
    const a = root(s).events[0];
    s = addBranch(s, s.rootId, a.id, undefined, branchResult("Outer", ["X", "Y"]));
    const outer = s.timelines[s.selected[a.id]];
    const x = outer.events[0];
    s = addBranch(s, outer.id, x.id, undefined, branchResult("Inner", ["P"]));
    const inner = s.selected[x.id];
    assert.equal(Object.keys(s.timelines).length, 3);

    s = removeBranch(s, s.rootId, a.id, outer.id);
    assert.deepEqual(Object.keys(s.timelines), [s.rootId]);
    assert.equal(s.selected[a.id], undefined);
    assert.equal(s.selected[x.id], undefined);
    assert.equal(s.timelines[inner], undefined);
    assert.deepEqual(root(s).events[0].branchIds, []);
    assert.deepEqual(titles(s), ["A", "B", "C"]);
  });

  test("model functions don't mutate their input", () => {
    const s = newScenario();
    const before = structuredClone(s);
    const a = root(s).events[0];
    const next = addBranch(s, s.rootId, a.id, undefined, branchResult("Alt", ["X"]));
    removeBranch(next, s.rootId, a.id, next.selected[a.id]);
    assert.deepEqual(s, before);
  });
});

describe("toMarkdown", () => {
  test("exports the visible path, branch label and comparison table", () => {
    let s = newScenario();
    const b = root(s).events[1];
    s = addBranch(s, s.rootId, b.id, "the twist", branchResult("Alt", ["X"]));
    const md = toMarkdown(s);

    assert.match(md, /^# Test Timeline/);
    assert.match(md, /\*\*What if the test passed\?\*\*/);
    assert.match(md, /### 1900 - X/);
    assert.doesNotMatch(md, /### 1900 - C/);
    assert.match(md, /\*\*Branch: Alt\*\* \(what if the twist\?\)/);
    assert.match(md, /\*\*Outcome:\*\* Alt outcome\./);
    assert.match(md, /\| Tech \| Real tech\. \| Alt tech\. \|/);
  });

  test("escapes pipes and line breaks in comparison table cells", () => {
    const s = createScenario(
      { premise: "x happened", realism: "wild", horizon: "near" },
      { ...result, worldToday: [{ aspect: "Trade | Money", real: "Coins\nand notes", alternate: "Shells |  beads" }] },
    );
    const row = toMarkdown(s).split("\n").at(-1)!;
    assert.equal(row, "| Trade \\| Money | Coins and notes | Shells \\|  beads |");
  });
});

describe("normalizePremise", () => {
  test("strips a leading 'what if' and trailing punctuation", () => {
    assert.equal(normalizePremise("What if Rome never fell?"), "Rome never fell");
    assert.equal(normalizePremise("  what if   the moon was closer?!  "), "the moon was closer");
    assert.equal(normalizePremise("dogs could talk."), "dogs could talk");
  });

  test("leaves premises that merely contain 'what if' alone", () => {
    assert.equal(normalizePremise("nobody asked what if"), "nobody asked what if");
  });
});
