import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import { accentStyle, getCategory } from "../games/registry";
import type { GameDefinition, Session } from "../domain/types";
import { bestSession, formatPrimary } from "../domain/scoring";
import { Icon } from "./Icon";

export function GameCard({
  game,
  sessions,
}: {
  game: GameDefinition;
  sessions: Session[];
}) {
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
      <div className="game-card-top">
        <span className="icon-tile">
          <Icon name={game.icon} size={18} strokeWidth={1.75} />
        </span>
        <span className="card-category">{getCategory(game.category).name}</span>
        <ArrowRight className="card-arrow" size={16} />
      </div>
      <h3>{game.name}</h3>
      <p>{game.description}</p>
      <div className="game-card-footer">
        <span>
          <Clock3 size={13} />
          {game.duration}
        </span>
        <span className={best ? "card-best" : "muted"}>
          {best ? `Best ${formatPrimary(best)}` : "Not played"}
        </span>
      </div>
    </Link>
  );
}
