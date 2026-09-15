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
    execute format('drop policy %I on public.activity_messages', policy_row.policyname);
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
commit;
