import { describe, expect, it } from "vitest";
import type { Session, Trial } from "../domain/types";
import { personalRecords } from "./progress";

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

describe("personal records", () => {
  it("only counts strict improvements over earlier sessions", () => {
    const first = session(300, 1),
      slower = session(350, 2),
      faster = session(250, 3),
      tie = session(250, 4);
    expect(personalRecords([tie, faster, slower, first])).toEqual(
      new Set([faster.id]),
    );
  });
  it("ignores practice and flagged sessions", () => {
    const first = session(300, 1),
      flagged = session(200, 2, { flags: ["timing"] }),
      practice = session(200, 3, { mode: "practice" });
    expect(personalRecords([first, flagged, practice]).size).toBe(0);
  });
  it("keeps records separate per input and mode", () => {
    const mouse = session(300, 1),
      touch = session(250, 2, { input: "touch" }),
      daily = session(200, 3, { mode: "daily", dailyId: "2026-10-21" });
    expect(personalRecords([mouse, touch, daily]).size).toBe(0);
  });
});
