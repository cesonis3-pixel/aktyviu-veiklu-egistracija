-- Migracija paliečia tik vieną patikrintą veiklą (ID ir pavadinimas sutampa)
-- ir naudoja tikrą auth.users paskyros ID, ne organizer_name savininkui nustatyti.
begin;

do $$
declare
  intended_owner_id uuid;
  matching_users integer;
begin
  select count(*), min(id)
  into matching_users, intended_owner_id
  from auth.users
  where lower(split_part(email, '@', 1)) = 'jurgituke1';

  if matching_users <> 1 then
    raise exception 'Savininkas nepakeistas: rastos % auth.users paskyros su el. pašto vardine dalimi jurgituke1. Reikalinga tiksliai viena.', matching_users;
  end if;

  update public.activities
  set creator_id = intended_owner_id, updated_at = now()
  where id = '62428dea-8b74-43e1-8bde-c9aa0619db77'
    and title = 'Žygis Vingio parke'
    and creator_id is distinct from intended_owner_id;
end;
$$;

commit;

-- Saugus senų savininko rezervacijų patikrinimas (tik skaito):
-- select r.id, r.activity_id, a.title, r.status
-- from public.reservations r
-- join public.activities a on a.id = r.activity_id
-- where r.user_id = a.creator_id;

-- Jei patvirtinate rezultatą, senas savininko rezervacijas saugiai atšaukite,
-- o ne trinkite:
-- update public.reservations r
-- set status = 'cancelled', cancelled_at = now(), updated_at = now()
-- from public.activities a
-- where a.id = r.activity_id
--   and r.user_id = a.creator_id
--   and r.status = 'active';
