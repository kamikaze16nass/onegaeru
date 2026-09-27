-- おねがえる MVP schema. Run in a new Supabase project.
create extension if not exists pgcrypto with schema extensions;

create type public.request_status as enum ('pending', 'accepted', 'done_pending_confirm', 'complete');
create type public.kp_transaction_kind as enum ('initial', 'return_payment', 'completion_reward');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  kp_balance integer not null default 50 check (kp_balance >= 0),
  created_at timestamptz not null default now()
);

create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.pair_members (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pair_id, user_id)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  current_holder_id uuid not null references public.profiles(id),
  completed_by uuid references public.profiles(id),
  title text not null check (char_length(title) between 1 and 80),
  note text check (note is null or char_length(note) <= 300),
  due_date date,
  status public.request_status not null default 'pending',
  reward_kp integer not null default 0 check (reward_kp >= 0),
  last_bid_kp integer not null default 0 check (last_bid_kp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_returns (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  returned_by uuid not null references public.profiles(id),
  returned_to uuid not null references public.profiles(id),
  kp integer not null check (kp >= 10),
  created_at timestamptz not null default now()
);

create table public.kp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  amount integer not null,
  kind public.kp_transaction_kind not null,
  created_at timestamptz not null default now()
);

create index requests_pair_created_idx on public.requests(pair_id, created_at desc);
create index requests_sender_created_idx on public.requests(sender_id, created_at desc);
create index kp_transactions_user_created_idx on public.kp_transactions(user_id, created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'ななしのカエル'));
  insert into public.kp_transactions(user_id, amount, kind) values (new.id, 50, 'initial');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.my_pair_id() returns uuid language sql stable security definer set search_path = public as $$
  select pair_id from public.pair_members where user_id = auth.uid() limit 1
$$;

alter table public.profiles enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.requests enable row level security;
alter table public.request_returns enable row level security;
alter table public.kp_transactions enable row level security;

create policy "self or partner profiles" on public.profiles for select to authenticated using (id = auth.uid() or id in (select user_id from public.pair_members where pair_id = public.my_pair_id()));
create policy "own pair" on public.pairs for select to authenticated using (id = public.my_pair_id());
create policy "own pair members" on public.pair_members for select to authenticated using (pair_id = public.my_pair_id());
create policy "own pair requests" on public.requests for select to authenticated using (pair_id = public.my_pair_id());
create policy "own pair returns" on public.request_returns for select to authenticated using (request_id in (select id from public.requests where pair_id = public.my_pair_id()));
create policy "own transactions" on public.kp_transactions for select to authenticated using (user_id = auth.uid());

create or replace view public.request_feed with (security_invoker = true) as
select r.*, sender.display_name as sender_name, holder.display_name as holder_name
from public.requests r
join public.profiles sender on sender.id = r.sender_id
join public.profiles holder on holder.id = r.current_holder_id;

create or replace view public.kp_transaction_feed with (security_invoker = true) as
select k.id, k.amount, k.kind, k.created_at, r.title as request_title
from public.kp_transactions k left join public.requests r on r.id = k.request_id;

create or replace function public.random_invite_code() returns text
language plpgsql
volatile
set search_path = pg_catalog, public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea := extensions.gen_random_bytes(8);
  invite_code text := '';
  byte_index integer;
begin
  for byte_index in 0..7 loop
    invite_code := invite_code || substr(
      alphabet,
      (get_byte(random_bytes, byte_index) % char_length(alphabet)) + 1,
      1
    );
  end loop;

  return invite_code;
end
$$;

create or replace function public.create_pair() returns uuid language plpgsql security definer set search_path = public as $$
declare new_pair_id uuid; new_code text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists(select 1 from pair_members where user_id = auth.uid()) then raise exception 'ALREADY_PAIRED'; end if;
  loop
    new_code := random_invite_code();
    exit when not exists(select 1 from pairs where invite_code = new_code);
  end loop;
  insert into pairs(invite_code, created_by) values(new_code, auth.uid()) returning id into new_pair_id;
  insert into pair_members(pair_id, user_id) values(new_pair_id, auth.uid());
  return new_pair_id;
end $$;

create or replace function public.join_pair(invite_code_input text) returns uuid language plpgsql security definer set search_path = public as $$
declare target_pair uuid; member_count integer;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists(select 1 from pair_members where user_id = auth.uid()) then raise exception 'ALREADY_PAIRED'; end if;
  select id into target_pair from pairs where invite_code = upper(trim(invite_code_input)) for update;
  if target_pair is null then raise exception 'INVALID_INVITE'; end if;
  select count(*) into member_count from pair_members where pair_id = target_pair;
  if member_count >= 2 then raise exception 'PAIR_FULL'; end if;
  insert into pair_members(pair_id, user_id) values(target_pair, auth.uid());
  return target_pair;
