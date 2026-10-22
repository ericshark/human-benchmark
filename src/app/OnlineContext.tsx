import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useApp } from "./AppContext";
import { database } from "../storage/database";
import {
  onlineClient,
  onlineConfigured,
  onlineRequest,
} from "../services/online";
import {
  sessionSchema,
  type GameId,
  type InputClass,
  type Session,
} from "../domain/types";

export interface OnlineProfile {
  id: string;
  display_name: string;
  sync_enabled: boolean;
  statistics_consent: boolean;
}
export interface Share {
  id: string;
  session_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}
export interface AssessmentToken {
  id: string;
  seed: number;
  issued_at: string;
  expires_at: string;
  input_class: InputClass;
}
interface OnlineState {
  configured: boolean;
  user: User | null;
  profile: OnlineProfile | null;
  shares: Share[];
  status: string;
  error: string;
  busy: boolean;
  signIn: (email: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  setPreferences: (sync: boolean, statistics: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  refresh: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  issueAssessment: (
    gameId: GameId,
    input: InputClass,
  ) => Promise<AssessmentToken>;
  queueAssessment: (session: Session, token: string) => Promise<void>;
}
const OnlineContext = createContext<OnlineState | null>(null);
export function OnlineProvider({ children }: { children: ReactNode }) {
  const { sessions, loading, settings, mergeSessions } = useApp();
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<OnlineProfile | null>(null),
    [shares, setShares] = useState<Share[]>([]);
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef({ user, profile, sessions });
  current.current = { user, profile, sessions };
  const initialIds = useRef<Set<string> | null>(null),
    flushing = useRef(false);
  const refresh = useCallback(async () => {
    const result = await onlineRequest<{
      profile: OnlineProfile | null;
      shares: Share[];
    }>({ action: "profile" });
    setProfile(result.profile);
    setShares(result.shares);
  }, []);
  useEffect(() => {
    if (!onlineConfigured) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void onlineClient()
      .then(async (client) => {
        const { data } = await client.auth.getSession();
        if (!alive) return;
        setUser(data.session?.user ?? null);
        if (data.session)
          void refresh().catch((cause) => setError(String(cause.message)));
        const listener = client.auth.onAuthStateChange((_event, session) => {
          if (!alive) return;
          setUser(session?.user ?? null);
          if (session)
            setTimeout(() => {
              void refresh().catch((cause) => setError(String(cause.message)));
            }, 0);
          else {
            setProfile(null);
            setShares([]);
          }
        });
        unsubscribe = () => listener.data.subscription.unsubscribe();
      })
      .catch((cause) => setError(String(cause.message)));
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [refresh]);
  const flush = useCallback(async () => {
    const owner = current.current.user?.id;
    if (!owner || flushing.current) return;
    flushing.current = true;
    setError("");
    try {
      const jobs = await database.uploads
        .where("ownerId")
        .equals(owner)
        .toArray();
      for (const job of jobs) {
        if (current.current.user?.id !== owner) break;
        const session = await database.sessions.get(job.sessionId);
        if (!session) {
          await database.uploads.delete(job.id);
          continue;
        }
        if (job.tokenId)
          await onlineRequest({
            action: "finalize",
            token: job.tokenId,
            session,
          });
        else if (current.current.profile?.sync_enabled)
          await onlineRequest({ action: "sync", sessions: [session] });
        else continue;
        await database.uploads.delete(job.id);
      }
      if (jobs.length) setStatus("Your queued results are up to date.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sync is waiting. Your results are saved locally.",
      );
    } finally {
      flushing.current = false;
    }
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!initialIds.current) {
      initialIds.current = new Set(sessions.map((session) => session.id));
      return;
    }
    const added = sessions.filter(
      (session) => !initialIds.current!.has(session.id),
    );
    sessions.forEach((session) => initialIds.current!.add(session.id));
    if (!user || !profile?.sync_enabled || !added.length) return;
    const owner = user.id;
    const timer = setTimeout(() => {
      void database.uploads
        .bulkPut(
          added
            .filter(
              (session) =>
                !session.onlineOwner || session.onlineOwner === owner,
            )
            .map((session) => ({
              id: `${owner}:${session.id}`,
              ownerId: owner,
              sessionId: session.id,
              tokenId: session.assessmentToken,
            })),
        )
        .then(flush)
        .catch(() =>
          setError(
            "Online queue could not be saved. Export your local history.",
          ),
        );
    }, 700);
    return () => clearTimeout(timer);
  }, [flush, loading, profile?.sync_enabled, sessions, user]);
  useEffect(() => {
    if (!user) return;
    void flush();
    const reconnect = () => {
      void flush();
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [flush, user]);
  const signIn = async (email: string) => {
    const client = await onlineClient();
    const result = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (result.error) throw result.error;
    setStatus(
      "Check your email for a sign-in link. Your local history stays here.",
    );
  };
  const signInGuest = async () => {
    const client = await onlineClient();
    const result = await client.auth.signInAnonymously();
    if (result.error) throw result.error;
    setStatus(
      "Anonymous online identity created. Choose synchronization and statistics separately.",
    );
  };
  const signOut = async () => {
    const client = await onlineClient();
    const result = await client.auth.signOut();
    if (result.error) throw result.error;
    setProfile(null);
    setUser(null);
    setStatus("Signed out. Local history is still in this browser.");
  };
  const setPreferences = async (sync: boolean, statistics: boolean) => {
    await onlineRequest({
      action: "preferences",
      name: settings.name,
      sync,
      statistics,
    });
    await refresh();
    setStatus("Your online preferences are saved.");
  };
  const syncNow = async () => {
    if (!user || !profile?.sync_enabled)
      throw new Error("Enable synchronization before uploading history.");
    setBusy(true);
    setError("");
    try {
      // This explicit action permits uploading existing local history, including offline sessions.
      const own = sessions.filter(
        (session) => !session.onlineOwner || session.onlineOwner === user.id,
      );
      await database.uploads.bulkPut(
        own.map((session) => ({
          id: `${user.id}:${session.id}`,
          ownerId: user.id,
          sessionId: session.id,
          tokenId:
            session.onlineOwner === user.id
              ? session.assessmentToken
              : undefined,
        })),
      );
      await flush();
      const remote = await onlineRequest<{ sessions: unknown[] }>({
        action: "history",
      });
      const imported = remote.sessions.map((session) =>
        sessionSchema.parse(session),
      );
      await mergeSessions(imported);
      setStatus(
        "Account history downloaded. Pending uploads are retained if the connection failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const deleteAccount = async () => {
    await onlineRequest({ action: "delete" });
    const client = await onlineClient();
    await client.auth.signOut({ scope: "local" });
    setUser(null);
    setProfile(null);
    setShares([]);
    setStatus(
      "Online account and performance data deleted. Local history remains under your control.",
    );
  };
  const issueAssessment = async (gameId: GameId, input: InputClass) =>
    (
      await onlineRequest<{ token: AssessmentToken }>({
        action: "issue",
        gameId,
        input,
      })
    ).token;
  const queueAssessment = async (session: Session, token: string) => {
    const owner = current.current.user?.id;
    if (!owner) return;
    await database.uploads.put({
      id: `${owner}:${session.id}`,
      ownerId: owner,
      sessionId: session.id,
      tokenId: token,
    });
    void flush();
  };
  return (
    <OnlineContext.Provider
      value={{
        configured: onlineConfigured,
        user,
        profile,
        shares,
        status,
        error,
        busy,
        signIn,
        signInGuest,
        signOut,
        setPreferences,
        syncNow,
        refresh,
        deleteAccount,
        issueAssessment,
        queueAssessment,
      }}
    >
      {children}
    </OnlineContext.Provider>
  );
}
export function useOnline() {
  const value = useContext(OnlineContext);
  if (!value) throw new Error("OnlineProvider is required");
  return value;
}
