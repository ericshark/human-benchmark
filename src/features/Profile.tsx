import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Flame,
  LockKeyhole,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { categories, gameById, games } from "../games/registry";
import { bestSession, formatMetric, scoreSession } from "../domain/scoring";
import type { GameId, InputClass, Mode } from "../domain/types";
import { CoverageWheel, HistoryChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { achievements, activeDays, currentStreak } from "./progress";

export default function Profile() {
  const { sessions, settings, loading } = useApp();
  const [historyGame, setHistoryGame] = useState<GameId>("signal");
  const [historyMode, setHistoryMode] = useState<Mode>("assessment");
  const [historyInput, setHistoryInput] = useState<InputClass>(settings.input);
  const valid = sessions.filter(
    (session) => session.mode === "assessment" && !session.flags.length,
  );
  const played = new Set(valid.map((session) => session.gameId));
  const history = sessions.filter(
    (session) =>
      session.gameId === historyGame &&
      session.mode === historyMode &&
      session.input === historyInput &&
      !session.flags.length,
  );
  const earned = achievements(sessions);
  const recommended =
    games.find((game) => !played.has(game.id)) ??
    games.find(
      (game) =>
        valid.filter((session) => session.gameId === game.id).length < 3,
    ) ??
    games[0];
  if (loading)
    return <div className="page loading-state">Opening your profile…</div>;
  return (
    <div className="page profile-page">
      <div className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">YOUR PERSONAL FIELD NOTES</span>
          <h1>A little more you.</h1>
          <p>
            {settings.name}, every challenge adds another piece to the picture.
          </p>
        </div>
        <Link className="button secondary" to="/settings">
          Manage my data <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="profile-top-grid">
        <section className="panel profile-summary">
          <div>
            <span className="eyebrow">YOUR EXPLORATION</span>
            <h2>
              {played.size === 12
                ? "The full spectrum."
                : played.size
                  ? "Your profile is taking shape."
                  : "A blank canvas. All potential."}
            </h2>
            <p>
              {played.size === 12
                ? "You’ve explored every game. Repeat comparable sessions to discover your typical performance."
                : "Explore all twelve games to build a picture across six categories. Each ring segment is a game, not a performance score."}
            </p>
            <Link className="text-link" to={`/play/${recommended.id}`}>
              {played.size
                ? `Next discovery: ${recommended.name}`
                : "Make your first discovery"}
              <ArrowRight size={17} />
            </Link>
          </div>
          <CoverageWheel sessions={sessions} />
        </section>
        <section className="panel rank-preview">
          <div className="rank-icon">
            <Sparkles size={25} />
          </div>
          <span className="eyebrow">HUMANRANK & PROFILE RARITY</span>
          <h2>
            Good data
            <br />
            comes first.
          </h2>
          <p>
            Your personal measurements are ready as you play. Population
            rankings need real, comparable player data.
          </p>
          <span className="availability-tag">
            <LockKeyhole size={13} />
            Awaiting qualifying cohorts
          </span>
          <Link to="/methodology" className="text-link">
            See what’s needed <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
      <div className="stats-row">
        {[
          { icon: Trophy, value: valid.length, label: "Assessments completed" },
          {
            icon: Check,
            value: `${played.size} / 12`,
            label: "Games explored",
          },
          {
            icon: Flame,
            value: currentStreak(sessions),
            label: "Current day streak",
          },
          {
            icon: CalendarDays,
            value: activeDays(sessions),
            label: "Days of discovery",
          },
        ].map(({ icon: ItemIcon, value, label }) => (
          <div className="panel stat-block" key={label}>
            <ItemIcon size={20} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">SIX DIMENSIONS OF YOU</span>
            <h2>Your personal benchmarks</h2>
          </div>
          <span className="muted">Assessment records · grouped by input</span>
        </div>
        <div className="category-profile-grid">
          {categories.map((category) => {
            const anchors = games.filter(
                (game) => game.category === category.id,
              ),
              count = anchors.filter((game) => played.has(game.id)).length;
            return (
              <section
                className="panel category-profile"
                key={category.id}
                style={{ "--accent": category.color } as React.CSSProperties}
              >
                <div className="category-profile-title">
                  <Icon name={category.id} size={20} />
                  <h3>{category.name}</h3>
                  <span>{count} / 2</span>
                </div>
                <p>{category.description}</p>
                <div className="coverage-track">
                  <span style={{ width: `${count * 50}%` }} />
                </div>
                {anchors.map((game) => {
                  const inputs = [
                    ...new Set(
                      valid
                        .filter((session) => session.gameId === game.id)
                        .map((session) => session.input),
                    ),
                  ];
                  return (
                    <div className="anchor-row" key={game.id}>
                      <Link to={`/play/${game.id}`}>
                        {game.name}
                        <ArrowUpRight size={12} />
                      </Link>
                      {inputs.length ? (
                        inputs.map((input) => {
                          const best = bestSession(
                            valid.filter(
                              (session) =>
                                session.gameId === game.id &&
                                session.input === input,
                            ),
                          );
                          return (
                            <span key={input}>
                              <strong>
                                {best && scoreSession(best).correct
                                  ? formatMetric(scoreSession(best).primary)
                                  : "No valid response"}
                              </strong>
                              <small>{input}</small>
                            </span>
                          );
                        })
                      ) : (
                        <span className="muted">Unexplored</span>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </section>
      <section className="panel history-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SMALL STEPS ADD UP</span>
            <h2>Follow your progress</h2>
          </div>
          <div className="history-filters">
            <label>
              <span className="sr-only">History game</span>
              <select
                aria-label="History game"
                value={historyGame}
                onChange={(event) =>
                  setHistoryGame(event.target.value as GameId)
                }
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="History input"
              value={historyInput}
              onChange={(event) =>
                setHistoryInput(event.target.value as InputClass)
              }
            >
              {["mouse", "trackpad", "touch", "keyboard"].map((input) => (
                <option key={input}>{input}</option>
              ))}
            </select>
            <select
              aria-label="History mode"
              value={historyMode}
              onChange={(event) => setHistoryMode(event.target.value as Mode)}
            >
              <option value="assessment">Assessment</option>
              <option value="daily">Daily circuit</option>
            </select>
          </div>
        </div>
        <HistoryChart sessions={history} />
        <p className="small-note">
          Protocol v1. Each point is an actual session using the same mode and
          input. Early results show observations, not a claim of reliable
          improvement.
        </p>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURIOSITY HAS ITS REWARDS</span>
            <h2>Your milestones</h2>
          </div>
          <span className="muted">
            {earned.filter((item) => item.unlocked).length} / {earned.length}{" "}
            discovered
          </span>
        </div>
        <div className="achievement-grid">
          {earned.map((item) => (
            <div
              className={`panel achievement ${item.unlocked ? "unlocked" : ""}`}
              key={item.id}
            >
              <Icon name={item.icon} size={26} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span>{item.unlocked ? "Discovered ✓" : item.progress}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="section-heading">
          <h2>Recent discoveries</h2>
          <Link className="text-link" to="/games">
            Play something new <ArrowRight size={15} />
          </Link>
        </div>
        {sessions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Result</th>
                  <th>Mode / input</th>
                  <th>When</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 15).map((session) => (
                  <tr key={session.id}>
                    <td>
                      {gameById[session.gameId].name}
                      {!!session.flags.length && (
                        <small className="error-text"> · review</small>
                      )}
                    </td>
                    <td>{formatMetric(scoreSession(session).primary)}</td>
                    <td>
                      {session.mode} · {session.input}
                    </td>
                    <td>
                      {new Date(session.completedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        to={`/results/${session.id}`}
                        aria-label={`Open ${gameById[session.gameId].name} result`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-inline">
            <Sparkles size={25} />
            <p>Your first discovery is waiting for you.</p>
            <Link className="button secondary" to="/games">
              Find a game <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
