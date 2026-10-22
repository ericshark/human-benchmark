import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppProvider } from "./AppContext";
import { Shell } from "./Shell";
import Home from "../features/Home";
import { OnlineProvider } from "./OnlineContext";
const Catalog = lazy(() => import("../features/Catalog"));
const GamePage = lazy(() => import("../features/GamePage"));
const Results = lazy(() => import("../features/Results"));
const Profile = lazy(() => import("../features/Profile"));
const Challenges = lazy(() => import("../features/Challenges"));
const Settings = lazy(() => import("../features/Settings"));
const Methodology = lazy(() => import("../features/Methodology"));
const SharedResult = lazy(() => import("../features/SharedResult"));
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="page empty-state">
        <h1>Let’s take a breath.</h1>
        <p>
          Something interrupted the playground. Your saved local history is
          still in this browser.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.assign("/")}
        >
          Return to the playground
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <OnlineProvider>
            <ScrollToTop />
            <Suspense
              fallback={
                <div className="loading-state">Opening the playground…</div>
              }
            >
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Home />} />
                  <Route path="games" element={<Catalog />} />
                  <Route path="play/:gameId" element={<GamePage />} />
                  <Route path="results/:sessionId" element={<Results />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="challenges" element={<Challenges />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="auth/callback" element={<Settings />} />
                  <Route path="share/:shareId" element={<SharedResult />} />
                  <Route path="methodology" element={<Methodology />} />
                  <Route
                    path="*"
                    element={
                      <div className="page empty-state">
                        <h1>A little off the beaten path.</h1>
                        <p>This page hasn’t been discovered.</p>
                        <Link className="button primary" to="/">
                          Back to HumanRank
                        </Link>
                      </div>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </OnlineProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
