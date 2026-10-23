import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth }),
}));
const owner = "11111111-1111-4111-8111-111111111111";
const fetchRequest = vi.fn();
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://humanrank.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test-key");
  vi.stubGlobal("fetch", fetchRequest);
  fetchRequest.mockReset();
  auth.getSession.mockReset();
  auth.getSession.mockResolvedValue({
    data: {
      session: { user: { id: owner }, access_token: "test-session-token" },
    },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("online HTTP boundary with simulated Auth and fetch", () => {
  it("rejects an account switch before sending the queued owner's data", async () => {
    const { onlineRequest } = await import("./online");
    await expect(
      onlineRequest({ action: "sync" }, "another-owner"),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("checks the current identity again on retry and rejects a signed-out session", async () => {
    const { onlineRequest } = await import("./online");
    fetchRequest.mockRejectedValueOnce(new TypeError("Offline"));
    await expect(onlineRequest({ action: "profile" }, owner)).rejects.toThrow(
      "Offline",
    );
    auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(onlineRequest({ action: "profile" }, owner)).rejects.toThrow(
      "Sign in",
    );
    expect(fetchRequest).toHaveBeenCalledTimes(1);
  });

  it("preserves HTTP status for assessment fallback and uses a bounded authenticated request", async () => {
    const { onlineRequest } = await import("./online");
    fetchRequest.mockResolvedValue(
      new Response(JSON.stringify({ error: "Token expired" }), { status: 409 }),
    );
    await expect(
      onlineRequest({ action: "finalize", token: "test-token" }, owner),
    ).rejects.toMatchObject({ message: "Token expired", status: 409 });
    const [url, request] = fetchRequest.mock.calls[0];
    expect(url).toBe("https://humanrank.invalid/functions/v1/humanrank");
    expect(request.method).toBe("POST");
    expect(request.headers.Authorization).toBe("Bearer test-session-token");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body)).toEqual({
      action: "finalize",
      token: "test-token",
    });
  });
});
