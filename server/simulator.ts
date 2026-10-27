import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  BranchSchema,
  ScenarioSchema,
  type BranchRequestSchema,
  type Horizon,
  type Realism,
  type SimulateRequest,
} from "../shared/schema";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

// Created on first use so the server can boot (e.g. in demo mode) without credentials.
let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

const SYSTEM_PROMPT = `You are the engine of a "What If" simulator: a counterfactual storyteller with the rigor of a historian.

Given a premise, you identify the point of divergence and trace its consequences forward as a chain of cause and effect.

- Anchor in real history up to the divergence. Afterwards, real people, institutions and places can still appear, but their fates change in ways the divergence explains.
- Each event follows from earlier ones, and its description makes that link explicit. Second- and third-order effects are the interesting part; don't stop at the obvious first-order consequence.
- Events are in chronological order. "year" is a short label such as "1453", "c. 300 BCE", "1960s" or "2031".
- "plausibility" (0-100) is how defensible the event is given the events before it, judged as a historian would.
- "impact": minor = local, major = national or regional, world-changing = global.
- Descriptions are 2-4 vivid, concrete sentences; titles are short headlines.
- If the premise isn't historical (a physical, biological or personal what-if), treat its first moment as the divergence and date events from today (${new Date().getFullYear()}) onward, or use relative labels like "Year 1" when no date fits.
- Write for a curious general reader. Plain text only, no markdown.`;

const REALISM_GUIDE: Record<Realism, string> = {
  grounded: "Grounded: favor the most likely consequences; most events should score 60+ on plausibility.",
  speculative: "Speculative: balance likelihood with interesting turns, including a few surprising but defensible developments.",
  wild: "Wild: follow bold, dramatic, low-probability cascades, but keep every step causally linked.",
};

const HORIZON_GUIDE: Record<Horizon, string> = {
  near: "Cover roughly the first 20-30 years after the divergence.",
  century: "Cover roughly a century after the divergence.",
  epic: "Cover the long arc: several centuries, or up to the present day if the divergence is far enough back.",
};

export function normalizePremise(premise: string) {
  return premise.replace(/^\s*what\s+if\s*/i, "").replace(/[?.!\s]+$/, "");
}

export class SimulationError extends Error {}

type Emit = (thinkingDelta: string) => void;

// Zod's JSON schema is passed through as-is (the SDK's zod helper would move enums into descriptions,
// so they wouldn't be enforced). The response is validated with the same zod schema afterwards.
function outputFormat(schema: z.ZodType) {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema);
  return { type: "json_schema" as const, schema: jsonSchema };
}

async function run<T extends z.ZodType>(schema: T, userPrompt: string, onThinking: Emit, signal: AbortSignal) {
  const stream = getClient().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "medium", format: outputFormat(schema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    },
    { signal },
  );
  stream.on("thinking", (delta) => onThinking(delta));

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new SimulationError("The simulator declined this premise. Try rephrasing it.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new SimulationError("The timeline ran too long and was cut off. Try a shorter horizon.");
  }
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return schema.parse(JSON.parse(text)) as z.infer<T>;
  } catch {
    throw new SimulationError("The simulator returned a malformed timeline. Please try again.");
  }
}

export function simulate(req: SimulateRequest, onThinking: Emit, signal: AbortSignal) {
  const prompt = `Premise: What if ${normalizePremise(req.premise)}?

${REALISM_GUIDE[req.realism]}
${HORIZON_GUIDE[req.horizon]}

Produce the divergence, a 2-3 sentence summary, 8-10 events, and 4-6 "worldToday" contrasts between our real world and the alternate world at the end of the timeline. Pick the aspects this premise actually changes.`;
  return run(ScenarioSchema, prompt, onThinking, signal);
}

export function branch(req: z.output<typeof BranchRequestSchema>, onThinking: Emit, signal: AbortSignal) {
  const canon = req.path.map((e, i) => `${i + 1}. [${e.year}] ${e.title}: ${e.description}`).join("\n");
  const fork = req.path[req.path.length - 1];
  const previous = req.previousContinuation.length
    ? `\n\nIn the existing version of this timeline, what followed was: ${req.previousContinuation.join("; ")}. The new branch must go somewhere different.`
    : "";
  const change = req.twist
    ? `Right after "${fork.title}" (${fork.year}), one more thing changes: what if ${normalizePremise(req.twist)}?`
    : `Imagine a different but plausible outcome of "${fork.title}" (${fork.year}) and follow where it leads.`;

  const prompt = `The original premise was: What if ${normalizePremise(req.premise)}?

Timeline so far (canon, up to and including the fork point):
${canon}${previous}

${change}

${REALISM_GUIDE[req.realism]}

Produce a short label for this branch, 5-7 new events that come after the fork point in chronological order, and a 1-2 sentence outcome.`;
  return run(BranchSchema, prompt, onThinking, signal);
}

export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof SimulationError) return { status: 422, message: err.message };
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 500, message: "The server's Anthropic API key is missing or invalid. Check your .env file." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Rate limited by the Claude API. Wait a moment and try again." };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 502, message: `Claude API error${err.status ? ` (${err.status})` : ""}: ${err.message}` };
  }
  if (err instanceof Anthropic.AnthropicError) {
    // Raised before any request is sent, e.g. when no credentials are configured.
    return { status: 500, message: `${err.message}. Set ANTHROPIC_API_KEY in .env, or run "npm run dev:demo".` };
  }
  return { status: 500, message: err instanceof Error ? err.message : "Unexpected server error" };
}

