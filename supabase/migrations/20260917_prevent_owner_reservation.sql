begin;

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

  select * into activity_row from public.activities where id = p_activity_id for update;
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

  select count(*)::integer into active_reservations from public.reservations
  where activity_id = p_activity_id and status = 'active';
  if active_reservations >= activity_row.capacity then
    raise exception 'Vietų nebeliko.' using errcode = 'P0005';
  end if;

  if reservation_row.id is null then
    insert into public.reservations (activity_id, user_id) values (p_activity_id, current_user_id);
  else
    update public.reservations set status = 'active', cancelled_at = null, updated_at = now()
    where id = reservation_row.id;
  end if;
  return jsonb_build_object('success', true, 'available', activity_row.capacity - active_reservations - 1);
end;
$$;

revoke all on function public.reserve_activity(uuid) from public, anon;
grant execute on function public.reserve_activity(uuid) to authenticated;
commit;
