import { integer, shuffle } from "../engine/random";
import type { GameId } from "../domain/types";

export const colors = [
  { name: "Coral", ink: "#ff857c" },
  { name: "Blue", ink: "#7fb8ff" },
  { name: "Green", ink: "#a8e66a" },
  { name: "Gold", ink: "#f6c769" },
];
export const symbols = ["◇", "✳", "△", "⊕"];
export interface Question {
  text: string;
  options: string[];
  answer: number;
  condition: string;
  level: number;
  ink?: string;
  cue?: string;
  shape?: string;
  figure?: number[];
  figures?: number[][];
  explanation?: string;
}
export function numberOptions(
  answer: number,
  random: () => number,
): { options: string[]; answer: number } {
  const values = new Set([answer]);
  while (values.size < 4) values.add(answer + integer(random, -12, 12));
  const options = shuffle([...values], random).map(String);
  return { options, answer: options.indexOf(String(answer)) };
}
export function rotateFigure(figure: number[], turns: number): number[] {
  let cells = [...figure];
  for (let turn = 0; turn < turns; turn++)
    cells = cells.map((cell) => (cell % 3) * 3 + (2 - Math.floor(cell / 3)));
  return cells.sort((a, b) => a - b);
}
function figurePool(size: number): number[][] {
  const pool: number[][] = [];
  for (let mask = 1; mask < 512; mask++) {
    const cells = Array.from({ length: 9 }, (_, index) => index).filter(
      (index) => (mask & (1 << index)) !== 0,
    );
    if (cells.length !== size) continue;
    const reached = new Set([cells[0]]),
      pending = [cells[0]];
    while (pending.length) {
      const cell = pending.pop()!;
      for (const next of cells) {
        if (
          !reached.has(next) &&
          Math.abs(Math.floor(cell / 3) - Math.floor(next / 3)) +
            Math.abs((cell % 3) - (next % 3)) ===
            1
        ) {
          reached.add(next);
          pending.push(next);
        }
      }
    }
    if (
      reached.size === size &&
      new Set([0, 1, 2, 3].map((turn) => rotateFigure(cells, turn).join(",")))
        .size === 4
    )
      pool.push(cells);
  }
  return pool;
}
const figurePools = [figurePool(4), figurePool(5)];
export function makeQuestion(
  game: GameId,
  index: number,
  random: () => number,
  legend = [1, 2, 3, 4],
  previousRule = 0,
): Question {
  if (game === "crossroads") {
    const direction = index % 4;
    return {
      text: ["←", "↑", "↓", "→"][direction],
      options: ["←", "↑", "↓", "→"],
      answer: direction,
      condition: ["left", "up", "down", "right"][direction],
      level: 1,
    };
  }
  if (game === "color-conflict") {
    const color = integer(random, 0, 3),
      congruent = index % 2 === 0;
    const word = congruent ? color : (color + integer(random, 1, 3)) % 4;
    return {
      text: colors[word].name.toUpperCase(),
      ink: colors[color].ink,
      options: colors.map((item) => item.name),
      answer: color,
      condition: congruent ? "congruent" : "incongruent",
      level: 1,
      cue: "CHOOSE THE INK COLOR",
    };
  }
  if (game === "rule-shift") {
    const rule =
      index === 0 ? 0 : index % 2 === 0 ? 1 - previousRule : previousRule;
    const number = integer(random, 1, 9),
      circle = random() > 0.5;
    return {
      text: String(number),
      shape: circle ? "circle" : "square",
      cue: rule === 0 ? "ODD OR EVEN?" : "CIRCLE OR SQUARE?",
      options: rule === 0 ? ["Odd", "Even"] : ["Circle", "Square"],
      answer: rule === 0 ? (number % 2 === 1 ? 0 : 1) : circle ? 0 : 1,
      condition: index === 0 || rule === previousRule ? "repeat" : "switch",
      level: rule,
    };
  }
  if (game === "pattern-forge") {
    const family = index % 3,
      level = Math.floor(index / 4) + 1;
    const start = integer(random, 1, 10),
      step = integer(random, 2, 4 + level);
    let sequence: number[], answer: number, cue: string, explanation: string;
    if (family === 0) {
      sequence = Array.from({ length: 4 }, (_, item) => start + item * step);
      answer = start + 4 * step;
      cue = "CONSTANT STEP";
      explanation = `Add ${step} each time.`;
    } else if (family === 1) {
      const second = step + integer(random, 1, 4);
      sequence = [
        start,
        start + step,
        start + step + second,
        start + 2 * step + second,
      ];
      answer = start + 2 * step + 2 * second;
      cue = "ALTERNATING STEPS";
      explanation = `Alternate adding ${step} and ${second}.`;
    } else {
      sequence = [
        start,
        start + step,
        start + 2 * step + level,
        start + 3 * step + 3 * level,
      ];
      answer = start + 4 * step + 6 * level;
      cue = "GROWING STEPS";
      explanation = `The step grows by ${level} each time: ${step}, ${step + level}, ${step + 2 * level}, ${step + 3 * level}.`;
    }
    return {
      text: sequence.join("   ·   ") + "   ·   ?",
      ...numberOptions(answer, random),
      condition: cue,
      cue,
      level,
      explanation,
    };
  }
  if (game === "rotation-lab") {
    const pool = figurePools[index < 8 ? 0 : 1];
    const figure = pool[integer(random, 0, pool.length - 1)],
      turns = 1 + (index % 3);
    const target = rotateFigure(figure, turns);
    const alternatives = [0, 1, 2, 3].map((turn) => rotateFigure(figure, turn));
    const options = shuffle(alternatives, random);
    return {
      text: `${turns * 90}°`,
      options: ["A", "B", "C", "D"],
      answer: options.findIndex((item) => item.join() === target.join()),
      condition: `${turns * 90} degrees`,
      cue: "ROTATE CLOCKWISE",
      level: index < 8 ? 1 : 2,
      figure,
      figures: options,
      explanation: `Rotate the reference ${turns * 90}° clockwise.`,
    };
  }
  if (game === "symbol-match") {
    const symbol = index % 4;
    return {
      text: symbols[symbol],
      options: ["1", "2", "3", "4"],
      answer: legend[symbol] - 1,
      condition: symbols[symbol],
      level: 1,
      cue: "DECODE THE SYMBOL",
    };
  }
  const operation = index % 3,
    a = integer(random, 2, operation === 2 ? 9 : 24),
    b = integer(random, 2, operation === 2 ? 9 : 19);
  const answer = operation === 0 ? a + b : operation === 1 ? a - b : a * b;
  return {
    text: `${a} ${["+", "−", "×"][operation]} ${b}`,
    ...numberOptions(answer, random),
    condition: ["addition", "subtraction", "multiplication"][operation],
    level: 1,
    cue: "FIND THE ANSWER",
  };
}
export function memoryPattern(
  length: number,
  sequence: boolean,
  random: () => number,
): number[] {
  return sequence
    ? Array.from({ length }, () => integer(random, 0, 8))
    : shuffle(
        Array.from({ length: 16 }, (_, index) => index),
        random,
      ).slice(0, length);
}
export function nextMemoryLevel(
  level: number,
  streak: number,
  correct: boolean,
): { level: number; streak: number } {
  if (!correct) return { level: Math.max(1, level - 1), streak: 0 };
  if (streak === 1) return { level: Math.min(12, level + 1), streak: 0 };
  return { level, streak: 1 };
}
