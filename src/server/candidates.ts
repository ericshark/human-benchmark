import type { SupabaseClient } from "@supabase/supabase-js";
import type { RatedObservation } from "../domain/statistics";
import type { Session } from "../domain/types";
export async function readCandidates(
  client: SupabaseClient,
  cutoff: Date,
  owner?: string,
): Promise<RatedObservation[]> {
  const rows: RatedObservation[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client
      .from("reference_candidates")
      .select("*")
      .lte("server_received_at", cutoff.toISOString())
      .gte(
        "completed_at",
        new Date(cutoff.getTime() - 90 * 86400000).toISOString(),
      )
      .order("id")
      .range(offset, offset + 999);
    if (owner) query = query.eq("player_id", owner);
    const result = await query;
    if (result.error) throw result.error;
    for (const row of result.data ?? [])
      rows.push({
        playerId: row.player_id,
        session: { ...row.session_summary, trials: [] } as Session,
        consent: true,
        eligible: true,
        serverDay: row.server_day,
        rankingValue: row.derived_result.rankingValue,
        higherIsBetter: row.derived_result.higherIsBetter,
      });
    if ((result.data?.length ?? 0) < 1000) break;
    if (rows.length > 100000)
      throw new Error(
        "Aggregation batch limit reached. Partition the job before increasing its scope.",
      );
  }
  return rows;
}

export async function readAggregates(
  client: SupabaseClient,
  cutoff: Date,
  owner?: string,
): Promise<import("../domain/statistics").PlayerAggregate[]> {
  const rows: import("../domain/statistics").PlayerAggregate[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client
      .rpc("reference_player_aggregates", {
        p_cutoff: cutoff.toISOString(),
        p_owner: owner ?? null,
      })
      .range(offset, offset + 999);
    if (result.error) throw result.error;
    for (const row of result.data ?? [])
      rows.push({
        playerId: row.player_id,
        gameId: row.game_id,
        input: row.input_class,
        presentation: row.presentation,
        context: row.context,
        value: Number(row.aggregate_value),
        sessions: Number(row.session_count),
        days: Number(row.available_days),
        updatedAt: row.latest_completed,
        higherIsBetter: row.higher_is_better,
      });
    if ((result.data?.length ?? 0) < 1000) break;
  }
  return rows;
}
