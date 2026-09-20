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
