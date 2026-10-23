import { describe, expect, it } from "vitest";
import { referenceEligibility, validateSession } from "./validation";
import { seededRandom, shuffle } from "../engine/random";
import { makeQuestion } from "../games/generators";
import type { Session } from "../domain/types";
const makeSession = (): Session => ({
  id: crypto.randomUUID(),
  gameId: "signal",
  version: 1,
  scoringVersion: 1,
  input: "mouse",
  mode: "assessment",
  seed: 12,
  startedAt: "2026-10-21T12:00:00.000Z",
  completedAt: "2026-10-21T12:01:00.000Z",
  viewport: { width: 1440, height: 900 },
  flags: [],
  trials: Array.from({ length: 12 }, (_, index) => ({
    index,
    stimulusAt: index * 3000,
    respondedAt: index * 3000 + 250,
    latency: 250,
    outcome: "correct" as const,
  })),
});
describe("server event validation", () => {
  it("recomputes from recorded events and rejects incomplete standard protocols", () => {
    const session = makeSession();
    expect(validateSession(session, true)).toEqual(session);
    expect(() =>
      validateSession(
        { ...session, trials: session.trials.slice(0, -1) },
        true,
      ),
    ).toThrow(/count/);
    expect(() => validateSession({ ...session, mode: "daily" }, true)).toThrow(
      /standard assessments/,
    );
  });
  it("rejects timestamp manipulation, negative values, and inconsistent indices", () => {
    const session = makeSession();
    expect(() =>
      validateSession({
        ...session,
        trials: [{ ...session.trials[0], latency: 1 }],
      }),
    ).toThrow(/latency/);
    expect(() =>
      validateSession({
        ...session,
        trials: [{ ...session.trials[0], index: 99 }],
      }),
    ).toThrow();
    expect(() =>
      validateSession({
        ...session,
        trials: [{ ...session.trials[0], latency: -1 }],
      }),
    ).toThrow();
  });
  it("independently checks seeded question answers instead of trusting correct flags", () => {
    const session = { ...makeSession(), gameId: "pattern-forge" as const };
    const random = seededRandom(session.seed);
    shuffle([1, 2, 3, 4], random);
    const order = shuffle(
      Array.from({ length: 12 }, (_, index) => index),
      random,
    );
    shuffle(
      Array.from({ length: 12 }, (_, index) => index),
      random,
    );
    session.trials = order.map((questionIndex, index) => {
      const question = makeQuestion("pattern-forge", questionIndex, random);
      return {
        index,
        stimulusAt: index * 2000,
        respondedAt: index * 2000 + 1000,
        latency: 1000,
        outcome: "correct" as const,
        condition: question.condition,
        level: question.level,
        expected: question.options[question.answer],
        response: question.options[question.answer],
        choices: 4,
      };
    });
    expect(validateSession(session, true)).toEqual(session);
    const forged = structuredClone(session);
    forged.trials[0].response = "999999";
    expect(() => validateSession(forged, true)).toThrow(/inconsistent/);
  });
  it("flags implausibly short events without rejecting merely slow or inaccurate players", () => {
    const good = makeSession();
    expect(referenceEligibility(good)).toBe(true);
    good.trials[0].latency = 20;
    good.trials[0].respondedAt = 20;
    expect(referenceEligibility(good)).toBe(false);
    good.trials = good.trials.map((trial) => ({
      ...trial,
      latency: 2500,
      respondedAt: trial.stimulusAt + 2500,
      outcome: "timeout",
    }));
    expect(referenceEligibility(good)).toBe(true);
  });
});
