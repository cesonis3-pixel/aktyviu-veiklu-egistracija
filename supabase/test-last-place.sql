-- Pasirenkamas A/B testas. Vykdyti PO 20260915_atomic_reservations.sql.
-- Pirmiausia patikrinkite esamas vienos vietos veiklas:
select * from public.get_public_activities()
where capacity = 1 and available = 1 and status = 'active' and starts_at > now();

-- Jei tinkamos veiklos nėra, paleiskite šią dalį.
-- Trys Baltic Winter veiklos nekeičiamos. Sukuriama atskira testinė veikla.
begin;
do $$
declare
  owner_id uuid;
  test_id constant uuid := 'b913dace-786a-4ba1-9207-6281c247ee01';
begin
  select id into owner_id from auth.users order by created_at, id limit 1;
  if owner_id is null then
    raise exception 'Pirmiausia užregistruokite testavimo paskyras.';
  end if;
  if exists (select 1 from public.activities where id = test_id) then
    raise notice 'Testinė veikla jau yra. Jos duomenys ir rezervacijos nekeičiami.';
  else
    insert into public.activities (id, creator_id, title, description, location, starts_at, capacity, status)
    values (test_id, owner_id, 'Paskutinės vietos rezervavimo testas',
      'Dviejų skirtingų paskyrų vienalaikio rezervavimo patikra.',
      'Testavimo aplinka', now() + interval '30 days', 1, 'active');
  end if;
end;
$$;
commit;

select * from public.get_public_activities()
where id = 'b913dace-786a-4ba1-9207-6281c247ee01';

-- Po testo: active_reservations turi būti 1, available turi būti 0.
select a.id, a.title, a.capacity,
  count(r.id) filter (where r.status = 'active') as active_reservations,
  a.capacity - count(r.id) filter (where r.status = 'active') as available
from public.activities a
left join public.reservations r on r.activity_id = a.id
where a.id = 'b913dace-786a-4ba1-9207-6281c247ee01'
group by a.id;

select id, activity_id, user_id, status from public.reservations
where activity_id = 'b913dace-786a-4ba1-9207-6281c247ee01';
