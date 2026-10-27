import { useState } from "react";
import type { Horizon, Realism, SimulateRequest } from "../../shared/schema";

const EXAMPLES = [
  "the Library of Alexandria never burned",
  "the Roman Empire never fell",
  "the internet was invented in the 1920s",
  "the dinosaurs never went extinct",
  "humans could photosynthesize",
  "the Mongols conquered Europe",
];

const REALISM_OPTIONS: { value: Realism; label: string; hint: string }[] = [
  { value: "grounded", label: "Grounded", hint: "Most likely outcomes" },
  { value: "speculative", label: "Speculative", hint: "Surprising but defensible" },
  { value: "wild", label: "Wild", hint: "Bold cascades" },
];

const HORIZON_OPTIONS: { value: Horizon; label: string; hint: string }[] = [
  { value: "near", label: "Decades", hint: "~25 years" },
  { value: "century", label: "Century", hint: "~100 years" },
  { value: "epic", label: "Epic", hint: "Centuries" },
];

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; hint: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>{props.label}</legend>
      <div className="segmented-options">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === props.value ? "active" : ""}
            onClick={() => props.onChange(o.value)}
            title={o.hint}
          >
            {o.label}
            <small>{o.hint}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Composer({ onSubmit, busy }: { onSubmit: (req: SimulateRequest) => void; busy: boolean }) {
  const [premise, setPremise] = useState("");
  const [realism, setRealism] = useState<Realism>("speculative");
  const [horizon, setHorizon] = useState<Horizon>("century");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (premise.trim().length >= 3 && !busy) onSubmit({ premise: premise.trim(), realism, horizon });
  };

  return (
    <form className="composer" onSubmit={submit}>
      <label className="premise">
        <span className="premise-prefix">What if</span>
        <textarea
          value={premise}
          onChange={(e) => setPremise(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder="the printing press was invented in ancient China…"
          maxLength={400}
          rows={2}
          autoFocus
        />
      </label>

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="chip" onClick={() => setPremise(ex)}>
            {ex}
          </button>
        ))}
      </div>

      <div className="composer-controls">
        <Segmented label="Realism" value={realism} options={REALISM_OPTIONS} onChange={setRealism} />
        <Segmented label="Time horizon" value={horizon} options={HORIZON_OPTIONS} onChange={setHorizon} />
        <button className="primary" type="submit" disabled={busy || premise.trim().length < 3}>
          {busy ? "Simulating…" : "Simulate"}
        </button>
      </div>
    </form>
  );
}
