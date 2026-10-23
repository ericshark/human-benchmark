import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { gameIds, sessionSchema } from "../domain/types";
import { scoreSession, hasPrimaryMeasurement } from "../domain/scoring";
import { referenceEligibility, validateSession } from "./validation";
import {
  buildCompleteProfiles,
  compareToReference,
  presentationKey,
  profileUnusualness,
} from "../domain/statistics";
import type { SnapshotData } from "./snapshots";
import { hashSeed } from "../engine/random";
import { readAggregates } from "./candidates";

class PayloadTooLarge extends Error {}
async function readRequestBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4 * 1024 * 1024) {
      await reader.cancel();
      throw new PayloadTooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile") }),
  z.object({
    action: z.literal("preferences"),
    name: z.string().trim().min(1).max(32),
    sync: z.boolean(),
    statistics: z.boolean(),
  }),
  z.object({
    action: z.literal("issue"),
    gameId: z.enum(gameIds),
    input: z.enum(["mouse", "trackpad", "touch", "keyboard"]),
  }),
  z.object({
    action: z.literal("finalize"),
    token: z.string().uuid(),
    session: sessionSchema,
  }),
  z.object({
    action: z.literal("sync"),
    sessions: z.array(sessionSchema).min(1).max(25),
  }),
  z.object({ action: z.literal("history") }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("share"), sessionId: z.string().uuid() }),
  z.object({ action: z.literal("revoke-share"), shareId: z.string().uuid() }),
  z.object({ action: z.literal("comparisons"), session: sessionSchema }),
  z.object({
    action: z.literal("ratings"),
    input: z.enum(["mouse", "trackpad", "touch", "keyboard"]),
    context: z.enum(["compact", "medium", "wide"]),
  }),
]);
export function createApiHandler(
  client: SupabaseClient,
  allowedOrigin: string,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers":
        "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    };
    const respond = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && origin !== allowedOrigin)
      return respond({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return respond({ error: "Use POST for this endpoint." }, 405);
    const bearer = request.headers
      .get("Authorization")
      ?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer)
      return respond({ error: "Sign in before using online features." }, 401);
    const { data: identity, error: authError } =
      await client.auth.getUser(bearer);
    if (authError || !identity.user)
      return respond({ error: "Your sign-in has expired." }, 401);
    const owner = identity.user.id;
    try {
      const text = await readRequestBody(request);
      if (text.length > 4 * 1024 * 1024)
        return respond({ error: "Request is too large." }, 413);
      const parsed = actionSchema.safeParse(JSON.parse(text));
      if (!parsed.success)
        return respond(
          { error: "The request format or protocol version is not supported." },
          400,
        );
      const action = parsed.data;
      const limit = await client.rpc("consume_request", {
        p_player: owner,
        p_action: action.action,
        p_limit: action.action === "sync" ? 10 : 30,
      });
      if (limit.error)
        return respond(
          {
            error:
              "The online service is not ready. Local play is still available.",
          },
          503,
        );
      if (!limit.data)
        return respond(
          { error: "Too many requests. Please try again in a minute." },
          429,
        );
      if (action.action === "profile") {
        const result = await client
          .from("player_profiles")
          .select("*")
          .eq("id", owner)
          .maybeSingle();
        if (result.error) throw result.error;
        const shares = await client
          .from("shared_results")
          .select("id,session_id,created_at,expires_at,revoked_at")
          .eq("player_id", owner)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .limit(50);
        return respond({
          serverTime: new Date().toISOString(),
          profile: result.data,
          shares: shares.data ?? [],
          anonymous: identity.user.is_anonymous === true,
        });
      }
      if (action.action === "preferences") {
        const result = await client.rpc("set_player_preferences", {
          p_player: owner,
          p_name: action.name,
          p_sync: action.sync,
          p_statistics: action.statistics,
        });
        if (result.error) throw result.error;
        return respond({ saved: true });
      }
      const { data: profile } = await client
        .from("player_profiles")
        .select("*")
        .eq("id", owner)
        .maybeSingle();
      if (action.action === "issue") {
        if (!profile?.statistics_consent)
          return respond(
            {
              error:
                "Enable population contribution before starting an online assessment.",
            },
            403,
          );
        const result = await client
          .from("assessment_tokens")
          .insert({
            player_id: owner,
            game_id: action.gameId,
            input_class: action.input,
            seed: crypto.getRandomValues(new Uint32Array(1))[0],
          })
          .select("id,seed,issued_at,expires_at,input_class")
          .single();
        if (result.error?.code === "23505")
          return respond(
            {
              error:
                "Today’s rated opportunity for this game has already started. Local assessments and practice remain available.",
            },
            409,
          );
        if (result.error) throw result.error;
        return respond({ token: result.data });
      }
      if (action.action === "finalize") {
        const session = validateSession(action.session, true);
        const token = await client
          .from("assessment_tokens")
          .select("*")
          .eq("id", action.token)
          .eq("player_id", owner)
          .maybeSingle();
        if (!token.data)
          return respond(
            { error: "Assessment token was not found for your account." },
            403,
          );
        const age = Date.now() - Date.parse(token.data.issued_at);
        const minimum =
          session.gameId === "orbit-track" ||
          session.gameId === "math-sprint" ||
          session.gameId === "symbol-match"
            ? 44000
            : session.gameId === "signal"
              ? 12000
              : 0;
        if (age < minimum)
          return respond(
            {
              error:
                "The server assessment window is shorter than this protocol permits.",
            },
            400,
          );
        session.startedAt = new Date(token.data.issued_at).toISOString();
        session.onlineOwner = owner;
        session.assessmentToken = action.token;
        session.completedAt = new Date().toISOString();
        const result = await client.rpc("finalize_assessment", {
          p_player: owner,
          p_token: action.token,
          p_session: session,
          p_result: scoreSession(session),
          p_eligible: referenceEligibility(session),
        });
        if (result.error) throw result.error;
        return respond({
          id: result.data,
          eligible: referenceEligibility(session),
        });
      }
      if (action.action === "sync") {
        if (!profile?.sync_enabled)
          return respond(
            { error: "Enable account synchronization first." },
            403,
          );
        const sessions = action.sessions.map((payload) => {
          const session = validateSession(payload);
          delete session.assessmentToken;
          session.onlineOwner = owner;
          return session;
        });
        const result = await client.from("player_sessions").upsert(
          sessions.map((session) => ({
            id: session.id,
            player_id: owner,
            game_id: session.gameId,
            input_class: session.input,
            mode: session.mode,
            completed_at: session.completedAt,
            session_data: session,
            derived_result: scoreSession(session),
            eligible: false,
          })),
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (result.error) throw result.error;
        return respond({ processed: sessions.length });
      }
      if (action.action === "history") {
        if (!profile?.sync_enabled)
          return respond(
            { error: "Enable account synchronization first." },
            403,
          );
        const result = await client
          .from("player_sessions")
          .select("session_data")
          .eq("player_id", owner)
          .order("completed_at", { ascending: false })
          .limit(5000);
        if (result.error) throw result.error;
        return respond({
          sessions: (result.data ?? []).map((row) => row.session_data),
        });
      }
      if (action.action === "delete") {
        const result = await client.rpc("delete_player_data", {
          p_player: owner,
        });
        if (result.error) throw result.error;
        const deleted = await client.auth.admin.deleteUser(owner);
        if (deleted.error)
          return respond(
            {
              error:
                "Your performance data was deleted, but account removal needs an administrator retry.",
            },
            503,
          );
        return respond({ deleted: true });
      }
      if (action.action === "share") {
        const row = await client
          .from("player_sessions")
          .select("session_data,derived_result")
          .eq("id", action.sessionId)
          .eq("player_id", owner)
          .maybeSingle();
        if (!row.data)
          return respond(
            {
              error:
                "Sync this session to your account before creating a public link.",
            },
            404,
          );
        const session = sessionSchema.parse(row.data.session_data),
          result = scoreSession(session);
        if (!hasPrimaryMeasurement(session))
          return respond(
            {
              error:
                "Complete a session with a valid measurement before creating a public link.",
            },
            400,
          );
        const share = await client
          .from("shared_results")
          .insert({
            player_id: owner,
            session_id: session.id,
            public_summary: {
              gameId: session.gameId,
              protocol: session.version,
              mode: session.mode,
              input: session.input,
              completedAt: session.completedAt,
              primary: result.primary,
              metrics: result.metrics,
              populationRank: null,
            },
          })
          .select("id,expires_at")
          .single();
        if (share.error) throw share.error;
        return respond({ share: share.data });
      }
      if (action.action === "revoke-share") {
        const result = await client
          .from("shared_results")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", action.shareId)
          .eq("player_id", owner);
        if (result.error) throw result.error;
        return respond({ revoked: true });
      }
      if (action.action === "comparisons" || action.action === "ratings") {
        const snapshot = await client
          .from("reference_snapshots")
          .select("id,created_at,reference_data,source_cutoff")
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!snapshot.data)
          return respond({
            status: "unavailable",
            reason: "No qualifying reference snapshot is available yet.",
            n: 0,
          });
        const referenceData = snapshot.data.reference_data as SnapshotData;
        const aggregates = await readAggregates(client, new Date(), owner);
        if (action.action === "comparisons") {
          const session = validateSession(action.session);
          const aggregate = aggregates.find(
            (item) =>
              item.gameId === session.gameId &&
              item.input === session.input &&
              item.presentation === presentationKey(session),
          );
          if (!aggregate)
            return respond({
              status: "unavailable",
              reason:
                "Three eligible assessments on distinct days with this setup are needed.",
              n: 0,
            });
          const reference = referenceData.references.find(
            (item) =>
              item.gameId === session.gameId &&
              item.input === session.input &&
              item.presentation === aggregate.presentation,
          );
          if (!reference)
            return respond({
              status: "unavailable",
              reason:
                "No compatible reference cohort is available for this setup.",
              n: 0,
            });
          return respond({
            ...compareToReference(aggregate.value, reference),
            snapshotDate: snapshot.data.created_at,
            basis:
              "Median of recent eligible assessments versus comparable repeated-session player aggregates.",
          });
        }
        const cohort = referenceData.completeCohorts.find(
          (item) =>
            item.input === action.input && item.context === action.context,
        );
        const own = buildCompleteProfiles(
          aggregates,
          referenceData.references,
          action.input,
          action.context,
        )[0];
        if (!own || !cohort || cohort.indices.length < 100)
          return respond({
            status: "unavailable",
            reason:
              "A complete repeated-assessment profile and at least 100 comparable complete reference profiles are needed.",
            n: cohort?.indices.length ?? 0,
            rarity: referenceData.rarity,
          });
        const snapshotDate = snapshot.data.created_at;
        const overall = compareToReference(own.index, {
          gameId: "signal",
          input: action.input,
          values: cohort.indices,
          higherIsBetter: true,
          snapshot: snapshotDate,
        });
        const categoryComparisons = own.categories.map((value, index) =>
          compareToReference(value, {
            gameId: "signal",
            input: action.input,
            values: cohort.categoryVectors.map((vector) => vector[index]),
            higherIsBetter: true,
            snapshot: snapshotDate,
          }),
        );
        const rarityProfile = cohort.rarityBank
          ? buildCompleteProfiles(
              aggregates,
              cohort.rarityBank.references,
              action.input,
              action.context,
            )[0]
          : undefined;
        const rarity = rarityProfile
          ? profileUnusualness(
              rarityProfile,
              cohort.rarityBank!.models[hashSeed(owner) % 4],
            )
          : referenceData.rarity;
        const evidence = JSON.stringify(
          aggregates
            .filter(
              (item) =>
                item.input === action.input && item.context === action.context,
            )
            .map((item) => [item.gameId, item.value, item.updatedAt])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        );
        const digest = new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(evidence),
          ),
        );
        const evidenceKey = Array.from(digest, (value) =>
          value.toString(16).padStart(2, "0"),
        ).join("");
        const recorded = await client.from("rating_history").upsert(
          {
            player_id: owner,
            snapshot_id: snapshot.data.id,
            reference_date: snapshot.data.created_at,
            evidence_key: evidenceKey,
            humanrank_index: own.index,
            category_indices: own.categories,
            comparison: overall,
          },
          {
            onConflict: "player_id,snapshot_id,evidence_key",
            ignoreDuplicates: true,
          },
        );
        if (recorded.error) throw recorded.error;
        const history = await client
          .from("rating_history")
          .select("id,reference_date,computed_at,humanrank_index")
          .eq("player_id", owner)
          .order("computed_at", { ascending: false })
          .limit(20);
        return respond({
          ...overall,
          history: history.data ?? [],
          index: own.index,
          categoryIndices: own.categories,
          categoryComparisons,
          snapshotDate: snapshot.data.created_at,
          rarity,
          cohort: `${action.context} / ${action.input}`,
        });
      }
      return respond({ error: "Unknown action." }, 400);
    } catch (error) {
      if (error instanceof PayloadTooLarge)
        return respond({ error: "Request is too large." }, 413);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return respond(
          { error: "The submitted session or JSON was invalid." },
          400,
        );
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : "";
      if (
        /^(Session|Trial|Stimulus|Only standard|The assessment|The challenge|A submitted|Memory|Invalid|Assessment|Statistics|The resulting)/.test(
          message,
        )
      )
        return respond({ error: message }, 400);
      return respond(
        {
          error:
            "The online operation could not be completed. Your local history is still available.",
        },
        500,
      );
    }
  };
}
