begin;

-- Lentelių struktūra nekeičiama: reservations.activity_id jau turi ON DELETE CASCADE.
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

  -- ON DELETE CASCADE ištrina visas susijusias rezervacijas vienoje transakcijoje.
  delete from public.activities
  where id = p_activity_id and creator_id = current_user_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke delete on public.activities from public, anon, authenticated;
revoke all on function public.delete_activity(uuid) from public, anon;
grant execute on function public.delete_activity(uuid) to authenticated;
commit;
