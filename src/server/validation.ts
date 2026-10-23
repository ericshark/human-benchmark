import { sessionSchema, type Session } from "../domain/types";
import { scoreSession } from "../domain/scoring";
import {
  makeQuestion,
  memoryPattern,
  nextMemoryLevel,
} from "../games/generators";
import { seededRandom, shuffle } from "../engine/random";

const counts: Partial<Record<Session["gameId"], number>> = {
  signal: 12,
  crossroads: 30,
  "grid-recall": 12,
  "echo-path": 12,
  "color-conflict": 40,
  "rule-shift": 40,
  "pattern-forge": 12,
  "rotation-lab": 16,
  "target-burst": 30,
};
export function validateSession(payload: unknown, ranked = false): Session {
  const session = sessionSchema.parse(payload);
  if (session.recordingExpired) {
    if (ranked)
      throw new Error(
        "The assessment recording is archived and cannot be submitted as a new rated session.",
      );
    return session;
  }
  if (Date.parse(session.completedAt) < Date.parse(session.startedAt))
    throw new Error("Session timestamps are reversed.");
  if (ranked && session.mode !== "assessment")
    throw new Error(
      "Only standard assessments can contribute to reference statistics.",
    );
  if (
    ranked &&
    counts[session.gameId] &&
    session.trials.length !== counts[session.gameId]
  )
    throw new Error("The assessment trial count is incomplete.");
  for (const [index, trial] of session.trials.entries()) {
    if (trial.index !== index || trial.respondedAt < trial.stimulusAt)
      throw new Error("Trial indices or timestamps are inconsistent.");
    if (
      trial.outcome !== "false-start" &&
      Math.abs(trial.respondedAt - trial.stimulusAt - trial.latency) > 10
    )
      throw new Error("Trial latency does not match its event timestamps.");
    if (index && trial.stimulusAt < session.trials[index - 1].stimulusAt)
      throw new Error("Stimulus timestamps must be monotonic.");
  }
  if (
    ranked &&
    [
      "crossroads",
      "color-conflict",
      "rule-shift",
      "pattern-forge",
      "rotation-lab",
      "symbol-match",
      "math-sprint",
    ].includes(session.gameId)
  ) {
    const random = seededRandom(session.seed),
      legend = shuffle([1, 2, 3, 4], random);
    const limit = counts[session.gameId] ?? 40;
    const order = shuffle(
      Array.from({ length: limit }, (_, index) => index),
      random,
    );
    let block = shuffle(
        Array.from({ length: 12 }, (_, index) => index),
        random,
      ),
      previousRule = 0;
    const timed =
      session.gameId === "symbol-match" || session.gameId === "math-sprint";
    for (const [index, trial] of session.trials.entries()) {
      if (timed && index % 12 === 0)
        block = shuffle(
          Array.from({ length: 12 }, (_, item) => item),
          random,
        );
      const questionIndex = timed
        ? block[index % 12]
        : session.gameId === "rule-shift"
          ? index
          : order[index];
      const question = makeQuestion(
        session.gameId,
        questionIndex,
        random,
        legend,
        previousRule,
      );
      previousRule = question.level;
      if (trial.condition !== question.condition)
        throw new Error("The challenge does not match its issued seed.");
      if (trial.outcome === "timeout") continue;
      if (
        trial.expected !== question.options[question.answer] ||
        !question.options.includes(trial.response ?? "") ||
        (trial.outcome === "correct") !== (trial.response === trial.expected) ||
        trial.level !== question.level ||
        trial.choices !== question.options.length
      )
        throw new Error(
          "A submitted answer or correctness flag is inconsistent.",
        );
    }
  }
  if (ranked && ["grid-recall", "echo-path"].includes(session.gameId)) {
    const sequence = session.gameId === "echo-path",
      random = seededRandom(session.seed);
    let level = 3,
      streak = 0;
    for (const trial of session.trials) {
      const pattern = memoryPattern(level, sequence, random);
      const expected = (
        sequence ? pattern : pattern.sort((a, b) => a - b)
      ).join(",");
      const response = (trial.response ?? "")
        .split(",")
        .filter(Boolean)
        .map(Number);
      if (
        response.some(
          (value) =>
            !Number.isInteger(value) ||
            value < 0 ||
            value > (sequence ? 8 : 15),
        ) ||
        (!sequence && new Set(response).size !== response.length)
      )
        throw new Error("Invalid memory response.");
      const correct =
        trial.outcome !== "timeout" && response.join(",") === expected;
      if (
        trial.expected !== expected ||
        trial.level !== level ||
        (trial.outcome === "correct") !== correct
      )
        throw new Error("Memory recall does not match its issued pattern.");
      const falseSelections = sequence
        ? response.filter((value, index) => value !== pattern[index]).length
        : response.filter((value) => !pattern.includes(value)).length;
      if (trial.error !== falseSelections)
        throw new Error("Memory error count is inconsistent.");
      const next = nextMemoryLevel(level, streak, correct);
      level = next.level;
      streak = next.streak;
    }
  }
  if (ranked && session.gameId === "signal") {
    for (const trial of session.trials)
      if (
        trial.outcome === "wrong" ||
        (trial.outcome === "false-start" && trial.latency !== 2500)
      )
        throw new Error("Invalid reaction outcome.");
  }
  if (ranked && session.gameId === "target-burst") {
    if (!session.arena) throw new Error("Invalid target arena provenance.");
    const { width, height } = session.arena,
      random = seededRandom(session.seed);
    for (const [index, trial] of session.trials.entries()) {
      const radius = [
        Math.max(12, Math.min(width, height) * 0.045),
        Math.max(16, Math.min(width, height) * 0.065),
        Math.max(22, Math.min(width, height) * 0.085),
      ][index % 3];
      const x = radius + 12 + random() * (width - 2 * radius - 24),
        y = radius + 12 + random() * (height - 2 * radius - 24);
      if (
        trial.expected !== `${x.toFixed(2)},${y.toFixed(2)}` ||
        Math.abs((trial.level ?? 0) - radius) > 0.001
      )
        throw new Error("Invalid target position or size for this seed.");
      if (trial.outcome === "timeout") continue;
      const coordinates = (trial.response ?? "").split(",").map(Number);
      if (
        coordinates.length !== 2 ||
        coordinates.some((value) => !Number.isFinite(value))
      )
        throw new Error("Invalid target pointer coordinates.");
      const error = Math.hypot(coordinates[0] - x, coordinates[1] - y) / radius;
      if (
        trial.outcome === "false-start" ||
        trial.error === undefined ||
        Math.abs(trial.error - error) > 0.01 ||
        (trial.outcome === "correct") !== error <= 1
      )
        throw new Error("Invalid target acquisition.");
    }
  }
  if (ranked && session.gameId === "orbit-track") {
    if (!session.arena) throw new Error("Invalid tracking arena provenance.");
    const { width, height } = session.arena,
      random = seededRandom(session.seed),
      phase = random() * Math.PI * 2;
    const radius = Math.max(18, Math.min(width, height) * 0.075);
    let elapsed = 0;
    for (const trial of session.trials) {
      const delta = trial.duration ?? 0;
      elapsed += delta;
      const middle = Math.max(0, elapsed - delta / 2),
        segment = Math.min(2, Math.floor(middle / 15000)),
        seconds = middle / 1000;
      const x =
          width *
          (0.5 + 0.33 * Math.sin(seconds * (0.65 + segment * 0.12) + phase)),
        y =
          height *
          (0.5 + 0.3 * Math.sin(seconds * (1.1 + segment * 0.1) + phase / 2));
      const coordinates = (trial.response ?? "outside").split(",").map(Number);
      const error =
        trial.response === "outside"
          ? 3
          : coordinates.length === 2 && coordinates.every(Number.isFinite)
            ? Math.min(
                3,
                Math.hypot(coordinates[0] - x, coordinates[1] - y) / radius,
              )
            : NaN;
      if (
        !Number.isFinite(error) ||
        Math.abs((trial.error ?? 99) - error) > 0.015
      )
        throw new Error("Invalid tracking pointer measurement.");
    }
    const duration = session.trials.reduce(
      (sum, trial) => sum + (trial.duration ?? 0),
      0,
    );
    if (
      Math.abs(duration - 45000) > 100 ||
      session.trials.some(
        (trial) =>
          trial.error === undefined ||
          trial.error > 3 ||
          (trial.outcome === "correct") !== trial.error <= 1 ||
          !trial.duration,
      )
    )
      throw new Error("Invalid time-weighted tracking record.");
  }
  const derived = scoreSession(session);
  if (!Number.isFinite(derived.rankingValue))
    throw new Error("The resulting score is not finite.");
  return session;
}
export function referenceEligibility(session: Session): boolean {
  if (session.flags.length) return false;
  if (
    ["signal", "crossroads", "color-conflict", "rule-shift"].includes(
      session.gameId,
    ) &&
    session.trials.some(
      (trial) => trial.outcome === "correct" && trial.latency < 50,
    )
  )
    return false;
  if (
    session.gameId === "orbit-track" &&
    session.trials.some((trial) => (trial.duration ?? 0) > 250)
  )
    return false;
  return true;
}
