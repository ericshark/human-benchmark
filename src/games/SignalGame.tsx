import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Zap, Hand, Check, X } from "lucide-react";
import { seededRandom } from "../engine/random";
import { useScheduler } from "../engine/useScheduler";
import { DEADLINE } from "../domain/scoring";
import type { Trial } from "../domain/types";
import type { GameProps } from "./runtime-types";

export default function SignalGame({
  mode,
  seed,
  onComplete,
  variant = "classic",
}: GameProps) {
  const [stage, setStage] = useState<"wait" | "go" | "feedback">("wait");
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const state = useRef({
    stage: "wait",
    onset: 0,
    trials: [] as Trial[],
    random: seededRandom(seed),
  });
  const { schedule, frame, clear } = useScheduler();
  const limit = mode === "practice" ? 3 : 12;
  const finishRef = useRef(onComplete);
  finishRef.current = onComplete;
  useEffect(() => {
    const current = state.current;
    function begin() {
      current.stage = "wait";
      setStage("wait");
      schedule(
        () =>
          frame(() => {
            if (current.stage !== "wait") return;
            flushSync(() => setStage("go"));
            current.onset = performance.now();
            current.stage = "go";
            schedule(() => {
              if (current.stage === "go") record("timeout", performance.now());
            }, DEADLINE);
          }),
        (variant === "remix" ? 300 : 1000) +
          current.random() * (variant === "remix" ? 700 : 1800),
      );
    }
    function record(outcome: Trial["outcome"], now: number, eventAt?: number) {
      if (current.stage === "feedback") return;
      clear();
      current.stage = "feedback";
      setStage("feedback");
      const latency =
        outcome === "correct" ? Math.max(0, now - current.onset) : DEADLINE;
      current.trials.push({
        index: current.trials.length,
        outcome,
        latency,
        stimulusAt: outcome === "false-start" ? now : current.onset,
        respondedAt: now,
        eventAt,
        handlerAt: now,
      });
      setCount(current.trials.length);
      setFeedback(
        outcome === "correct"
          ? `${Math.round(latency)} ms`
          : outcome === "false-start"
            ? "A little too soon"
            : "Signal missed",
      );
      schedule(
        () =>
          current.trials.length >= limit
            ? finishRef.current([...current.trials])
            : begin(),
        650,
      );
    }
    function respond(event: KeyboardEvent | PointerEvent) {
      if (
        event instanceof KeyboardEvent &&
        event.target instanceof Element &&
        event.target.closest("button,a,input,select,textarea,summary")
      )
        return;
      if (
        event instanceof KeyboardEvent &&
        (event.code !== "Space" || event.repeat)
      )
        return;
      if (
        event instanceof PointerEvent &&
        (!event.isPrimary || event.button !== 0)
      )
        return;
      event.preventDefault();
      if (current.stage === "wait")
        record("false-start", performance.now(), event.timeStamp);
      else if (current.stage === "go")
        record("correct", performance.now(), event.timeStamp);
    }
    const arena = document.getElementById("signal-arena");
    const pointer = (event: PointerEvent) => respond(event);
    window.addEventListener("keydown", respond);
    arena?.addEventListener("pointerdown", pointer);
    begin();
    return () => {
      clear();
      window.removeEventListener("keydown", respond);
      arena?.removeEventListener("pointerdown", pointer);
    };
  }, [clear, frame, limit, schedule, variant]);
  return (
    <>
      <div className="round-line">
        <span>
          TRIAL {Math.min(count + 1, limit)}{" "}
          <span className="muted">/ {limit}</span>
        </span>
        <span>
          {mode === "practice" ? "Practice · not saved" : "Local assessment"}
        </span>
      </div>
      <div
        className={`signal-arena ${stage}`}
        id="signal-arena"
        role="button"
        tabIndex={0}
        aria-label={
          stage === "go"
            ? "React now"
            : stage === "wait"
              ? "Wait for the signal"
              : feedback
        }
      >
        <div className="signal-icon">
          {stage === "go" ? (
            <Zap size={64} fill="currentColor" />
          ) : stage === "wait" ? (
            <Hand size={56} />
          ) : feedback.includes("ms") ? (
            <Check size={56} />
          ) : (
            <X size={56} />
          )}
        </div>
        <h2>
          {stage === "go" ? "Now." : stage === "wait" ? "Hold." : feedback}
        </h2>
        <p>
          {stage === "go"
            ? "Click, tap, or press Space"
            : stage === "wait"
              ? "Wait for the signal to appear"
              : count < limit
                ? "Take a breath. Next signal coming."
                : "Your results are ready."}
        </p>
      </div>
      <div className="trial-dots">
        {Array.from({ length: limit }, (_, index) => (
          <span key={index} className={index < count ? "complete" : ""} />
        ))}
      </div>
    </>
  );
}
