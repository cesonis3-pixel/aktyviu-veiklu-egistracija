-- Vykdyti tik jei diagnostinė užklausa patvirtina, kad profilio ID yra tikroji
-- jurgituke1 paskyra. Migracija nekeičia rezervacijų ir neliečia kitų veiklų.
begin;

do $$
declare
  intended_owner_id uuid;
  matching_profiles integer;
begin
  select count(*), min(id)
  into matching_profiles, intended_owner_id
  from public.profiles
  where lower(btrim(display_name)) = 'jurgituke1';

  if matching_profiles <> 1 then
    raise exception 'Savininkas nepakeistas: rastas % profilių vardu jurgituke1. Reikalingas tiksliai vienas.', matching_profiles;
  end if;

  update public.activities
  set creator_id = intended_owner_id, updated_at = now()
  where title = 'Žygis Vingio parke'
    and lower(btrim(organizer_name)) = 'jurgituke1'
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
