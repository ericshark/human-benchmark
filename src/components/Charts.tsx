import { useId } from "react";
import type { Session } from "../domain/types";
import { formatMetric, scoreSession } from "../domain/scoring";
import { categories, games } from "../games/registry";

export function CoverageWheel({
  sessions,
  large = false,
}: {
  sessions: Session[];
  large?: boolean;
}) {
  const covered = new Set(
    sessions
      .filter(
        (session) => session.mode === "assessment" && !session.flags.length,
      )
      .map((session) => session.gameId),
  );
  return (
    <div className={`coverage-wheel ${large ? "large" : ""}`}>
      <svg
        viewBox="0 0 320 320"
        role="img"
        aria-label={`Assessment coverage: ${covered.size} of 12 games completed. Each segment represents one game.`}
      >
        <circle className="wheel-base" cx="160" cy="160" r="120" />
        {games.map((game, index) => {
          const start = index * 30 - 90,
            end = start + 24;
          const point = (angle: number, radius: number) => [
            160 + Math.cos((angle * Math.PI) / 180) * radius,
            160 + Math.sin((angle * Math.PI) / 180) * radius,
          ];
          const [x1, y1] = point(start, 120),
            [x2, y2] = point(end, 120);
          return (
            <path
              key={game.id}
              d={`M${x1},${y1} A120,120 0 0,1 ${x2},${y2}`}
              fill="none"
              stroke={
                covered.has(game.id)
                  ? categories.find((item) => item.id === game.category)!.color
                  : "var(--wheel-empty)"
              }
              strokeWidth="18"
              strokeLinecap="round"
            />
          );
        })}
        {[66, 90].map((radius) => (
          <circle
            key={radius}
            className="wheel-inner"
            cx="160"
            cy="160"
            r={radius}
          />
        ))}
        <text className="wheel-value" x="160" y="159" textAnchor="middle">
          {covered.size}
          <tspan className="wheel-denominator"> / 12</tspan>
        </text>
        <text className="wheel-label" x="160" y="183" textAnchor="middle">
          GAMES EXPLORED
        </text>
      </svg>
    </div>
  );
}
export function HistoryChart({
  sessions,
  label = "Personal history",
}: {
  sessions: Session[];
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const data = [...sessions]
    .reverse()
    .slice(-20)
    .map((session) => ({ session, metric: scoreSession(session).primary }));
  if (data.length < 2)
    return (
      <div className="chart-empty">
        <span className="tiny-line">╱╲___╱</span>
        <p>Your story starts with a baseline.</p>
        <span>Complete two comparable sessions to see a trend.</span>
      </div>
    );
  const values = data.map((item) => item.metric.value),
    min = Math.min(...values),
    max = Math.max(...values);
  const points = values.map(
    (value, index) =>
      `${35 + (index / (values.length - 1)) * 630},${160 - ((value - min) / (max - min || 1)) * 110}`,
  );
  return (
    <div className="history-chart">
      <svg
        viewBox="0 0 700 210"
        role="img"
        aria-label={`${label}: ${data.map((item) => formatMetric(item.metric)).join(", ")}. More detail in the table below.`}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--lime)" stopOpacity=".18" />
            <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[50, 105, 160].map((y) => (
          <line
            key={y}
            x1="35"
            x2="665"
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="4 5"
          />
        ))}
        <polygon
          points={`35,180 ${points.join(" ")} 665,180`}
          fill={`url(#area-${id})`}
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.split(",")[0]}
            cy={point.split(",")[1]}
            r="4"
            fill="var(--lime)"
          />
        ))}
        <text x="35" y="201" className="chart-label">
          {new Date(data[0].session.completedAt).toLocaleDateString()}
        </text>
        <text x="665" y="201" textAnchor="end" className="chart-label">
          Latest session
        </text>
      </svg>
      <details>
        <summary>View data table</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>{data[0].metric.label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ session, metric }) => (
              <tr key={session.id}>
                <td>{new Date(session.completedAt).toLocaleString()}</td>
                <td>{formatMetric(metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
export function TrialChart({ session }: { session: Session }) {
  const tracking = session.gameId === "orbit-track";
  // Tracking samples can number in the thousands; summarize contiguous time windows for display.
  const trials = tracking
    ? session.trials
        .filter(
          (_, index) =>
            index % Math.max(1, Math.floor(session.trials.length / 60)) === 0,
        )
        .slice(0, 60)
    : session.trials;
  const values = trials.map((trial) =>
    tracking
      ? (trial.error ?? 3)
      : trial.level && ["grid-recall", "echo-path"].includes(session.gameId)
        ? trial.level
        : trial.latency,
  );
  const maximum = Math.max(...values, 1);
  return (
    <div
      className="trial-chart"
      role="img"
      aria-label={
        tracking
          ? "Tracking error sampled across the session. Lower bars indicate less error."
          : "Trial measurements. Green indicates correct responses; coral indicates an error or timeout."
      }
    >
      {trials.map((trial, index) => (
        <div
          key={trial.index}
          className={`trial-bar ${trial.outcome !== "correct" ? "error" : ""}`}
          style={{ height: `${Math.max(3, (values[index] / maximum) * 100)}%` }}
          title={`Trial ${trial.index + 1}: ${trial.outcome}; ${tracking ? (trial.error ?? 3).toFixed(2) + " radii" : Math.round(trial.latency) + " ms"}`}
        />
      ))}
    </div>
  );
}
