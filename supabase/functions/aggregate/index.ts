import { createClient } from "npm:@supabase/supabase-js@2";
import { buildSnapshotFromAggregates } from "../../../src/server/snapshots.ts";
import { readAggregates } from "../../../src/server/candidates.ts";
const url = Deno.env.get("SUPABASE_URL"),
  key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  secret = Deno.env.get("SNAPSHOT_JOB_SECRET");
if (!url || !key || !secret || secret.length < 32) {
  throw new Error(
    "Configure service credentials and a job secret of at least 32 characters.",
  );
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function equalSecret(candidate: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret!)),
  ]);
  return new Uint8Array(left).reduce(
    (difference, value, index) =>
      difference | (value ^ new Uint8Array(right)[index]),
    0,
  ) === 0;
}
Deno.serve(async (request) => {
  if (
    request.method !== "POST" ||
    !(await equalSecret(
      request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "",
    ))
  ) return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.job === "maintenance") {
      const result = await client.rpc("maintain_player_data");
      if (result.error) throw result.error;
      return Response.json({ maintained: true });
    }
    const cutoff = new Date(),
      aggregates = await readAggregates(client, cutoff);
    const enableRarity = Deno.env.get("ENABLE_PROFILE_RARITY") === "true";
    const previous = enableRarity
      ? await client.from("reference_snapshots").select(
        "reference_data,participant_ids",
      ).eq("status", "ready").order("created_at", { ascending: false }).limit(1)
        .maybeSingle()
      : null;
    const built = buildSnapshotFromAggregates(aggregates, cutoff, {
      enableRarity,
      previousReferences: previous?.data?.reference_data.references,
      previousParticipants: previous?.data?.participant_ids,
    });
    const result = await client.rpc("publish_reference_snapshot", {
      p_cutoff: cutoff.toISOString(),
      p_data: built.data,
      p_participants: built.participants,
    });
    if (result.error) throw result.error;
    await client.from("request_limits").delete().lt(
      "window_start",
      new Date(Date.now() - 2 * 86400000).toISOString(),
    );
    return Response.json({
      snapshot: result.data,
      participants: built.participants.length,
      cohorts: built.data.references.length,
    });
  } catch {
    return Response.json({
      error: "Snapshot build failed; the previous reference remains available.",
    }, { status: 500 });
  }
});
