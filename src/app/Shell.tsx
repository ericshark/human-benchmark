import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Compass,
  LayoutGrid,
  ChartNoAxesCombined,
  Flame,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "./AppContext";
import { useOnline } from "./OnlineContext";

const navigation = [
  { path: "/", label: "Discover", icon: Compass },
  { path: "/games", label: "All games", icon: LayoutGrid },
  { path: "/profile", label: "My profile", icon: ChartNoAxesCombined },
  { path: "/challenges", label: "Challenges", icon: Flame },
];
export function Shell() {
  const { settings, storageError } = useApp();
  const online = useOnline();
  const { pathname } = useLocation();
  const title = pathname.startsWith("/play")
    ? "The arena"
    : pathname.startsWith("/results")
      ? "Your results"
      : (navigation.find((item) => item.path === pathname)?.label ??
        (pathname === "/settings" ? "Settings" : "Behind the numbers"));
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="HumanRank home">
          <span className="brand-mark">
            h<span>r</span>
            <i />
          </span>
          <span>
            human<span className="brand-light">rank</span>
            <span className="brand-period">.</span>
          </span>
        </NavLink>
        <div className="sidebar-label">YOUR PLAYGROUND</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === "/games" && <small>12</small>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-challenge">
          <span className="small-icon">
            <Sparkles size={19} />
          </span>
          <h3>A little curious?</h3>
          <p>
            Six games. Six dimensions.
            <br />A new side of you.
          </p>
          <NavLink to="/challenges?circuit=intro">
            Discover your profile <ArrowUpRight size={14} />
          </NavLink>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/methodology" className="nav-item">
            <ShieldCheck size={18} />
            How scoring works
          </NavLink>
          <NavLink to="/settings" className="nav-item">
            <SlidersHorizontal size={18} />
            Settings
          </NavLink>
          <div className="sidebar-footnote">
            <span className="status-dot" />
            {online.profile?.sync_enabled
              ? "Account sync enabled."
              : "Local play. Your data stays here."}
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Playground</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <NavLink className="profile-chip" to="/profile">
            <span className="local-tag">
              {online.user ? "ONLINE EXPLORER" : "LOCAL EXPLORER"}
            </span>
            <span className="avatar">
              {settings.name.slice(0, 1).toUpperCase()}
            </span>
            <span>{settings.name}</span>
          </NavLink>
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
          <span>Curiosity looks good on you.</span>
          <span>
            HumanRank <span className="footer-dot">·</span> Play. Learn. Level
            up.
          </span>
          <NavLink to="/methodology">A little transparency ↗</NavLink>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === "/"}>
            <Icon size={20} />
            <span>
              {label === "My profile"
                ? "Profile"
                : label === "All games"
                  ? "Games"
                  : label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
