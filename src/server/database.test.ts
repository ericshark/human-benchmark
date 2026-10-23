import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222";
const token = "33333333-3333-4333-8333-333333333333",
  sessionId = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    insert into auth.users values('${one}'),('${two}');`);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/202610220001_core.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(`insert into public.player_profiles(id,display_name,statistics_consent) values('${one}','Ada',true),('${two}','Grace',true);
    insert into public.assessment_tokens(id,player_id,game_id,input_class,seed) values('${token}','${one}','signal','mouse',123);`);
}, 30000);
afterEach(async () => {
  await db.exec("reset role");
});
afterAll(async () => {
  await db.close();
});

describe("PostgreSQL access control and atomic assessment handling", () => {
  it("isolates account reads and forbids direct writes to scores and statistics", async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${one}'`);
    const result = await db.query<{ id: string }>(
      "select id from player_profiles",
    );
    expect(result.rows).toEqual([{ id: one }]);
    await expect(
      db.exec(
        `update player_profiles set statistics_consent=true where id='${two}'`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("select * from reference_snapshots")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.exec(`select set_player_preferences('${two}','Hacked',true,true)`),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows exactly one daily token per player/game even across input classes", async () => {
    await expect(
      db.exec(
        `insert into assessment_tokens(player_id,game_id,input_class,seed) values('${one}','signal','touch',999)`,
      ),
    ).rejects.toThrow(/unique/);
  });
  it("finalizes a token atomically and idempotently; prevents cross-owner finalization", async () => {
    const session = JSON.stringify({
      id: sessionId,
      gameId: "signal",
      seed: 123,
      input: "mouse",
      mode: "assessment",
      completedAt: new Date().toISOString(),
    });
    await db.exec("set role service_role");
    await expect(
      db.query("select finalize_assessment($1,$2,$3::jsonb,$4::jsonb,true)", [
        two,
        token,
        session,
        "{}",
      ]),
    ).rejects.toThrow(/not found/);
    const first = await db.query(
      "select finalize_assessment($1,$2,$3::jsonb,$4::jsonb,true) as id",
      [one, token, session, "{}"],
    );
    const retry = await db.query(
      "select finalize_assessment($1,$2,$3::jsonb,$4::jsonb,true) as id",
      [one, token, session, "{}"],
    );
    expect(first.rows).toEqual([{ id: sessionId }]);
    expect(retry.rows).toEqual(first.rows);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from player_sessions",
        )
      ).rows[0].count,
    ).toBe(1);
    await expect(
      db.query("select finalize_assessment($1,$2,$3::jsonb,$4::jsonb,true)", [
        one,
        token,
        JSON.stringify({ ...JSON.parse(session), id: crypto.randomUUID() }),
        "{}",
      ]),
    ).rejects.toThrow(/already finalized/);
  });
  it("rejects token protocol mismatch and expiry", async () => {
    const next = crypto.randomUUID();
    await db.exec(
      `insert into assessment_tokens(id,player_id,game_id,input_class,seed,expires_at) values('${next}','${two}','signal','mouse',123,now()-interval '1 minute')`,
    );
    const session = {
      id: crypto.randomUUID(),
      gameId: "signal",
      seed: 123,
      input: "mouse",
      mode: "assessment",
      completedAt: new Date().toISOString(),
    };
    await db.exec("set role service_role");
    await expect(
      db.query("select finalize_assessment($1,$2,$3::jsonb,$4::jsonb,true)", [
        two,
        next,
        JSON.stringify(session),
        "{}",
      ]),
    ).rejects.toThrow(/expired/);
  });
  it("applies rate limits atomically", async () => {
    await db.exec("set role service_role");
    const results: boolean[] = [];
    for (let request = 0; request < 4; request++)
      results.push(
        (
          await db.query<{ ok: boolean }>(
            "select consume_request($1,$2,3) as ok",
            [one, "test"],
          )
        ).rows[0].ok,
      );
    expect(results).toEqual([true, true, true, false]);
  });
  it("withdraws active references immediately and preserves the other account", async () => {
    await db.exec(
      `insert into reference_snapshots(status,source_cutoff,reference_data,participant_ids) values('ready',now(),'{}',array['${one}']::uuid[])`,
    );
    await db.exec("set role service_role");
    await db.query("select set_player_preferences($1,$2,false,false)", [
      one,
      "Ada",
    ]);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from reference_snapshots",
        )
      ).rows[0].status,
    ).toBe("retired");
    await db.query("select delete_player_data($1)", [one]);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from player_sessions where player_id=$1",
          [one],
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (await db.query<{ id: string }>("select id from player_profiles")).rows,
    ).toEqual([{ id: two }]);
  });
  it("does not expose public shares without a valid, unrevoked token", async () => {
    await db.exec("set role anon");
    expect(
      (
        await db.query<{ value: unknown }>(
          "select read_shared_result($1) as value",
          [crypto.randomUUID()],
        )
      ).rows[0].value,
    ).toBeNull();
    await expect(db.exec("select * from shared_results")).rejects.toThrow(
      /permission denied/,
    );
  });
});

