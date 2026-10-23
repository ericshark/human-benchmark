-- All event writes pass through the authenticated validation function.
create table public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Explorer' check (char_length(display_name) between 1 and 32),
  sync_enabled boolean not null default false,
  statistics_consent boolean not null default false,
  consent_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.assessment_tokens (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id in ('signal','crossroads','grid-recall','echo-path','color-conflict','rule-shift','pattern-forge','rotation-lab','target-burst','orbit-track','symbol-match','math-sprint')),
  protocol_version integer not null default 1 check (protocol_version = 1),
  input_class text not null check (input_class in ('mouse','trackpad','touch','keyboard')),
  seed bigint not null check (seed between 0 and 4294967295),
  server_day date not null default (now() at time zone 'UTC')::date,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 minutes',
  unique(player_id,game_id,protocol_version,server_day)
);
create table public.player_sessions (
  id uuid primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  input_class text not null,
  mode text not null check (mode in ('assessment','daily','practice')),
  completed_at timestamptz not null,
  session_data jsonb not null,
  derived_result jsonb not null,
  token_id uuid unique references public.assessment_tokens(id),
  eligible boolean not null default false,
  server_received_at timestamptz not null default now(),
  check (not eligible or (token_id is not null and mode = 'assessment'))
);
create index player_sessions_owner_date on public.player_sessions(player_id,completed_at desc);
create index player_sessions_reference on public.player_sessions(game_id,input_class) where eligible;
create table public.reference_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  methodology_version integer not null default 1,
  status text not null default 'pending' check (status in ('pending','ready','retired')),
  source_cutoff timestamptz not null,
  reference_data jsonb not null,
  -- Per-player data is server-only. The public API returns only the evaluated aggregate comparison.
  participant_ids uuid[] not null default '{}'
);
create table public.shared_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.player_sessions(id) on delete cascade,
  public_summary jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz
);
create table public.request_limits (
  player_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key(player_id,action,window_start)
);

alter table public.player_profiles enable row level security;
alter table public.assessment_tokens enable row level security;
alter table public.player_sessions enable row level security;
alter table public.reference_snapshots enable row level security;
alter table public.shared_results enable row level security;
alter table public.request_limits enable row level security;
create policy own_profile_read on public.player_profiles for select to authenticated using (id = (select auth.uid()));
create policy own_session_read on public.player_sessions for select to authenticated using (player_id = (select auth.uid()));
create policy own_tokens_read on public.assessment_tokens for select to authenticated using (player_id = (select auth.uid()));
create policy own_shares_read on public.shared_results for select to authenticated using (player_id = (select auth.uid()));
revoke all on public.player_profiles,public.assessment_tokens,public.player_sessions,public.reference_snapshots,public.shared_results,public.request_limits from anon,authenticated;
grant select on public.player_profiles,public.assessment_tokens,public.player_sessions,public.shared_results to authenticated;
grant all on public.player_profiles,public.assessment_tokens,public.player_sessions,public.reference_snapshots,public.shared_results,public.request_limits to service_role;

create table public.consent_events (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references auth.users(id) on delete cascade,
  sync_enabled boolean not null, statistics_consent boolean not null, changed_at timestamptz not null default now()
);
alter table public.consent_events enable row level security;
create policy own_consent_history on public.consent_events for select to authenticated using(player_id=(select auth.uid()));
revoke all on public.consent_events from public,anon,authenticated;
grant select on public.consent_events to authenticated;
grant all on public.consent_events to service_role;

create function public.consume_request(p_player uuid,p_action text,p_limit integer) returns boolean
language plpgsql security definer set search_path = public,pg_temp as $$
declare used integer;
begin
  insert into request_limits(player_id,action,window_start) values(p_player,p_action,date_trunc('minute',now()))
  on conflict(player_id,action,window_start) do update set hits = request_limits.hits + 1 returning hits into used;
  return used <= p_limit;
end; $$;

