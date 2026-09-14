insert into public.activities (
  creator_id,
  title,
  description,
  location,
  starts_at,
  capacity,
  status
)
select
  u.id,
  seed.title,
  seed.description,
  seed.location,
  seed.starts_at,
  seed.capacity,
  'active'
from auth.users u
cross join (
  values
    (
      'Žygis Vingio parke',
      'Lengvas pasivaikščiojimas pažintiniu maršrutu.',
      'Vingio parkas, Vilnius',
      now() + interval '7 days',
      10
    ),
    (
      'Lauko treniruotė',
      'Bendra fizinio pasirengimo treniruotė pradedantiesiems.',
      'Kalnų parkas, Vilnius',
      now() + interval '8 days',
      5
    ),
    (
      'Irklavimo pamoka',
      'Įvadinė individuali irklavimo pamoka prie Galvės ežero.',
      'Galvės ežeras, Trakai',
      now() + interval '9 days',
      1
    )
) as seed(title, description, location, starts_at, capacity)
where u.email = 'jurgituke1@gmail.com';

select id, title, location, starts_at, capacity, creator_id
from public.activities
where creator_id = (
  select id from auth.users where email = 'jurgituke1@gmail.com'
)
order by starts_at;
