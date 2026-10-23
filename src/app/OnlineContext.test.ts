// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { database } from "../storage/database";
import { defaultSettings, type Session } from "../domain/types";
import { OnlineProvider, useOnline, type OnlineProfile } from "./OnlineContext";
import { OnlineRequestError } from "../services/online";

// Auth and HTTP are simulated; IndexedDB and the provider/queue lifecycle are real.
// These tests do not verify Supabase Auth, deployed functions, or email delivery.
const harness = vi.hoisted(() => ({
  owner: "11111111-1111-4111-8111-111111111111" as string | null,
  changeAuth: null as ((owner: string | null) => void) | null,
  profiles: new Map<string, OnlineProfile>(),
  sessions: [] as Session[],
  request: vi.fn(),
  mergeSessions: vi.fn(),
}));
vi.mock("./AppContext", () => ({
  useApp: () => ({
    sessions: harness.sessions,
    loading: false,
    settings: defaultSettings,
    mergeSessions: harness.mergeSessions,
  }),
}));
vi.mock("../services/online", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/online")>()),
  onlineConfigured: true,
  onlineRequest: harness.request,
  onlineClient: async () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: harness.owner ? { user: { id: harness.owner } } : null,
        },
      }),
      onAuthStateChange: (
        callback: (event: string, session: unknown) => void,
      ) => {
        harness.changeAuth = (owner) => {
          harness.owner = owner;
          callback("SIGNED_IN", owner ? { user: { id: owner } } : null);
        };
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                harness.changeAuth = null;
              },
            },
          },
        };
      },
    },
  }),
}));
const one = "11111111-1111-4111-8111-111111111111";
const two = "22222222-2222-4222-8222-222222222222";
const token = "33333333-3333-4333-8333-333333333333";
function profile(owner: string, sync = true, statistics = true): OnlineProfile {
  return {
    id: owner,
    display_name: "Test player",
    sync_enabled: sync,
    statistics_consent: statistics,
  };
}
function recording(owner = one): Session {
  return {
    id: crypto.randomUUID(),
    gameId: "signal",
    version: 1,
    scoringVersion: 1,
    mode: "assessment",
    seed: 1,
    startedAt: "2026-10-23T10:00:00.000Z",
    completedAt: "2026-10-23T10:01:00.000Z",
    input: "mouse",
    viewport: { width: 1440, height: 900 },
    onlineOwner: owner,
    flags: [],
    trials: Array.from({ length: 12 }, (_, index) => ({
      index,
      outcome: "correct",
      stimulusAt: index * 3000,
      respondedAt: index * 3000 + 200,
      latency: 200,
    })),
  };
}
async function enqueue(session: Session, tokenId?: string) {
  await database.sessions.put(session);
  await database.uploads.put({
    id: `${session.onlineOwner}:${session.id}`,
    ownerId: session.onlineOwner!,
    sessionId: session.id,
    tokenId,
  });
}
function mount() {
  return renderHook(() => useOnline(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(OnlineProvider, null, children),
  });
}
async function ready() {
  const hook = mount();
  await waitFor(() =>
    expect(hook.result.current.profile?.id).toBe(harness.owner),
  );
  return hook;
}
const uploads = () =>
  harness.request.mock.calls.filter(([body]) =>
    ["sync", "finalize"].includes(body.action),
  );
const profileResponse = (owner: string) => ({
  profile: harness.profiles.get(owner) ?? null,
  shares: [],
  serverTime: new Date().toISOString(),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  await database.uploads.clear();
  await database.sessions.clear();
  harness.owner = one;
  harness.sessions = [];
  harness.profiles = new Map([
    [one, profile(one)],
    [two, profile(two)],
  ]);
  harness.request.mockReset();
  harness.mergeSessions.mockReset();
  harness.request.mockImplementation(async (body, owner) => {
    if (body.action === "profile") return profileResponse(owner);
    if (body.action === "preferences")
      harness.profiles.set(owner, profile(owner, body.sync, body.statistics));
    return {};
  });
});
afterEach(() => {
  cleanup();
});

