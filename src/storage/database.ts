import Dexie, { type EntityTable } from "dexie";
import type { Session } from "../domain/types";

export class HumanRankDatabase extends Dexie {
  sessions!: EntityTable<Session, "id">;
  uploads!: EntityTable<
    { id: string; ownerId: string; sessionId: string; tokenId?: string },
    "id"
  >;
  constructor(name = "humanrank") {
    super(name);
    this.version(1).stores({
      sessions: "id, gameId, completedAt, mode, input, dailyId",
    });
    this.version(2).stores({ uploads: "id, ownerId, sessionId" });
  }
}
export const database = new HumanRankDatabase();
