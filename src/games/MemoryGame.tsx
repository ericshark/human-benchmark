import { useEffect, useRef, useState } from "react";
import { Check, Eye, Hand, Send, X } from "lucide-react";
import { seededRandom } from "../engine/random";
import { useScheduler } from "../engine/useScheduler";
import { memoryPattern, nextMemoryLevel } from "./generators";
import type { Trial } from "../domain/types";
import type { GameProps } from "./runtime-types";

type Phase = "show" | "input" | "feedback";
export default function MemoryGame({
  gameId,
  mode,
  seed,
  onComplete,
  variant = "classic",
}: GameProps) {
  const sequence = gameId === "echo-path",
    limit = mode === "practice" ? 3 : 12;
  const [phase, setPhase] = useState<Phase>("show"),
    [lit, setLit] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]),
    [count, setCount] = useState(0),
    [level, setLevel] = useState(3);
  const [correct, setCorrect] = useState(false);
  const state = useRef({
    phase: "show" as Phase,
    pattern: [] as number[],
    selected: [] as number[],
    level: 3,
    streak: 0,
    onset: 0,
    trials: [] as Trial[],
  });
  const { schedule, clear } = useScheduler();
  const submitRef = useRef<() => void>(() => {}),
    selectRef = useRef<(cell: number) => void>(() => {});
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    const current = state.current,
      random = seededRandom(seed);
    function begin() {
      current.phase = "show";
      current.selected = [];
      current.pattern = memoryPattern(current.level, sequence, random);
      setPhase("show");
      setSelected([]);
      setLevel(current.level);
      const input = () => {
        if (sequence && mode === "practice" && variant === "remix")
          current.pattern.reverse();
        setLit([]);
        setPhase("input");
        current.phase = "input";
        current.onset = performance.now();
        schedule(() => {
          if (current.phase === "input") submit(true);
        }, 15000);
      };
      if (sequence) {
        setLit([]);
        current.pattern.forEach((cell, index) => {
          schedule(() => setLit([cell]), 450 + index * 650);
          schedule(() => setLit([]), 900 + index * 650);
        });
        schedule(input, 500 + current.pattern.length * 650);
      } else {
        setLit(current.pattern);
        schedule(
          input,
          variant === "remix" && mode === "practice"
            ? 650
            : 1500 + current.level * 100,
        );
      }
    }
    function submit(timeout = false) {
      if (current.phase !== "input") return;
      clear();
      current.phase = "feedback";
      setPhase("feedback");
      setLit(current.pattern);
      const now = performance.now();
      const expected = sequence
        ? current.pattern
        : [...current.pattern].sort((a, b) => a - b);
      const response = sequence
        ? current.selected
        : [...current.selected].sort((a, b) => a - b);
      const passed = expected.join() === response.join() && !timeout;
      const falseSelections = sequence
        ? response.filter((cell, index) => cell !== expected[index]).length
        : response.filter((cell) => !expected.includes(cell)).length;
      current.trials.push({
        index: current.trials.length,
        outcome: timeout ? "timeout" : passed ? "correct" : "wrong",
        stimulusAt: current.onset,
        respondedAt: now,
        latency: now - current.onset,
        level: current.level,
        expected: expected.join(","),
        response: response.join(","),
        error: falseSelections,
      });
      setCorrect(passed);
      setCount(current.trials.length);
      const next = nextMemoryLevel(current.level, current.streak, passed);
      current.level = next.level;
      current.streak = next.streak;
      schedule(
        () =>
          current.trials.length >= limit
            ? completeRef.current([...current.trials])
            : begin(),
        1100,
      );
    }
    function select(cell: number) {
      if (current.phase !== "input") return;
      if (sequence) current.selected.push(cell);
      else
        current.selected = current.selected.includes(cell)
          ? current.selected.filter((item) => item !== cell)
          : [...current.selected, cell];
      setSelected([...current.selected]);
      if (sequence && current.selected.length === current.pattern.length)
        submit();
    }
    function keyboard(event: KeyboardEvent) {
      if (event.repeat || !sequence || !/^[1-9]$/.test(event.key)) return;
      event.preventDefault();
      select(Number(event.key) - 1);
    }
    submitRef.current = () => submit();
    selectRef.current = select;
    window.addEventListener("keydown", keyboard);
    begin();
    return () => {
      clear();
      window.removeEventListener("keydown", keyboard);
    };
  }, [clear, limit, schedule, seed, sequence, mode, variant]);
  return (
    <>
      <div className="round-line">
        <span>
          ROUND {Math.min(count + (phase === "feedback" ? 0 : 1), limit)} /{" "}
          {limit}
        </span>
        <span>
          {level} {sequence ? "steps" : "cells"} · 15s to recall
        </span>
      </div>
      <div className="memory-arena">
        <div className="memory-prompt" aria-live="polite">
          {phase === "show" ? (
            <>
              <Eye size={19} />
              Watch closely
            </>
          ) : phase === "input" ? (
            <>
              <Hand size={19} />
              {sequence
                ? variant === "remix" && mode === "practice"
                  ? "Replay the path in reverse"
                  : "Replay the path"
                : "Rebuild the constellation"}
            </>
          ) : correct ? (
            <>
              <Check size={19} />
              Exactly right
            </>
          ) : (
            <>
              <X size={19} />
              Here’s the pattern
            </>
          )}
        </div>
        <div className={`memory-grid ${sequence ? "sequence-grid" : ""}`}>
          {Array.from({ length: sequence ? 9 : 16 }, (_, cell) => (
            <button
              key={cell}
              disabled={phase !== "input"}
              aria-label={`Cell ${cell + 1}`}
              aria-pressed={selected.includes(cell)}
              onClick={() => selectRef.current(cell)}
              className={`${lit.includes(cell) ? "lit" : ""} ${selected.includes(cell) && phase === "input" ? "selected" : ""}`}
            >
              {sequence ? (
                <span>{cell + 1}</span>
              ) : selected.includes(cell) && phase === "input" ? (
                <Check size={23} />
              ) : null}
            </button>
          ))}
        </div>
        <div className="memory-footer">
          {!sequence && phase === "input" ? (
            <button
              className="button primary"
              onClick={() => submitRef.current()}
            >
              <Send size={16} />
              Submit {selected.length} cells
            </button>
          ) : (
            <span className="muted">
              {sequence && phase === "input"
                ? `${selected.length} / ${level} steps · use pads or keys 1–9`
                : phase === "show"
                  ? "The lights will disappear shortly."
                  : "Take a breath between rounds."}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
