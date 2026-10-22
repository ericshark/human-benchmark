import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { categories, games } from "../games/registry";
import { GameCard } from "../components/GameCard";
import { Icon } from "../components/Icon";
import { CoverageWheel } from "../components/Charts";

export default function Home() {
  const { sessions, settings } = useApp();
  const valid = sessions.filter(
    (session) => session.mode === "assessment" && !session.flags.length,
  );
  const played = new Set(valid.map((session) => session.gameId));
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            THE HUMAN PERFORMANCE ARCADE
          </div>
          <h1>
            There’s more
            <br />
            to <em>you.</em>
          </h1>
          <p>
            Quick reflexes. A sharp memory. Unshakable focus.
            <br className="desktop-break" /> Play your way to discovering what
            makes you, you.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/challenges?circuit=intro">
              Discover my strengths <ArrowRight size={18} />
            </Link>
            <Link className="text-link" to="/games">
              Explore the games <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-details">
            <span>
              <Check size={14} />
              No account needed
            </span>
            <span>
              <Clock3 size={14} />A few minutes of curiosity
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit-grid" />
          <div className="hero-orbit outer" />
          <div className="hero-orbit middle" />
          <div className="hero-orbit inner" />
          <div className="hero-core">
            <span className="core-symbol">✳</span>
          </div>
          <span className="orbit-label label-one">
            <Zap size={15} />
            REFLEXES
          </span>
          <span className="orbit-label label-two">
            <Icon name="memory" size={15} />
            MEMORY
          </span>
          <span className="orbit-label label-three">
            <Target size={15} />
            PRECISION
          </span>
          <span className="orbit-label label-four">
            <Icon name="reasoning" size={15} />
            REASONING
          </span>
          <span className="orbit-point point-one" />
          <span className="orbit-point point-two" />
          <span className="hero-visual-caption">SIX DIMENSIONS. ONE YOU.</span>
        </div>
      </section>
      <div className="discovery-strip">
        <div>
          <span className="strip-icon">
            <Sparkles size={20} />
          </span>
          <strong>Big discoveries. Small games.</strong>
          <span>12 challenges to meet a different side of yourself.</span>
        </div>
        <Link to="/methodology">
          Built on curiosity <ArrowUpRight size={15} />
        </Link>
      </div>
      <section className="explore-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
            <h2>Find your next “wait, I can do that?”</h2>
          </div>
          <Link className="text-link" to="/games">
            All 12 games <ArrowRight size={17} />
          </Link>
        </div>
        <div className="category-shortcuts">
          {categories.map((category) => (
            <Link
              to={`/games?category=${category.id}`}
              key={category.id}
              style={{ "--accent": category.color } as React.CSSProperties}
            >
              <Icon name={category.id} size={17} />
              <span>{category.name}</span>
            </Link>
          ))}
        </div>
        <div className="game-grid">
          {[
            "signal",
            "grid-recall",
            "color-conflict",
            "pattern-forge",
            "target-burst",
            "symbol-match",
          ].map((id) => (
            <GameCard
              key={id}
              game={games.find((game) => game.id === id)!}
              sessions={sessions}
            />
          ))}
        </div>
      </section>
      <div className="home-lower">
        <section className="profile-preview panel">
          <div>
            <span className="eyebrow">A PICTURE OF YOUR POTENTIAL</span>
            <h2>
              {played.size
                ? `Keep exploring, ${settings.name}.`
                : "Every game adds a little more you."}
            </h2>
            <p>
              Connect your results across six categories. Find your personal
              bests, follow your progress, and see your profile take shape.
            </p>
            <Link className="text-link" to="/profile">
              Explore my profile <ArrowRight size={17} />
            </Link>
            <div className="preview-counts">
              <span>
                <strong>{played.size}</strong>of 12 games explored
              </span>
              <span>
                <strong>{valid.length}</strong>assessments completed
              </span>
            </div>
          </div>
          <CoverageWheel sessions={sessions} />
        </section>
        <section className="daily-preview panel">
          <span className="challenge-tag">
            <span className="status-dot" />A FRESH LITTLE CHALLENGE
          </span>
          <Trophy size={35} strokeWidth={1.2} />
          <h2>
            Make curiosity
            <br />a daily thing.
          </h2>
          <p>
            Three games. A new combination every day.
            <br />
            Your only competition? Yesterday’s you.
          </p>
          <Link className="button secondary" to="/challenges">
            Today’s circuit <ArrowUpRight size={17} />
          </Link>
        </section>
      </div>
    </div>
  );
}
