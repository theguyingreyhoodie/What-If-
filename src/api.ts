import type { BranchRequest, BranchResult, ScenarioResult, SimulateRequest, StreamMessage } from "../shared/schema";

// POSTs to a streaming endpoint and reads NDJSON lines until the result arrives.
async function streamRequest<T>(url: string, body: unknown, onThinking: (text: string) => void, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as StreamMessage<T>;
      if (msg.type === "thinking") onThinking(msg.text);
      else if (msg.type === "error") throw new Error(msg.error);
      else return msg.data;
    }
  }
  throw new Error("The connection closed before the simulation finished.");
}

export const simulate = (req: SimulateRequest, onThinking: (text: string) => void, signal?: AbortSignal) =>
  streamRequest<ScenarioResult>("/api/simulate", req, onThinking, signal);

export const branch = (req: BranchRequest, onThinking: (text: string) => void, signal?: AbortSignal) =>
  streamRequest<BranchResult>("/api/branch", req, onThinking, signal);
