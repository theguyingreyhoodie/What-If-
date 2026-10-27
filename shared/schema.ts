import { z } from "zod";

// Schemas shared by the server (request validation + Claude structured outputs)
// and the client (types only).

export const CATEGORIES = [
  "politics",
  "conflict",
  "science",
  "technology",
  "economy",
  "culture",
  "society",
  "environment",
] as const;

export const IMPACTS = ["minor", "major", "world-changing"] as const;
export const REALISM = ["grounded", "speculative", "wild"] as const;
export const HORIZONS = ["near", "century", "epic"] as const;

export const EventSchema = z.object({
  year: z.string().describe('Short date label, e.g. "1453", "c. 300 BCE", "1960s", "2031"'),
  title: z.string().describe("Headline, under ~8 words"),
  description: z.string().describe("2-4 concrete sentences: what happened and why it follows from earlier events"),
  category: z.enum(CATEGORIES),
  impact: z.enum(IMPACTS),
  plausibility: z.number().describe("0-100: how defensible this event is given what came before"),
});

export const ScenarioSchema = z.object({
  title: z.string().describe("Evocative title, at most 6 words"),
  divergence: z.object({
    year: z.string(),
    description: z.string().describe("The single change from real history, 1-2 sentences"),
  }),
  summary: z.string().describe("2-3 sentence overview of where this timeline goes"),
  events: z.array(EventSchema),
  worldToday: z
    .array(
      z.object({
        aspect: z.string().describe('e.g. "Technology", "Geopolitics", "Religion"'),
        real: z.string().describe("Our world, one sentence"),
        alternate: z.string().describe("The alternate world at the end of the timeline, one sentence"),
      }),
    )
    .describe("Contrasts between our world and the alternate one"),
});

export const BranchSchema = z.object({
  label: z.string().describe("Short name for this branch, at most 5 words"),
  events: z.array(EventSchema),
  outcome: z.string().describe("1-2 sentences on how this branch's world ends up"),
});

const premise = z
  .string()
  .trim()
  .min(3, "Describe your what-if in a few words")
  .max(400, "Keep the premise under 400 characters");

export const SimulateRequestSchema = z.object({
  premise,
  realism: z.enum(REALISM),
  horizon: z.enum(HORIZONS),
});

const PathEventSchema = EventSchema.pick({ year: true, title: true, description: true });

export const BranchRequestSchema = z.object({
  premise,
  realism: z.enum(REALISM),
  // Canon timeline up to and including the event being forked.
  path: z.array(PathEventSchema).min(1).max(80),
  // What followed the fork in the timeline being branched from, so the new branch differs.
  previousContinuation: z.array(z.string().max(200)).max(40).default([]),
  twist: z.string().trim().max(300).optional(),
});

export type Category = (typeof CATEGORIES)[number];
export type Impact = (typeof IMPACTS)[number];
export type Realism = (typeof REALISM)[number];
export type Horizon = (typeof HORIZONS)[number];
export type SimEvent = z.infer<typeof EventSchema>;
export type ScenarioResult = z.infer<typeof ScenarioSchema>;
export type BranchResult = z.infer<typeof BranchSchema>;
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
export type BranchRequest = z.input<typeof BranchRequestSchema>;

// Lines of the NDJSON stream the server sends back.
export type StreamMessage<T> =
  | { type: "thinking"; text: string }
  | { type: "result"; data: T }
  | { type: "error"; error: string };
