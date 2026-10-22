import type { GameId, Mode, Trial } from "../domain/types";
export interface GameProps {
  gameId: GameId;
  mode: Mode;
  seed: number;
  onComplete: (trials: Trial[]) => void;
  onInterrupt: (reason: string) => void;
}
