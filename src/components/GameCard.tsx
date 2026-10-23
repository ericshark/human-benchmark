import { Link } from "react-router-dom";
import { Clock3, Play, Trophy } from "lucide-react";
import { accentStyle, getCategory } from "../games/registry";
import type { GameDefinition, Session } from "../domain/types";
import { bestSession, formatPrimary } from "../domain/scoring";
import { Icon } from "./Icon";

export function GameArt({
  game,
  size = "card",
}: {
  game: GameDefinition;
  size?: "card" | "hero";
}) {
  return (
    <div
      className={`game-art art-${game.category} art-${size}`}
      aria-hidden="true"
    >
      <span className="art-blob blob-one" />
      <span className="art-blob blob-two" />
      {game.category === "memory" ? (
        <div className="art-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={[0, 4, 5, 7].includes(i) ? "on" : ""} />
          ))}
        </div>
      ) : game.category === "focus" ? (
        <div className="focus-words">
          <span>RED</span>
          <span>BLUE</span>
        </div>
      ) : game.category === "processing" ? (
        <div className="art-symbols">
          <span>◆</span>
          <span>+</span>
          <span>▲</span>
        </div>
      ) : (
        <span className="art-icon">
          <Icon
            name={game.icon}
            size={size === "hero" ? 84 : 58}
            strokeWidth={2.4}
          />
        </span>
      )}
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
      style={accentStyle(game.category)}
    >
      <GameArt game={game} />
      {best ? (
        <span className="card-badge best">
          <Trophy size={13} strokeWidth={2.6} />
          {formatPrimary(best)}
        </span>
      ) : (
        <span className="card-badge new">New</span>
      )}
      <div className="game-card-content">
        <span className="card-category">{category.name}</span>
        <h3>{game.name}</h3>
        <p>{game.description}</p>
        <div className="game-card-footer">
          <span className="chip">
            <Clock3 size={13} strokeWidth={2.4} />
            {game.duration}
          </span>
          <span className="card-play" aria-hidden="true">
            <Play size={16} fill="currentColor" />
          </span>
        </div>
      </div>
    </Link>
  );
}
