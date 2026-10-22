import { describe, expect, it } from "vitest";
import {
  bestSession,
  comparable,
  DEADLINE,
  median,
  quantile,
  scoreGame,
} from "./scoring";
import {
  backupSchema,
  defaultSettings,
  type Session,
  type Trial,
} from "./types";
const trial = (
  outcome: Trial["outcome"],
  latency: number,
  extra: Partial<Trial> = {},
): Trial => ({
  index: 0,
  outcome,
  latency,
  stimulusAt: 100,
  respondedAt: 100 + latency,
  ...extra,
});

describe("game scoring integrity", () => {
  it("computes medians and interpolated quartiles without mutating input", () => {
    const values = [400, 100, 300, 200];
    expect(median(values)).toBe(250);
    expect(quantile(values, 0.25)).toBe(175);
    expect(values).toEqual([400, 100, 300, 200]);
  });
  it("retains early responses and timeouts in the penalized reaction average", () => {
    const result = scoreGame("signal", [
      trial("correct", 200),
      trial("correct", 300),
      trial("false-start", 0),
      trial("timeout", 2500),
    ]);
    expect(result.primary.value).toBe(250);
    expect(result.rankingValue).toBe(1375);
    expect(result.accuracy).toBe(50);
  });
  it.each([
    "signal",
    "crossroads",
    "color-conflict",
    "rule-shift",
    "target-burst",
  ] as const)(
    "%s cannot improve when correct responses become misses",
    (game) => {
      for (let count = 1; count <= 12; count++) {
        const good = Array.from({ length: 12 }, (_, index) =>
          trial("correct", 200 + index * 20),
        );
        const bad = good.map((item, index) =>
          index < count ? { ...item, outcome: "wrong" as const } : item,
        );
        expect(scoreGame(game, bad).rankingValue).toBeGreaterThanOrEqual(
          scoreGame(game, good).rankingValue,
        );
      }
      expect(scoreGame(game, [trial("wrong", 0)]).rankingValue).toBe(DEADLINE);
    },
  );
  it("uses net throughput with chance correction and preserves negative scores", () => {
    const randomBlock = [
      trial("correct", 100, { choices: 4 }),
      ...Array.from({ length: 3 }, () => trial("wrong", 100, { choices: 4 })),
    ];
    expect(scoreGame("math-sprint", randomBlock, 60).rankingValue).toBeCloseTo(
      0,
    );
    expect(
      scoreGame("symbol-match", [trial("wrong", 100, { choices: 4 })], 60)
        .rankingValue,
    ).toBeCloseTo(-1 / 3);
    expect(
      scoreGame("symbol-match", [trial("timeout", 45000)], 45).rankingValue,
    ).toBe(0);
  });
  it("weights tracking by time rather than pointer sampling frequency", () => {
    const result = scoreGame("orbit-track", [
      trial("correct", 10, { duration: 10, error: 0.5 }),
      trial("wrong", 90, { duration: 90, error: 2 }),
    ]);
    expect(result.primary.value).toBe(10);
    expect(result.rankingValue).toBe(1.85);
  });
  it("does not reward fast wrong reasoning answers", () => {
    const result = scoreGame("pattern-forge", [
      trial("correct", 5000, { level: 1 }),
      trial("wrong", 10, { level: 3 }),
    ]);
    expect(result.primary.value).toBe(25);
    expect(result.rankingValue).toBe(25);
  });
  it("uses recent staircase presentations, not a lucky maximum", () => {
    const trials = [12, 8, 5, 4, 3, 2, 2, 2].map((level) =>
      trial("wrong", 3000, { level }),
    );
    expect(scoreGame("grid-recall", trials).rankingValue).toBe(3);
  });
  it("reports switch cost only with observations in both conditions", () => {
    const result = scoreGame("rule-shift", [
      trial("correct", 400, { condition: "repeat" }),
      trial("correct", 600, { condition: "switch" }),
    ]);
    expect(
      result.metrics.find((item) => item.label === "Switch cost")?.value,
    ).toBe(200);
    expect(
      scoreGame("rule-shift", [trial("correct", 400)]).metrics.some(
        (item) => item.label === "Switch cost",
      ),
    ).toBe(false);
  });
});
const session = (id: string, latency: number): Session => ({
  id,
  gameId: "signal",
  version: 1,
  scoringVersion: 1,
  mode: "assessment",
  seed: 1,
  startedAt: "2026-10-21T12:00:00.000Z",
  completedAt: "2026-10-21T12:01:00.000Z",
  input: "mouse",
  viewport: { width: 1440, height: 900 },
  trials: [trial("correct", latency)],
  flags: [],
});
describe("history and backup contracts", () => {
  it("excludes flagged sessions from records and groups incompatible inputs separately", () => {
    const first = session(crypto.randomUUID(), 300),
      suspicious = { ...session(crypto.randomUUID(), 20), flags: ["timing"] };
    expect(bestSession([first, suspicious])?.id).toBe(first.id);
    expect(comparable(first, { ...first, input: "touch" })).toBe(false);
    expect(comparable(first, { ...first, mode: "daily" })).toBe(false);
  });
  it("accepts an actual complete backup and rejects unknown protocols and nonfinite metrics", () => {
    const backup = {
      format: "humanrank",
      version: 1,
      exportedAt: "2026-10-21T12:01:00.000Z",
      settings: defaultSettings,
      sessions: [session(crypto.randomUUID(), 300)],
    };
    expect(backupSchema.safeParse(backup).success).toBe(true);
    expect(
      backupSchema.safeParse({
        ...backup,
        sessions: [{ ...backup.sessions[0], version: 2 }],
      }).success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({
        ...backup,
        sessions: [{ ...backup.sessions[0], trials: [trial("correct", NaN)] }],
      }).success,
    ).toBe(false);
  });
});
