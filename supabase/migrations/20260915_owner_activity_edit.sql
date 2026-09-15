begin;

-- Store the organizer label used by the create and edit forms.
alter table public.activities
  add column if not exists organizer_name text;

-- Existing rows remain readable while new and edited rows must have a label.
update public.activities
set organizer_name = 'Organizatorius'
where organizer_name is null or btrim(organizer_name) = '';

alter table public.activities
  alter column organizer_name set not null;

alter table public.activities
  drop constraint if exists activities_organizer_name_not_empty;

alter table public.activities
  add constraint activities_organizer_name_not_empty
  check (btrim(organizer_name) <> '');

-- The API uses the authenticated Supabase client for UPDATE. RLS remains enabled
-- and limits both the target row and the resulting row to its creator.
grant update (title, description, location, starts_at, capacity, organizer_name)
  on table public.activities to authenticated;

drop policy if exists "Users can update their own activities"
  on public.activities;

create policy "Users can update their own activities"
  on public.activities
  for update
  to authenticated
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);

-- Keep the public RPC shape in sync with the application projection.
drop function if exists public.get_public_activities();

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

grant execute on function public.get_public_activities() to anon, authenticated;

-- Replace the old create function so organizer_name is persisted on creation too.
drop function if exists public.create_activity(text, text, text, text, integer);
drop function if exists public.create_activity(text, text, text, timestamptz, integer);

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
  values (
    current_user_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    btrim(p_location),
    p_starts_at,
    p_capacity,
    btrim(p_organizer_name),
    'active'
  )
  returning id into activity_id;

  return jsonb_build_object('success', true, 'id', activity_id, 'status', 'active');
end;
$$;

revoke all on function public.create_activity(text, text, text, timestamptz, integer, text) from public, anon;
grant execute on function public.create_activity(text, text, text, timestamptz, integer, text) to authenticated;

commit;
