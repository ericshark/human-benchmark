import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  backupSchema,
  defaultSettings,
  sessionSchema,
  settingsSchema,
  type Session,
  type Settings,
} from "../domain/types";
import { database } from "../storage/database";
import { introGames } from "../games/registry";

interface AppState {
  sessions: Session[];
  settings: Settings;
  loading: boolean;
  storageError: string;
  updateSettings: (settings: Settings) => void;
  saveSession: (session: Session) => Promise<void>;
  importData: (text: string) => Promise<number>;
  exportData: () => void;
  deleteData: () => Promise<void>;
  introProgress: string[];
  resetIntro: () => void;
  mergeSessions: (sessions: Session[]) => Promise<void>;
}
const AppContext = createContext<AppState | null>(null);
function readSettings(): Settings {
  try {
    return settingsSchema.parse(
      JSON.parse(localStorage.getItem("humanrank.settings") ?? "{}"),
    );
  } catch {
    return defaultSettings;
  }
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [introStart, setIntroStart] = useState(() => {
    try {
      return localStorage.getItem("humanrank.introStart") ?? "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    let current = true;
    const load = () =>
      database.sessions
        .orderBy("completedAt")
        .reverse()
        .toArray()
        .then((rows) => {
          if (current) setSessions(rows);
        })
        .catch(() => {
          if (current)
            setStorageError(
              "Local history could not be opened. Results from this visit can still be exported.",
            );
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    void load();
    const channel =
      typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel("humanrank.history");
    channel?.addEventListener("message", load);
    return () => {
      current = false;
      channel?.close();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.motion = settings.reducedMotion
      ? "reduced"
      : "system";
  }, [settings.theme, settings.reducedMotion]);
  const updateSettings = useCallback((next: Settings) => {
    const valid = settingsSchema.parse(next);
    setSettings(valid);
    try {
      localStorage.setItem("humanrank.settings", JSON.stringify(valid));
    } catch {
      setStorageError("Preferences could not be saved in this browser.");
    }
  }, []);
  const broadcast = () => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("humanrank.history");
    channel.postMessage("changed");
    channel.close();
  };
  const saveSession = useCallback(async (session: Session) => {
    const valid = sessionSchema.parse(session);
    setSessions((previous) =>
      [valid, ...previous.filter((item) => item.id !== valid.id)].sort((a, b) =>
        b.completedAt.localeCompare(a.completedAt),
      ),
    );
    try {
      await database.sessions.put(valid);
      broadcast();
    } catch {
      setStorageError(
        "This result is available for this visit, but could not be saved. Export your history before leaving.",
      );
    }
  }, []);
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "humanrank",
            version: 1,
            exportedAt: new Date().toISOString(),
            settings,
            sessions,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `humanrank-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importData = async (text: string) => {
    if (text.length > 10 * 1024 * 1024)
      throw new Error("Please choose a backup smaller than 10 MB.");
    const parsed = backupSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      throw new Error(
        "This file is not a supported HumanRank backup. No data was changed.",
      );
    if (
      new Set(parsed.data.sessions.map((session) => session.id)).size !==
      parsed.data.sessions.length
    )
      throw new Error(
        "The backup contains duplicate session IDs. No data was changed.",
      );
    // Validate everything before a transaction; never partially import malformed backups.
    await database.transaction("rw", database.sessions, async () => {
      const existing = new Set(
        await database.sessions.toCollection().primaryKeys(),
      );
      await database.sessions.bulkPut(
        parsed.data.sessions.filter((session) => !existing.has(session.id)),
      );
    });
    const rows = await database.sessions
      .orderBy("completedAt")
      .reverse()
      .toArray();
    setSessions(rows);
    updateSettings(parsed.data.settings);
    broadcast();
    return parsed.data.sessions.length;
  };
  const deleteData = async () => {
    await database.transaction(
      "rw",
      database.sessions,
      database.uploads,
      async () => {
        await database.sessions.clear();
        await database.uploads.clear();
      },
    );
    localStorage.removeItem("humanrank.settings");
    localStorage.removeItem("humanrank.introStart");
    setSessions([]);
    setSettings(defaultSettings);
    setIntroStart("");
    setStorageError("");
    broadcast();
  };
  const resetIntro = () => {
    const start = new Date().toISOString();
    setIntroStart(start);
    try {
      localStorage.setItem("humanrank.introStart", start);
    } catch {
      setStorageError("Circuit progress cannot be stored in this browser.");
    }
  };
  const introProgress = introGames.filter((id) =>
    sessions.some(
      (session) =>
        session.gameId === id &&
        session.mode === "assessment" &&
        !session.flags.length &&
        session.completedAt >= introStart,
    ),
  );
  const mergeSessions = useCallback(async (incoming: Session[]) => {
    const validated = incoming.map((session) => sessionSchema.parse(session));
    await database.transaction("rw", database.sessions, async () => {
      const existing = new Set(
        await database.sessions.toCollection().primaryKeys(),
      );
      await database.sessions.bulkPut(
        validated.filter((session) => !existing.has(session.id)),
      );
    });
    setSessions(
      await database.sessions.orderBy("completedAt").reverse().toArray(),
    );
    broadcast();
  }, []);
  return (
    <AppContext.Provider
      value={{
        sessions,
        settings,
        loading,
        storageError,
        updateSettings,
        saveSession,
        importData,
        exportData,
        deleteData,
        introProgress,
        resetIntro,
        mergeSessions,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider is required");
  return context;
}
