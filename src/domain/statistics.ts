import { median } from "./scoring";
import { gameIds, type GameId, type Session } from "./types";
import { scoreSession } from "./scoring";
import { categories, games } from "../games/definitions";
import { seededRandom } from "../engine/random";

export interface RatedObservation {
  playerId: string;
  session: Session;
  serverDay: string;
  consent: boolean;
  eligible: boolean;
  rankingValue?: number;
  higherIsBetter?: boolean;
}
export interface PlayerAggregate {
  playerId: string;
  gameId: GameId;
  input: Session["input"];
  value: number;
  sessions: number;
  days: number;
  higherIsBetter: boolean;
  presentation?: string;
  context?: string;
  updatedAt?: string;
}
export interface Availability {
  status: "unavailable" | "provisional" | "established";
  reason: string;
  n: number;
}
export interface Comparison extends Availability {
  percentile?: number;
  interval?: [number, number];
}
export interface Reference {
  gameId: GameId;
  input: Session["input"];
  values: number[];
  higherIsBetter: boolean;
  snapshot: string;
  presentation?: string;
}
export function assessmentContext(session: Session): string {
  return session.viewport.width < 600
    ? "compact"
    : session.viewport.width < 1000
      ? "medium"
      : "wide";
}
export function presentationKey(session: Session): string {
  return `${assessmentContext(session)}${session.arena ? `:${session.arena.width.toFixed(0)}x${session.arena.height.toFixed(0)}` : ""}`;
}
export function aggregatePlayers(
  observations: RatedObservation[],
  asOf: Date,
): PlayerAggregate[] {
  const groups = new Map<string, RatedObservation[]>();
  const earliest = asOf.getTime() - 90 * 86400000;
  for (const observation of observations) {
    const { session } = observation;
    if (
      !observation.consent ||
      !observation.eligible ||
      session.flags.length ||
      session.mode !== "assessment" ||
      Date.parse(session.completedAt) < earliest ||
      Date.parse(session.completedAt) > asOf.getTime()
    )
      continue;
    const key = `${observation.playerId}|${session.gameId}|${session.input}|${presentationKey(session)}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.values()].flatMap((group) => {
    const uniqueDays = new Map<string, RatedObservation>();
    // The server prevents duplicate daily tokens. Deduplication also makes offline audit input safe.
    for (const item of [...group].sort(
      (a, b) =>
        a.session.completedAt.localeCompare(b.session.completedAt) ||
        a.session.id.localeCompare(b.session.id),
    ))
      if (!uniqueDays.has(item.serverDay)) uniqueDays.set(item.serverDay, item);
    const recent = [...uniqueDays.values()]
      .sort((a, b) => b.serverDay.localeCompare(a.serverDay))
      .slice(0, 5);
    if (recent.length < 3) return [];
    const first = recent[0];
    return [
      {
        playerId: first.playerId,
        gameId: first.session.gameId,
        input: first.session.input,
        value: median(
          recent.map(
            (item) =>
              item.rankingValue ?? scoreSession(item.session).rankingValue,
          ),
        ),
        sessions: recent.length,
        days: uniqueDays.size,
        higherIsBetter:
          first.higherIsBetter ?? scoreSession(first.session).higherIsBetter,
        presentation: presentationKey(first.session),
        context: assessmentContext(first.session),
        updatedAt: first.session.completedAt,
      },
    ];
  });
}
export function midrank(
  value: number,
  values: number[],
  higherIsBetter = true,
): number {
  if (
    !values.length ||
    !Number.isFinite(value) ||
    values.some((item) => !Number.isFinite(item))
  )
    throw new Error(
      "A finite value and nonempty finite reference are required.",
    );
  const below = values.filter((item) =>
    higherIsBetter ? item < value : item > value,
  ).length;
  return (
    (100 * (below + 0.5 * values.filter((item) => item === value).length)) /
    values.length
  );
}
export function percentileInterval(
  value: number,
  values: number[],
  higherIsBetter: boolean,
  seed = 42,
): [number, number] {
  const random = seededRandom(seed),
    estimates: number[] = [];
  for (let repeat = 0; repeat < 300; repeat++) {
    let wins = 0;
    for (let index = 0; index < values.length; index++) {
      const sample = values[Math.floor(random() * values.length)];
      wins +=
        sample === value
          ? 0.5
          : (higherIsBetter ? sample < value : sample > value)
            ? 1
            : 0;
    }
    estimates.push((100 * wins) / values.length);
  }
  estimates.sort((a, b) => a - b);
  return [estimates[7], estimates[292]];
}
export function compareToReference(
  value: number,
  reference: Reference,
): Comparison {
  const n = reference.values.length;
  if (n < 100)
    return {
      status: "unavailable",
      reason:
        "At least 100 distinct qualifying players are needed for an initial comparison.",
      n,
    };
  const percentile = midrank(value, reference.values, reference.higherIsBetter),
    interval = percentileInterval(
      value,
      reference.values,
      reference.higherIsBetter,
    );
  const tailSupport = Math.min(
    reference.values.filter((item) => item <= value).length,
    reference.values.filter((item) => item >= value).length,
  );
  if (interval[1] - interval[0] > 25 || tailSupport < 10)
    return {
      status: "unavailable",
      reason:
        "The reference sample does not support a stable comparison at this score.",
      n,
    };
  const established = n >= 500 && interval[1] - interval[0] <= 12;
  return {
    status: established ? "established" : "provisional",
    reason: established
      ? "Comparable participating HumanRank players; sampling uncertainty only."
      : "Early cohort: interpret the interval rather than a precise rank.",
    n,
    percentile: established
      ? Math.round(percentile)
      : Math.round(percentile / 5) * 5,
    interval,
  };
}
export interface CompleteProfile {
  playerId: string;
  categories: number[];
  index: number;
}
export function buildCompleteProfiles(
  aggregates: PlayerAggregate[],
  references: Reference[],
  input: Session["input"],
  context = "wide",
): CompleteProfile[] {
  const players = new Map<string, Map<GameId, PlayerAggregate>>();
  for (const aggregate of aggregates) {
    if (aggregate.input !== input || (aggregate.context ?? "wide") !== context)
      continue;
    let anchors = players.get(aggregate.playerId);
    if (!anchors) {
      anchors = new Map();
      players.set(aggregate.playerId, anchors);
    }
    const prior = anchors.get(aggregate.gameId);
    if (!prior || (aggregate.updatedAt ?? "") > (prior.updatedAt ?? ""))
      anchors.set(aggregate.gameId, aggregate);
  }
  const referenceMap = new Map(
    references.map((reference) => [
      `${reference.gameId}|${reference.input}|${reference.presentation ?? "wide"}`,
      {
        ...reference,
        sortedValues: [...reference.values].sort((a, b) => a - b),
      },
    ]),
  );
  return [...players].flatMap(([playerId, anchors]) => {
    const percentiles = new Map<GameId, number>();
    for (const id of gameIds) {
      const aggregate = anchors.get(id);
      if (!aggregate) return [];
      const reference = referenceMap.get(
        `${id}|${input}|${aggregate.presentation ?? "wide"}`,
      );
      if (!reference || reference.values.length < 100) return [];
      percentiles.set(
        id,
        midrankSorted(
          aggregate.value,
          reference.sortedValues,
          reference.higherIsBetter,
        ),
      );
    }
    const scores = categories.map((category) => {
      const anchors = games.filter((game) => game.category === category.id);
      return (
        (percentiles.get(anchors[0].id)! + percentiles.get(anchors[1].id)!) / 2
      );
    });
    return [
      {
        playerId,
        categories: scores,
        index: Math.round(
          (scores.reduce((sum, value) => sum + value, 0) / 6) * 10,
        ),
      },
    ];
  });
}

// Orthonormal Helmert contrasts remove overall level without inverting a singular 6D covariance.
export function profileShape(values: number[]): number[] {
  if (
    values.length !== 6 ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)
  )
    throw new Error(
      "Six finite category indices between 0 and 100 are required.",
    );
  const transformed = values.map((value) => {
    const p = Math.max(0.005, Math.min(0.995, value / 100));
    return Math.log(p / (1 - p));
  });
  return Array.from({ length: 5 }, (_, index) => {
    const divisor = Math.sqrt((index + 1) * (index + 2));
    return (
      (transformed.slice(0, index + 1).reduce((sum, value) => sum + value, 0) -
        (index + 1) * transformed[index + 1]) /
      divisor
    );
  });
}
interface ShapeFit {
  center: number[];
  covariance: number[][];
}
export interface RarityModel {
  version: 1;
  primary: ShapeFit;
  sensitivity: ShapeFit;
  distances: number[];
  sensitivityDistances: number[];
  n: number;
  healthy: boolean;
}
function fitShape(profiles: CompleteProfile[], shrinkage: number): ShapeFit {
  const vectors = profiles.map((profile) => profileShape(profile.categories));
  const center = Array.from(
    { length: 5 },
    (_, dimension) =>
      vectors.reduce((sum, vector) => sum + vector[dimension], 0) /
      vectors.length,
  );
  const raw = Array.from({ length: 5 }, (_, row) =>
    Array.from(
      { length: 5 },
      (_, col) =>
        vectors.reduce(
          (sum, vector) =>
            sum + (vector[row] - center[row]) * (vector[col] - center[col]),
          0,
        ) /
        (vectors.length - 1),
    ),
  );
  const target = raw.reduce((sum, row, index) => sum + row[index], 0) / 5;
  return {
    center,
    covariance: raw.map((row, i) =>
      row.map(
        (value, j) =>
          value * (1 - shrinkage) + (i === j ? target * shrinkage + 1e-6 : 0),
      ),
    ),
  };
}
function shapeDistance(values: number[], fit: ShapeFit): number {
  const delta = profileShape(values).map(
    (value, index) => value - fit.center[index],
  );
  const lower = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  for (let row = 0; row < 5; row++)
    for (let col = 0; col <= row; col++) {
      let value = fit.covariance[row][col];
      for (let k = 0; k < col; k++) value -= lower[row][k] * lower[col][k];
      lower[row][col] =
        row === col
          ? Math.sqrt(Math.max(value, 1e-12))
          : value / lower[col][col];
    }
  const solution = Array<number>(5).fill(0);
  for (let row = 0; row < 5; row++) {
    let value = delta[row];
    for (let col = 0; col < row; col++)
      value -= lower[row][col] * solution[col];
    solution[row] = value / lower[row][row];
  }
  return solution.reduce((sum, value) => sum + value * value, 0);
}
function tailScore(distance: number, calibration: number[]): number {
  return (
    (1 + calibration.filter((value) => value >= distance).length) /
    (calibration.length + 1)
  );
}
export function fitRarity(
  training: CompleteProfile[],
  calibration: CompleteProfile[],
  evaluation: CompleteProfile[],
): RarityModel | null {
  const all = [...training, ...calibration, ...evaluation];
  if (new Set(all.map((profile) => profile.playerId)).size !== all.length)
    throw new Error(
      "Rarity fitting, calibration, and evaluation must use disjoint players.",
    );
  if (
    training.length < 1000 ||
    calibration.length < 500 ||
    evaluation.length < 500
  )
    return null;
  const primary = fitShape(training, 0.15),
    sensitivity = fitShape(training, 0.3);
  const distances = calibration.map((profile) =>
    shapeDistance(profile.categories, primary),
  );
  const sensitivityDistances = calibration.map((profile) =>
    shapeDistance(profile.categories, sensitivity),
  );
  const tailRate =
    evaluation.filter(
      (profile) =>
        tailScore(shapeDistance(profile.categories, primary), distances) <=
        0.05,
    ).length / evaluation.length;
  return {
    version: 1,
    primary,
    sensitivity,
    distances,
    sensitivityDistances,
    n: all.length,
    healthy: tailRate >= 0.01 && tailRate <= 0.1,
  };
}
export function profileUnusualness(
  profile: CompleteProfile,
  model: RarityModel | null,
): Comparison {
  if (!model || !model.healthy)
    return {
      status: "unavailable",
      reason:
        "At least 2,000 independent complete profiles and passing held-out calibration checks are required.",
      n: model?.n ?? 0,
    };
  const distance = shapeDistance(profile.categories, model.primary);
  const unusualness = 100 * (1 - tailScore(distance, model.distances));
  const alternative =
    100 *
    (1 -
      tailScore(
        shapeDistance(profile.categories, model.sensitivity),
        model.sensitivityDistances,
      ));
  if (Math.abs(unusualness - alternative) > 10)
    return {
      status: "unavailable",
      reason:
        "This profile is sensitive to reasonable model choices. More evidence is needed.",
      n: model.n,
    };
  const tailInterval = wilsonInterval(
    model.distances.filter((value) => value >= distance).length,
    model.distances.length,
  );
  const interval: [number, number] = [
    Math.max(0, 100 * (1 - tailInterval[1])),
    Math.min(100, 100 * (1 - tailInterval[0])),
  ];
  return {
    status: "provisional",
    reason:
      "Profile-shape unusualness among comparable complete profiles. This is not profile-match frequency.",
    n: model.n,
    percentile: Math.min(95, Math.floor(unusualness / 5) * 5),
    interval,
  };
}
export function similarityFrequency(
  matches: number,
  n: number,
): {
  status: "unavailable" | "provisional";
  interval?: [number, number];
  reason: string;
} {
  if (
    !Number.isInteger(matches) ||
    !Number.isInteger(n) ||
    matches < 0 ||
    n < matches
  )
    throw new Error("Valid held-out match counts are required.");
  if (matches < 20 || n < 1000)
    return {
      status: "unavailable",
      reason:
        "A predefined similarity neighborhood and at least 20 independent matches among 1,000 held-out profiles are required.",
    };
  const z = 1.96,
    p = matches / n,
    denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const half =
    (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    status: "provisional",
    interval: [center - half, center + half],
    reason:
      "Similarity frequency interval for a neighborhood fixed independently of this evaluation sample. Do not confuse this with an anomaly tail.",
  };
}

function wilsonInterval(matches: number, n: number): [number, number] {
  const z = 1.96,
    p = matches / n,
    denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const half =
    (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [center - half, center + half];
}

function midrankSorted(
  value: number,
  sorted: number[],
  higherIsBetter: boolean,
): number {
  const bound = (strict: boolean) => {
    let low = 0,
      high = sorted.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (sorted[mid] < value || (!strict && sorted[mid] === value))
        low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const lower = bound(true),
    upper = bound(false),
    percentile = ((lower + 0.5 * (upper - lower)) / sorted.length) * 100;
  return higherIsBetter ? percentile : 100 - percentile;
}
