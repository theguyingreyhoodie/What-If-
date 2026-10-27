import "dotenv/config";
import express, { type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { BranchRequestSchema, SimulateRequestSchema, type StreamMessage } from "../shared/schema";
import { demoBranch, demoSimulate } from "./demo";
import { branch, describeError, simulate } from "./simulator";

const PORT = Number(process.env.PORT ?? 8787);
const DEMO = process.env.DEMO === "1";

const app = express();
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, demo: DEMO });
});

type Runner<Req, Res> = (req: Req, onThinking: (delta: string) => void, signal: AbortSignal) => Promise<Res>;

// Validates the body, then streams NDJSON: thinking deltas while Claude works, then one result or error line.
function streamRoute<S extends z.ZodType, Res>(schema: S, runner: Runner<z.output<S>, Res>) {
  return async (req: express.Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    const send = (msg: StreamMessage<Res>) => res.write(JSON.stringify(msg) + "\n");

    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort();
    });

    try {
      const data = await runner(parsed.data, (text) => send({ type: "thinking", text }), controller.signal);
      send({ type: "result", data });
    } catch (err) {
      if (controller.signal.aborted) return;
      const { message } = describeError(err);
      console.error("[simulator]", err);
      send({ type: "error", error: message });
    }
    res.end();
  };
}

app.post("/api/simulate", streamRoute(SimulateRequestSchema, DEMO ? demoSimulate : simulate));
app.post("/api/branch", streamRoute(BranchRequestSchema, DEMO ? demoBranch : branch));

// In production, serve the built client from the same origin.
if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`What-If server on http://localhost:${PORT}${DEMO ? " (demo mode, no API calls)" : ""}`);
});
