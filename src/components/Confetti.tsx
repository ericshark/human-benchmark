import { useMemo, type CSSProperties } from "react";
import { useApp } from "../app/AppContext";
import { seededRandom } from "../engine/random";

const colors = [
  "#ff8a3d",
  "#8b5cf6",
  "#ffc93c",
  "#3b82f6",
  "#ff4f8b",
  "#14b8a6",
];

export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const { settings } = useApp();
  // A fixed seed keeps rendering pure; the burst looks random enough.
  const confetti = useMemo(() => {
    const random = seededRandom(7);
    return Array.from({ length: pieces }, (_, index) => ({
      left: random() * 100,
      delay: random() * 0.6,
      duration: 1.8 + random() * 1.4,
      drift: (random() - 0.5) * 220,
      spin: 360 + random() * 720,
      color: colors[index % colors.length],
      round: index % 3 === 0,
    }));
  }, [pieces]);
  const systemReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (settings.reducedMotion || systemReduced) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {confetti.map((piece, index) => (
        <span
          key={index}
          className={piece.round ? "round" : ""}
          style={
            {
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--drift": `${piece.drift}px`,
              "--spin": `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
