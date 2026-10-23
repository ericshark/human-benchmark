import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiHandler } from "./api";
function client(user: boolean) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: user ? { id: "11111111-1111-4111-8111-111111111111" } : null,
        },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  } as unknown as SupabaseClient;
}
const origin = "https://humanrank.example";
describe("API request boundary", () => {
  it("rejects another origin before authentication and supports preflight", async () => {
    const sdk = client(true),
      handle = createApiHandler(sdk, origin);
    expect(
      (
        await handle(
          new Request(origin, {
            method: "POST",
            headers: { Origin: "https://attacker.example" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(sdk.auth.getUser).not.toHaveBeenCalled();
    const preflight = await handle(
      new Request(origin, { method: "OPTIONS", headers: { Origin: origin } }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
  it("requires a validated bearer identity for private actions", async () => {
    const sdk = client(false),
      handle = createApiHandler(sdk, origin);
    expect((await handle(new Request(origin, { method: "POST" }))).status).toBe(
      401,
    );
    expect(
      (
        await handle(
          new Request(origin, {
            method: "POST",
            headers: { Authorization: "Bearer expired" },
            body: '{"action":"profile"}',
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("rejects malformed JSON and unknown actions without reaching storage", async () => {
    const handle = createApiHandler(client(true), origin);
    for (const body of [
      "{broken",
      '{"action":"write_arbitrary_score","score":9999}',
    ])
      expect(
        (
          await handle(
            new Request(origin, {
              method: "POST",
              headers: { Authorization: "Bearer valid" },
              body,
            }),
          )
        ).status,
      ).toBe(400);
  });
  it("returns rate limiting before any account operation", async () => {
    const sdk = client(true);
    vi.mocked(sdk.rpc).mockResolvedValue({
      data: false,
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    } as never);
    const result = await createApiHandler(
      sdk,
      origin,
    )(
      new Request(origin, {
        method: "POST",
        headers: { Authorization: "Bearer valid" },
        body: '{"action":"profile"}',
      }),
    );
    expect(result.status).toBe(429);
  });
});

it("bounds streamed request bodies before parsing or database writes", async () => {
  const sdk = client(true),
    handle = createApiHandler(sdk, origin);
  const result = await handle(
    new Request(origin, {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
      body: "a".repeat(4 * 1024 * 1024 + 1),
    }),
  );
  expect(result.status).toBe(413);
  expect(sdk.rpc).not.toHaveBeenCalled();
});
