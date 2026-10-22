import { z } from "zod";

export const gameIds = [
  "signal",
  "crossroads",
  "grid-recall",
  "echo-path",
  "color-conflict",
  "rule-shift",
  "pattern-forge",
  "rotation-lab",
  "target-burst",
  "orbit-track",
  "symbol-match",
  "math-sprint",
] as const;
export type GameId = (typeof gameIds)[number];
export type CategoryId =
  "reflexes" | "memory" | "focus" | "reasoning" | "precision" | "processing";
export type InputClass = "mouse" | "trackpad" | "touch" | "keyboard";
export type Mode = "assessment" | "practice" | "daily";

export const trialSchema = z.object({
  index: z.number().int().min(0).max(10000),
  outcome: z.enum(["correct", "wrong", "false-start", "timeout"]),
  stimulusAt: z.number().finite().nonnegative(),
  respondedAt: z.number().finite().nonnegative(),
  latency: z.number().finite().nonnegative().max(600000),
  eventAt: z.number().finite().nonnegative().optional(),
  handlerAt: z.number().finite().nonnegative().optional(),
  level: z.number().finite().nonnegative().optional(),
  condition: z.string().max(80).optional(),
  expected: z.string().max(300).optional(),
  response: z.string().max(300).optional(),
  error: z.number().finite().nonnegative().optional(),
  duration: z.number().finite().nonnegative().optional(),
  choices: z.number().int().min(2).max(16).optional(),
});
export type Trial = z.infer<typeof trialSchema>;

export const sessionSchema = z.object({
  id: z.string().uuid(),
  gameId: z.enum(gameIds),
  version: z.literal(1),
  scoringVersion: z.literal(1),
  mode: z.enum(["assessment", "practice", "daily"]),
  seed: z.number().int().min(0).max(4294967295),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  input: z.enum(["mouse", "trackpad", "touch", "keyboard"]),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  arena: z
    .object({ width: z.number().positive(), height: z.number().positive() })
    .optional(),
  trials: z.array(trialSchema).min(1).max(10000),
  flags: z.array(z.string().max(120)).max(30),
  dailyId: z.string().max(30).optional(),
  note: z.string().max(300).optional(),
  assessmentToken: z.string().uuid().optional(),
  onlineOwner: z.string().uuid().optional(),
});
export type Session = z.infer<typeof sessionSchema>;

export interface Metric {
  label: string;
  value: number;
  unit: string;
  digits?: number;
}
export interface GameResult {
  primary: Metric;
  rankingValue: number;
  higherIsBetter: boolean;
  metrics: Metric[];
  accuracy: number;
  correct: number;
  total: number;
}
export interface GameDefinition {
  id: GameId;
  name: string;
  category: CategoryId;
  description: string;
  tagline: string;
  duration: string;
  icon: string;
  instructions: string[];
  measurement: string;
  keys?: string[];
}

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(32).default("Explorer"),
  input: z.enum(["mouse", "trackpad", "touch", "keyboard"]).default("mouse"),
  sound: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  theme: z.enum(["dark", "light"]).default("dark"),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  name: "Explorer",
  input: "mouse",
  sound: false,
  reducedMotion: false,
  theme: "dark",
};
export const backupSchema = z.object({
  format: z.literal("humanrank"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  settings: settingsSchema,
  sessions: z.array(sessionSchema).max(5000),
});
