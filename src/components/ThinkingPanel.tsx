import { useEffect, useRef } from "react";

// Shows Claude's summarized reasoning as it streams in.
export function ThinkingPanel({ title, text, onCancel }: { title: string; text: string; onCancel?: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [text]);

  return (
    <div className="thinking">
      <div className="thinking-head">
        <span className="pulse" aria-hidden />
        <span>{title}</span>
        {onCancel && (
          <button className="link" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <div className="thinking-body" ref={bodyRef}>
        {text ? renderBold(text) : <span className="muted">Finding the point of divergence…</span>}
      </div>
    </div>
  );
}

// Thinking summaries use **bold** headers; render those without pulling in a markdown library.
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}
