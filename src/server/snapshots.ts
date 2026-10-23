import {
  aggregatePlayers,
  buildCompleteProfiles,
  type RatedObservation,
  type Reference,
  type PlayerAggregate,
  fitRarity,
  type RarityModel,
} from "../domain/statistics";
import { hashSeed } from "../engine/random";
import type { InputClass } from "../domain/types";

export interface SnapshotData {
  methodologyVersion: 1;
  sourceCutoff: string;
  references: Reference[];
  completeCohorts: {
    input: InputClass;
    context: string;
    indices: number[];
    categoryVectors: number[][];
    rarityBank?: { models: (RarityModel | null)[]; references: Reference[] };
  }[];
  rarity: { status: "unavailable"; reason: string };
}
export function buildSnapshot(
  observations: RatedObservation[],
  cutoff: Date,
): { data: SnapshotData; participants: string[] } {
  const aggregates = aggregatePlayers(observations, cutoff);
  return buildSnapshotFromAggregates(aggregates, cutoff);
}
export function buildSnapshotFromAggregates(
  aggregates: PlayerAggregate[],
  cutoff: Date,
  options: {
    enableRarity?: boolean;
    previousReferences?: Reference[];
    previousParticipants?: string[];
  } = {},
): { data: SnapshotData; participants: string[] } {
  const referenceGroups = new Map<string, typeof aggregates>();
  for (const aggregate of aggregates) {
    const key = `${aggregate.gameId}|${aggregate.input}|${aggregate.presentation}`;
    const group = referenceGroups.get(key);
    if (group) group.push(aggregate);
    else referenceGroups.set(key, [aggregate]);
  }
  const references: Reference[] = [...referenceGroups.values()].map(
    (group) => ({
      gameId: group[0].gameId,
      input: group[0].input,
      presentation: group[0].presentation,
      values: group.map((item) => item.value),
      higherIsBetter: group[0].higherIsBetter,
      snapshot: cutoff.toISOString(),
    }),
  );
  const completeCohorts: SnapshotData["completeCohorts"] = [];
  for (const input of ["mouse", "trackpad", "touch", "keyboard"] as const)
    for (const context of ["compact", "medium", "wide"]) {
      const complete = buildCompleteProfiles(
        aggregates,
        references,
        input,
        context,
      );
      let rarityBank: SnapshotData["completeCohorts"][number]["rarityBank"];
      if (options.enableRarity && options.previousReferences?.length) {
        const shapes = buildCompleteProfiles(
          aggregates,
          options.previousReferences,
          input,
          context,
        );
        if (shapes.length >= 2000) {
          const folds = Array.from({ length: 4 }, (_, fold) =>
            shapes.filter((profile) => hashSeed(profile.playerId) % 4 === fold),
          );
          const models = folds.map((evaluation, fold) =>
            fitRarity(
              [...folds[(fold + 2) % 4], ...folds[(fold + 3) % 4]],
              folds[(fold + 1) % 4],
              evaluation,
            ),
          );
          rarityBank = { models, references: options.previousReferences };
        }
      }
      if (complete.length)
        completeCohorts.push({
          input,
          context,
          indices: complete.map((profile) => profile.index),
          categoryVectors: complete.map((profile) => profile.categories),
          ...(rarityBank ? { rarityBank } : {}),
        });
    }
  return {
    data: {
      methodologyVersion: 1,
      sourceCutoff: cutoff.toISOString(),
      references,
      completeCohorts,
      rarity: {
        status: "unavailable",
        reason:
          "Joint-profile collection and independent pilot validation are required before activating rarity output.",
      },
    },
    participants: [
      ...new Set([
        ...aggregates.map((item) => item.playerId),
        ...(options.enableRarity ? (options.previousParticipants ?? []) : []),
      ]),
    ],
  };
}
