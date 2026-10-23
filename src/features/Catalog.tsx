import { useSearchParams } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useApp } from "../app/AppContext";
import { accentStyle, categories, games } from "../games/registry";
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
      <div className="page-heading heading-with-action">
        <div>
          <h1>All games</h1>
          <p>12 quick games across 6 skills. Tap one to play.</p>
        </div>
        <label className="search-field">
          <Search size={18} strokeWidth={2.6} />
          <input
            aria-label="Search games"
            placeholder="Search games"
            value={query}
            onChange={(event) => update("q", event.target.value)}
          />
        </label>
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
            style={accentStyle(item.id)}
            className={category === item.id ? "active" : ""}
            aria-pressed={category === item.id}
            onClick={() => update("category", item.id)}
          >
            <Icon name={item.id} size={16} strokeWidth={2.6} />
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
          <Search size={40} strokeWidth={2.4} />
          <h2>No games found.</h2>
          <p>Try a different search.</p>
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
