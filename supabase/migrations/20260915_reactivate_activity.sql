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

commit;
