import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock3,
  Flame,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { accentStyle, gameById, introGames } from "../games/registry";
import { dailyGames, localDay, weeklyGames } from "./progress";
import { Icon } from "../components/Icon";
import { useOnline } from "../app/OnlineContext";

export default function Challenges() {
  const { sessions, introProgress, resetIntro } = useApp(),
    [params] = useSearchParams();
  const online = useOnline();
  const day = online.challengeDay ?? localDay();
  const daily = dailyGames(day),
    weekly = weeklyGames();
  const nextIntro = introGames.find((id) => !introProgress.includes(id));
  const doneToday = daily.filter((id) =>
    sessions.some(
      (session) =>
        session.gameId === id &&
        session.dailyId === day &&
        !session.flags.length,
    ),
  );
  const startWeek = new Date();
  startWeek.setHours(0, 0, 0, 0);
  startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
  const weeklyDone = weekly.filter((id) =>
    sessions.some(
      (session) =>
        session.gameId === id &&
        !session.flags.length &&
        new Date(session.completedAt) >= startWeek,
    ),
  );
  return (
    <div className="page challenges-page">
      <div className="page-heading">
        <h1>Challenges</h1>
        <p>Circuits, daily games, and weekly goals.</p>
      </div>
      <section
        className={`card intro-circuit ${params.get("circuit") === "intro" ? "featured" : ""}`}
      >
        <div className="circuit-copy">
          <span className="challenge-tag">
            <Sparkles size={14} />
            Starter circuit
          </span>
          <h2>Find your strengths</h2>
          <p>
            One game from each of the 6 skills, back to back. Pick up where you
            left off any time.
          </p>
          <div className="circuit-facts">
            <span className="chip">
              <Clock3 size={14} />
              About 7 minutes
            </span>
            <span className="chip">{introProgress.length} / 6 done</span>
          </div>
          <div className="inline-actions">
            {nextIntro ? (
              <Link
                className="button primary"
                to={`/play/${nextIntro}?circuit=intro`}
              >
                {introProgress.length
                  ? "Continue circuit"
                  : "Discover my strengths"}
                <ArrowRight size={17} />
              </Link>
            ) : (
              <Link className="button primary" to="/profile">
                See my initial profile <ArrowRight size={17} />
              </Link>
            )}
            {introProgress.length > 0 && (
              <button className="text-link" onClick={resetIntro}>
                <RotateCcw size={14} />
                Start a fresh circuit
              </button>
            )}
          </div>
        </div>
        <div className="circuit-steps">
          {introGames.map((id, index) => (
            <Link
              key={id}
              to={`/play/${id}?circuit=intro`}
              style={accentStyle(gameById[id].category)}
            >
              <span
                className={`step-number ${introProgress.includes(id) ? "done" : ""}`}
              >
                {introProgress.includes(id) ? (
                  <Check size={16} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <Icon name={gameById[id].icon} size={20} />
              <span>
                <strong>{gameById[id].name}</strong>
                <small>{gameById[id].category}</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <section className="daily-section">
        <div className="section-heading">
          <h2>
            <Flame size={24} />
            Daily challenge
          </h2>
          <span className="muted">
            {new Date().toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}{" "}
            · {doneToday.length} / 3 complete
          </span>
        </div>
        <div className="daily-grid">
          {daily.map((id, index) => (
            <Link
              to={`/play/${id}?circuit=daily`}
              className={`daily-card ${doneToday.includes(id) ? "done" : ""}`}
              key={id}
              style={accentStyle(gameById[id].category)}
            >
              <div className="daily-card-top">
                <span>0{index + 1}</span>
                {doneToday.includes(id) ? (
                  <span className="success-text">
                    <Check size={16} />
                    Completed
                  </span>
                ) : (
                  <span>{gameById[id].duration}</span>
                )}
              </div>
              <span className="daily-card-icon">
                <Icon name={gameById[id].icon} size={34} />
              </span>
              <h3>{gameById[id].name}</h3>
              <p>{gameById[id].description}</p>
              <span className="text-link">
                {doneToday.includes(id) ? "Play again" : "Play"}
                <ArrowRight size={17} />
              </span>
            </Link>
          ))}
        </div>
        <p className="small-note">
          {online.challengeDay
            ? "Daily challenges use shared seeds and the service’s UTC day."
            : "Daily challenges use shared seeds and your device’s local date."}{" "}
          Daily scores are kept separate from your regular records.
        </p>
        {doneToday.length === 3 && (
          <div className="notice">
            <Trophy size={25} />
            <div>
              <strong>Daily challenge complete!</strong>
              <p>Come back tomorrow for three new games.</p>
            </div>
          </div>
        )}
      </section>
      <section className="card weekly-panel">
        <div>
          <span className="challenge-tag">This week</span>
          <h2>Weekly mix</h2>
          <p>Play these six games before Monday.</p>
          <span className="weekly-progress">
            {weeklyDone.length} of 6 explored
          </span>
        </div>
        <div className="weekly-games">
          {weekly.map((id) => (
            <Link
              key={id}
              to={`/play/${id}`}
              style={accentStyle(gameById[id].category)}
              className={weeklyDone.includes(id) ? "done" : ""}
            >
              <Icon name={gameById[id].icon} size={18} />
              {gameById[id].name}
              {weeklyDone.includes(id) ? (
                <Check size={15} className="success-text" />
              ) : (
                <ArrowRight size={15} />
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
