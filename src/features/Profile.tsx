import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Flame,
  Lock,
  Medal,
  Play,
  Settings2,
  Trophy,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { accentStyle, categories, gameById, games } from "../games/registry";
import { bestSession, formatPrimary } from "../domain/scoring";
import type { GameId, InputClass, Mode } from "../domain/types";
import { CoverageWheel, HistoryChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { ProfileExport } from "../components/ProfileExport";
import { OnlineRatingSummary } from "../components/OnlineRatings";
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
    return <div className="page loading-state">Loading your stats…</div>;
  return (
    <div className="page profile-page">
      <section className="player-card">
        <span className="player-avatar" aria-hidden="true">
          {settings.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="player-info">
          <h1>{settings.name}</h1>
          <p className="player-summary">
            {valid.length} {valid.length === 1 ? "session" : "sessions"} ·{" "}
            {played.size} of 12 games · {currentStreak(sessions)}-day streak
          </p>
        </div>
        <div className="player-actions">
          <ProfileExport />
          <Link className="button secondary" to="/settings">
            <Settings2 size={15} />
            Manage my data
          </Link>
          <Link className="button primary" to={`/play/${recommended.id}`}>
            <Play size={15} fill="currentColor" />
            {played.size ? `Play ${recommended.name}` : "Play your first game"}
          </Link>
        </div>
      </section>
      <div className="stats-row">
        {[
          {
            icon: Trophy,
            value: valid.length,
            label: "Games completed",
          },
          {
            icon: Check,
            value: `${played.size} / 12`,
            label: "Games explored",
          },
          {
            icon: Flame,
            value: currentStreak(sessions),
            label: "Day streak",
          },
          {
            icon: CalendarDays,
            value: activeDays(sessions),
            label: "Days played",
          },
        ].map(({ icon: ItemIcon, value, label }) => (
          <div className="stat-block" key={label}>
            <span className="stat-icon">
              <ItemIcon size={16} />
            </span>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card coverage-card">
          <div className="section-heading">
            <h2>Skills explored</h2>
            <span className="muted">{played.size} of 12 games</span>
          </div>
          <div className="coverage-layout">
            <CoverageWheel sessions={sessions} />
            <ul className="skill-bars">
              {categories.map((category) => {
                const count = games.filter(
                  (game) =>
                    game.category === category.id && played.has(game.id),
                ).length;
                return (
                  <li key={category.id} style={accentStyle(category.id)}>
                    <Icon name={category.id} size={16} />
                    <span>{category.name}</span>
                    <span className="skill-track">
                      <span style={{ width: `${count * 50}%` }} />
                    </span>
                    <small>{count}/2</small>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
        <OnlineRatingSummary />
      </div>
      <section>
        <div className="section-heading">
          <h2>
            <Medal size={22} /> Personal bests
          </h2>
          <span className="muted">Best assessment per input</span>
        </div>
        <div className="bests-grid">
          {games.map((game) => {
            const inputs = [
              ...new Set(
                valid
                  .filter((session) => session.gameId === game.id)
                  .map((session) => session.input),
              ),
            ];
            return (
              <Link
                to={`/play/${game.id}`}
                className={`best-tile ${inputs.length ? "" : "empty"}`}
                key={game.id}
                style={accentStyle(game.category)}
              >
                <span className="best-icon">
                  <Icon name={game.icon} size={20} />
                </span>
                <span className="best-name">{game.name}</span>
                {inputs.length ? (
                  inputs.map((input) => {
                    const best = bestSession(
                      valid.filter(
                        (session) =>
                          session.gameId === game.id && session.input === input,
                      ),
                    );
                    return (
                      <span className="best-value" key={input}>
                        <strong>
                          {best ? formatPrimary(best) : "No valid response"}
                        </strong>
                        <small>{input}</small>
                      </span>
                    );
                  })
                ) : (
                  <span className="best-value muted">Not played yet</span>
                )}
              </Link>
            );
          })}
        </div>
      </section>
      <section className="card history-panel">
        <div className="section-heading">
          <h2>Progress over time</h2>
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
          Each point is a real session with the same mode and input.
        </p>
      </section>
      <section>
        <div className="section-heading">
          <h2>
            <Trophy size={22} /> Badges
          </h2>
          <span className="muted">
            {earned.filter((item) => item.unlocked).length} / {earned.length}{" "}
            unlocked
          </span>
        </div>
        <div className="achievement-grid">
          {earned.map((item) => (
            <div
              className={`achievement ${item.unlocked ? "unlocked" : ""}`}
              key={item.id}
            >
              <span className="badge-medal">
                {item.unlocked ? (
                  <Icon name={item.icon} size={28} />
                ) : (
                  <Lock size={24} />
                )}
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="badge-progress">
                {item.unlocked ? "Unlocked ✓" : item.progress}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="card recent-panel">
        <div className="section-heading">
          <h2>Recent games</h2>
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
                    <td>{formatPrimary(session)}</td>
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
            <Play size={25} />
            <p>No games yet. Your first one takes about a minute.</p>
            <Link className="button secondary" to="/games">
              Find a game <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
