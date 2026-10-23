import type { GameId, Mode, Trial } from "../domain/types";
export interface GameProps {
  gameId: GameId;
  mode: Mode;
  seed: number;
  variant?: "classic" | "remix";
  onComplete: (trials: Trial[]) => void;
  onInterrupt: (reason: string) => void;
}