create function public.finalize_assessment(p_player uuid,p_token uuid,p_session jsonb,p_result jsonb,p_eligible boolean) returns uuid
language plpgsql security definer set search_path = public,pg_temp as $$
declare token assessment_tokens; existing player_sessions; session_id uuid;
begin
  select * into token from assessment_tokens where id=p_token and player_id=p_player for update;
  if not found then raise exception 'Assessment token not found'; end if;
  select * into existing from player_sessions where token_id=p_token;
  if found then
    if existing.id = (p_session->>'id')::uuid then return existing.id; end if;
    raise exception 'Assessment already finalized';
  end if;
  if token.expires_at < now() then raise exception 'Assessment token expired'; end if;
  if p_session->>'gameId' <> token.game_id or (p_session->>'seed')::bigint <> token.seed or p_session->>'input' <> token.input_class or p_session->>'mode' <> 'assessment' then raise exception 'Assessment protocol does not match token'; end if;
  if not exists(select 1 from player_profiles where id=p_player and statistics_consent) then raise exception 'Statistics consent is required'; end if;
  session_id := (p_session->>'id')::uuid;
  insert into player_sessions(id,player_id,game_id,input_class,mode,completed_at,session_data,derived_result,token_id,eligible)
    values(session_id,p_player,token.game_id,token.input_class,'assessment',(p_session->>'completedAt')::timestamptz,p_session,p_result,p_token,p_eligible)
    on conflict(id) do update set session_data=excluded.session_data,derived_result=excluded.derived_result,token_id=excluded.token_id,eligible=excluded.eligible,completed_at=excluded.completed_at,game_id=excluded.game_id,input_class=excluded.input_class,mode=excluded.mode
    where player_sessions.player_id=p_player and player_sessions.token_id is null
    returning id into session_id;
  if not found then raise exception 'Session belongs to a different owner or assessment'; end if;
  return session_id;
end; $$;

create function public.set_player_preferences(p_player uuid,p_name text,p_sync boolean,p_statistics boolean) returns void
language plpgsql security definer set search_path = public,pg_temp as $$
begin
  insert into player_profiles(id,display_name,sync_enabled,statistics_consent) values(p_player,p_name,p_sync,p_statistics)
  on conflict(id) do update set display_name=excluded.display_name,sync_enabled=excluded.sync_enabled,statistics_consent=excluded.statistics_consent,consent_updated_at=now();
  insert into consent_events(player_id,sync_enabled,statistics_consent) values(p_player,p_sync,p_statistics);
  -- Withdrawn participants are removed from current references immediately, before the next rebuild.
  if not p_statistics then update reference_snapshots set status='retired' where status='ready' and p_player=any(participant_ids); end if;
end; $$;

create function public.delete_player_data(p_player uuid) returns void
language plpgsql security definer set search_path = public,pg_temp as $$
begin
  update reference_snapshots set status='retired',participant_ids=array_remove(participant_ids,p_player) where p_player=any(participant_ids);
  delete from rating_history where player_id=p_player;
  delete from shared_results where player_id=p_player;
  delete from player_sessions where player_id=p_player;
  delete from assessment_tokens where player_id=p_player;
  delete from request_limits where player_id=p_player;
  delete from consent_events where player_id=p_player;
  delete from player_profiles where id=p_player;
end; $$;

create function public.read_shared_result(p_share uuid) returns jsonb
language sql stable security definer set search_path = public,pg_temp as $$
  select public_summary from shared_results where id=p_share and revoked_at is null and expires_at > now();
$$;
revoke all on function public.consume_request(uuid,text,integer),public.finalize_assessment(uuid,uuid,jsonb,jsonb,boolean),public.set_player_preferences(uuid,text,boolean,boolean),public.delete_player_data(uuid),public.read_shared_result(uuid) from public,anon,authenticated;
grant execute on function public.consume_request(uuid,text,integer),public.finalize_assessment(uuid,uuid,jsonb,jsonb,boolean),public.set_player_preferences(uuid,text,boolean,boolean),public.delete_player_data(uuid) to service_role;
grant execute on function public.read_shared_result(uuid) to anon,authenticated,service_role;

-- The aggregator does not load raw traces or private notes into memory.
create view public.reference_candidates with (security_invoker = true) as
select s.id,s.player_id,s.game_id,s.input_class,s.completed_at,s.server_received_at,s.derived_result,
       s.session_data - 'trials' - 'note' as session_summary,t.server_day
from public.player_sessions s
join public.player_profiles p on p.id=s.player_id and p.statistics_consent
join public.assessment_tokens t on t.id=s.token_id
where s.eligible;
revoke all on public.reference_candidates from public,anon,authenticated;
grant select on public.reference_candidates to service_role;

