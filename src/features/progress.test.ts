import { describe, expect, it } from "vitest";
import type { Session, Trial } from "../domain/types";
import {
  levelThreshold,
  playerProgress,
  sessionXp,
  XP_REWARDS,
} from "./progress";

const trial = (latency: number): Trial => ({
  index: 0,
  outcome: "correct",
  latency,
  stimulusAt: 100,
  respondedAt: 100 + latency,
});
const session = (
  latency: number,
  minute: number,
  extra: Partial<Session> = {},
): Session => ({
  id: crypto.randomUUID(),
  gameId: "signal",
  version: 1,
  scoringVersion: 1,
  mode: "assessment",
  seed: 1,
  startedAt: `2026-10-21T12:${String(minute).padStart(2, "0")}:00.000Z`,
  completedAt: `2026-10-21T12:${String(minute).padStart(2, "0")}:30.000Z`,
  input: "mouse",
  viewport: { width: 1440, height: 900 },
  trials: [trial(latency)],
  flags: [],
  ...extra,
});

describe("player XP", () => {
  it("rewards completed games and only strict improvements as records", () => {
    const first = session(300, 1),
      slower = session(350, 2),
      faster = session(250, 3),
      tie = session(250, 4);
    const earned = sessionXp([tie, faster, slower, first]);
    expect(earned.get(first.id)).toEqual({
      xp: XP_REWARDS.game,
      record: false,
    });
    expect(earned.get(slower.id)?.record).toBe(false);
    expect(earned.get(faster.id)).toEqual({
      xp: XP_REWARDS.game + XP_REWARDS.record,
      record: true,
    });
    expect(earned.get(tie.id)?.record).toBe(false);
  });
  it("adds a daily bonus and ignores practice or flagged sessions", () => {
    const daily = session(300, 1, { mode: "daily", dailyId: "2026-10-21" }),
      flagged = session(200, 2, { flags: ["timing"] }),
      practice = session(200, 3, { mode: "practice" });
    const earned = sessionXp([daily, flagged, practice]);
    expect(earned.get(daily.id)?.xp).toBe(XP_REWARDS.game + XP_REWARDS.daily);
    expect(earned.has(flagged.id)).toBe(false);
    expect(earned.has(practice.id)).toBe(false);
  });
  it("keeps records separate per input", () => {
    const mouse = session(300, 1),
      touch = session(400, 2, { input: "touch" });
    expect(sessionXp([mouse, touch]).get(touch.id)?.record).toBe(false);
  });
  it("derives levels from a triangular XP curve", () => {
    expect([1, 2, 3, 4].map(levelThreshold)).toEqual([0, 100, 300, 600]);
    expect(playerProgress([])).toMatchObject({ xp: 0, level: 1, levelXp: 0 });
    const progress = playerProgress([session(300, 1), session(250, 2)]);
    expect(progress).toMatchObject({
      xp: 350,
      level: 3,
      levelXp: 50,
      nextLevelXp: 300,
      records: 1,
    });
  });
});
