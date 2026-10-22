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
import { gameById, introGames } from "../games/registry";
import { dailyGames, localDay, weeklyGames } from "./progress";
import { Icon } from "../components/Icon";

export default function Challenges() {
  const { sessions, introProgress, resetIntro } = useApp(),
    [params] = useSearchParams();
  const daily = dailyGames(),
    day = localDay(),
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
        <span className="eyebrow">KEEP YOUR CURIOSITY MOVING</span>
        <h1>A little challenge goes a long way.</h1>
        <p>
          Fresh combinations, personal milestones, and a reason to surprise
          yourself.
        </p>
      </div>
      <section
        className={`panel intro-circuit ${params.get("circuit") === "intro" ? "featured" : ""}`}
      >
        <div className="circuit-copy">
          <span className="challenge-tag">
            <Sparkles size={14} />
            THE DISCOVERY CIRCUIT
          </span>
          <h2>
            Meet six sides
            <br />
            of yourself.
          </h2>
          <p>
            One game from every category. A first look at your personal
            performance profile. Pick up where you left off.
          </p>
          <div className="circuit-facts">
            <span>
              <Clock3 size={15} />
              About 6–8 minutes
            </span>
            <span>{introProgress.length} / 6 explored</span>
          </div>
          <div className="inline-actions">
            {nextIntro ? (
              <Link
                className="button primary"
                to={`/play/${nextIntro}?circuit=intro`}
              >
                {introProgress.length
                  ? "Continue discovering"
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
            <Link key={id} to={`/play/${id}?circuit=intro`}>
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
          <div>
            <span className="eyebrow">A FRESH COMBINATION, EVERY DAY</span>
            <h2>
              <Flame size={25} />
              Today’s circuit
            </h2>
          </div>
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
              className="panel daily-card"
              key={id}
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
              <Icon name={gameById[id].icon} size={38} strokeWidth={1.2} />
              <span className="eyebrow">{gameById[id].category}</span>
              <h3>{gameById[id].name}</h3>
              <p>{gameById[id].description}</p>
              <span className="text-link">
                {doneToday.includes(id)
                  ? "Replay the challenge"
                  : "Take the challenge"}
                <ArrowRight size={17} />
              </span>
            </Link>
          ))}
        </div>
        <p className="small-note">
          Daily challenges use shared seeds and your device’s local date. They
          earn participation milestones and have separate records from
          assessments.
        </p>
        {doneToday.length === 3 && (
          <div className="notice">
            <Trophy size={25} />
            <div>
              <strong>Your daily dose of discovery, complete.</strong>
              <p>
                All three games are in your history. Come back tomorrow for a
                new combination.
              </p>
            </div>
          </div>
        )}
      </section>
      <section className="panel weekly-panel">
        <div>
          <span className="eyebrow">THIS WEEK’S EXPLORATION</span>
          <h2>Take the scenic route.</h2>
          <p>
            Try these six games this week. Variety counts here; your performance
            rating never receives participation bonuses.
          </p>
          <span className="weekly-progress">
            {weeklyDone.length} of 6 explored
          </span>
        </div>
        <div className="weekly-games">
          {weekly.map((id) => (
            <Link key={id} to={`/play/${id}`}>
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