describe("online upload lifecycle with simulated auth and network", () => {
  it("resumes only the signed-in owner's durable jobs after profile loading", async () => {
    const own = recording(),
      other = recording(two);
    await enqueue(own);
    await enqueue(other);
    await ready();
    await waitFor(async () => expect(await database.uploads.count()).toBe(1));
    expect(uploads()).toHaveLength(1);
    expect(uploads()[0]).toEqual([{ action: "sync", sessions: [own] }, one]);
    expect((await database.uploads.toArray())[0].ownerId).toBe(two);
  });

  it("retains an offline assessment through unmount and retries on the next visit", async () => {
    const hook = await ready();
    const session = { ...recording(), assessmentToken: token };
    await database.sessions.put(session);
    harness.request.mockImplementation(async (body, owner) => {
      if (body.action === "profile") return profileResponse(owner);
      throw new TypeError("Network unavailable");
    });
    await act(() => hook.result.current.queueAssessment(session, token));
    await waitFor(() =>
      expect(hook.result.current.error).toContain("Network unavailable"),
    );
    expect(await database.uploads.count()).toBe(1);
    hook.unmount();
    harness.request.mockImplementation(async (body, owner) =>
      body.action === "profile" ? profileResponse(owner) : {},
    );
    await ready();
    await waitFor(async () => expect(await database.uploads.count()).toBe(0));
    expect(uploads().map(([body]) => body.action)).toEqual([
      "finalize",
      "finalize",
    ]);
    expect(await database.sessions.get(session.id)).toEqual(session);
  });

  it("does not borrow the previous account's consent while the next profile loads", async () => {
    const hook = await ready();
    const other = recording(two);
    await enqueue(other, token);
    harness.profiles.set(two, profile(two, false, false));
    const pending = deferred<ReturnType<typeof profileResponse>>();
    harness.request.mockImplementation(async (body, owner) =>
      body.action === "profile" && owner === two ? pending.promise : {},
    );
    await act(async () => {
      harness.changeAuth!(two);
    });
    await waitFor(() =>
      expect(harness.request).toHaveBeenCalledWith({ action: "profile" }, two),
    );
    expect(uploads()).toEqual([]);
    await act(async () => {
      pending.resolve(profileResponse(two));
    });
    await waitFor(() => expect(hook.result.current.profile?.id).toBe(two));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(uploads()).toEqual([]);
    expect(await database.uploads.count()).toBe(1);
  });

  it("drains the next account's queue after an in-flight upload finishes", async () => {
    const hook = await ready();
    const own = recording(),
      other = recording(two);
    const pending = deferred<object>();
    await enqueue(other);
    harness.request.mockImplementation(async (body, owner) => {
      if (body.action === "profile") return profileResponse(owner);
      if (owner === one) return pending.promise;
      return {};
    });
    await database.sessions.put(own);
    await act(() => hook.result.current.queueAssessment(own, token));
    await waitFor(() => expect(uploads()).toHaveLength(1));
    await act(async () => {
      harness.changeAuth!(two);
    });
    await waitFor(() => expect(hook.result.current.profile?.id).toBe(two));
    await act(async () => {
      pending.resolve({});
    });
    await waitFor(async () => expect(await database.uploads.count()).toBe(0));
    expect(uploads().map(([, owner]) => owner)).toEqual([one, two]);
  });

  it("keeps queued results local while both consents are off and resumes when re-enabled", async () => {
    const hook = await ready();
    await act(() => hook.result.current.setPreferences(false, false));
    await waitFor(() =>
      expect(hook.result.current.profile?.statistics_consent).toBe(false),
    );
    const session = recording();
    await database.sessions.put(session);
    await act(() => hook.result.current.queueAssessment(session, token));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(uploads()).toEqual([]);
    expect(await database.uploads.count()).toBe(1);
    await act(() => hook.result.current.setPreferences(false, true));
    await waitFor(async () => expect(await database.uploads.count()).toBe(0));
    expect(uploads()[0][0].action).toBe("finalize");
  });

  it("uses personal sync rather than population submission after statistics consent is withdrawn", async () => {
    const hook = await ready();
    await act(() => hook.result.current.setPreferences(true, false));
    const session = { ...recording(), assessmentToken: token };
    await database.sessions.put(session);
    await act(() => hook.result.current.queueAssessment(session, token));
    await waitFor(async () => expect(await database.uploads.count()).toBe(0));
    expect(uploads()).toEqual([[{ action: "sync", sessions: [session] }, one]]);
    expect(await database.sessions.get(session.id)).toEqual(session);
  });

  it.each([400, 403, 409])(
    "preserves a rejected assessment as personal history after HTTP %s",
    async (status) => {
      const hook = await ready();
      const session = { ...recording(), assessmentToken: token };
      await database.sessions.put(session);
      harness.request.mockImplementation(async (body) => {
        if (body.action === "finalize")
          throw new OnlineRequestError("Assessment cannot qualify", status);
        return {};
      });
      await act(() => hook.result.current.queueAssessment(session, token));
      await waitFor(() =>
        expect(hook.result.current.error).toContain(
          "Your local result remains available",
        ),
      );
      expect(
        (await database.sessions.get(session.id))?.assessmentToken,
      ).toBeUndefined();
      expect((await database.uploads.toArray())[0].tokenId).toBeUndefined();
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });
      await waitFor(async () => expect(await database.uploads.count()).toBe(0));
      expect(uploads().map(([body]) => body.action)).toEqual([
        "finalize",
        "sync",
      ]);
      expect((await database.sessions.get(session.id))?.trials).toEqual(
        session.trials,
      );
    },
  );
});
