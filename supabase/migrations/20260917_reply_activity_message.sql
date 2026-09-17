begin;

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
