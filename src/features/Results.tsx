import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Download,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  TriangleAlert,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { gameById, getCategory, introGames } from "../games/registry";
import {
  bestSession,
  comparable,
  formatMetric,
  median,
  scoreSession,
} from "../domain/scoring";
import { HistoryChart, TrialChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { dailyGames } from "./progress";

export default function Results() {
  const { sessionId } = useParams(),
    [params] = useSearchParams();
  const { sessions, loading, introProgress } = useApp();
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
    ctx.fillStyle = "#111410";
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = "#c4f76a";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText("humanrank.", 75, 90);
    ctx.fillStyle = "#a8b0a2";
    ctx.font = "24px sans-serif";
    ctx.fillText(`${category.name.toUpperCase()}  /  ${game.name}`, 75, 195);
    ctx.fillStyle = "#f0f2e9";
    ctx.font = "bold 100px sans-serif";
    ctx.fillText(
      validPrimary ? formatMetric(result.primary) : "No valid response",
      75,
      330,
    );
    ctx.font = "30px sans-serif";
    ctx.fillText(result.primary.label, 75, 395);
    ctx.fillStyle = "#a8b0a2";
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
  return (
    <div
      className="page results-page"
      style={{ "--accent": category.color } as React.CSSProperties}
    >
      <div className="page-heading">
        <span className="eyebrow">
          <Icon name={game.icon} size={16} />
          {game.name.toUpperCase()} · SESSION COMPLETE
        </span>
        <h1>
          {record ? "A new personal best." : "A little more you, discovered."}
        </h1>
        <p>
          {record
            ? "That’s progress you can put a number on."
            : "One challenge. A new perspective. Here’s how it went."}
        </p>
      </div>
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
      <section className="result-hero panel">
        <div className="result-main">
          <span className="result-game-icon">
            <Icon name={game.icon} size={28} />
          </span>
          <span className="eyebrow">{result.primary.label.toUpperCase()}</span>
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
          <p>
            {result.correct} correct{" "}
            {game.id === "orbit-track" ? "samples" : "responses"} ·{" "}
            {session.mode === "daily" ? "Daily circuit" : "Local assessment"} ·{" "}
            {session.input}
          </p>
          <div className="result-badges">
            <span>
              <ShieldCheck size={14} />
              Saved to this browser
            </span>
            {record && (
              <span className="record-badge">
                <Trophy size={14} />
                Personal best
              </span>
            )}
          </div>
        </div>
        <div className="result-comparisons">
          <div>
            <span>Personal best · same setup</span>
            <strong>
              {best && scoreSession(best).correct
                ? formatMetric(scoreSession(best).primary)
                : "Not established"}
            </strong>
          </div>
          <div>
            <span>Typical recent form</span>
            <strong>
              {history.length >= 2
                ? formatMetric({
                    ...result.primary,
                    value: median(
                      history
                        .slice(0, 5)
                        .map((item) => scoreSession(item).primary.value),
                    ),
                  })
                : "Building your baseline"}
            </strong>
          </div>
          <div>
            <span>Previous attempt</span>
            <strong>
              {previous
                ? formatMetric(scoreSession(previous).primary)
                : "This is your first. Nice."}
            </strong>
          </div>
        </div>
      </section>
      <div className="metric-grid">
        {result.metrics.map((metric) => (
          <div className="metric-card panel" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{formatMetric(metric)}</strong>
          </div>
        ))}
      </div>
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
              <CheckIcon />
              Circuit complete
            </Link>
          )
        ) : (
          <Link className="button secondary" to={`/play/${suggestion}`}>
            Try {gameById[suggestion].name}
            <ArrowRight size={16} />
          </Link>
        )}
        <button className="button ghost" onClick={downloadCard}>
          <Download size={16} />
          Save result card
        </button>
      </div>
      <div className="result-chart-grid">
        <section className="panel chart-panel">
          <div className="section-heading">
            <h2>Your session, in detail</h2>
            <span className="muted">{session.trials.length} observations</span>
          </div>
          <TrialChart session={session} />
          <p className="small-note">
            {game.id === "orbit-track"
              ? "Lower bars show less tracking error. Display samples are spaced through the full recording."
              : "Each bar is a trial. Coral marks errors, false starts, or timeouts."}
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
        <section className="panel chart-panel">
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
          <strong>Personal insight, grounded in your play.</strong>
          <p>
            Population comparisons are not available yet. HumanRank will only
            show percentiles and profile rarity when enough comparable,
            qualifying player data exists.{" "}
            <Link to="/methodology">How scoring works ↗</Link>
          </p>
        </div>
      </div>
      <Link className="next-discovery panel" to="/profile">
        <Sparkles size={24} />
        <div>
          <h3>See the bigger picture.</h3>
          <p>Find this result in your personal performance profile.</p>
        </div>
        <ArrowRight size={20} />
      </Link>
    </div>
  );
}
function CheckIcon() {
  return <Trophy size={16} />;
}
