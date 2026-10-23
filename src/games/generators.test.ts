import { describe, expect, it } from "vitest";
import { hashSeed, seededRandom, shuffle } from "../engine/random";
import {
  makeQuestion,
  memoryPattern,
  nextMemoryLevel,
  rotateFigure,
} from "./generators";
import { games } from "./registry";
import { dailyGames, localDay, currentStreak } from "../features/progress";

describe("reproducible challenge generation", () => {
  it("reproduces seed streams and permutations", () => {
    const a = seededRandom(123),
      b = seededRandom(123);
    expect(Array.from({ length: 100 }, a)).toEqual(
      Array.from({ length: 100 }, b),
    );
    expect(new Set(shuffle([0, 1, 2, 3], seededRandom(22))).size).toBe(4);
    expect(hashSeed("today")).toBe(hashSeed("today"));
  });
  it("defines exactly two anchor games for each category", () => {
    expect(games).toHaveLength(12);
    expect(new Set(games.map((game) => game.id)).size).toBe(12);
    for (const category of new Set(games.map((game) => game.category)))
      expect(games.filter((game) => game.category === category)).toHaveLength(
        2,
      );
  });
  it("generates unambiguous patterns with an independently calculated answer", () => {
    for (let seed = 0; seed < 100; seed++)
      for (let index = 0; index < 12; index++) {
        const question = makeQuestion(
          "pattern-forge",
          index,
          seededRandom(seed),
        );
        const values = question.text
          .split("·")
          .slice(0, 4)
          .map((value) => Number(value.trim()));
        const delta = values
          .slice(1)
          .map((value, item) => value - values[item]);
        const expected =
          question.condition === "CONSTANT STEP"
            ? values[3] + delta[0]
            : question.condition === "ALTERNATING STEPS"
              ? values[3] + delta[1]
              : values[3] + delta[2] + (delta[2] - delta[1]);
        expect(Number(question.options[question.answer])).toBe(expected);
        expect(new Set(question.options).size).toBe(4);
      }
  });
  it("gives every rotation puzzle four unique options and one independently rotated answer", () => {
    for (let seed = 0; seed < 40; seed++)
      for (let index = 0; index < 16; index++) {
        const question = makeQuestion(
          "rotation-lab",
          index,
          seededRandom(seed),
        );
        const turns = Number(question.text.replace("°", "")) / 90;
        let matrix = Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 3 }, (_, col) =>
            question.figure!.includes(row * 3 + col),
          ),
        );
        for (let turn = 0; turn < turns; turn++)
          matrix = Array.from({ length: 3 }, (_, row) =>
            Array.from({ length: 3 }, (_, col) => matrix[2 - col][row]),
          );
        const expected = matrix.flatMap((row, y) =>
          row.flatMap((filled, x) => (filled ? [y * 3 + x] : [])),
        );
        expect(question.figures![question.answer]).toEqual(expected);
        expect(
          new Set(question.figures!.map((figure) => figure.join())).size,
        ).toBe(4);
        expect(rotateFigure(question.figure!, 4)).toEqual(
          [...question.figure!].sort((a, b) => a - b),
        );
      }
  });
  it("creates bounded arithmetic with a unique correct option", () => {
    for (let index = 0; index < 300; index++) {
      const question = makeQuestion("math-sprint", index, seededRandom(index));
      const [left, operator, right] = question.text.split(" "),
        a = Number(left),
        b = Number(right);
      const expected =
        operator === "+" ? a + b : operator === "−" ? a - b : a * b;
      expect(Number(question.options[question.answer])).toBe(expected);
      expect(new Set(question.options).size).toBe(4);
    }
  });
  it("keeps memory patterns valid and advances only after two consecutive passes", () => {
    for (let level = 1; level <= 12; level++) {
      const pattern = memoryPattern(level, false, seededRandom(level));
      expect(pattern).toHaveLength(level);
      expect(new Set(pattern).size).toBe(level);
      expect(pattern.every((cell) => cell >= 0 && cell < 16)).toBe(true);
    }
    expect(nextMemoryLevel(3, 0, true)).toEqual({ level: 3, streak: 1 });
    expect(nextMemoryLevel(3, 1, true)).toEqual({ level: 4, streak: 0 });
    expect(nextMemoryLevel(3, 1, false)).toEqual({ level: 2, streak: 0 });
    expect(nextMemoryLevel(1, 0, false).level).toBe(1);
    expect(nextMemoryLevel(12, 1, true).level).toBe(12);
  });
  it("produces distinct stable daily games and local dates without UTC rollover", () => {
    expect(dailyGames("2026-10-21")).toEqual(dailyGames("2026-10-21"));
    expect(new Set(dailyGames("2026-10-21")).size).toBe(3);
    expect(localDay(new Date(2026, 9, 21, 23, 59))).toBe("2026-10-21");
    expect(currentStreak([])).toBe(0);
  });
});

it("varies rotation figures across seeds with explicit four- and five-cell bands", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 300; seed++)
    for (const index of [0, 8]) {
      const question = makeQuestion("rotation-lab", index, seededRandom(seed));
      expect(question.figure).toHaveLength(index === 0 ? 4 : 5);
      seen.add(question.figure!.join(","));
    }
  expect(seen.size).toBeGreaterThan(30);
});
