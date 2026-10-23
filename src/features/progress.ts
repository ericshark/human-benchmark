import type { GameId, Session } from "../domain/types";
import { games } from "../games/registry";
import { hashSeed, seededRandom, shuffle } from "../engine/random";
import { bestSession } from "../domain/scoring";

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dailyGames(day = localDay()): GameId[] {
  return shuffle(
    games.map((game) => game.id),
    seededRandom(hashSeed(day)),
  ).slice(0, 3);
}
export function weeklyGames(date = new Date()): GameId[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return shuffle(
    games.map((game) => game.id),
    seededRandom(hashSeed(`week:${localDay(start)}`)),
  ).slice(0, 6);
}
export function activeDays(sessions: Session[]): number {
  return new Set(
    sessions.map((session) => localDay(new Date(session.completedAt))),
  ).size;
}
export function currentStreak(sessions: Session[], today = new Date()): number {
  const days = new Set(
    sessions.map((session) => localDay(new Date(session.completedAt))),
  );
  const cursor = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
export function achievements(sessions: Session[]) {
  const completed = sessions.filter(
    (session) => session.mode === "assessment" && !session.flags.length,
  );
  const ids = new Set(completed.map((session) => session.gameId));
  const categories = new Set(
    [...ids].map((id) => games.find((game) => game.id === id)!.category),
  );
  return [
    {
      id: "first",
      title: "First spark",
      description: "Finish your first assessment.",
      icon: "zap",
      unlocked: completed.length >= 1,
      progress: `${Math.min(completed.length, 1)} / 1`,
    },
    {
      id: "six",
      title: "Curious by nature",
      description: "Explore all six categories.",
      icon: "puzzle",
      unlocked: categories.size === 6,
      progress: `${categories.size} / 6`,
    },
    {
      id: "twelve",
      title: "Full spectrum",
      description: "Complete all twelve games.",
      icon: "grid",
      unlocked: ids.size === 12,
      progress: `${ids.size} / 12`,
    },
    {
      id: "days",
      title: "A little every day",
      description: "Play on seven different days.",
      icon: "orbit",
      unlocked: activeDays(sessions) >= 7,
      progress: `${Math.min(activeDays(sessions), 7)} / 7`,
    },
    {
      id: "repeat",
      title: "Find your rhythm",
      description: "Finish twenty assessments.",
      icon: "waypoints",
      unlocked: completed.length >= 20,
      progress: `${Math.min(completed.length, 20)} / 20`,
    },
    {
      id: "daily",
      title: "Daily dose",
      description: "Finish all three games in one daily circuit.",
      icon: "target",
      unlocked: [
        ...new Set(sessions.map((session) => session.dailyId).filter(Boolean)),
      ].some((day) =>
        dailyGames(day).every((id) =>
          sessions.some(
            (session) =>
              session.dailyId === day &&
              session.gameId === id &&
              !session.flags.length,
          ),
        ),
      ),
      progress: "Daily circuit",
    },
  ];
}

export const XP_REWARDS = { game: 100, daily: 50, record: 150 } as const;

/**
 * XP earned by each saved session. A record bonus is only granted when a
 * session strictly beats every earlier comparable session, so the very first
 * attempt at a game never counts as a personal best.
 */
export function sessionXp(
  sessions: Session[],
): Map<string, { xp: number; record: boolean }> {
  const earned = new Map<string, { xp: number; record: boolean }>();
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    if (session.mode === "practice" || session.flags.length) continue;
    const key = [
      session.gameId,
      session.mode,
      session.version,
      session.input,
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    let best: Session | undefined;
    for (const session of group) {
      const leader = bestSession(best ? [best, session] : [session]);
      const record = !!best && leader === session;
      best = leader;
      earned.set(session.id, {
        xp:
          XP_REWARDS.game +
          (session.mode === "daily" ? XP_REWARDS.daily : 0) +
          (record ? XP_REWARDS.record : 0),
        record,
      });
    }
  }
  return earned;
}

/** Total XP needed to reach a level: 0, 100, 300, 600, 1000, … */
export function levelThreshold(level: number): number {
  return (XP_REWARDS.game * (level - 1) * level) / 2;
}
export function playerProgress(sessions: Session[]) {
  let xp = 0,
    records = 0;
  for (const value of sessionXp(sessions).values()) {
    xp += value.xp;
    if (value.record) records++;
  }
  let level = 1;
  while (xp >= levelThreshold(level + 1)) level++;
  const floor = levelThreshold(level),
    ceiling = levelThreshold(level + 1);
  return {
    xp,
    level,
    levelXp: xp - floor,
    nextLevelXp: ceiling - floor,
    records,
  };
}
