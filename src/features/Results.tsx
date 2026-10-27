import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  Download,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
  TriangleAlert,
} from "lucide-react";
import type { Session } from "../domain/types";
import { useApp } from "../app/AppContext";
import {
  accentStyle,
  gameById,
  getCategory,
  introGames,
} from "../games/registry";
import {
  bestSession,
  comparable,
  formatMetric,
  median,
  scoreSession,
  hasPrimaryMeasurement,
  formatPrimary,
} from "../domain/scoring";
import { HistoryChart, TrialChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { dailyGames } from "./progress";
import { PopulationComparison } from "../components/OnlineRatings";
import { ResultExtras } from "../components/ResultExtras";

export default function Results() {
  const { sessionId } = useParams(),
    [params] = useSearchParams();
  const { sessions, loading, introProgress, storageError } = useApp();
  const session = sessions.find((item) => item.id === sessionId);
  if (loading)
    return <div className="page loading-state">Opening your result…</div>;
  if (!session)
    return (
      <div className="page empty-state">
        <h1>This result isn’t in this browser.</h1>
        <p>Import your backup in Settings or play a new session.</p>
        <Link className="button primary" to="/games">
          Explore the games
        </Link>
      </div>
    );
  const game = gameById[session.gameId],
    category = getCategory(game.category),
    result = scoreSession(session);
  const history = sessions.filter((item) => comparable(item, session));
  const measuredHistory = history.filter(hasPrimaryMeasurement);
  const best = bestSession(history),
    previous = history.find((item) => item.id !== session.id);
  const record = best?.id === session.id && history.length > 1;
  const circuit = params.get("circuit");
  const dailyRemaining = dailyGames(session.dailyId).filter(
    (id) =>
      !sessions.some(
        (item) =>
          item.dailyId === session.dailyId &&
          item.gameId === id &&
          !item.flags.length,
      ),
  );
  const nextGame =
    circuit === "intro"
      ? introGames.find((id) => !introProgress.includes(id))
      : circuit === "daily"
        ? dailyRemaining[0]
        : undefined;
  const suggestion =
    introGames.find(
      (id) =>
        gameById[id].category !== game.category &&
        !sessions.some((item) => item.gameId === id),
    ) ?? introGames.find((id) => id !== game.id)!;
  const validPrimary =
    result.correct > 0 ||
    [
      "pattern-forge",
      "rotation-lab",
      "orbit-track",
      "symbol-match",
      "math-sprint",
      "grid-recall",
      "echo-path",
    ].includes(game.id);
  function downloadCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx || !session) return;
    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, 1200, 630);
    const glow = ctx.createRadialGradient(600, -80, 0, 600, -80, 720);
    glow.addColorStop(0, `${category.color}40`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1200, 630);
    // Brand mark: matches .brand-mark and favicon.svg.
    const mark = ctx.createLinearGradient(75, 58, 103, 86);
    mark.addColorStop(0, "#98a1ff");
    mark.addColorStop(1, "#6570f0");
    ctx.fillStyle = mark;
    ctx.beginPath();
    ctx.roundRect(75, 58, 28, 28, 8);
    ctx.fill();
    ctx.fillStyle = "#0a0a12";
    ctx.beginPath();
    ctx.roundRect(83, 72, 4, 8, 2);
    ctx.roundRect(91, 66, 4, 14, 2);
    ctx.fill();
    ctx.fillStyle = "#ededef";
    ctx.font = "600 32px sans-serif";
    ctx.fillText("HumanRank", 117, 83);
    ctx.fillStyle = category.color;
    ctx.font = "24px sans-serif";
    ctx.fillText(`${category.name.toUpperCase()}  /  ${game.name}`, 75, 195);
    ctx.fillStyle = "#ededef";
    ctx.font = "600 100px sans-serif";
    ctx.fillText(
      validPrimary ? formatMetric(result.primary) : "No valid response",
      75,
      330,
    );
    ctx.font = "30px sans-serif";
    ctx.fillText(result.primary.label, 75, 395);
    ctx.fillStyle = "#8e8e96";
    ctx.font = "22px sans-serif";
    ctx.fillText(
      `${session.mode === "daily" ? "Daily challenge" : "Local assessment"} · ${session.input} · protocol v1 · ${new Date(session.completedAt).toLocaleDateString()}`,
      75,
      510,
    );
    ctx.font = "18px sans-serif";
    ctx.fillText(
      "Personal game performance. No population ranking claimed.",
      75,
      565,
    );
    const link = document.createElement("a");
    link.download = `humanrank-${game.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
  const typicalValue =
    measuredHistory.length >= 2
      ? median(
          measuredHistory
            .slice(0, 5)
            .map((item) => scoreSession(item).primary.value),
        )
      : undefined;
  const typical =
    typicalValue === undefined
      ? "—"
      : formatMetric({ ...result.primary, value: typicalValue });
  const bestIsMeasured = !!best && hasPrimaryMeasurement(best);
  // Signed comparison of this session against another value, phrased by the game's direction.
  function compareTo(value: number | undefined) {
    if (!validPrimary || value === undefined) return null;
    const difference = result.primary.value - value;
    const step = 10 ** -(result.primary.digits ?? 0);
    if (Math.abs(difference) < step / 2)
      return { tone: "even", label: "Level" };
    const improved = result.higherIsBetter ? difference > 0 : difference < 0;
    const amount = formatMetric({
      ...result.primary,
      value: Math.abs(difference),
    });
    return improved
      ? { tone: "up", label: `${amount} better` }
      : { tone: "down", label: `${amount} behind` };
  }
  const primaryOf = (other?: Session) =>
    other && hasPrimaryMeasurement(other)
      ? scoreSession(other).primary.value
      : undefined;
  const comparisons = [
    {
      label: "Your best",
      value: bestIsMeasured ? formatMetric(scoreSession(best!).primary) : "—",
      delta:
        best?.id === session.id
          ? history.length > 1
            ? { tone: "up", label: "This session" }
            : null
          : compareTo(primaryOf(best)),
    },
    {
      label: "Last time",
      value: previous ? formatPrimary(previous) : "First try",
      delta: compareTo(primaryOf(previous)),
    },
    {
      label: "Typical",
      value: typical,
      delta: measuredHistory.length > 2 ? compareTo(typicalValue) : null,
    },
  ];
  return (
    <div className="page results-page" style={accentStyle(game.category)}>
      {!!session.flags.length && (
        <div className="notice warning" role="alert">
          <TriangleAlert size={19} />
          <div>
            <strong>Measurement needs a second look</strong>
            <p>
              {session.flags.join(" ")} This session is in your history but
              excluded from records and coverage.
            </p>
          </div>
        </div>
      )}
      <section className="result-hero">
        <div className="result-main">
          <span className="result-game">
            <span className="result-game-icon">
              <Icon name={game.icon} size={16} />
            </span>
            {game.name}
            {session.mode === "daily" && (
              <span className="chip daily-chip">Daily</span>
            )}
          </span>
          <span className="result-label">
            {result.primary.label}
            {record && (
              <span className="record-tag">
                <Trophy size={12} />
                New best
              </span>
            )}
          </span>
          <div className="result-number">
            {validPrimary ? (
              <>
                {result.primary.value.toFixed(result.primary.digits ?? 0)}
                <span>{result.primary.unit}</span>
              </>
            ) : (
              <span>No valid responses</span>
            )}
          </div>
          <p className="result-meta">
            {result.correct} correct{" "}
            {game.id === "orbit-track" ? "samples" : "responses"} ·{" "}
            {session.mode === "daily" ? "Daily circuit" : "Assessment"} ·{" "}
            {session.input}
          </p>
          <div className="result-badges">
            <span>
              <ShieldCheck size={14} />
              {storageError
                ? "Available for this visit · export to keep"
                : "Saved to this browser"}
            </span>
          </div>
        </div>
        <div className="result-comparisons">
          {comparisons.map(({ label, value, delta }) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              {delta ? (
                <small className={`delta ${delta.tone}`}>
                  {delta.tone === "up" && <TrendingUp size={13} />}
                  {delta.tone === "down" && <TrendingDown size={13} />}
                  {delta.label}
                </small>
              ) : (
                <small className="delta">&nbsp;</small>
              )}
            </div>
          ))}
        </div>
        <div className="result-trials">
          <TrialChart session={session} />
          <p className="small-note">
            {game.id === "orbit-track"
              ? "Tracking error across the session. Lower is steadier."
              : `${session.trials.length} trials · tinted bars are errors, false starts, or timeouts.`}
          </p>
        </div>
      </section>
      <div className="result-actions">
        <Link
          className="button primary"
          to={`/play/${game.id}${circuit ? `?circuit=${circuit}` : ""}`}
        >
          <RotateCcw size={16} />
          Play again
        </Link>
        {circuit ? (
          nextGame ? (
            <Link
              className="button secondary"
              to={`/play/${nextGame}?circuit=${circuit}`}
            >
              Next: {gameById[nextGame].name}
              <ArrowRight size={16} />
            </Link>
          ) : (
            <Link className="button secondary" to="/challenges">
              <Check size={16} />
              Circuit complete
            </Link>
          )
        ) : (
          <Link className="button secondary" to={`/play/${suggestion}`}>
            Try {gameById[suggestion].name}
            <ArrowRight size={16} />
          </Link>
        )}
        <button
          className="button icon-button"
          onClick={downloadCard}
          aria-label="Save result card"
          title="Save result card"
        >
          <Download size={16} />
        </button>
      </div>
      <div className="metric-grid">
        {result.metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.label.includes("Consistency") && result.correct < 2
                ? "More trials needed"
                : !result.correct &&
                    metric.unit === "ms" &&
                    !metric.label.includes("Penalized")
                  ? "—"
                  : formatMetric(metric)}
            </strong>
          </div>
        ))}
      </div>
      <details className="result-details">
        <summary>
          <BarChart3 size={18} />
          See details & charts
        </summary>
        <div className="result-chart-grid">
          <section className="card chart-panel">
            <div className="section-heading">
              <h2>This session</h2>
              <span className="muted">{session.trials.length} trials</span>
            </div>
            <p className="small-note">
              {game.id === "orbit-track"
                ? "The chart above shows display samples spaced through the full recording."
                : "Every trial, in order, as recorded."}
            </p>
            <details>
              <summary>View all trial data</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Trial</th>
                      <th>Outcome</th>
                      <th>Time</th>
                      <th>Condition / level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.trials.slice(0, 100).map((trial) => (
                      <tr key={trial.index}>
                        <td>{trial.index + 1}</td>
                        <td>{trial.outcome}</td>
                        <td>{trial.latency.toFixed(0)} ms</td>
                        <td>{trial.condition ?? trial.level ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {session.trials.length > 100 && (
                <p>
                  First 100 shown. Export your history for the full recording.
                </p>
              )}
            </details>
          </section>
          <section className="card chart-panel">
            <div className="section-heading">
              <h2>Your progress</h2>
              <span className="muted">Same mode + input</span>
            </div>
            <HistoryChart sessions={history} />
          </section>
        </div>
        <div className="notice">
          <ShieldCheck size={21} />
          <div>
            <PopulationComparison session={session} />
          </div>
        </div>
        <p className="small-note">
          A personal best is your best full session under the published scoring
          rule, including error penalties.
        </p>
      </details>
      <ResultExtras key={session.id} session={session} />
    </div>
  );
}
