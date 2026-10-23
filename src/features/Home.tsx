import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Flame,
  Medal,
  Play,
  Star,
  Swords,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { useOnline } from "../app/OnlineContext";
import { accentStyle, gameById, games, introGames } from "../games/registry";
import { GameArt, GameCard } from "../components/GameCard";
import { Icon } from "../components/Icon";
import {
  currentStreak,
  dailyGames,
  localDay,
  playerProgress,
} from "./progress";

export default function Home() {
  const { sessions, settings, introProgress } = useApp();
  const online = useOnline();
  const progress = useMemo(() => playerProgress(sessions), [sessions]);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
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
  return (
    <div className="page home-page">
      <section className="up-next" style={accentStyle(upNextGame.category)}>
        <div className="up-next-copy">
          <span className="up-next-label">
            {firstVisit
              ? `Welcome, ${settings.name}!`
              : nextIntro
                ? `Starter circuit · game ${introProgress.length + 1} of 6`
                : "Up next"}
          </span>
          <h1>{firstVisit ? "Ready, set, play." : upNextGame.name}</h1>
          <p>
            {firstVisit
              ? "Six quick games, one from every skill. Find out what you’re great at in about 7 minutes."
              : upNextGame.description}
          </p>
          <div className="up-next-actions">
            <Link className="button primary huge light" to={upNext.href}>
              <Play size={22} fill="currentColor" />
              {firstVisit ? "Discover my strengths" : `Play ${upNextGame.name}`}
            </Link>
            {nextIntro && !firstVisit && (
              <span
                className="intro-pips"
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
        </div>
        <GameArt game={upNextGame} size="hero" />
      </section>

      <div className="home-row">
        <section className="daily-card-home card">
          <div className="card-heading">
            <span className="card-icon daily-icon">
              <CalendarCheck size={20} strokeWidth={2.6} />
            </span>
            <div>
              <h2>Daily challenge</h2>
              <p>
                {dailyDone.length === 3
                  ? "All done today. Come back tomorrow!"
                  : "3 games · same puzzles for everyone today"}
              </p>
            </div>
          </div>
          <div className="daily-games">
            {daily.map((id) => (
              <Link
                key={id}
                to={`/play/${id}?circuit=daily`}
                className={`daily-game ${dailyDone.includes(id) ? "done" : ""}`}
                style={accentStyle(gameById[id].category)}
              >
                <span className="daily-game-icon">
                  {dailyDone.includes(id) ? (
                    <Check size={22} strokeWidth={3} />
                  ) : (
                    <Icon
                      name={gameById[id].icon}
                      size={22}
                      strokeWidth={2.4}
                    />
                  )}
                </span>
                <span>{gameById[id].name}</span>
              </Link>
            ))}
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
          {nextDaily ? (
            <Link
              className="button primary daily-button"
              to={`/play/${nextDaily}?circuit=daily`}
            >
              {dailyDone.length ? "Keep going" : "Play daily"}
              <ArrowRight size={18} strokeWidth={2.6} />
            </Link>
          ) : (
            <Link className="button secondary daily-button" to="/challenges">
              See challenges
            </Link>
          )}
        </section>

        <section className="stat-strip card">
          <div className="card-heading">
            <h2>Your stats</h2>
            <Link className="text-link" to="/profile">
              See all <ArrowRight size={16} strokeWidth={2.6} />
            </Link>
          </div>
          <div className="mini-stats">
            <div className="mini-stat level">
              <Star size={20} strokeWidth={2.6} />
              <strong>{progress.level}</strong>
              <span>Level</span>
              <span className="mini-meter">
                <span
                  style={{
                    width: `${(progress.levelXp / progress.nextLevelXp) * 100}%`,
                  }}
                />
              </span>
            </div>
            <div className="mini-stat streak">
              <Flame size={20} strokeWidth={2.6} />
              <strong>{streak}</strong>
              <span>Day streak</span>
            </div>
            <div className="mini-stat played">
              <Swords size={20} strokeWidth={2.6} />
              <strong>
                {played.size}
                <small>/12</small>
              </strong>
              <span>Games tried</span>
            </div>
            <div className="mini-stat records">
              <Medal size={20} strokeWidth={2.6} />
              <strong>{progress.records}</strong>
              <span>Personal bests</span>
            </div>
          </div>
        </section>
      </div>

      <section className="home-games">
        <div className="section-heading">
          <h2>Pick a game</h2>
          <Link className="text-link" to="/games">
            All 12 games
          </Link>
        </div>
        <div className="game-grid">
          {introGames.map((id) => (
            <GameCard key={id} game={gameById[id]} sessions={sessions} />
          ))}
        </div>
      </section>
    </div>
  );
}
