-- Tik patikrintas esamas įrašas. ID, vieta, data, talpa ir rezervacijos nekeičiami.
-- Sąlygos apsaugo nuo naujesnio organizatoriaus teksto perrašymo.
update public.activities
set title = 'Keturračiai sniege',
    description = 'Išvyka keturračiais snieguotais miško takais. Pasiruoškite važiavimui žiemos sąlygomis ir apsirenkite šiltai.',
    updated_at = now()
where id = '3e9e0b88-a653-4d37-8f48-6faabf12a866'
  and title = 'Keturičiai sniege'
  and description = 'Važiavimais miškinguose vietuose per sniegą'
returning id, title, description;
