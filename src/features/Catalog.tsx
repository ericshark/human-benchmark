import { useSearchParams } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useApp } from "../app/AppContext";
import { categories, games } from "../games/registry";
import { GameCard } from "../components/GameCard";
import { Icon } from "../components/Icon";

export default function Catalog() {
  const { sessions } = useApp();
  const [params, setParams] = useSearchParams();
  const pendingParams = useRef(params);
  useLayoutEffect(() => {
    pendingParams.current = params;
  }, [params]);
  const category = params.get("category") ?? "all",
    query = params.get("q") ?? "";
  const filtered = games.filter(
    (game) =>
      (category === "all" || category === game.category) &&
      `${game.name} ${game.description} ${game.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const update = (key: string, value: string) => {
    // Merge rapid edits before the router has committed its previous navigation.
    const next = new URLSearchParams(pendingParams.current);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    pendingParams.current = next;
    setParams(next, { replace: true });
  };
  return (
    <div className="page">
      <div className="page-heading">
        <span className="eyebrow">THE PLAYGROUND</span>
        <h1>Follow your curiosity.</h1>
        <p>Twelve ways to challenge yourself. Where will you start?</p>
      </div>
      <div className="catalog-controls">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search games"
            placeholder="Find your next challenge…"
            value={query}
            onChange={(event) => update("q", event.target.value)}
          />
        </label>
        <span className="muted">
          <SlidersHorizontal size={15} />
          {filtered.length} games to explore
        </span>
      </div>
      <div className="filter-tabs" aria-label="Filter by category">
        <button
          className={category === "all" ? "active" : ""}
          aria-pressed={category === "all"}
          onClick={() => update("category", "all")}
        >
          All games <small>12</small>
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            className={category === item.id ? "active" : ""}
            aria-pressed={category === item.id}
            onClick={() => update("category", item.id)}
          >
            <Icon name={item.id} size={15} />
            {item.name}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="game-grid catalog-grid">
          {filtered.map((game) => (
            <GameCard key={game.id} game={game} sessions={sessions} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={35} />
          <h2>No games found.</h2>
          <p>Try a different search or explore all six categories.</p>
          <button
            className="button secondary"
            onClick={() => {
              pendingParams.current = new URLSearchParams();
              setParams({});
            }}
          >
            Show all games
          </button>
        </div>
      )}
    </div>
  );
}
