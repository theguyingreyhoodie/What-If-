import { useEffect, useState } from "react";
import type { SimulateRequest } from "../shared/schema";
import { simulate } from "./api";
import { Composer } from "./components/Composer";
import { ScenarioView } from "./components/ScenarioView";
import { ThinkingPanel } from "./components/ThinkingPanel";
import { createScenario, type Scenario } from "./model";
import { loadScenarios, onScenariosChangedElsewhere, saveScenarios } from "./storage";

const idFromHash = () => location.hash.match(/^#\/s\/(.+)$/)?.[1] ?? null;

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios);
  const [activeId, setActiveId] = useState<string | null>(idFromHash);
  const [pending, setPending] = useState<{ premise: string; thinking: string; controller: AbortController } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => saveScenarios(scenarios), [scenarios]);
  // Re-saving what another tab wrote leaves the stored value unchanged, so this doesn't loop.
  useEffect(() => onScenariosChangedElsewhere(setScenarios), []);

  useEffect(() => {
    const onHash = () => setActiveId(idFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const open = (id: string | null) => {
    location.hash = id ? `#/s/${id}` : "";
    setActiveId(id);
    window.scrollTo({ top: 0 });
  };

  const run = async (req: SimulateRequest) => {
    const controller = new AbortController();
    setPending({ premise: req.premise, thinking: "", controller });
    setError(null);
    try {
      const result = await simulate(req, (text) => setPending((p) => (p ? { ...p, thinking: p.thinking + text } : p)), controller.signal);
      const scenario = createScenario(req, result);
      setScenarios((all) => [scenario, ...all]);
      open(scenario.id);
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  const active = scenarios.find((s) => s.id === activeId);

  if (active) {
    return (
      <main className="app">
        <ScenarioView
          key={active.id}
          scenario={active}
          onChange={(next) => setScenarios((all) => all.map((s) => (s.id === next.id ? next : s)))}
          onDelete={() => {
            setScenarios((all) => all.filter((s) => s.id !== active.id));
            open(null);
          }}
          onBack={() => open(null)}
        />
      </main>
    );
  }

  return (
    <main className="app home">
      <header className="hero">
        <p className="eyebrow">Alternate history engine</p>
        <h1>
          What <em>if</em>…
        </h1>
        <p className="lede">Change one moment and watch the consequences cascade. Fork any event to explore a different path.</p>
      </header>

      <Composer onSubmit={run} busy={!!pending} />

      {pending && (
        <ThinkingPanel title={`Simulating “what if ${pending.premise}”…`} text={pending.thinking} onCancel={() => pending.controller.abort()} />
      )}
      {error && <div className="error">{error}</div>}

      {scenarios.length > 0 && (
        <section className="history">
          <h2>Your timelines</h2>
          <ul>
            {scenarios.map((s) => {
              const branches = Object.keys(s.timelines).length - 1;
              return (
                <li key={s.id}>
                  <button onClick={() => open(s.id)}>
                    <strong>{s.title}</strong>
                    <span>What if {s.premise}?</span>
                    <small>
                      {new Date(s.createdAt).toLocaleDateString()} · {s.realism}
                      {branches > 0 && ` · ${branches} branch${branches === 1 ? "" : "es"}`}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
