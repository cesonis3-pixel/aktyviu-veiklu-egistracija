-- Vykdyti Supabase SQL Editor po esamo schema.sql.
-- Pašalinus testines veiklas, ON DELETE CASCADE pašalins jų rezervacijas.
begin;

do $$
declare
  owner_id uuid;
begin
  select id into owner_id from auth.users
  where email = 'jurgituke1@gmail.com';
  if owner_id is null then
    raise exception 'Nerasta esama organizatoriaus paskyra jurgituke1@gmail.com. Veiklos nepakeistos.';
  end if;

  delete from public.activities;

  insert into public.activities
    (creator_id, title, description, location, starts_at, capacity, status)
  values
    (owner_id, 'Slidinėjimo išvyka', 'Praleisk šeštadienį aktyviai ir atrask slidinėjimo džiaugsmą kartu su bendraminčiais. Susitiksime Druskininkuose, susipažinsime ir keliausime į trasas. Išvyka tinka tiek pradedantiesiems, tiek jau išbandžiusiems slides. Pasirūpink šilta apranga, pirštinėmis ir gera nuotaika – dėl reikalingos įrangos susitarsime prieš išvyką.', 'Druskininkai', '2027-01-16T10:00:00+02:00'::timestamptz, 12, 'active'),
    (owner_id, 'Žygis gamtoje', 'Trumpam palik miesto šurmulį ir pasivaikščiok žiemos miško takais. Mūsų laukia maždaug 8 kilometrų nesudėtingas maršrutas Kauno rajone, ramus tempas ir sustojimas karštai arbatai. Avėk patogius, neslystančius batus, apsirenk pagal orą ir pasiimk termosą mėgstamo gėrimo.', 'Kauno rajonas', '2027-01-23T11:00:00+02:00'::timestamptz, 10, 'active'),
    (owner_id, 'Žiemos aktyvi veikla', 'Žiema kviečia pajudėti! Susitikime aktyviam rytui Trakų apylinkėse: pasivaikščiosime snieguotais takais, išbandysime komandines užduotis ir pabūsime gryname ore. Specialaus pasirengimo nereikia. Pasiimk šiltus, judėti patogius drabužius ir vandens.', 'Trakai', '2027-02-06T10:30:00+02:00'::timestamptz, 8, 'active');
end;
$$;

commit;

select id, title, description, location, starts_at, capacity
from public.activities
order by starts_at;
