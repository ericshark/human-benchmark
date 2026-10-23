import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Download,
  RotateCcw,
  ShieldCheck,
  Trophy,
  TriangleAlert,
} from "lucide-react";
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
import { dailyGames, playerProgress, sessionXp } from "./progress";
import { Confetti } from "../components/Confetti";
import { PopulationComparison } from "../components/OnlineRatings";
import { ResultExtras } from "../components/ResultExtras";

export default function Results() {
  const { sessionId } = useParams(),
    [params] = useSearchParams();
  const { sessions, loading, introProgress, storageError } = useApp();
  const session = sessions.find((item) => item.id === sessionId);
  const progress = useMemo(() => playerProgress(sessions), [sessions]);
  const earnedXp = useMemo(
    () => (sessionId ? sessionXp(sessions).get(sessionId)?.xp : undefined),
    [sessions, sessionId],
  );
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
    ctx.fillStyle = "#fff8ec";
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = category.color;
    ctx.fillRect(0, 0, 1200, 18);
    ctx.fillStyle = "#1f1b3a";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText("HumanRank", 75, 90);
    ctx.fillStyle = category.deep;
    ctx.font = "24px sans-serif";
    ctx.fillText(`${category.name.toUpperCase()}  /  ${game.name}`, 75, 195);
    ctx.fillStyle = "#1f1b3a";
    ctx.font = "bold 100px sans-serif";
    ctx.fillText(
      validPrimary ? formatMetric(result.primary) : "No valid response",
      75,
      330,
    );
    ctx.font = "30px sans-serif";
    ctx.fillText(result.primary.label, 75, 395);
    ctx.fillStyle = "#6b6489";
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
  const typical =
    measuredHistory.length >= 2
      ? formatMetric({
          ...result.primary,
          value: median(
            measuredHistory
              .slice(0, 5)
              .map((item) => scoreSession(item).primary.value),
          ),
        })
      : "—";
  return (
    <div className="page results-page" style={accentStyle(game.category)}>
      {record && <Confetti />}
      {!!session.flags.length && (
        <div className="notice warning" role="alert">
          <TriangleAlert size={19} />
          <div>
            <strong>Measurement needs a second look</strong>
            <p>
              {session.flags.join(" ")} This session is in your history but
              excluded from records, XP, and coverage.
            </p>
          </div>
        </div>
      )}
      <section className={`result-hero ${record ? "record" : ""}`}>
        <div className="result-main">
          <span className="result-game">
            <span className="result-game-icon">
              <Icon name={game.icon} size={20} strokeWidth={2.4} />
            </span>
            {game.name}
            {session.mode === "daily" && (
              <span className="chip daily-chip">Daily</span>
            )}
          </span>
          {record ? (
            <span className="record-banner">
              <Trophy size={20} strokeWidth={2.6} />
              New personal best!
            </span>
          ) : (
            <span className="result-label">{result.primary.label}</span>
          )}
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
          {record && (
            <span className="result-label">{result.primary.label}</span>
          )}
          <p className="result-meta">
            {result.correct} correct{" "}
            {game.id === "orbit-track" ? "samples" : "responses"} ·{" "}
            {session.mode === "daily" ? "Daily circuit" : "Assessment"} ·{" "}
            {session.input}
          </p>
          {earnedXp !== undefined && (
            <div className="xp-gain">
              <span className="xp-chip">+{earnedXp} XP</span>
              <span className="xp-level">Level {progress.level}</span>
              <span className="level-meter large" aria-hidden="true">
                <span
                  style={{
                    width: `${(progress.levelXp / progress.nextLevelXp) * 100}%`,
                  }}
                />
              </span>
            </div>
          )}
          <div className="result-badges">
            <span>
              <ShieldCheck size={14} strokeWidth={2.4} />
              {storageError
                ? "Available for this visit · export to keep"
                : "Saved to this browser"}
            </span>
          </div>
        </div>
        <div className="result-comparisons">
          <div>
            <span>Your best</span>
            <strong>
              {best && hasPrimaryMeasurement(best)
                ? formatMetric(scoreSession(best).primary)
                : "—"}
            </strong>
          </div>
          <div>
            <span>Last time</span>
            <strong>{previous ? formatPrimary(previous) : "First try!"}</strong>
          </div>
          <div>
            <span>Typical</span>
            <strong>{typical}</strong>
          </div>
        </div>
      </section>
      <div className="result-actions">
        <Link
          className="button primary huge"
          to={`/play/${game.id}${circuit ? `?circuit=${circuit}` : ""}`}
        >
          <RotateCcw size={20} strokeWidth={2.6} />
          Play again
        </Link>
        {circuit ? (
          nextGame ? (
            <Link
              className="button secondary huge"
              to={`/play/${nextGame}?circuit=${circuit}`}
            >
              Next: {gameById[nextGame].name}
              <ArrowRight size={20} strokeWidth={2.6} />
            </Link>
          ) : (
            <Link className="button secondary huge" to="/challenges">
              <Check size={20} strokeWidth={2.6} />
              Circuit complete
            </Link>
          )
        ) : (
          <Link className="button secondary huge" to={`/play/${suggestion}`}>
            Try {gameById[suggestion].name}
            <ArrowRight size={20} strokeWidth={2.6} />
          </Link>
        )}
        <button
          className="button icon-button"
          onClick={downloadCard}
          aria-label="Save result card"
          title="Save result card"
        >
          <Download size={20} strokeWidth={2.4} />
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
          <BarChart3 size={18} strokeWidth={2.4} />
          See details & charts
        </summary>
        <div className="result-chart-grid">
          <section className="card chart-panel">
            <div className="section-heading">
              <h2>This session</h2>
              <span className="muted">{session.trials.length} trials</span>
            </div>
            <TrialChart session={session} />
            <p className="small-note">
              {game.id === "orbit-track"
                ? "Lower bars show less tracking error. Display samples are spaced through the full recording."
                : "Each bar is a trial. Pink bars are errors, false starts, or timeouts."}
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
