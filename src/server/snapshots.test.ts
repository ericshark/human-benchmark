import { describe, expect, it } from "vitest";
import { buildSnapshotFromAggregates } from "./snapshots";
import { gameIds } from "../domain/types";
import { seededRandom } from "../engine/random";
import type { PlayerAggregate } from "../domain/statistics";
describe("snapshot assembly and model release gates", () => {
  it("keeps rarity unavailable without pilot activation and independent prior norms", () => {
    const empty = buildSnapshotFromAggregates([], new Date("2026-10-22"));
    expect(empty.data.rarity.status).toBe("unavailable");
    expect(empty.data.references).toEqual([]);
    expect(empty.participants).toEqual([]);
  });
  it("constructs disjoint held-out model banks from actual supplied complete aggregates", () => {
    const random = seededRandom(91),
      aggregates: PlayerAggregate[] = [];
    for (let player = 0; player < 2400; player++)
      for (const gameId of gameIds)
        aggregates.push({
          playerId: `actor-${player}`,
          gameId,
          input: "mouse",
          context: "wide",
          presentation: "wide",
          value: random() * 100,
          sessions: 3,
          days: 3,
          higherIsBetter: true,
          updatedAt: "2026-10-21T12:00:00.000Z",
        });
    const first = buildSnapshotFromAggregates(
      aggregates,
      new Date("2026-10-21"),
    );
    expect(first.data.completeCohorts).toHaveLength(1);
    expect(first.data.completeCohorts[0].rarityBank).toBeUndefined();
    const next = buildSnapshotFromAggregates(
      aggregates,
      new Date("2026-10-22"),
      {
        enableRarity: true,
        previousReferences: first.data.references,
        previousParticipants: first.participants,
      },
    );
    const bank = next.data.completeCohorts[0].rarityBank;
    expect(bank?.models).toHaveLength(4);
    expect(bank?.models.every((model) => model !== null)).toBe(true);
    expect(next.participants).toHaveLength(2400);
    expect(
      next.data.references.every(
        (reference) => reference.values.length === 2400,
      ),
    ).toBe(true);
  }, 20000);
});
