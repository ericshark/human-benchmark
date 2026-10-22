import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Crosshair } from "lucide-react";
import { seededRandom } from "../engine/random";
import { useScheduler } from "../engine/useScheduler";
import { DEADLINE } from "../domain/scoring";
import type { Trial } from "../domain/types";
import type { GameProps } from "./runtime-types";

export default function PrecisionGame({
  gameId,
  mode,
  seed,
  onComplete,
}: GameProps) {
  const tracking = gameId === "orbit-track";
  const limit = mode === "practice" ? 5 : 30,
    segmentDuration = mode === "practice" ? 5000 : 15000;
  const [count, setCount] = useState(0),
    [remaining, setRemaining] = useState(
      tracking ? (segmentDuration / 1000) * 3 : 0,
    );
  const [target, setTarget] = useState({ x: 50, y: 50, radius: 24 });
  const [inside, setInside] = useState(false),
    [flash, setFlash] = useState("");
  const arena = useRef<HTMLDivElement>(null),
    targetElement = useRef<HTMLDivElement>(null);
  const current = useRef({
    onset: 0,
    active: false,
    finished: false,
    trials: [] as Trial[],
    target: { x: 50, y: 50, radius: 24 },
    pointer: null as { x: number; y: number } | null,
  });
  const { frame, schedule, clear } = useScheduler();
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const hitRef = useRef<(x: number, y: number, eventAt: number) => void>(
    () => {},
  );
  useEffect(() => {
    const state = current.current,
      element = arena.current;
    if (!element) return;
    const rect = element.getBoundingClientRect(),
      random = seededRandom(seed);
    const width = rect.width,
      height = rect.height;
    function complete() {
      if (state.finished) return;
      state.finished = true;
      state.active = false;
      clear();
      completeRef.current([...state.trials]);
    }
    if (tracking) {
      const phase = random() * Math.PI * 2,
        duration = segmentDuration * 3;
      const radius = Math.max(18, Math.min(width, height) * 0.075);
      const start = performance.now();
      let last = start,
        lastSecond = -1,
        wasInside = false;
      setTarget({ x: 50, y: 50, radius });
      const position = (elapsed: number) => {
        const segment = Math.min(2, Math.floor(elapsed / segmentDuration));
        const seconds = elapsed / 1000;
        return {
          x:
            width *
            (0.5 + 0.33 * Math.sin(seconds * (0.65 + segment * 0.12) + phase)),
          y:
            height *
            (0.5 + 0.3 * Math.sin(seconds * (1.1 + segment * 0.1) + phase / 2)),
        };
      };
      const tick = () => {
        const now = performance.now(),
          elapsed = Math.min(duration, now - start),
          delta = Math.max(0, Math.min(now - last, duration - (last - start)));
        // Bound stored sampling to roughly 60 Hz, including on high-refresh displays.
        if (delta < 16 && elapsed < duration) {
          frame(tick);
          return;
        }
        const point = position(elapsed),
          midpoint = position(Math.max(0, elapsed - delta / 2));
        const pointer = state.pointer;
        const error = pointer
          ? Math.min(
              3,
              Math.hypot(pointer.x - midpoint.x, pointer.y - midpoint.y) /
                radius,
            )
          : 3;
        const onTarget = error <= 1;
        state.trials.push({
          index: state.trials.length,
          outcome: onTarget ? "correct" : "wrong",
          stimulusAt: last,
          respondedAt: last + delta,
          latency: delta,
          duration: delta,
          error,
          level: Math.min(3, Math.floor(elapsed / segmentDuration) + 1),
          response: pointer
            ? `${pointer.x.toFixed(1)},${pointer.y.toFixed(1)}`
            : "outside",
        });
        if (targetElement.current) {
          targetElement.current.style.left = `${point.x}px`;
          targetElement.current.style.top = `${point.y}px`;
        }
        if (onTarget !== wasInside) {
          setInside(onTarget);
          wasInside = onTarget;
        }
        const seconds = Math.ceil((duration - elapsed) / 1000);
        if (seconds !== lastSecond) {
          setRemaining(seconds);
          setCount(Math.min(2, Math.floor(elapsed / segmentDuration)));
          lastSecond = seconds;
        }
        last = now;
        if (elapsed >= duration) complete();
        else frame(tick);
      };
      frame(tick);
    } else {
      function next() {
        const radius = [
          Math.max(12, Math.min(width, height) * 0.045),
          Math.max(16, Math.min(width, height) * 0.065),
          Math.max(22, Math.min(width, height) * 0.085),
        ][state.trials.length % 3];
        const nextTarget = {
          x: radius + 12 + random() * (width - 2 * radius - 24),
          y: radius + 12 + random() * (height - 2 * radius - 24),
          radius,
        };
        state.active = false;
        frame(() => {
          flushSync(() => {
            setTarget(nextTarget);
            setFlash("");
          });
          state.target = nextTarget;
          state.onset = performance.now();
          state.active = true;
          const onset = state.onset;
          schedule(() => {
            if (state.active && state.onset === onset)
              record("timeout", DEADLINE, 0);
          }, DEADLINE);
        });
      }
      function record(
        outcome: Trial["outcome"],
        latency: number,
        error: number,
        eventAt?: number,
        response?: string,
      ) {
        if (!state.active || state.finished) return;
        state.active = false;
        clear();
        const now = performance.now();
        state.trials.push({
          index: state.trials.length,
          outcome,
          stimulusAt: state.onset,
          respondedAt: now,
          latency,
          error,
          eventAt,
          handlerAt: now,
          level: state.target.radius,
          expected: `${state.target.x.toFixed(2)},${state.target.y.toFixed(2)}`,
          response,
        });
        setCount(state.trials.length);
        setFlash(outcome === "correct" ? "hit" : "miss");
        schedule(
          () => (state.trials.length >= limit ? complete() : next()),
          130,
        );
      }
      hitRef.current = (x, y, eventAt) => {
        const error =
          Math.hypot(x - state.target.x, y - state.target.y) /
          state.target.radius;
        record(
          error <= 1 ? "correct" : "wrong",
          Math.max(0, performance.now() - state.onset),
          error,
          eventAt,
          `${x.toFixed(2)},${y.toFixed(2)}`,
        );
      };
      next();
    }
    return () => {
      state.finished = true;
      clear();
    };
  }, [clear, frame, limit, schedule, seed, segmentDuration, tracking]);
  return (
    <>
      <div className="round-line">
        <span>
          {tracking
            ? `PATH ${count + 1} / 3`
            : `TARGET ${Math.min(count + 1, limit)} / ${limit}`}
        </span>
        <span>
          {tracking ? `${remaining}s remaining` : "Aim for the center"}
        </span>
      </div>
      <div
        ref={arena}
        className={`precision-arena ${tracking ? "tracking" : ""} ${flash}`}
        aria-label={
          tracking
            ? "Follow the moving target with your pointer"
            : "Target arena"
        }
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const point = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
          current.current.pointer = point;
          if (!tracking) hitRef.current(point.x, point.y, event.timeStamp);
          else event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          current.current.pointer = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
        }}
        onPointerLeave={() => {
          current.current.pointer = null;
        }}
        onPointerUp={(event) => {
          if (event.pointerType === "touch") current.current.pointer = null;
        }}
        onPointerCancel={() => {
          current.current.pointer = null;
        }}
      >
        <div className="arena-crosshair">
          <Crosshair size={20} />
        </div>
        <div
          ref={targetElement}
          className={`precision-target ${inside ? "inside" : ""}`}
          style={{
            left: target.x,
            top: target.y,
            width: target.radius * 2,
            height: target.radius * 2,
          }}
          aria-label="Target"
        >
          <span />
        </div>
        {tracking && (
          <span className="tracking-label">
            {inside ? "IN THE ZONE" : "STAY WITH THE RING"}
          </span>
        )}
      </div>
      <p className="arena-hint">
        {tracking
          ? "Move your pointer or hold and drag with your finger."
          : "Click or tap each target. Misses count, so make every move deliberate."}
      </p>
    </>
  );
}
