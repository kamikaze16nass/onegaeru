-- Authoritative rules: adjust this single JSON for play testing.
create table public.pyon_config (
  id boolean primary key default true check (id),
  rules jsonb not null
);
insert into public.pyon_config values (true, '{"jumpMs":240,"networkGraceMs":3000,"kpChance":0.05,"playCap":10,"dailyCap":30,"levels":[{"through":10,"timeMs":2500,"danger":0.12},{"through":20,"timeMs":2200,"danger":0.30},{"through":30,"timeMs":1900,"danger":0.45},{"through":50,"timeMs":1600,"danger":0.60},{"through":75,"timeMs":1350,"danger":0.72},{"through":100,"timeMs":1150,"danger":0.80},{"through":2147483647,"timeMs":1000,"danger":0.85}]}');
alter table public.pyon_config enable row level security;
create policy "read game rules" on public.pyon_config for select to authenticated using (true);
grant select on public.pyon_config to authenticated;

create table public.pyon_runs (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  picked integer not null default 0 check (picked >= 0 and picked <= score),
  stage jsonb not null,
  rules jsonb not null,
  state text not null default 'playing' check (state in ('playing','gameOver')),
  reason text,
  started_at timestamptz not null default clock_timestamp(),
  landed_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  base integer not null default 0,
  awarded integer not null default 0 check (awarded between 0 and 10)
);
create unique index pyon_one_active on public.pyon_runs(user_id) where state = 'playing';
create index pyon_daily on public.pyon_runs(user_id, finished_at);
alter table public.pyon_runs enable row level security;
create policy "own game runs" on public.pyon_runs for select to authenticated using (user_id = auth.uid());
grant select on public.pyon_runs to authenticated;
alter table public.kp_transactions add column pyon_run_id uuid references public.pyon_runs(id);
create unique index kp_one_pyon_reward on public.kp_transactions(pyon_run_id) where pyon_run_id is not null;

create function public.pyon_level(rules jsonb, score integer) returns jsonb language sql immutable set search_path = public as $$
  select value from jsonb_array_elements(rules->'levels') with ordinality
  where score < (value->>'through')::integer order by ordinality limit 1
$$;
create function public.pyon_stage(rules jsonb, score integer) returns jsonb language plpgsql volatile set search_path = public as $$
declare tiles jsonb := '[{"kind":"safe","kp":false},{"kind":"safe","kp":false}]'; side integer; i integer;
begin
  if random() < (pyon_level(rules, score)->>'danger')::numeric then
    side := floor(random()*2)::integer;
    tiles := jsonb_set(tiles, array[side::text,'kind'], to_jsonb((array['hole','water','enemy'])[1+floor(random()*3)::integer]));
  end if;
  for i in 0..1 loop
    if tiles->i->>'kind' = 'safe' then
      tiles := jsonb_set(tiles, array[i::text,'kp'], to_jsonb(random() < (rules->>'kpChance')::numeric));
    end if;
  end loop;
  return tiles;
end $$;
create function public.pyon_today() returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(awarded),0)::integer from pyon_runs where user_id = auth.uid()
  and finished_at >= (date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')
$$;
create function public.pyon_reply(item public.pyon_runs) returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(item) || jsonb_build_object('today', pyon_today(), 'timeMs', (pyon_level(item.rules,item.score)->>'timeMs')::integer)
$$;
create function public.pyon_start(run_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare item pyon_runs%rowtype; settings jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform 1 from profiles where id=auth.uid() for update;
  select * into item from pyon_runs where id=run_id and user_id=auth.uid();
  if found then return pyon_reply(item); end if;
  -- An abandoned run earns nothing. Serialize starts across tabs.
  update pyon_runs set state='gameOver', reason='abandoned', finished_at=clock_timestamp() where user_id=auth.uid() and state='playing';
  select rules into settings from pyon_config where id;
  insert into pyon_runs(id,user_id,stage,rules) values(run_id,auth.uid(),pyon_stage(settings,0),settings) returning * into item;
  return pyon_reply(item);
end $$;
create function public.pyon_move(run_id uuid, expected_score integer, lane integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare item pyon_runs%rowtype; tile jsonb; amount integer; elapsed numeric;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if lane not in (-1,0,1) or lane is null then raise exception 'INVALID_LANE'; end if;
  -- Same lock order as start; profile serializes daily rewards across all runs.
  perform 1 from profiles where id=auth.uid() for update;
  select * into item from pyon_runs where id=run_id and user_id=auth.uid() for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if item.state='gameOver' or expected_score < item.score then return pyon_reply(item); end if;
  if expected_score is distinct from item.score then raise exception 'INVALID_STEP'; end if;
  elapsed := extract(epoch from clock_timestamp()-item.landed_at)*1000;
  if lane=-1 or elapsed > (pyon_level(item.rules,item.score)->>'timeMs')::integer + (item.rules->>'networkGraceMs')::integer then
    item.reason := 'timeout';
  else
    if elapsed < (item.rules->>'jumpMs')::integer then raise exception 'TOO_FAST'; end if;
    tile := item.stage->lane;
    if tile->>'kind' <> 'safe' then item.reason := tile->>'kind';
    else
      item.score := item.score+1;
      item.picked := item.picked + case when (tile->>'kp')::boolean then 1 else 0 end;
      update pyon_runs set score=item.score, picked=item.picked, stage=pyon_stage(item.rules,item.score), landed_at=clock_timestamp() where id=item.id returning * into item;
      return pyon_reply(item);
    end if;
  end if;
  item.base := case when item.score=0 then 0 else least(10, ((item.score-1)/10+1)*2) end;
  amount := least((item.rules->>'playCap')::integer, item.base+item.picked, greatest(0,(item.rules->>'dailyCap')::integer-pyon_today()));
  update pyon_runs set state='gameOver',reason=item.reason,base=item.base,awarded=amount,finished_at=clock_timestamp() where id=item.id returning * into item;
  if amount>0 then
    update profiles set kp_balance=kp_balance+amount where id=auth.uid();
    insert into kp_transactions(user_id,amount,kind,pyon_run_id) values(auth.uid(),amount,'pyon_reward',item.id);
  end if;
  return pyon_reply(item);
end $$;
revoke all on function public.pyon_level(jsonb,integer), public.pyon_stage(jsonb,integer), public.pyon_reply(public.pyon_runs), public.pyon_today(), public.pyon_start(uuid), public.pyon_move(uuid,integer,integer) from public;
grant execute on function public.pyon_today(), public.pyon_start(uuid), public.pyon_move(uuid,integer,integer) to authenticated;