create function public.publish_reference_snapshot(p_cutoff timestamptz,p_data jsonb,p_participants uuid[]) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare consenting integer; snapshot_id uuid;
begin
  -- Locks make publication and concurrent consent withdrawal serializable for these players.
  perform id from player_profiles where id=any(p_participants) and statistics_consent order by id for share;
  get diagnostics consenting = row_count;
  if consenting <> cardinality(p_participants) then raise exception 'Participant consent changed; rebuild the snapshot'; end if;
  update reference_snapshots set status='retired' where status='ready';
  insert into reference_snapshots(status,source_cutoff,reference_data,participant_ids) values('ready',p_cutoff,p_data,p_participants) returning id into snapshot_id;
  return snapshot_id;
end; $$;
create function public.maintain_player_data() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update player_sessions set session_data=(session_data-'trials'-'note') || jsonb_build_object('trials','[]'::jsonb,'recordingExpired',true,'archivedResult',derived_result)
    where completed_at < now()-interval '90 days' and not (session_data ? 'recordingExpired');
  delete from request_limits where window_start < now()-interval '2 days';
  delete from shared_results where expires_at < now() or revoked_at < now()-interval '7 days';
end; $$;
revoke all on function public.publish_reference_snapshot(timestamptz,jsonb,uuid[]),public.maintain_player_data() from public,anon,authenticated;
grant execute on function public.publish_reference_snapshot(timestamptz,jsonb,uuid[]),public.maintain_player_data() to service_role;

-- Aggregate in PostgreSQL so scheduled jobs do not download every raw event or session.
create function public.reference_player_aggregates(p_cutoff timestamptz,p_owner uuid default null)
returns table(player_id uuid,game_id text,input_class text,presentation text,context text,aggregate_value double precision,session_count bigint,available_days bigint,latest_completed timestamptz,higher_is_better boolean)
language sql stable security definer set search_path=public,pg_temp as $$
with source as (
  select c.*,case when (session_summary->'viewport'->>'width')::int<600 then 'compact' when (session_summary->'viewport'->>'width')::int<1000 then 'medium' else 'wide' end as display_context
  from reference_candidates c where c.server_received_at<=p_cutoff and c.completed_at>=p_cutoff-interval '90 days' and c.completed_at<=p_cutoff and (p_owner is null or c.player_id=p_owner)
), presented as (
  select source.*,display_context || case when session_summary ? 'arena' then ':' || round((session_summary->'arena'->>'width')::numeric)::text || 'x' || round((session_summary->'arena'->>'height')::numeric)::text else '' end as presentation_key from source
), per_day as (
  select presented.*,row_number() over(partition by player_id,game_id,input_class,presentation_key,server_day order by completed_at,id) as day_position from presented
), recent as (
  select per_day.*,row_number() over(partition by player_id,game_id,input_class,presentation_key order by server_day desc) as recent_position,
    count(*) over(partition by player_id,game_id,input_class,presentation_key) as total_days
  from per_day where day_position=1
)
select player_id,game_id,input_class,presentation_key,display_context,
  percentile_cont(.5) within group(order by (derived_result->>'rankingValue')::double precision),count(*),max(total_days),max(completed_at),bool_and((derived_result->>'higherIsBetter')::boolean)
from recent where recent_position<=5 group by player_id,game_id,input_class,presentation_key,display_context having count(*)>=3
order by player_id,game_id,input_class,presentation_key;
$$;
revoke all on function public.reference_player_aggregates(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.reference_player_aggregates(timestamptz,uuid) to service_role;

create table public.rating_history (
  id uuid primary key default gen_random_uuid(),player_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid references public.reference_snapshots(id) on delete set null,
  reference_date timestamptz not null,computed_at timestamptz not null default now(),evidence_key text not null,
  humanrank_index integer not null check(humanrank_index between 0 and 1000),category_indices jsonb not null,comparison jsonb not null,
  unique(player_id,snapshot_id,evidence_key)
);
alter table public.rating_history enable row level security;
create policy own_rating_history on public.rating_history for select to authenticated using(player_id=(select auth.uid()));
revoke all on public.rating_history from public,anon,authenticated;
grant select on public.rating_history to authenticated;
grant all on public.rating_history to service_role;
