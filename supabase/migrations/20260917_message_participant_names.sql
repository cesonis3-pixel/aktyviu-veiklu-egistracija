begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
drop policy if exists "Authenticated users can read display names" on public.profiles;
create policy "Authenticated users can read display names" on public.profiles
for select to authenticated using (true);

-- Esamiems naudotojams vardas atkuriamas iš metadata, o jei jo nėra – iš el. pašto.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Dalyvis'
  )
from auth.users u
on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Dalyvis'
    )
  )
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_user();

-- Organizatoriaus vardas gaunamas pagal tikrą creator_id, ne pagal veiklos teksto lauką.
create or replace function public.get_public_activities()
returns table (
  id uuid,
  creator_id uuid,
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
    a.id, a.creator_id, a.title, a.description, a.location, a.starts_at,
    a.capacity, a.status, (a.capacity - count(r.id)::integer) as available,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(a.organizer_name), ''), 'Dalyvis') as organizer_name
  from public.activities a
  left join public.reservations r on r.activity_id = a.id and r.status = 'active'
  left join public.profiles p on p.id = a.creator_id
  group by a.id, p.display_name
  order by a.starts_at asc;
$$;

grant execute on function public.get_public_activities() to anon, authenticated;
commit;
