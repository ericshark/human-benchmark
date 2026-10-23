import type { CSSProperties } from "react";
import type { CategoryId, GameDefinition, GameId } from "../domain/types";

export const categories: {
  id: CategoryId;
  name: string;
  /** Muted tint for small signals: icon tiles, dots, bars, arena highlights. */
  color: string;
  description: string;
}[] = [
  {
    id: "reflexes",
    name: "Reflexes",
    color: "#e8a26a",
    description: "Find your fast.",
  },
  {
    id: "memory",
    name: "Memory",
    color: "#a99bf0",
    description: "Hold onto the details.",
  },
  {
    id: "focus",
    name: "Focus",
    color: "#e3c56c",
    description: "Cut through the noise.",
  },
  {
    id: "reasoning",
    name: "Reasoning",
    color: "#7ea7ef",
    description: "See what comes next.",
  },
  {
    id: "precision",
    name: "Precision",
    color: "#e78aa8",
    description: "Make every move count.",
  },
  {
    id: "processing",
    name: "Processing",
    color: "#6ec4b4",
    description: "Think on your feet.",
  },
];
export const games: GameDefinition[] = [
  {
    id: "signal",
    name: "Signal",
    category: "reflexes",
    description: "One signal. One response. How quickly can you react?",
    tagline: "Meet your reflexes.",
    duration: "45–60 sec",
    icon: "zap",
    keys: ["Space"],
    instructions: [
      "Wait while the arena says “Hold.”",
      "When the signal appears, click, tap, or press Space.",
      "There are 12 trials. An early response consumes a trial.",
    ],
    measurement:
      "Median valid response time and consistency. All 12 trials contribute to the penalized average; false starts and timeouts count as 2,500 ms. Browser and hardware latency are included.",
  },
  {
    id: "crossroads",
    name: "Crossroads",
    category: "reflexes",
    description: "Four directions. A split-second decision. Choose your lane.",
    tagline: "Speed meets decision.",
    duration: "60 sec",
    icon: "route",
    keys: ["←", "↑", "↓", "→"],
    instructions: [
      "Follow the direction of the arrow in the center.",
      "Use arrow keys or the four direction buttons.",
      "Answer 30 signals. Each has a 2.5-second deadline.",
    ],
    measurement:
      "Correct response latency and accuracy. Wrong or missed responses count as 2,500 ms in the penalized average. Directions are balanced across the session.",
  },
  {
    id: "grid-recall",
    name: "Grid Recall",
    category: "memory",
    description: "A constellation appears. Remember where the lights were.",
    tagline: "Every detail matters.",
    duration: "90 sec",
    icon: "grid",
    instructions: [
      "Remember the illuminated cells in the 4 × 4 grid.",
      "When they disappear, select those same cells and submit.",
      "Two consecutive passes increase the level; a miss lowers it. Play 12 boards.",
    ],
    measurement:
      "Staircase level is the average presented level of the last six boards, not a diagnosis of memory capacity. Also see exact recalls, highest passed level, and false selections.",
  },
  {
    id: "echo-path",
    name: "Echo Path",
    category: "memory",
    description: "Watch a path light up, then play it back in order.",
    tagline: "Follow your memory.",
    duration: "90 sec",
    icon: "waypoints",
    instructions: [
      "Watch the pads light up one at a time.",
      "Repeat the sequence in the same order using the pads.",
      "Two consecutive passes increase the length; a miss lowers it. Play 12 sequences.",
    ],
    measurement:
      "Average presented length of the last six sequences, alongside exact recalls and highest passed length. The starting length is 3; the range is 1–12.",
  },
  {
    id: "color-conflict",
    name: "Color Conflict",
    category: "focus",
    description: "Read the color. Ignore the word. Easier said than done.",
    tagline: "Trust your eyes.",
    duration: "60 sec",
    icon: "palette",
    keys: ["1", "2", "3", "4"],
    instructions: [
      "Choose the INK color of the word, ignoring what it says.",
      "Use the labeled buttons or keys 1–4.",
      "Complete 40 trials. Some words match their ink; others conflict.",
    ],
    measurement:
      "Median correct response, accuracy, and interference cost. The fixed mix contains 20 matching and 20 conflicting trials; errors and timeouts receive 2,500 ms.",
  },
  {
    id: "rule-shift",
    name: "Rule Shift",
    category: "focus",
    description: "The rule changes. Can your attention change with it?",
    tagline: "Stay one step ahead.",
    duration: "75 sec",
    icon: "switch",
    keys: ["1", "2"],
    instructions: [
      "The cue asks either “ODD OR EVEN?” or “CIRCLE OR SQUARE?”",
      "Apply only the current rule to the shape and number.",
      "Use the two buttons or keys 1–2. Complete 40 trials.",
    ],
    measurement:
      "Accuracy and response time on repeat-rule and switch-rule trials. Switch cost is the difference in correct median latency; it is descriptive, not a separate rating.",
  },
  {
    id: "pattern-forge",
    name: "Pattern Forge",
    category: "reasoning",
    description: "Find the hidden rule. Fill in the missing piece.",
    tagline: "Connect the dots.",
    duration: "2 min",
    icon: "puzzle",
    keys: ["1", "2", "3", "4"],
    instructions: [
      "Find the next number using the displayed rule family.",
      "Choose one of four answers with the buttons or keys 1–4.",
      "Solve 12 generated questions. Each has a 15-second limit.",
    ],
    measurement:
      "Difficulty-weighted accuracy across arithmetic, alternating, and second-difference rules. Correctness comes first; solve time is reported separately. The explicit family keeps rules unambiguous.",
  },
  {
    id: "rotation-lab",
    name: "Rotation Lab",
    category: "reasoning",
    description: "Same shape, new perspective. Find the rotated match.",
    tagline: "Turn it over in your mind.",
    duration: "90 sec",
    icon: "rotate",
    keys: ["1", "2", "3", "4"],
    instructions: [
      "Inspect the reference shape and the requested rotation.",
      "Find the option that matches after that clockwise turn.",
      "Complete 16 questions. Each has an 8-second limit.",
    ],
    measurement:
      "Difficulty-weighted accuracy with response time and rotation breakdown. All options are unique and exactly one matches the requested rotation.",
  },
  {
    id: "target-burst",
    name: "Target Burst",
    category: "precision",
    description: "Find your rhythm. Acquire each target with accuracy.",
    tagline: "Make your move.",
    duration: "45 sec",
    icon: "target",
    instructions: [
      "Click or tap the center of each appearing target.",
      "Targets vary in size and position over 30 trials.",
      "A miss consumes a trial. Declare mouse, trackpad, or touch in Settings.",
    ],
    measurement:
      "Acquisition time, hit rate, and endpoint error in target radii. Misses and timeouts count as 2,500 ms. Precision history is grouped by declared input.",
  },
  {
    id: "orbit-track",
    name: "Orbit Track",
    category: "precision",
    description: "Stay with a moving target as its path unfolds.",
    tagline: "Find your flow.",
    duration: "45 sec",
    icon: "orbit",
    instructions: [
      "Keep your cursor or finger inside the moving ring.",
      "On touch, hold and drag inside the arena.",
      "Follow three 15-second paths. Time outside the arena counts as off-target.",
    ],
    measurement:
      "Time on target and time-weighted tracking error in target radii. Samples are weighted by elapsed time; missing input receives a three-radius penalty.",
  },
  {
    id: "symbol-match",
    name: "Symbol Match",
    category: "processing",
    description: "Decode a changing world, one symbol at a time.",
    tagline: "Make the connection.",
    duration: "45 sec",
    icon: "scan",
    keys: ["1", "2", "3", "4"],
    instructions: [
      "Use the visible legend to decode the large symbol.",
      "Select the matching number using buttons or keys 1–4.",
      "Work for 45 seconds. Correct answers earn 1; wrong answers cost ⅓.",
    ],
    measurement:
      "Net correct answers per minute, accuracy, and decision time. The legend is fixed per session; symbol order is balanced in shuffled blocks.",
  },
  {
    id: "math-sprint",
    name: "Math Sprint",
    category: "processing",
    description: "Small calculations. Quick decisions. Keep the momentum.",
    tagline: "Think on your feet.",
    duration: "45 sec",
    icon: "calculator",
    keys: ["1", "2", "3", "4"],
    instructions: [
      "Solve each short arithmetic problem.",
      "Choose the answer using buttons or keys 1–4.",
      "Work for 45 seconds. Errors cost ⅓ of a correct answer.",
    ],
    measurement:
      "Net correct answers per minute with accuracy and operation-level response times. Addition, subtraction, and multiplication occur in balanced blocks.",
  },
];
export const gameById = Object.fromEntries(
  games.map((game) => [game.id, game]),
) as Record<GameId, GameDefinition>;
export const introGames: GameId[] = [
  "signal",
  "grid-recall",
  "color-conflict",
  "pattern-forge",
  "target-burst",
  "symbol-match",
];
export function getCategory(id: CategoryId) {
  return categories.find((category) => category.id === id)!;
}
export function accentStyle(id: CategoryId): CSSProperties {
  return { "--cat": getCategory(id).color } as CSSProperties;
}