end $$;

create or replace function public.create_request(title_input text, note_input text default null, due_date_input date default null) returns uuid language plpgsql security definer set search_path = public as $$
declare pair_value uuid; partner_id uuid; sent_count integer; new_id uuid;
begin
  pair_value := my_pair_id();
  if pair_value is null then raise exception 'NOT_PAIRED'; end if;
  select user_id into partner_id from pair_members where pair_id = pair_value and user_id <> auth.uid();
  if partner_id is null then raise exception 'PARTNER_NOT_READY'; end if;
  select count(*) into sent_count from requests where sender_id = auth.uid() and created_at >= date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  if sent_count >= 3 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if char_length(trim(title_input)) not between 1 and 80 then raise exception 'INVALID_TITLE'; end if;
  insert into requests(pair_id, sender_id, current_holder_id, title, note, due_date)
  values(pair_value, auth.uid(), partner_id, trim(title_input), nullif(trim(note_input), ''), due_date_input) returning id into new_id;
  return new_id;
end $$;

create or replace function public.accept_request(request_id_input uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update requests set status = 'accepted', updated_at = now()
  where id = request_id_input and pair_id = my_pair_id() and current_holder_id = auth.uid() and status = 'pending';
  if not found then raise exception 'INVALID_REQUEST_STATE'; end if;
end $$;

create or replace function public.return_request(request_id_input uuid, kp_input integer) returns void language plpgsql security definer set search_path = public as $$
declare item requests%rowtype; other_user uuid; current_balance integer; minimum integer;
begin
  select * into item from requests where id = request_id_input and pair_id = my_pair_id() for update;
  if item.id is null or item.current_holder_id <> auth.uid() or item.status <> 'pending' then raise exception 'INVALID_REQUEST_STATE'; end if;
  minimum := case when item.last_bid_kp = 0 then 10 else item.last_bid_kp + 10 end;
  if kp_input < minimum then raise exception 'BID_TOO_LOW'; end if;
  select kp_balance into current_balance from profiles where id = auth.uid() for update;
  if current_balance < kp_input then raise exception 'INSUFFICIENT_KP'; end if;
  select user_id into other_user from pair_members where pair_id = item.pair_id and user_id <> auth.uid();
  update profiles set kp_balance = kp_balance - kp_input where id = auth.uid();
  update requests set current_holder_id = other_user, reward_kp = reward_kp + kp_input, last_bid_kp = kp_input, updated_at = now() where id = item.id;
  insert into request_returns(request_id, returned_by, returned_to, kp) values(item.id, auth.uid(), other_user, kp_input);
  insert into kp_transactions(user_id, request_id, amount, kind) values(auth.uid(), item.id, -kp_input, 'return_payment');
end $$;

create or replace function public.mark_request_done(request_id_input uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update requests set status = 'done_pending_confirm', completed_by = auth.uid(), updated_at = now()
  where id = request_id_input and pair_id = my_pair_id() and current_holder_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'INVALID_REQUEST_STATE'; end if;
end $$;

create or replace function public.confirm_request_done(request_id_input uuid) returns void language plpgsql security definer set search_path = public as $$
declare item requests%rowtype;
begin
  select * into item from requests where id = request_id_input and pair_id = my_pair_id() for update;
  if item.id is null or item.status <> 'done_pending_confirm' or item.completed_by = auth.uid() then raise exception 'INVALID_REQUEST_STATE'; end if;
  update requests set status = 'complete', updated_at = now() where id = item.id;
  if item.reward_kp > 0 then
    update profiles set kp_balance = kp_balance + item.reward_kp where id = item.completed_by;
    insert into kp_transactions(user_id, request_id, amount, kind) values(item.completed_by, item.id, item.reward_kp, 'completion_reward');
  end if;
end $$;

revoke all on function public.create_pair() from public;
revoke all on function public.join_pair(text) from public;
revoke all on function public.create_request(text,text,date) from public;
revoke all on function public.accept_request(uuid) from public;
revoke all on function public.return_request(uuid,integer) from public;
revoke all on function public.mark_request_done(uuid) from public;
revoke all on function public.confirm_request_done(uuid) from public;
grant execute on function public.create_pair() to authenticated;
grant execute on function public.join_pair(text) to authenticated;
grant execute on function public.create_request(text,text,date) to authenticated;
grant execute on function public.accept_request(uuid) to authenticated;
grant execute on function public.return_request(uuid,integer) to authenticated;
grant execute on function public.mark_request_done(uuid) to authenticated;
grant execute on function public.confirm_request_done(uuid) to authenticated;
grant select on public.request_feed, public.kp_transaction_feed to authenticated;
grant select on public.profiles, public.pairs, public.pair_members, public.requests, public.request_returns, public.kp_transactions to authenticated;