it("publishes only consenting participants and rejects withdrawn snapshot input", async () => {
  await db.exec("reset role");
  await db.exec("set role service_role");
  await expect(
    db.query("select publish_reference_snapshot(now(),$1::jsonb,$2::uuid[])", [
      "{}",
      [one],
    ]),
  ).rejects.toThrow(/consent changed/);
  const result = await db.query<{ id: string }>(
    "select publish_reference_snapshot(now(),$1::jsonb,$2::uuid[]) as id",
    ["{}", [two]],
  );
  expect(result.rows[0].id).toBeTruthy();
});

it("expires raw cloud recordings while retaining score summaries", async () => {
  await db.exec("reset role");
  const id = crypto.randomUUID();
  const summary = {
    primary: { label: "Median reaction", value: 250, unit: "ms", digits: 0 },
    rankingValue: 250,
    higherIsBetter: false,
    metrics: [],
    accuracy: 100,
    correct: 12,
    total: 12,
  };
  await db.query(
    "insert into player_sessions(id,player_id,game_id,input_class,mode,completed_at,session_data,derived_result) values($1,$2,'signal','mouse','assessment',now()-interval '91 days',$3::jsonb,$4::jsonb)",
    [
      id,
      two,
      JSON.stringify({ trials: [{ latency: 250 }], note: "private" }),
      JSON.stringify(summary),
    ],
  );
  await db.exec("set role service_role");
  await db.query("select maintain_player_data()");
  const result = await db.query<{
    session_data: {
      trials: unknown[];
      note?: string;
      recordingExpired: boolean;
      archivedResult: unknown;
    };
  }>("select session_data from player_sessions where id=$1", [id]);
  expect(result.rows[0].session_data.trials).toEqual([]);
  expect(result.rows[0].session_data.note).toBeUndefined();
  expect(result.rows[0].session_data.archivedResult).toEqual(summary);
});

it("aggregates validated recent sessions in PostgreSQL with one contribution per player", async () => {
  await db.exec("reset role");
  for (const [index, value] of [200, 300, 400].entries()) {
    const day = new Date(Date.now() - (index + 10) * 86400000).toISOString(),
      tokenId = crypto.randomUUID(),
      id = crypto.randomUUID();
    await db.query(
      "insert into assessment_tokens(id,player_id,game_id,input_class,seed,server_day) values($1,$2,'signal','mouse',1,$3::timestamptz::date)",
      [tokenId, two, day],
    );
    await db.query(
      "insert into player_sessions(id,player_id,game_id,input_class,mode,completed_at,session_data,derived_result,token_id,eligible) values($1,$2,'signal','mouse','assessment',$3::timestamptz,$4::jsonb,$5::jsonb,$6,true)",
      [
        id,
        two,
        day,
        JSON.stringify({
          viewport: { width: 1440, height: 900 },
          mode: "assessment",
          flags: [],
        }),
        JSON.stringify({ rankingValue: value, higherIsBetter: false }),
        tokenId,
      ],
    );
  }
  await db.exec("set role service_role");
  const result = await db.query<{
    aggregate_value: number;
    session_count: number;
    presentation: string;
    player_id: string;
  }>("select * from reference_player_aggregates(now(),$1)", [two]);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].aggregate_value).toBe(300);
  expect(Number(result.rows[0].session_count)).toBe(3);
  expect(result.rows[0].presentation).toBe("wide");
});

it("preserves original rating references without allowing duplicate or cross-account history", async () => {
  await db.exec("reset role");
  const snapshot = (
    await db.query<{ id: string }>(
      "select id from reference_snapshots where status='ready' limit 1",
    )
  ).rows[0].id;
  await db.query(
    "insert into rating_history(player_id,snapshot_id,reference_date,evidence_key,humanrank_index,category_indices,comparison) values($1,$2,now(),'fixed-evidence',500,'[50,50,50,50,50,50]','{}')",
    [two, snapshot],
  );
  await expect(
    db.query(
      "insert into rating_history(player_id,snapshot_id,reference_date,evidence_key,humanrank_index,category_indices,comparison) values($1,$2,now(),'fixed-evidence',600,'[]','{}')",
      [two, snapshot],
    ),
  ).rejects.toThrow(/unique/);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${one}'`);
  expect((await db.query("select * from rating_history")).rows).toEqual([]);
  await expect(
    db.exec("update rating_history set humanrank_index=1000"),
  ).rejects.toThrow(/permission denied/);
});
