import type { GameId, GameResult, Metric, Session, Trial } from "./types";

export const DEADLINE = 2500;
export function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}
export function quantile(values: number[], proportion: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const offset = (sorted.length - 1) * proportion;
  const lower = Math.floor(offset);
  return (
    sorted[lower] +
    (sorted[Math.ceil(offset)] - sorted[lower]) * (offset - lower)
  );
}
export function median(values: number[]): number {
  return quantile(values, 0.5);
}
const metric = (
  label: string,
  value: number,
  unit = "",
  digits = 0,
): Metric => ({ label, value, unit, digits });

export function scoreGame(
  gameId: GameId,
  trials: Trial[],
  elapsedSeconds?: number,
): GameResult {
  const correct = trials.filter((trial) => trial.outcome === "correct");
  const accuracy = trials.length ? (correct.length / trials.length) * 100 : 0;
  const latencies = correct.map((trial) => trial.latency);
  const medianTime = median(latencies);
  const errors = trials.length - correct.length;
  const penalized = mean(
    trials.map((trial) =>
      trial.outcome === "correct"
        ? Math.min(DEADLINE, trial.latency)
        : DEADLINE,
    ),
  );
  const base = { accuracy, correct: correct.length, total: trials.length };
  const common = [
    metric("Accuracy", accuracy, "%"),
    metric("Correct responses", correct.length),
    metric("Median response", medianTime, "ms"),
  ];
  if (gameId === "grid-recall" || gameId === "echo-path") {
    const lastLevels = trials.slice(-6).map((trial) => trial.level ?? 0);
    const estimate = mean(lastLevels);
    const levels = correct.map((trial) => trial.level ?? 0);
    return {
      ...base,
      primary: metric("Staircase level", estimate, "items", 1),
      rankingValue: estimate,
      higherIsBetter: true,
      metrics: [
        metric(
          "Highest passed",
          levels.length ? Math.max(...levels) : 0,
          "items",
        ),
        metric("Exact recalls", correct.length),
        metric("Recall accuracy", accuracy, "%"),
        metric(
          "False selections",
          trials.reduce((sum, trial) => sum + (trial.error ?? 0), 0),
        ),
      ],
    };
  }
  if (gameId === "pattern-forge" || gameId === "rotation-lab") {
    const possible = trials.reduce((sum, trial) => sum + (trial.level ?? 1), 0);
    const earned = correct.reduce((sum, trial) => sum + (trial.level ?? 1), 0);
    const weighted = possible ? (100 * earned) / possible : 0;
    return {
      ...base,
      primary: metric("Weighted accuracy", weighted, "%"),
      rankingValue: weighted,
      higherIsBetter: true,
      metrics: [
        metric("Solved", correct.length),
        metric("Questions", trials.length),
        metric("Median solve time", medianTime / 1000, "s", 1),
        metric("Accuracy", accuracy, "%"),
      ],
    };
  }
  if (gameId === "symbol-match" || gameId === "math-sprint") {
    const seconds = elapsedSeconds ?? 45;
    const net = trials.reduce(
      (sum, trial) =>
        sum +
        (trial.outcome === "correct"
          ? 1
          : trial.outcome === "wrong"
            ? -1 / ((trial.choices ?? 4) - 1)
            : 0),
      0,
    );
    const rate = seconds > 0 ? (net * 60) / seconds : 0;
    return {
      ...base,
      primary: metric("Net correct / minute", rate, "/min", 1),
      rankingValue: rate,
      higherIsBetter: true,
      metrics: [
        metric("Correct", correct.length),
        metric("Errors", errors),
        metric("Accuracy", accuracy, "%"),
        metric("Median decision", medianTime, "ms"),
      ],
    };
  }
  if (gameId === "orbit-track") {
    const totalDuration = trials.reduce(
      (sum, trial) => sum + (trial.duration ?? 0),
      0,
    );
    const error = totalDuration
      ? trials.reduce(
          (sum, trial) => sum + (trial.error ?? 3) * (trial.duration ?? 0),
          0,
        ) / totalDuration
      : 3;
    const inside = totalDuration
      ? (correct.reduce((sum, trial) => sum + (trial.duration ?? 0), 0) /
          totalDuration) *
        100
      : 0;
    return {
      ...base,
      accuracy: inside,
      primary: metric("Time on target", inside, "%"),
      rankingValue: error,
      higherIsBetter: false,
      metrics: [
        metric("Mean tracking error", error, "radii", 2),
        metric("Tracked time", totalDuration / 1000, "s", 1),
        metric("Time on target", inside, "%"),
      ],
    };
  }
  if (gameId === "signal")
    return {
      ...base,
      primary: metric("Median reaction", medianTime, "ms"),
      rankingValue: penalized,
      higherIsBetter: false,
      metrics: [
        metric(
          "Best valid reaction",
          latencies.length ? Math.min(...latencies) : 0,
          "ms",
        ),
        metric(
          "Consistency · IQR",
          quantile(latencies, 0.75) - quantile(latencies, 0.25),
          "ms",
        ),
        metric(
          "False starts",
          trials.filter((trial) => trial.outcome === "false-start").length,
        ),
        metric(
          "Missed signals",
          trials.filter((trial) => trial.outcome === "timeout").length,
        ),
      ],
    };
  if (gameId === "target-burst")
    return {
      ...base,
      primary: metric("Median acquisition", medianTime, "ms"),
      rankingValue: penalized,
      higherIsBetter: false,
      metrics: [
        metric("Hit rate", accuracy, "%"),
        metric("Misses", errors),
        metric(
          "Endpoint error",
          mean(correct.map((trial) => trial.error ?? 0)),
          "radii",
          2,
        ),
        metric("Penalized average", penalized, "ms"),
      ],
    };
  let extra: Metric[] = [];
  if (gameId === "color-conflict" || gameId === "rule-shift") {
    const first = gameId === "color-conflict" ? "congruent" : "repeat";
    const second = gameId === "color-conflict" ? "incongruent" : "switch";
    const baseline = correct.filter((trial) => trial.condition === first);
    const condition = correct.filter((trial) => trial.condition === second);
    if (baseline.length && condition.length)
      extra = [
        metric(
          gameId === "color-conflict" ? "Interference cost" : "Switch cost",
          median(condition.map((trial) => trial.latency)) -
            median(baseline.map((trial) => trial.latency)),
          "ms",
        ),
      ];
  }
  return {
    ...base,
    primary: metric("Median correct response", medianTime, "ms"),
    rankingValue: penalized,
    higherIsBetter: false,
    metrics: [
      ...common,
      ...extra,
      metric("Penalized average", penalized, "ms"),
    ],
  };
}
export function scoreSession(session: Session): GameResult {
  if (session.recordingExpired && session.archivedResult)
    return session.archivedResult;
  return scoreGame(
    session.gameId,
    session.trials,
    session.mode === "practice" &&
      (session.gameId === "math-sprint" || session.gameId === "symbol-match")
      ? 15
      : undefined,
  );
}
export function formatMetric(metricValue: Metric): string {
  return `${metricValue.value.toLocaleString(undefined, { maximumFractionDigits: metricValue.digits ?? 0, minimumFractionDigits: metricValue.digits ?? 0 })}${metricValue.unit === "%" ? "%" : metricValue.unit ? ` ${metricValue.unit}` : ""}`;
}
export function comparable(a: Session, b: Session): boolean {
  return (
    a.gameId === b.gameId &&
    a.mode === b.mode &&
    a.version === b.version &&
    a.input === b.input &&
    !a.flags.length &&
    !b.flags.length
  );
}
export function bestSession(sessions: Session[]): Session | undefined {
  return sessions
    .filter((session) => !session.flags.length)
    .reduce<Session | undefined>((best, session) => {
      if (!best) return session;
      const current = scoreSession(session),
        previous = scoreSession(best);
      return (
        current.higherIsBetter
          ? current.rankingValue > previous.rankingValue
          : current.rankingValue < previous.rankingValue
      )
        ? session
        : best;
    }, undefined);
}

export function hasPrimaryMeasurement(session: Session): boolean {
  return (
    ![
      "signal",
      "crossroads",
      "color-conflict",
      "rule-shift",
      "target-burst",
    ].includes(session.gameId) || scoreSession(session).correct > 0
  );
}
export function formatPrimary(session: Session): string {
  return hasPrimaryMeasurement(session)
    ? formatMetric(scoreSession(session).primary)
    : "No valid responses";
}
