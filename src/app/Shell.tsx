import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Flame, Gamepad2, LayoutGrid, Trophy } from "lucide-react";
import { useApp } from "./AppContext";
import { useOnline } from "./OnlineContext";
import { currentStreak, playerProgress } from "../features/progress";

const navigation = [
  { path: "/", label: "Play", icon: Gamepad2 },
  { path: "/games", label: "Games", icon: LayoutGrid },
  { path: "/profile", label: "Stats", icon: BarChart3 },
  { path: "/challenges", label: "Challenges", icon: Trophy },
];
export function Shell() {
  const { settings, sessions, storageError } = useApp();
  const online = useOnline();
  const progress = useMemo(() => playerProgress(sessions), [sessions]);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="HumanRank home">
          <span className="brand-mark" aria-hidden="true">
            H
          </span>
          <span className="brand-name">HumanRank</span>
        </NavLink>
        <nav className="top-nav" aria-label="Main navigation">
          {navigation.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} strokeWidth={2.4} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="player-status">
          <span
            className={`streak-chip ${streak ? "lit" : ""}`}
            title={`${streak}-day streak`}
          >
            <Flame size={17} strokeWidth={2.6} />
            <span className="sr-only">Day streak:</span>
            {streak}
          </span>
          <NavLink
            to="/profile"
            className="level-chip"
            aria-label={`Level ${progress.level}, ${progress.levelXp} of ${progress.nextLevelXp} XP to next level`}
          >
            <span className="level-badge">{progress.level}</span>
            <span className="level-meter" aria-hidden="true">
              <span
                style={{
                  width: `${(progress.levelXp / progress.nextLevelXp) * 100}%`,
                }}
              />
            </span>
          </NavLink>
          <NavLink
            className="avatar"
            to="/settings"
            aria-label={`${settings.name} · settings${online.user ? " · online" : ""}`}
            title="Settings"
          >
            {settings.name.slice(0, 1).toUpperCase()}
          </NavLink>
        </div>
      </header>
      {storageError && (
        <div role="alert" className="storage-alert">
          {storageError} <NavLink to="/settings">Manage data</NavLink>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>
          {online.profile?.sync_enabled
            ? "Account sync on"
            : "Local play · your data stays in this browser"}
        </span>
        <NavLink to="/methodology">How scoring works</NavLink>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === "/"}>
            <Icon size={22} strokeWidth={2.4} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
