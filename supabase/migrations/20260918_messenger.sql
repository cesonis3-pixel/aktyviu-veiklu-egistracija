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
