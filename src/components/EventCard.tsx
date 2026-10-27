import { useState } from "react";
import type { Impact } from "../../shared/schema";
import type { TimelineEvent } from "../model";

const IMPACT_LEVEL: Record<Impact, number> = { minor: 1, major: 2, "world-changing": 3 };

export function EventCard(props: {
  event: TimelineEvent;
  canBranch: boolean;
  onBranch: (twist: string | undefined) => void;
}) {
  const { event } = props;
  const [forking, setForking] = useState(false);
  const [twist, setTwist] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onBranch(twist.trim() || undefined);
    setForking(false);
    setTwist("");
  };

  return (
    <article className="event">
      <div className="event-year">{event.year}</div>
      <div className="event-card">
        <header>
          <h3>{event.title}</h3>
          <div className="event-meta">
            <span className={`tag cat-${event.category}`}>{event.category}</span>
            <span className="impact" title={`Impact: ${event.impact}`}>
              {[1, 2, 3].map((n) => (
                <i key={n} className={n <= IMPACT_LEVEL[event.impact] ? "on" : ""} />
              ))}
              <span>{event.impact}</span>
            </span>
          </div>
        </header>
        <p>{event.description}</p>
        <footer>
          <div className="plausibility" title="How defensible this event is, given what came before">
            <span>Plausibility</span>
            <div className="bar">
              <div style={{ width: `${Math.max(0, Math.min(100, event.plausibility))}%` }} />
            </div>
            <span>{Math.round(event.plausibility)}%</span>
          </div>
          {props.canBranch && !forking && (
            <button className="ghost" onClick={() => setForking(true)}>
              ⑂ Branch from here
            </button>
          )}
        </footer>
        {forking && (
          <form className="fork-form" onSubmit={submit}>
            <label>
              <span>What if, right after this…</span>
              <input
                autoFocus
                value={twist}
                onChange={(e) => setTwist(e.target.value)}
                placeholder="leave blank to let the simulator pick a different outcome"
                maxLength={300}
              />
            </label>
            <div className="fork-actions">
              <button type="button" className="link" onClick={() => setForking(false)}>
                Cancel
              </button>
              <button type="submit" className="primary small">
                Create branch
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
