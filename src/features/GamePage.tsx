import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
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
  Clock3,
  Keyboard,
  CircleCheck,
  Play,
  RotateCcw,
  Settings2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import { accentStyle, gameById, getCategory } from "../games/registry";
import {
  gameIds,
  type GameId,
  type InputClass,
  type Session,
  type Trial,
} from "../domain/types";
import { formatMetric, scoreGame } from "../domain/scoring";
import { hashSeed, newSeed } from "../engine/random";
import { useScheduler } from "../engine/useScheduler";
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
    | "countdown"
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
  const [countdownPractice, setCountdownPractice] = useState(false);
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
  const focused = active || stage === "countdown";
  useEffect(() => {
    document.body.classList.toggle("in-game", focused);
    return () => document.body.classList.remove("in-game");
  }, [focused]);
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
    input.current = issuedToken?.input_class ?? settings.input;
    if (audio.current && audio.current.state !== "closed")
      void audio.current.close();
    audio.current = settings.sound ? prepareCompletionSound() : null;
    setSeed(
      issuedToken?.seed ??
        (daily && !practice ? hashSeed(`${day}|${gameId}|v1`) : newSeed()),
    );
    setCountdownPractice(practice);
    setStage("countdown");
  }
  function beginPlay() {
    // Timing starts when the engine mounts, after the countdown.
    started.current = new Date().toISOString();
    setStage(countdownPractice ? "practice" : "playing");
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
  const remixLabel =
    gameId === "signal"
      ? "Quick-fire"
      : gameId === "echo-path"
        ? "Reverse path"
        : gameId === "grid-recall"
          ? "Flash recall"
          : gameId === "target-burst"
            ? "Small targets"
            : gameId === "orbit-track"
              ? "Room to roam"
              : "Relaxed pace · 60 seconds per question";
  return (
    <div className="page game-page" style={accentStyle(game.category)}>
      {stage === "instructions" && (
        <>
          <Link to="/games" className="back-link">
            <ArrowLeft size={16} />
            All games
          </Link>
          <section className="how-to-play">
            <div className="how-to-art">
              <span className="category-pill">{category.name}</span>
              <Icon name={game.icon} size={72} strokeWidth={1.25} />
            </div>
            <div className="how-to-copy">
              <h1>{game.name}</h1>
              <p className="how-to-tagline">{game.description}</p>
              <h2 className="how-to-label">How to play</h2>
              <ol className="how-to-steps">
                {game.instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
              <div className="how-to-meta">
                <span className="chip">
                  <Clock3 size={14} />
                  {game.duration}
                </span>
                {game.keys && (
                  <span className="chip">
                    <Keyboard size={14} />
                    {game.keys.join(" ")}
                  </span>
                )}
                {daily && (
                  <span className="chip daily-chip">Daily challenge</span>
                )}
              </div>
              <div className="instruction-actions">
                <button className="button primary" onClick={() => start()}>
                  <Play size={16} fill="currentColor" />
                  {daily ? "Start daily challenge" : "Start assessment"}
                </button>
                <button
                  className="button secondary"
                  onClick={() => start(true)}
                >
                  Try a practice round
                </button>
              </div>
              <details className="more-options">
                <summary>
                  <Settings2 size={16} />
                  More options
                </summary>
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
                      <option value="remix">{remixLabel}</option>
                    </select>
                  </label>
                )}
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
                          ...(game.category !== "precision"
                            ? ["keyboard"]
                            : []),
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
                          .issueAssessment(
                            gameId,
                            assessmentInput as InputClass,
                          )
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
                      One online opportunity per game per UTC day. Use the
                      selected input throughout; local play stays unlimited.
                    </p>
                  </div>
                )}
                <div className="measurement-details">
                  <h3>What this game measures</h3>
                  <p>{game.measurement}</p>
                  <p>
                    Results describe your performance in this browser, with this
                    input setup. They are not a measure of intelligence, health,
                    or worth. <Link to="/methodology">How scoring works</Link>
                  </p>
                </div>
              </details>
            </div>
          </section>
        </>
      )}
      {onlineError && (
        <p className="notice warning" role="alert">
          {onlineError}
        </p>
      )}
      {stage === "countdown" && (
        <div className="game-stage countdown-stage">
          <Countdown onDone={beginPlay} />
          <p className="countdown-caption">
            {countdownPractice ? "Practice round" : game.name} · get ready
          </p>
        </div>
      )}
      {active && (
        <div
          className="game-stage"
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
          <div className="game-stage-header">
            <span className="stage-title">
              <Icon name={game.icon} size={18} />
              {game.name}
              {stage === "practice" && (
                <span className="practice-tag">Practice · not saved</span>
              )}
            </span>
            <button
              className="quit-button"
              onClick={() =>
                interrupt(
                  "Session ended by you. Nothing was added to your history.",
                )
              }
            >
              <X size={16} />
              End session
            </button>
          </div>
          <Suspense
            fallback={<div className="loading-state">Loading game…</div>}
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
        </div>
      )}
      {stage === "practice-finished" && (
        <div className="session-state">
          <span className="state-icon">
            <CircleCheck size={32} strokeWidth={1.75} />
          </span>
          <h2>You’ve got the idea.</h2>
          <p>
            Practice score:{" "}
            <strong>
              {formatMetric(scoreGame(gameId, practiceTrials, 15).primary)}
            </strong>
            . Practice isn’t saved — ready for the real thing?
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
        <div className="session-state">
          <span className="state-icon warning">
            <TriangleAlert size={32} strokeWidth={1.75} />
          </span>
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
              Back to how to play
            </button>
          </div>
        </div>
      )}
      {stage === "saving" && (
        <div className="session-state">
          <span className="state-icon spin" />
          <h2>Saving result…</h2>
        </div>
      )}
    </div>
  );
}
const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 600;
function Countdown({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const { schedule, clear } = useScheduler();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    COUNTDOWN_STEPS.forEach((_, index) => {
      if (index) schedule(() => setStep(index), index * COUNTDOWN_STEP_MS);
    });
    schedule(() => done.current(), COUNTDOWN_STEPS.length * COUNTDOWN_STEP_MS);
    return clear;
  }, [schedule, clear]);
  return (
    <div className="countdown" role="status" aria-live="assertive">
      <span key={step} className={step === 3 ? "go" : ""}>
        {COUNTDOWN_STEPS[step]}
      </span>
    </div>
  );
}
