create table if not exists public.activities (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references auth.users(id) on delete restrict,
	title text not null check (btrim(title) <> ''),
	description text,
	location text not null check (btrim(location) <> ''),
	starts_at timestamptz not null,
	capacity integer not null check (capacity > 0),
	organizer_name text not null check (btrim(organizer_name) <> ''),
	status text not null default 'active'
		check (status in ('active', 'cancelled')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists activities_creator_id_idx
	on public.activities (creator_id);

grant select on table public.activities to authenticated;
grant update (title, description, location, starts_at, capacity, organizer_name)
	on table public.activities to authenticated;

alter table public.activities enable row level security;

drop policy if exists "Users can read their own activities"
	on public.activities;

create policy "Users can read their own activities"
	on public.activities
	for select
	to authenticated
	using ((select auth.uid()) = creator_id);

drop policy if exists "Anyone can read activities"
	on public.activities;

create policy "Anyone can read activities"
	on public.activities
	for select
	to anon, authenticated
	using (true);

drop policy if exists "Users can update their own activities"
	on public.activities;

create policy "Users can update their own activities"
	on public.activities
	for update
	to authenticated
	using ((select auth.uid()) = creator_id)
	with check ((select auth.uid()) = creator_id);

create table if not exists public.reservations (
	id uuid primary key default gen_random_uuid(),
	activity_id uuid not null references public.activities(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	status text not null default 'active'
		check (status in ('active', 'cancelled')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	cancelled_at timestamptz,
	unique (activity_id, user_id)
);

create index if not exists reservations_user_id_idx
	on public.reservations (user_id);

create index if not exists reservations_activity_id_idx
	on public.reservations (activity_id);

grant select on table public.reservations to authenticated;

alter table public.reservations enable row level security;

drop policy if exists "Users can read their own reservations"
	on public.reservations;

create policy "Users can read their own reservations"
	on public.reservations
	for select
	to authenticated
	using ((select auth.uid()) = user_id);

create or replace function public.get_public_activities()
returns table (
	id uuid,
	title text,
	description text,
	location text,
	starts_at timestamptz,
	capacity integer,
	status text,
	available integer,
	organizer_name text
)
language sql
security definer
set search_path = public
as $$
	select
		a.id,
		a.title,
		a.description,
		a.location,
		a.starts_at,
		a.capacity,
		a.status,
		(a.capacity - count(r.id)::integer) as available,
		a.organizer_name
	from public.activities a
	left join public.reservations r
		on r.activity_id = a.id and r.status = 'active'
	group by a.id
	order by a.starts_at asc;
$$;

create or replace function public.create_activity(
	p_title text,
	p_description text,
	p_location text,
	p_starts_at timestamptz,
	p_capacity integer,
	p_organizer_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := auth.uid();
	activity_id uuid;
begin
	if current_user_id is null then
		raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
	end if;
	if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_location, '')) = ''
		or btrim(coalesce(p_organizer_name, '')) = '' then
		raise exception 'Pavadinimas, vieta ir organizatoriaus pavadinimas yra privalomi.' using errcode = 'P0010';
	end if;
	if p_starts_at <= now() then
		raise exception 'Veiklos data ir laikas turi būti ateityje.' using errcode = 'P0011';
	end if;
	if p_capacity is null or p_capacity < 1 then
		raise exception 'Vietų skaičius turi būti teigiamas.' using errcode = 'P0012';
	end if;

	insert into public.activities (creator_id, title, description, location, starts_at, capacity, organizer_name, status)
	values (current_user_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), btrim(p_location), p_starts_at, p_capacity, btrim(p_organizer_name), 'active')
	returning id into activity_id;

	return jsonb_build_object('success', true, 'id', activity_id, 'status', 'active');
end;
$$;

create or replace function public.reserve_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  activity_row public.activities%rowtype;
  reservation_row public.reservations%rowtype;
  active_reservations integer;
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;

  -- Visos šios veiklos rezervacijos laukia to paties eilutės užrakto.
  -- Užraktas laikomas iki RPC transakcijos pabaigos.
  select * into activity_row from public.activities
  where id = p_activity_id for update;
  if not found then
    raise exception 'Veikla nerasta.' using errcode = 'P0002';
  end if;
  if activity_row.creator_id = current_user_id then
    raise exception 'Negalite rezervuoti savo sukurtos veiklos.' using errcode = 'P0014';
  end if;
  if activity_row.status <> 'active' then
    raise exception 'Ši veikla atšaukta.' using errcode = 'P0003';
  end if;
  if activity_row.starts_at <= now() then
    raise exception 'Ši veikla jau prasidėjo.' using errcode = 'P0007';
  end if;

  select * into reservation_row from public.reservations
  where activity_id = p_activity_id and user_id = current_user_id;
  if reservation_row.status = 'active' then
    raise exception 'Jūs jau turite rezervaciją šiai veiklai.' using errcode = 'P0004';
  end if;

  -- Skaičiuojama tik gavus užraktą, o ne pagal naršyklės būseną.
  select count(*)::integer into active_reservations from public.reservations
  where activity_id = p_activity_id and status = 'active';
  if active_reservations >= activity_row.capacity then
    raise exception 'Vietų nebeliko.' using errcode = 'P0005';
  end if;

  if reservation_row.id is null then
    insert into public.reservations (activity_id, user_id)
    values (p_activity_id, current_user_id);
  else
    update public.reservations
    set status = 'active', cancelled_at = null, updated_at = now()
    where id = reservation_row.id;
  end if;
  return jsonb_build_object('success', true, 'available', activity_row.capacity - active_reservations - 1);
end;
$$;

create or replace function public.cancel_reservation(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  -- Ta pati užrakinimo tvarka ir atšaukiant rezervaciją.
  perform id from public.activities where id = p_activity_id for update;
  update public.reservations
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where activity_id = p_activity_id and user_id = current_user_id and status = 'active';
  if not found then
    raise exception 'Aktyvi rezervacija nerasta.' using errcode = 'P0006';
  end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.cancel_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := auth.uid();
	activity_row public.activities%rowtype;
begin
	if current_user_id is null then
		raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
	end if;

	select * into activity_row
	from public.activities
	where id = p_activity_id
	for update;

	if not found then
		raise exception 'Veikla nerasta.' using errcode = 'P0002';
	end if;
	if activity_row.creator_id <> current_user_id then
		raise exception 'Neturite teisės atšaukti šios veiklos.' using errcode = 'P0008';
	end if;
	if activity_row.status = 'cancelled' then
		raise exception 'Ši veikla jau atšaukta.' using errcode = 'P0009';
	end if;

	update public.activities
	set status = 'cancelled', updated_at = now()
	where id = p_activity_id and creator_id = current_user_id and status = 'active';

	return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

-- Įrašai keičiami tik per funkcijas, kurios pačios tikrina auth.uid().
revoke insert, update, delete on public.reservations from public, anon, authenticated;
revoke all on function public.reserve_activity(uuid) from public, anon;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.reserve_activity(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
revoke all on function public.cancel_activity(uuid) from public, anon;
grant execute on function public.cancel_activity(uuid) to authenticated;


grant execute on function public.get_public_activities() to anon, authenticated;
revoke all on function public.create_activity(text, text, text, timestamptz, integer, text) from public, anon;
grant execute on function public.create_activity(text, text, text, timestamptz, integer, text) to authenticated;

create or replace function public.delete_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  activity_row public.activities%rowtype;
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  select * into activity_row from public.activities
  where id = p_activity_id for update;
  if not found then
    raise exception 'Veikla nerasta.' using errcode = 'P0002';
  end if;
  if activity_row.creator_id <> current_user_id then
    raise exception 'Neturite teisės ištrinti šios veiklos.' using errcode = 'P0008';
  end if;
  -- reservations.activity_id ON DELETE CASCADE atominiu būdu pašalina visas
  -- šios veiklos rezervacijas, tiek aktyvias, tiek atšauktas.
  delete from public.activities
  where id = p_activity_id and creator_id = current_user_id;
  return jsonb_build_object('success', true);
end;
$$;

revoke delete on public.activities from public, anon, authenticated;
revoke all on function public.delete_activity(uuid) from public, anon;
grant execute on function public.delete_activity(uuid) to authenticated;


-- Activity messages
begin;

create table if not exists public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete set null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists activity_messages_recipient_idx on public.activity_messages(recipient_id, created_at desc);
create index if not exists activity_messages_sender_idx on public.activity_messages(sender_id, created_at desc);
alter table public.activity_messages enable row level security;

-- Pakeičiamos tik žinučių lentelės politikos, kad neliktų senos viešo skaitymo politikos.
do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'activity_messages'
  loop
    execute format('drop policy if exists %I on public.activity_messages', policy_row.policyname);
  end loop;
end;
$$;
revoke all on public.activity_messages from public, anon, authenticated;
grant select on public.activity_messages to authenticated;
create policy "Message participants can read" on public.activity_messages
for select to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create or replace function public.send_activity_message(p_activity_id uuid, p_subject text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := auth.uid();
  recipient uuid;
  message_id uuid;
begin
  if sender is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  select creator_id into recipient from public.activities
  where id = p_activity_id for share;
  if not found then
    raise exception 'Veikla nerasta.' using errcode = 'P0002';
  end if;
  if recipient = sender then
    raise exception 'Negalite siųsti žinutės sau.' using errcode = 'P0020';
  end if;
  if regexp_replace(coalesce(p_subject, ''), '\s', '', 'g') = ''
    or regexp_replace(coalesce(p_message, ''), '\s', '', 'g') = ''
    or char_length(btrim(coalesce(p_subject, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_message, ''))) not between 1 and 2000 then
    raise exception 'Tema ir žinutė yra privalomi. Tema iki 120, žinutė iki 2000 simbolių.' using errcode = 'P0021';
  end if;
  insert into public.activity_messages(activity_id, sender_id, recipient_id, subject, message)
  values (p_activity_id, sender, recipient, btrim(p_subject), btrim(p_message))
  returning id into message_id;
  return jsonb_build_object('success', true, 'id', message_id);
end;
$$;
revoke all on function public.send_activity_message(uuid, text, text) from public, anon;
grant execute on function public.send_activity_message(uuid, text, text) to authenticated;

-- Naudotojų rodomi vardai žinutėms ir veiklų organizatoriams.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
create policy "Authenticated users can read display names" on public.profiles
for select to authenticated using (true);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Dalyvis'))
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute procedure public.create_profile_for_user();

drop function if exists public.get_public_activities();
create function public.get_public_activities()
returns table (id uuid, creator_id uuid, title text, description text, location text,
  starts_at timestamptz, capacity integer, status text, available integer, organizer_name text)
language sql security definer set search_path = public as $$
  select a.id, a.creator_id, a.title, a.description, a.location, a.starts_at,
    a.capacity, a.status, (a.capacity - count(r.id)::integer),
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.organizer_name), ''), 'Dalyvis')
  from public.activities a
  left join public.reservations r on r.activity_id = a.id and r.status = 'active'
  left join public.profiles p on p.id = a.creator_id
  group by a.id, p.display_name
  order by a.starts_at asc;
$$;
commit;

begin;

create or replace function public.reactivate_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  activity_row public.activities%rowtype;
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  select * into activity_row from public.activities
  where id = p_activity_id for update;
  if not found then
    raise exception 'Veikla nerasta.' using errcode = 'P0002';
  end if;
  if activity_row.creator_id <> current_user_id then
    raise exception 'Neturite teisės aktyvuoti šios veiklos.' using errcode = 'P0008';
  end if;
  if activity_row.status <> 'cancelled' then
    raise exception 'Aktyvuoti galima tik atšauktą veiklą.' using errcode = 'P0022';
  end if;
  if activity_row.starts_at <= clock_timestamp() then
    raise exception 'Negalima aktyvuoti veiklos, kurios data jau praėjo. Pirmiausia pakeiskite datą.' using errcode = 'P0023';
  end if;
  update public.activities set status = 'active'
  where id = p_activity_id and creator_id = current_user_id and status = 'cancelled';
  return jsonb_build_object('success', true, 'status', 'active');
end;
$$;

revoke all on function public.reactivate_activity(uuid) from public, anon;
grant execute on function public.reactivate_activity(uuid) to authenticated;

create or replace function public.reply_activity_message(p_message_id uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  original public.activity_messages%rowtype;
  message_id uuid;
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  select * into original from public.activity_messages
  where id = p_message_id and recipient_id = current_user_id for share;
  if not found then
    raise exception 'Žinutė nerasta arba neturite teisės į ją atsakyti.' using errcode = 'P0024';
  end if;
  if original.sender_id = current_user_id then
    raise exception 'Negalite atsakyti sau.' using errcode = 'P0020';
  end if;
  if regexp_replace(coalesce(p_message, ''), '\s', '', 'g') = ''
    or char_length(coalesce(p_message, '')) not between 1 and 2000 then
    raise exception 'Įveskite atsakymą (iki 2000 simbolių).' using errcode = 'P0021';
  end if;
  insert into public.activity_messages(activity_id, sender_id, recipient_id, subject, message)
  values (original.activity_id, current_user_id, original.sender_id,
    'Re: ' || left(regexp_replace(original.subject, '^(\s*Re:\s*)+', '', 'i'), 116),
    btrim(p_message))
  returning id into message_id;
  return jsonb_build_object('success', true, 'id', message_id);
end;
$$;

revoke all on function public.reply_activity_message(uuid, text) from public, anon;
grant execute on function public.reply_activity_message(uuid, text) to authenticated;

commit;

begin;

alter table public.activity_messages enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'activity_messages'
  loop
    execute format('drop policy %I on public.activity_messages', p.policyname);
  end loop;
end;
$$;
revoke all on public.activity_messages from public, anon, authenticated;
grant select on public.activity_messages to authenticated;
create policy "Message participants can read" on public.activity_messages
for select to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create index if not exists activity_messages_conversation_idx
on public.activity_messages(activity_id, sender_id, recipient_id, created_at, id);
create index if not exists activity_messages_unread_idx
on public.activity_messages(recipient_id, created_at) where read_at is null;

create or replace function public.send_conversation_message(p_message_id uuid, p_message text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  original public.activity_messages%rowtype;
  other_user_id uuid;
  owner_id uuid;
  new_message_id uuid;
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  if regexp_replace(coalesce(p_message, ''), '\s', '', 'g') = ''
    or char_length(coalesce(p_message, '')) not between 1 and 2000 then
    raise exception 'Įveskite žinutę (iki 2000 simbolių).' using errcode = 'P0021';
  end if;
  select * into original from public.activity_messages
  where id = p_message_id
    and (sender_id = current_user_id or recipient_id = current_user_id)
  for share;
  if not found then
    raise exception 'Neturite teisės rašyti šiame pokalbyje.' using errcode = 'P0024';
  end if;
  other_user_id := case when original.sender_id = current_user_id
    then original.recipient_id else original.sender_id end;
  if other_user_id = current_user_id then
    raise exception 'Negalite rašyti sau.' using errcode = 'P0020';
  end if;
  if original.activity_id is not null then
    select creator_id into owner_id from public.activities
    where id = original.activity_id for share;
    if not found or (owner_id <> current_user_id and owner_id <> other_user_id) then
      raise exception 'Neturite teisės rašyti šiame pokalbyje.' using errcode = 'P0024';
    end if;
    if owner_id = current_user_id and not exists (
      select 1 from public.activity_messages
      where activity_id = original.activity_id
        and sender_id = other_user_id and recipient_id = current_user_id
    ) then
      raise exception 'Dalyvis dar nepradėjo pokalbio.' using errcode = 'P0024';
    end if;
  end if;
  -- Deleted activities retain communication only between existing participants.
  insert into public.activity_messages(activity_id, sender_id, recipient_id, subject, message)
  values (original.activity_id, current_user_id, other_user_id, original.subject, btrim(p_message))
  returning id into new_message_id;
  return jsonb_build_object('success', true, 'id', new_message_id);
end;
$$;
revoke all on function public.send_conversation_message(uuid, text) from public, anon;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;

create or replace function public.mark_activity_messages_read(p_message_ids uuid[])
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_message_ids), 0) not between 1 and 500 then
    raise exception 'Neteisingas žinučių sąrašas.' using errcode = 'P0021';
  end if;
  update public.activity_messages set read_at = now()
  where id = any(p_message_ids) and recipient_id = current_user_id and read_at is null;
  get diagnostics updated_count = row_count;
  return jsonb_build_object('success', true, 'updated', updated_count);
end;
$$;
revoke all on function public.mark_activity_messages_read(uuid[]) from public, anon;
grant execute on function public.mark_activity_messages_read(uuid[]) to authenticated;

commit;

begin;

-- Preserve all existing IDs, owners, reservations and messages.
alter table public.activity_messages add column if not exists read_at timestamptz;

-- Only authenticated owners can change editable columns. Status uses guarded RPCs.
revoke insert, update, delete on public.activities from public, anon, authenticated;
revoke update (id, creator_id, status, created_at, updated_at) on public.activities from public, anon, authenticated;
grant update (title, description, location, starts_at, capacity, organizer_name) on public.activities to authenticated;
grant select on public.activities to authenticated;
alter table public.activities enable row level security;
alter table public.reservations enable row level security;
revoke insert, update, delete on public.reservations from public, anon, authenticated;

do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('activities', 'reservations')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;
create policy "Anyone can read activities" on public.activities for select to anon, authenticated using (true);
create policy "Users can update their own activities" on public.activities for update to authenticated
using ((select auth.uid()) = creator_id) with check ((select auth.uid()) = creator_id);
create policy "Users can read their own reservations" on public.reservations for select to authenticated
using ((select auth.uid()) = user_id);

-- UPDATE already holds the same activity row lock as reserve_activity.
-- SECURITY DEFINER counts every reservation, including rows hidden by RLS.
create or replace function public.check_activity_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity < (select count(*) from public.reservations where activity_id = new.id and status = 'active') then
    raise exception 'Vietų skaičius negali būti mažesnis už aktyvių rezervacijų skaičių.' using errcode = 'P0012';
  end if;
  return new;
end;
$$;
revoke all on function public.check_activity_capacity() from public, anon, authenticated;
drop trigger if exists activity_capacity_guard on public.activities;
create trigger activity_capacity_guard before update of capacity on public.activities
for each row execute function public.check_activity_capacity();

create or replace function public.delete_activity(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.activities%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  select * into a from public.activities where id = p_activity_id for update;
  if not found then raise exception 'Veikla nerasta.' using errcode = 'P0002'; end if;
  if a.creator_id <> auth.uid() then
    raise exception 'Neturite teisės ištrinti šios veiklos.' using errcode = 'P0008';
  end if;
  if exists (select 1 from public.reservations where activity_id = a.id and status = 'active') then
    raise exception 'Yra aktyvių rezervacijų. Naudokite veiklos atšaukimą.' using errcode = 'P0013';
  end if;
  delete from public.activities where id = a.id;
  return jsonb_build_object('success', true);
end;
$$;
revoke all on function public.delete_activity(uuid) from public, anon;
grant execute on function public.delete_activity(uuid) to authenticated;

-- The label is organizer_name; it never determines ownership.
drop function if exists public.get_public_activities();
create function public.get_public_activities()
returns table (id uuid, creator_id uuid, title text, description text, location text,
  starts_at timestamptz, capacity integer, status text, available integer, organizer_name text)
language sql security definer set search_path = '' as $$
  select a.id, a.creator_id, a.title, a.description, a.location, a.starts_at,
    a.capacity, a.status, a.capacity - count(r.id)::integer,
    coalesce(nullif(btrim(a.organizer_name), ''), 'Veiklos organizatorius')
  from public.activities a
  left join public.reservations r on r.activity_id = a.id and r.status = 'active'
  group by a.id order by a.starts_at, a.id;
$$;
revoke all on function public.get_public_activities() from public;
grant execute on function public.get_public_activities() to anon, authenticated;

create or replace function public.get_public_activity(p_activity_id uuid)
returns table (id uuid, creator_id uuid, title text, description text, location text,
  starts_at timestamptz, capacity integer, status text, available integer, organizer_name text)
language sql security definer set search_path = '' as $$
  select a.id, a.creator_id, a.title, a.description, a.location, a.starts_at,
    a.capacity, a.status, a.capacity - count(r.id)::integer,
    coalesce(nullif(btrim(a.organizer_name), ''), 'Veiklos organizatorius')
  from public.activities a
  left join public.reservations r on r.activity_id = a.id and r.status = 'active'
  where a.id = p_activity_id group by a.id;
$$;
revoke all on function public.get_public_activity(uuid) from public;
grant execute on function public.get_public_activity(uuid) to anon, authenticated;

-- Names from metadata, never synthesized from another person's email.
create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Dalyvis'))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
insert into public.profiles(id, display_name)
select id, coalesce(nullif(btrim(raw_user_meta_data ->> 'display_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'full_name'), ''), 'Dalyvis') from auth.users
on conflict (id) do nothing;

-- Remove only known email-derived fallback names, preserving chosen profile names.
update public.profiles p set display_name = 'Dalyvis'
from auth.users u where p.id = u.id
  and nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '') is null
  and nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '') is null
  and p.display_name = split_part(u.email, '@', 1);

-- Exact legacy typo; no substring replacement of user-authored descriptions.
-- Legacy reply endpoint must enforce the same participant/creator rules.
create or replace function public.reply_activity_message(p_message_id uuid, p_message text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Prisijunkite prie paskyros.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.activity_messages where id = p_message_id and recipient_id = auth.uid()) then
    raise exception 'Žinutė nerasta arba neturite teisės į ją atsakyti.' using errcode = 'P0024';
  end if;
  return public.send_conversation_message(p_message_id, p_message);
end;
$$;
revoke all on function public.reply_activity_message(uuid, text) from public, anon;
grant execute on function public.reply_activity_message(uuid, text) to authenticated;

update public.activities set title = 'Slidinėjimas' where title = 'Silidinėjimas';
update public.activities set title = 'Žiemos veikla',
  location = 'Vieta tikslinama su organizatoriumi',
  description = 'Veiklos programa tikslinama. Prieš rezervuodami susisiekite su organizatoriumi.'
where title = 'Jurgita' and location = 'Jurgita' and description = 'keliones';
update public.activities
set description = 'Snieglenčių veikla Liepkalnyje. Dėl pasirengimo, inventoriaus ir susitikimo vietos susisiekite su organizatoriumi.'
where id = '43345e7a-058d-47cb-8e04-24021ca3dfa8'
  and title = 'Snieglentė' and location = 'Liepkalnis' and description = 'Koks tavo vardas';

commit;
