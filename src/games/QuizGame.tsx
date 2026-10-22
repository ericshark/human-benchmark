import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, X } from "lucide-react";
import { seededRandom, shuffle } from "../engine/random";
import { useScheduler } from "../engine/useScheduler";
import type { Trial } from "../domain/types";
import { makeQuestion, symbols, colors, type Question } from "./generators";
import type { GameProps } from "./runtime-types";

export function Figure({ cells, label }: { cells: number[]; label?: string }) {
  return (
    <div className="figure" aria-label={label}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={cells.includes(index) ? "filled" : ""} />
      ))}
    </div>
  );
}
export default function QuizGame({
  gameId,
  mode,
  seed,
  onComplete,
}: GameProps) {
  const random = useRef(seededRandom(seed));
  const legend = useRef(shuffle([1, 2, 3, 4], random.current));
  const [question, setQuestion] = useState<Question | null>(null);
  const [count, setCount] = useState(0),
    [remaining, setRemaining] = useState(mode === "practice" ? 15 : 45);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    explanation?: string;
  } | null>(null);
  const current = useRef({
    question: null as Question | null,
    onset: 0,
    started: 0,
    accepting: false,
    finished: false,
    trials: [] as Trial[],
    previousRule: 0,
  });
  const { schedule, frame, clear } = useScheduler();
  const timed = gameId === "symbol-match" || gameId === "math-sprint";
  const limit =
    mode === "practice"
      ? 4
      : gameId === "pattern-forge"
        ? 12
        : gameId === "rotation-lab"
          ? 16
          : gameId === "crossroads"
            ? 30
            : 40;
  const duration = mode === "practice" ? 15000 : 45000;
  const deadline =
    gameId === "pattern-forge"
      ? 15000
      : gameId === "rotation-lab"
        ? 8000
        : 2500;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const answerRef = useRef<(answer: number, eventAt?: number) => void>(
    () => {},
  );
  useEffect(() => {
    const state = current.current;
    const order = shuffle(
      Array.from({ length: limit }, (_, index) => index),
      random.current,
    );
    let block = shuffle(
      Array.from({ length: 12 }, (_, index) => index),
      random.current,
    );
    state.started = performance.now();
    function finish() {
      if (state.finished) return;
      if (timed && state.accepting && state.question) {
        const now = performance.now();
        state.trials.push({
          index: state.trials.length,
          outcome: "timeout",
          stimulusAt: state.onset,
          respondedAt: now,
          latency: Math.max(0, now - state.onset),
          condition: state.question.condition,
          choices: state.question.options.length,
        });
      }
      state.finished = true;
      state.accepting = false;
      clear();
      if (state.trials.length) completeRef.current([...state.trials]);
    }
    function show() {
      if (state.finished) return;
      const index = state.trials.length;
      if (timed && index % 12 === 0)
        block = shuffle(
          Array.from({ length: 12 }, (_, item) => item),
          random.current,
        );
      const questionIndex = timed
        ? block[index % 12]
        : gameId === "rule-shift"
          ? index
          : order[index];
      const next = makeQuestion(
        gameId,
        questionIndex,
        random.current,
        legend.current,
        state.previousRule,
      );
      state.previousRule = next.level;
      frame(() => {
        flushSync(() => {
          setQuestion(next);
          setFeedback(null);
        });
        state.question = next;
        state.onset = performance.now();
        state.accepting = true;
        if (!timed)
          schedule(() => {
            if (state.accepting && state.question === next) answer(-1);
          }, deadline);
      });
    }
    function answer(selected: number, eventAt?: number) {
      if (!state.accepting || state.finished || !state.question) return;
      const now = performance.now();
      if (timed && now - state.started >= duration) {
        finish();
        return;
      }
      state.accepting = false;
      const active = state.question,
        correct = selected === active.answer;
      state.trials.push({
        index: state.trials.length,
        outcome: selected === -1 ? "timeout" : correct ? "correct" : "wrong",
        stimulusAt: state.onset,
        respondedAt: now,
        eventAt,
        handlerAt: now,
        latency: Math.max(0, now - state.onset),
        condition: active.condition,
        level: active.level,
        expected: active.options[active.answer],
        response: active.options[selected] ?? "timeout",
        choices: active.options.length,
      });
      setCount(state.trials.length);
      setFeedback({ correct, explanation: active.explanation });
      if (!timed && state.trials.length >= limit) schedule(finish, 700);
      else schedule(show, active.explanation ? 650 : 130);
    }
    answerRef.current = answer;
    function keyboard(event: KeyboardEvent) {
      if (event.repeat) return;
      const selected =
        gameId === "crossroads"
          ? ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"].indexOf(
              event.key,
            )
          : ["1", "2", "3", "4"].indexOf(event.key);
      if (selected >= 0 && selected < (state.question?.options.length ?? 0)) {
        event.preventDefault();
        answer(selected, event.timeStamp);
      }
    }
    window.addEventListener("keydown", keyboard);
    if (timed) {
      function tick() {
        const left = Math.max(
          0,
          duration - (performance.now() - state.started),
        );
        setRemaining(Math.ceil(left / 1000));
        if (!left) finish();
        else schedule(tick, 100);
      }
      schedule(tick, 100);
    }
    show();
    return () => {
      state.finished = true;
      clear();
      window.removeEventListener("keydown", keyboard);
    };
  }, [clear, deadline, duration, frame, gameId, limit, schedule, timed]);
  if (!question) return <div className="quiz-arena">Getting ready…</div>;
  return (
    <>
      <div className="round-line">
        <span>
          {timed
            ? `${count} ANSWERED`
            : `QUESTION ${Math.min(count + (feedback ? 0 : 1), limit)} / ${limit}`}
        </span>
        <span>
          {timed
            ? `${remaining}s remaining`
            : `${deadline / 1000}s per question`}
        </span>
      </div>
      {gameId === "symbol-match" && (
        <div className="symbol-legend">
          {symbols.map((symbol, index) => (
            <div key={symbol}>
              <span>{symbol}</span>
              <span className="muted">=</span>
              <strong>{legend.current[index]}</strong>
            </div>
          ))}
        </div>
      )}
      <div className={`quiz-arena ${gameId}`}>
        <span className="eyebrow">
          {question.cue ?? "CHOOSE THE DIRECTION"}
        </span>
        {question.figure ? (
          <div className="rotation-question">
            <div>
              <span className="muted">Reference</span>
              <Figure cells={question.figure} label="Reference shape" />
            </div>
            <div className="rotation-arrow">
              ↻<strong>{question.text}</strong>
            </div>
          </div>
        ) : (
          <div
            className={`question ${question.shape ?? ""}`}
            style={{ color: question.ink }}
          >
            {question.text}
          </div>
        )}
        <div className="question-feedback" aria-live="polite">
          {feedback && (
            <span className={feedback.correct ? "success-text" : "error-text"}>
              {feedback.correct ? <Check size={17} /> : <X size={17} />}
              {feedback.explanation ??
                (feedback.correct ? "Nice." : "Keep going.")}
            </span>
          )}
        </div>
        <div
          className={`answer-options ${question.options.length === 2 ? "two" : ""}`}
        >
          {question.options.map((option, index) => (
            <button
              key={index}
              className="answer-button"
              onClick={(event) => answerRef.current(index, event.timeStamp)}
              disabled={!!feedback}
              aria-label={question.figures ? `Option ${option}` : option}
            >
              {question.figures ? (
                <Figure cells={question.figures[index]} />
              ) : (
                <span
                  style={
                    gameId === "color-conflict"
                      ? { color: colors[index].ink }
                      : undefined
                  }
                >
                  {option}
                </span>
              )}
              <kbd>{gameId === "crossroads" ? option : index + 1}</kbd>
            </button>
          ))}
        </div>
      </div>
      <p className="arena-hint">
        {gameId === "crossroads"
          ? "Use your arrow keys or the direction buttons."
          : "Use the number keys or select an answer."}
      </p>
    </>
  );
}
