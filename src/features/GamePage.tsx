import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Keyboard,
  Play,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { gameById, getCategory } from "../games/registry";
import {
  gameIds,
  type GameId,
  type InputClass,
  type Session,
  type Trial,
} from "../domain/types";
import { formatMetric, scoreGame } from "../domain/scoring";
import { hashSeed, newSeed } from "../engine/random";
import { Icon } from "../components/Icon";
import { localDay } from "./progress";
import { playCompletionSound, prepareCompletionSound } from "../engine/audio";
import { useOnline, type AssessmentToken } from "../app/OnlineContext";

const Signal = lazy(() => import("../games/SignalGame"));
const Quiz = lazy(() => import("../games/QuizGame"));
const Memory = lazy(() => import("../games/MemoryGame"));
const Precision = lazy(() => import("../games/PrecisionGame"));
export default function GamePage() {
  const { gameId: parameter } = useParams();
  if (!gameIds.includes(parameter as GameId))
    return (
      <div className="page empty-state">
        <h1>That game hasn’t landed here.</h1>
        <Link className="button primary" to="/games">
          Explore all games
        </Link>
      </div>
    );
  return <GameSession key={parameter} gameId={parameter as GameId} />;
}
function GameSession({ gameId }: { gameId: GameId }) {
  const game = gameById[gameId],
    category = getCategory(game.category);
  const { settings, saveSession } = useApp();
  const online = useOnline();
  const navigate = useNavigate(),
    [params] = useSearchParams();
  const daily = params.get("circuit") === "daily";
  const day = online.challengeDay ?? localDay();
  const [stage, setStage] = useState<
    | "instructions"
    | "practice"
    | "playing"
    | "practice-finished"
    | "interrupted"
    | "saving"
  >("instructions");
  const [seed, setSeed] = useState(newSeed),
    [practiceTrials, setPracticeTrials] = useState<Trial[]>([]);
  const [interruption, setInterruption] = useState("");
  const [variant, setVariant] = useState<"classic" | "remix">("classic");
  const [onlineBusy, setOnlineBusy] = useState(false),
    [onlineError, setOnlineError] = useState("");
  const [assessmentInput, setAssessmentInput] = useState(
    game.keys
      ? "keyboard"
      : settings.input === "keyboard"
        ? "mouse"
        : settings.input,
  );
  const token = useRef<AssessmentToken | null>(null);
  const startedDay = useRef(day);
  const started = useRef(""),
    input = useRef(settings.input),
    complete = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      if (audio.current && audio.current.state !== "closed")
        void audio.current.close();
    },
    [],
  );
  const active = stage === "playing" || stage === "practice";
  const interrupt = useCallback(
    (reason: string) => {
      if (complete.current) return;
      complete.current = true;
      setInterruption(reason);
      setStage("interrupted");
    },
    [setInterruption, setStage],
  );
  useEffect(() => {
    if (!active) return;
    const visibility = () => {
      if (document.hidden)
        interrupt(
          "The tab was hidden during play. Start a fresh session so timing stays comparable.",
        );
    };
    const blur = () =>
      interrupt(
        "The game lost focus. Start a fresh session when you’re ready.",
      );
    const resize = () =>
      interrupt("The arena size changed. Start again with the new layout.");
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        !event.repeat &&
        (event.code === "Space" ||
          [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(event.key))
      )
        input.current = "keyboard";
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", resize);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("keydown", keyboard, true);
    };
  }, [active, interrupt]);
  function start(practice = false, issuedToken?: AssessmentToken) {
    token.current = issuedToken ?? null;
    startedDay.current = day;
    complete.current = false;
    started.current = new Date().toISOString();
    input.current = issuedToken?.input_class ?? settings.input;
    if (audio.current && audio.current.state !== "closed")
      void audio.current.close();
    audio.current = settings.sound ? prepareCompletionSound() : null;
    setSeed(
      issuedToken?.seed ??
        (daily && !practice ? hashSeed(`${day}|${gameId}|v1`) : newSeed()),
    );
    setStage(practice ? "practice" : "playing");
  }
  async function finish(trials: Trial[]) {
    if (complete.current) return;
    complete.current = true;
    playCompletionSound(audio.current);
    audio.current = null;
    if (stage === "practice") {
      setPracticeTrials(trials);
      setStage("practice-finished");
      return;
    }
    setStage("saving");
    const flags: string[] = [];
    if (
      ["signal", "crossroads", "color-conflict", "rule-shift"].includes(
        gameId,
      ) &&
      trials.some((trial) => trial.outcome === "correct" && trial.latency < 50)
    )
      flags.push("Very short responses: review timing and input conditions.");
    const session: Session = {
      id: crypto.randomUUID(),
      gameId,
      version: 1,
      scoringVersion: 1,
      mode: daily ? "daily" : "assessment",
      seed,
      startedAt: started.current,
      completedAt: new Date().toISOString(),
      input: input.current,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      trials,
      flags,
      ...(daily ? { dailyId: startedDay.current } : {}),
      ...(token.current?.ownerId
        ? {
            assessmentToken: token.current.id,
            onlineOwner: token.current.ownerId,
          }
        : {}),
    };
    const arena = document.querySelector<HTMLElement>(".precision-arena");
    if (arena)
      session.arena = { width: arena.clientWidth, height: arena.clientHeight };
    try {
      await saveSession(session);
      if (token.current)
        await online
          .queueAssessment(session, token.current.id)
          .catch(() =>
            setOnlineError(
              "Your result is saved locally, but the online queue could not be written.",
            ),
          );
      navigate(
        `/results/${session.id}${params.get("circuit") ? `?circuit=${params.get("circuit")}` : ""}`,
      );
    } catch {
      setInterruption(
        "This result could not be recorded. Please retry or check your browser storage settings.",
      );
      setStage("interrupted");
    }
  }
  const Engine =
    gameId === "signal"
      ? Signal
      : gameId === "grid-recall" || gameId === "echo-path"
        ? Memory
        : gameId === "target-burst" || gameId === "orbit-track"
          ? Precision
          : Quiz;
  return (
    <div
      className="page game-page"
      style={{ "--accent": category.color } as CSSProperties}
    >
      <Link to="/games" className="back-link">
        <ArrowLeft size={15} />
        Back to playground
      </Link>
      <div className="game-page-heading">
        <div>
          <span className="eyebrow category-eyebrow">
            <Icon name={game.icon} size={16} />
            {category.name.toUpperCase()}
          </span>
          <h1>
            {game.name}
            <span className="title-period">.</span>
          </h1>
          <p>{game.tagline}</p>
        </div>
        <span className="duration-chip">
          <Clock3 size={15} />
          {game.duration}
        </span>
      </div>
      {stage === "instructions" && (
        <div className="game-instructions panel">
          <div className="instruction-visual">
            <div className="instruction-orbit" />
            <Icon name={game.icon} size={78} strokeWidth={1.2} />
            <span>YOUR NEXT DISCOVERY</span>
          </div>
          <div className="instruction-copy">
            <span className="eyebrow">LET’S PLAY</span>
            <h2>{game.description}</h2>
            <ol>
              {game.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
            {!["math-sprint", "symbol-match"].includes(gameId) && (
              <label className="practice-variation">
                Practice variation
                <select
                  aria-label="Practice variation"
                  value={variant}
                  onChange={(event) =>
                    setVariant(event.target.value as "classic" | "remix")
                  }
                >
                  <option value="classic">Classic practice</option>
                  <option value="remix">
                    {gameId === "signal"
                      ? "Quick-fire"
                      : gameId === "echo-path"
                        ? "Reverse path"
                        : gameId === "grid-recall"
                          ? "Flash recall"
                          : gameId === "target-burst"
                            ? "Small targets"
                            : gameId === "orbit-track"
                              ? "Room to roam"
                              : "Relaxed pace · 60 seconds per question"}
                  </option>
                </select>
              </label>
            )}
            <div className="instruction-actions">
              <button className="button primary" onClick={() => start()}>
                <Play size={16} fill="currentColor" />
                {daily ? "Start daily challenge" : "Start assessment"}
              </button>
              <button className="button secondary" onClick={() => start(true)}>
                Try a practice round
              </button>
            </div>
            <p className="small-note">
              <ShieldCheck size={14} />
              Local result. No account needed.{" "}
              {game.keys && (
                <>
                  <Keyboard size={14} />
                  {game.keys.join(" · ")}
                </>
              )}
            </p>
            {online.profile?.statistics_consent && !daily && (
              <div className="rated-start">
                <label>
                  Online assessment input
                  <select
                    aria-label="Online assessment input"
                    value={assessmentInput}
                    onChange={(event) =>
                      setAssessmentInput(event.target.value as InputClass)
                    }
                  >
                    {[
                      "mouse",
                      "trackpad",
                      "touch",
                      ...(game.category !== "precision" ? ["keyboard"] : []),
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  disabled={onlineBusy}
                  onClick={() => {
                    setOnlineBusy(true);
                    setOnlineError("");
                    void online
                      .issueAssessment(gameId, assessmentInput as InputClass)
                      .then((issued) => start(false, issued))
                      .catch((cause) => setOnlineError(cause.message))
                      .finally(() => setOnlineBusy(false));
                  }}
                >
                  {onlineBusy
                    ? "Preparing rated session…"
                    : "Start today’s online assessment"}
                </button>
                <p className="small-note">
                  One online opportunity per game per UTC day. Use the selected
                  input throughout; local play stays unlimited.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {onlineError && (
        <p className="notice warning" role="alert">
          {onlineError}
        </p>
      )}
      {active && (
        <div
          className="game-stage panel"
          onPointerCancel={() =>
            interrupt(
              "The touch gesture was interrupted. Start a fresh session when you’re ready.",
            )
          }
          onPointerDownCapture={(event) => {
            input.current =
              event.pointerType === "touch"
                ? "touch"
                : settings.input === "trackpad"
                  ? "trackpad"
                  : "mouse";
          }}
          onKeyDownCapture={(event) => {
            if (
              !event.repeat &&
              !["Tab", "Escape", "Shift"].includes(event.key)
            )
              input.current = "keyboard";
          }}
        >
          <Suspense
            fallback={
              <div className="loading-state">Preparing your challenge…</div>
            }
          >
            <Engine
              key={`${seed}-${stage}`}
              gameId={gameId}
              variant={stage === "practice" ? variant : "classic"}
              seed={seed}
              mode={
                stage === "practice"
                  ? "practice"
                  : daily
                    ? "daily"
                    : "assessment"
              }
              onComplete={(trials) => {
                void finish(trials);
              }}
              onInterrupt={interrupt}
            />
          </Suspense>
          <div className="game-stage-footer">
            <span className="status-dot" />
            {stage === "practice"
              ? "PRACTICE · YOUR RESULT WILL NOT BE SAVED"
              : "LOCAL ASSESSMENT · V1"}
            <button
              className="text-link"
              onClick={() =>
                interrupt(
                  "Session ended by you. Nothing was added to your assessment history.",
                )
              }
            >
              End session
            </button>
          </div>
        </div>
      )}
      {stage === "practice-finished" && (
        <div className="panel session-state">
          <span className="state-icon">
            <Check size={32} />
          </span>
          <span className="eyebrow">PRACTICE COMPLETE</span>
          <h2>You’ve got the idea.</h2>
          <p>
            {formatMetric(scoreGame(gameId, practiceTrials, 15).primary)} in
            practice. This shorter session was not saved.
          </p>
          <div className="inline-actions">
            <button className="button primary" onClick={() => start()}>
              Start full assessment <ArrowRight size={16} />
            </button>
            <button className="button secondary" onClick={() => start(true)}>
              Practice again
            </button>
          </div>
        </div>
      )}
      {stage === "interrupted" && (
        <div className="panel session-state">
          <TriangleAlert size={35} />
          <h2>A fresh start?</h2>
          <p>{interruption}</p>
          <div className="inline-actions">
            <button className="button primary" onClick={() => start()}>
              <RotateCcw size={16} />
              Try again
            </button>
            <button
              className="button secondary"
              onClick={() => setStage("instructions")}
            >
              Review instructions
            </button>
          </div>
        </div>
      )}
      {stage === "saving" && (
        <div className="panel session-state">
          <h2>Connecting the dots…</h2>
          <p>Saving your session to this browser.</p>
        </div>
      )}
      <details className="measurement-details">
        <summary>
          <ShieldCheck size={16} />
          What this game measures
        </summary>
        <p>{game.measurement}</p>
        <p>
          Games describe your performance in this browser, with this input
          setup. Results are not a measure of intelligence, health, or human
          worth. <Link to="/methodology">Read the methodology.</Link>
        </p>
      </details>
    </div>
  );
}
