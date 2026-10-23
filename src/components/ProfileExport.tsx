import { Download } from "lucide-react";
import { useApp } from "../app/AppContext";
import { categories, games } from "../games/registry";
import { bestSession, formatPrimary } from "../domain/scoring";
export function ProfileExport() {
  const { sessions, settings } = useApp();
  function download() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff8ec";
    ctx.fillRect(0, 0, 1200, 1000);
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("HumanRank", 65, 75);
    ctx.fillStyle = "#1f1b3a";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText("My discoveries. In six dimensions.", 65, 160);
    const valid = sessions.filter(
      (session) =>
        session.mode === "assessment" &&
        !session.flags.length &&
        session.input === settings.input,
    );
    ctx.fillStyle = "#6b6489";
    ctx.font = "21px sans-serif";
    ctx.fillText(
      `${new Set(valid.map((session) => session.gameId)).size} of 12 games explored · ${settings.input} · personal records`,
      65,
      207,
    );
    categories.forEach((category, index) => {
      const x = 65 + (index % 2) * 550,
        y = 255 + Math.floor(index / 2) * 205;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 520, 175);
      ctx.fillStyle = category.deep;
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(category.name, x + 24, y + 40);
      games
        .filter((game) => game.category === category.id)
        .forEach((game, row) => {
          const best = bestSession(
            valid.filter((session) => session.gameId === game.id),
          );
          ctx.fillStyle = "#6b6489";
          ctx.font = "17px sans-serif";
          ctx.fillText(game.name, x + 24, y + 80 + row * 48);
          ctx.fillStyle = "#1f1b3a";
          ctx.font = "20px sans-serif";
          ctx.fillText(
            best ? formatPrimary(best) : "Unexplored",
            x + 240,
            y + 80 + row * 48,
          );
        });
    });
    ctx.fillStyle = "#6b6489";
    ctx.font = "19px sans-serif";
    ctx.fillText(
      "Actual game performance. No population rank or profile rarity claimed.",
      65,
      925,
    );
    const link = document.createElement("a");
    link.download = "humanrank-profile.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
  return (
    <button className="button secondary" onClick={download}>
      <Download size={15} />
      Save profile card
    </button>
  );
}
