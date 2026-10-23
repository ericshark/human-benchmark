import { describe, expect, it } from "vitest";
import {
  aggregatePlayers,
  buildCompleteProfiles,
  compareToReference,
  fitRarity,
  midrank,
  profileShape,
  profileUnusualness,
  similarityFrequency,
  type CompleteProfile,
  type RatedObservation,
} from "./statistics";
import { gameIds, type Session } from "./types";
import { seededRandom } from "../engine/random";
function observation(
  player: string,
  day: number,
  gameId: Session["gameId"] = "signal",
): RatedObservation {
  return {
    playerId: player,
    consent: true,
    eligible: true,
    serverDay: `2026-10-${String(day).padStart(2, "0")}`,
    session: {
      id: `${player}-${day}-${gameId}`,
      gameId,
      version: 1,
      scoringVersion: 1,
      mode: "assessment",
      input: "mouse",
      seed: 1,
      viewport: { width: 1440, height: 900 },
      startedAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`,
      completedAt: `2026-10-${String(day).padStart(2, "0")}T12:01:00.000Z`,
      trials: [
        {
          index: 0,
          stimulusAt: 0,
          respondedAt: 200,
          latency: 200,
          outcome: "correct",
        },
      ],
      flags: [],
    },
  };
}
describe("population integrity and composites", () => {
  it("uses midranks with ties and correct lower-is-better direction", () => {
    expect(midrank(2, [1, 2, 2, 3])).toBe(50);
    expect(midrank(1, [1, 2, 3], false)).toBeCloseTo(83.33333);
    expect(() => midrank(1, [])).toThrow();
    expect(() => midrank(NaN, [1])).toThrow();
  });
  it("withholds sparse and unsupported extreme comparisons", () => {
    const reference = {
      gameId: "signal" as const,
      input: "mouse" as const,
      snapshot: "v1",
      higherIsBetter: false,
      values: Array.from({ length: 99 }, (_, index) => index),
    };
    expect(compareToReference(50, reference).status).toBe("unavailable");
    expect(
      compareToReference(-1, {
        ...reference,
        values: Array.from({ length: 1000 }, (_, index) => index),
      }).status,
    ).toBe("unavailable");
    expect(
      compareToReference(500, {
        ...reference,
        values: Array.from({ length: 1000 }, (_, index) => index),
      }).percentile,
    ).toBe(50);
  });
  it("limits each player to one aggregate and one observation per server day", () => {
    const base = [
      observation("a", 1),
      observation("a", 2),
      observation("a", 3),
    ];
    expect(aggregatePlayers(base, new Date("2026-10-21"))).toHaveLength(1);
    expect(
      aggregatePlayers(
        [...base, ...Array.from({ length: 1000 }, () => observation("a", 3))],
        new Date("2026-10-21"),
      ),
    ).toEqual(aggregatePlayers(base, new Date("2026-10-21")));
    expect(
      aggregatePlayers(base.slice(0, 2), new Date("2026-10-21")),
    ).toHaveLength(0);
  });
  it("excludes withdrawn consent, invalid data, stale observations, and incompatible input", () => {
    const base = [1, 2, 3].map((day) => observation("a", day));
    expect(
      aggregatePlayers(
        base.map((item) => ({ ...item, consent: false })),
        new Date("2026-10-21"),
      ),
    ).toEqual([]);
    expect(aggregatePlayers(base, new Date("2027-10-21"))).toEqual([]);
    base[2].session.input = "touch";
    expect(aggregatePlayers(base, new Date("2026-10-21"))).toEqual([]);
  });
  it("requires every fixed anchor and computes an index without pretending it is a percentile", () => {
    const observations = gameIds.flatMap((id) =>
      [1, 2, 3].map((day) => observation("a", day, id)),
    );
    const aggregates = aggregatePlayers(observations, new Date("2026-10-21"));
    const references = gameIds.map((gameId) => ({
      gameId,
      input: "mouse" as const,
      values: Array(100).fill(200),
      higherIsBetter: true,
      snapshot: "v1",
    }));
    const profile = buildCompleteProfiles(aggregates, references, "mouse");
    expect(profile).toHaveLength(1);
    expect(profile[0].categories).toHaveLength(6);
    expect(
      buildCompleteProfiles(aggregates.slice(1), references, "mouse"),
    ).toEqual([]);
    expect(buildCompleteProfiles(aggregates, references, "touch")).toEqual([]);
  });
});
describe("joint profile rarity", () => {
  const random = seededRandom(77);
  const profiles: CompleteProfile[] = Array.from(
    { length: 2400 },
    (_, index) => ({
      playerId: `player-${index}`,
      categories: Array.from({ length: 6 }, () => 15 + random() * 70),
      index: 500,
    }),
  );
  it("maps six categories to five independent contrasts and separates balanced levels", () => {
    expect(
      profileShape([20, 20, 20, 20, 20, 20]).every(
        (value) => Math.abs(value) < 1e-12,
      ),
    ).toBe(true);
    expect(
      profileShape([80, 80, 80, 80, 80, 80]).every(
        (value) => Math.abs(value) < 1e-12,
      ),
    ).toBe(true);
    expect(profileShape([80, 20, 80, 20, 80, 20])).toHaveLength(5);
  });
  it("withholds small cohorts and rejects player leakage across splits", () => {
    expect(fitRarity(profiles.slice(0, 20), [], [])).toBeNull();
    expect(() =>
      fitRarity(
        profiles.slice(0, 1000),
        profiles.slice(999, 1500),
        profiles.slice(1500, 2000),
      ),
    ).toThrow(/disjoint/);
    expect(profileUnusualness(profiles[0], null).status).toBe("unavailable");
  });
  it("fits and empirically calibrates correlated profiles without an independence product", () => {
    const model = fitRarity(
      profiles.slice(0, 1200),
      profiles.slice(1200, 1800),
      profiles.slice(1800),
    );
    expect(model).not.toBeNull();
    expect(model!.healthy).toBe(true);
    const result = profileUnusualness(
      { playerId: "new", categories: [80, 20, 80, 20, 80, 20], index: 500 },
      model,
    );
    expect(result.status).toBe("provisional");
    expect(result.percentile).toBeGreaterThan(50);
    expect(result.reason).toContain("not profile-match frequency");
  });
  it("never turns zero matches or anomaly tails into a reciprocal rarity claim", () => {
    expect(similarityFrequency(0, 100000).status).toBe("unavailable");
    expect(similarityFrequency(19, 1000).status).toBe("unavailable");
    const result = similarityFrequency(30, 3000);
    expect(result.interval![0]).toBeLessThan(0.01);
    expect(result.interval![1]).toBeGreaterThan(0.01);
  });
});
