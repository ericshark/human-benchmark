import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { getCategory } from "../games/registry";
import type { GameDefinition, Session } from "../domain/types";
import { bestSession, formatMetric, scoreSession } from "../domain/scoring";
import { Icon } from "./Icon";

export function GameArt({ game }: { game: GameDefinition }) {
  return (
    <div className={`game-art art-${game.category}`} aria-hidden="true">
      <span className="art-orbit orbit-one" />
      <span className="art-orbit orbit-two" />
      {game.category === "memory" ? (
        <div className="art-grid">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className={[1, 3, 4, 9, 10, 14].includes(i) ? "on" : ""}
            />
          ))}
        </div>
      ) : game.category === "focus" ? (
        <div className="focus-words">
          <span>BLUE</span>
          <span>GREEN</span>
          <span>RED</span>
        </div>
      ) : game.category === "processing" ? (
        <div className="art-symbols">
          <span>◇</span>
          <span>+</span>
          <span>△</span>
        </div>
      ) : (
        <Icon name={game.icon} size={60} strokeWidth={1.25} />
      )}
      <span className="art-corner">
        HR / {game.id.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}
export function GameCard({
  game,
  sessions,
}: {
  game: GameDefinition;
  sessions: Session[];
}) {
  const category = getCategory(game.category);
  const best = bestSession(
    sessions.filter(
      (session) => session.gameId === game.id && session.mode === "assessment",
    ),
  );
  return (
    <Link
      className="game-card"
      to={`/play/${game.id}`}
      style={{ "--accent": category.color } as CSSProperties}
    >
      <GameArt game={game} />
      <div className="game-card-content">
        <div className="card-category">
          <span className="color-dot" />
          {category.name}
          <ArrowUpRight size={17} />
        </div>
        <h3>{game.name}</h3>
        <p>{game.description}</p>
        <div className="game-card-footer">
          <span>
            <Clock3 size={13} />
            {game.duration}
          </span>
          <span>
            {best
              ? `Best ${formatMetric(scoreSession(best).primary)}`
              : "Discover your baseline"}
            <span className="card-play">↗</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
