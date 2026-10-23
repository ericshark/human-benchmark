import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Clock3, Play } from "lucide-react";
import { useApp } from "../app/AppContext";
import { useOnline } from "../app/OnlineContext";
import {
  accentStyle,
  gameById,
  games,
  getCategory,
  introGames,
} from "../games/registry";
import { bestSession, formatPrimary } from "../domain/scoring";
import { GameCard } from "../components/GameCard";
import { Icon } from "../components/Icon";
import {
  currentStreak,
  dailyGames,
  localDay,
  personalRecords,
} from "./progress";

export default function Home() {
  const { sessions, introProgress } = useApp();
  const online = useOnline();
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const records = useMemo(() => personalRecords(sessions).size, [sessions]);
  const valid = sessions.filter(
    (session) => session.mode === "assessment" && !session.flags.length,
  );
  const played = new Set(valid.map((session) => session.gameId));
  const day = online.challengeDay ?? localDay();
  const daily = dailyGames(day);
  const dailyDone = daily.filter((id) =>
    sessions.some(
      (session) =>
        session.gameId === id &&
        session.dailyId === day &&
        !session.flags.length,
    ),
  );
  const nextIntro = introGames.find((id) => !introProgress.includes(id));
  const nextDaily = daily.find((id) => !dailyDone.includes(id));
  const firstVisit = !sessions.length && !introProgress.length;
  // Recommend the intro circuit first, then unexplored games, then today's daily.
  const upNext = nextIntro
    ? { id: nextIntro, href: `/play/${nextIntro}?circuit=intro` }
    : (() => {
        const unplayed = games.find((game) => !played.has(game.id));
        if (unplayed) return { id: unplayed.id, href: `/play/${unplayed.id}` };
        const id = nextDaily ?? daily[0];
        return { id, href: `/play/${id}?circuit=daily` };
      })();
  const upNextGame = gameById[upNext.id];
  const upNextBest = bestSession(
    valid.filter((session) => session.gameId === upNext.id),
  );
  return (
    <div className="page home-page">
      {firstVisit ? (
        <section className="up-next intro">
          <div className="up-next-copy">
            <span className="eyebrow">Starter circuit · 6 games</span>
            <h1>Find your strengths</h1>
            <p>
              One short test from each skill: reflexes, memory, focus,
              reasoning, precision, and processing. About 7 minutes.
            </p>
            <div className="up-next-actions">
              <Link className="button primary" to={upNext.href}>
                <Play size={16} fill="currentColor" />
                Discover my strengths
              </Link>
              <Link className="button secondary" to="/games">
                Browse games
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="up-next" style={accentStyle(upNextGame.category)}>
          <span className="icon-tile large">
            <Icon name={upNextGame.icon} size={26} strokeWidth={1.75} />
          </span>
          <div className="up-next-copy">
            <span className="eyebrow">
              {nextIntro
                ? `Starter circuit · ${introProgress.length + 1} of 6`
                : "Up next"}
            </span>
            <h1>{upNextGame.name}</h1>
            <p>{upNextGame.description}</p>
            <div className="up-next-meta">
              <span>{getCategory(upNextGame.category).name}</span>
              <span>
                <Clock3 size={13} />
                {upNextGame.duration}
              </span>
              {upNextBest && <span>Best {formatPrimary(upNextBest)}</span>}
            </div>
          </div>
          <div className="up-next-actions">
            <Link className="button primary" to={upNext.href}>
              <Play size={16} fill="currentColor" />
              Play {upNextGame.name}
            </Link>
            {nextIntro && (
              <span
                className="intro-pips"
                role="img"
                aria-label={`${introProgress.length} of 6 starter games done`}
              >
                {introGames.map((id) => (
                  <span
                    key={id}
                    className={introProgress.includes(id) ? "done" : ""}
                  />
                ))}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="stat-strip" aria-label="Your stats">
        {[
          { value: streak, label: "Day streak" },
          { value: `${played.size}/12`, label: "Games tried" },
          { value: records, label: "Personal bests" },
          { value: valid.length, label: "Sessions" },
        ].map(({ value, label }) => (
          <div className="mini-stat" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
        <Link className="text-link" to="/profile">
          All stats <ArrowRight size={14} />
        </Link>
      </section>

      <div className="home-columns">
        <section className="home-games">
          <div className="section-heading">
            <h2>Starter games</h2>
            <Link className="text-link" to="/games">
              All 12 games
            </Link>
          </div>
          <div className="game-grid compact">
            {introGames.map((id) => (
              <GameCard key={id} game={gameById[id]} sessions={sessions} />
            ))}
          </div>
        </section>

        <section className="card daily-card-home">
          <div className="section-heading">
            <h2>Daily challenge</h2>
            <span className="muted">{dailyDone.length}/3</span>
          </div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label="Daily challenge progress"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={dailyDone.length}
          >
            <span style={{ width: `${(dailyDone.length / 3) * 100}%` }} />
          </div>
          <ul className="daily-list">
            {daily.map((id) => (
              <li key={id} style={accentStyle(gameById[id].category)}>
                <Link to={`/play/${id}?circuit=daily`}>
                  <span className="icon-tile">
                    <Icon name={gameById[id].icon} size={16} />
                  </span>
                  <span className="daily-name">{gameById[id].name}</span>
                  {dailyDone.includes(id) ? (
                    <span className="daily-status done">
                      <Check size={14} /> Done
                    </span>
                  ) : (
                    <span className="daily-status">Play</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="small-note">
            Same three games for everyone today. Scores are kept separate from
            regular sessions.
          </p>
        </section>
      </div>
    </div>
  );
}
