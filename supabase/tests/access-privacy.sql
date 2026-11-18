-- Run against a disposable Supabase database with the migrations applied.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'privacy-test-a@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'privacy-test-b@example.test');
insert into public.player_profiles (id, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'Privacy test A'),
  ('10000000-0000-4000-8000-000000000002', 'Privacy test B');

set local role anon;
do $$
begin
  if has_table_privilege(current_user, 'public.player_profiles', 'SELECT')
     or has_table_privilege(current_user, 'public.player_sessions', 'SELECT')
     or has_function_privilege(current_user, 'public.delete_player_data(uuid)', 'EXECUTE') then
    raise exception 'Anonymous users can access private player data';
  end if;
end;
$$;
reset role;

set local role authenticated;
do $$
declare
  player uuid;
  visible uuid[];
begin
  foreach player in array array[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', player::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', player)::text, true);
    select array_agg(id) into visible from public.player_profiles;
    if visible is distinct from array[player] then
      raise exception 'Player profile visibility is not scoped to its owner';
    end if;
  end loop;
  if has_table_privilege(current_user, 'public.reference_snapshots', 'SELECT')
     or has_table_privilege(current_user, 'public.player_sessions', 'INSERT')
     or has_function_privilege(current_user, 'public.delete_player_data(uuid)', 'EXECUTE') then
    raise exception 'Player role has server-only privileges';
  end if;
end;
$$;

rollback;
