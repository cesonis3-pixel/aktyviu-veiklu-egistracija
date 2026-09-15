create table if not exists public.activities (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references auth.users(id) on delete restrict,
	title text not null check (btrim(title) <> ''),
	description text,
	location text not null check (btrim(location) <> ''),
	starts_at timestamptz not null,
	capacity integer not null check (capacity > 0),
	status text not null default 'active'
		check (status in ('active', 'cancelled')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists activities_creator_id_idx
	on public.activities (creator_id);

grant select on table public.activities to authenticated;

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
	available integer
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
		(a.capacity - count(r.id)::integer) as available
	from public.activities a
	left join public.reservations r
		on r.activity_id = a.id and r.status = 'active'
	group by a.id
	order by a.starts_at asc;
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
