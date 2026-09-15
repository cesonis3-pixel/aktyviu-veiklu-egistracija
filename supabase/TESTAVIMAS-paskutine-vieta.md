# Dviem žmonėms liko viena vieta

## Paruošimas

1. Supabase Dashboard → SQL Editor vykdykite visą `migrations/20260915_atomic_reservations.sql`.
   Ji nekeičia veiklų ir netrina rezervacijų. Jei UNIQUE trūksta, jis pridedamas;
   esant dublikatams visa migracija atšaukiama, duomenys netrinami.
2. `test-last-place.sql` pirmoji SELECT užklausa parodo būsimas aktyvias veiklas,
   kurių capacity = 1 ir available = 1. Galite naudoti vieną iš jų.
3. Jei tokios veiklos nėra, vykdykite pažymėtą BEGIN–COMMIT dalį.
   Ji prideda „Paskutinės vietos rezervavimo testas“, nekeisdama trijų Baltic Winter veiklų.
   Jos adresas: `/activities/b913dace-786a-4ba1-9207-6281c247ee01`.
   Pakartotinis scenarijus nekeičia esamo įrašo ir neatšaukia rezervacijų.
4. Naudokite dvi atskiras patvirtintas paskyras. Paleiskite projektą.

## Pasenusio puslapio testas

1. A prisijungia įprastoje naršyklėje; B – kitoje naršyklėje arba incognito.
2. Abu atidaro tą patį veiklos UUID; abu turi matyti vieną laisvą vietą.
3. A spaudžia „Registruoti vietą“: rodoma „Rezervuojama...“, tada „Vieta rezervuota.“ ir 0 vietų.
4. B neatnaujina puslapio ir spaudžia tą patį mygtuką.
5. B gauna „Vietų nebeliko.“; jo puslapis atnaujina laisvų vietų skaičių į 0.
6. SQL Editor vykdykite `test-last-place.sql` paskutines dvi SELECT užklausas.
   Tikėtina: capacity = 1, active_reservations = 1, available = 0.
   Po pirmo testo naujai veiklai turi būti iš viso vienas reservations įrašas.

## Beveik vienalaikis testas

1. Laimėjęs vartotojas per UI atšaukia savo rezervaciją.
2. Abu perkrauna veiklos puslapį ir mato 1 vietą.
3. Suskaičiavę iki trijų abu beveik vienu metu spaudžia „Registruoti vietą“.
4. Vienas gauna sėkmę, kitas – „Vietų nebeliko.“. Kuris laimės, nėra nustatyta iš anksto.
5. Pakartokite SQL patikrą: galiojanti (`status = 'active'`) rezervacija tik viena.
   Ankstesnė atšaukta rezervacija gali likti istorijoje; tai nėra galiojanti vieta.
6. Pakartokite kelis kartus, sukeisdami A ir B. Tam pačiam vartotojui rezervuojant
   iš naujo, jo atšauktas įrašas atnaujinamas, naujas dublikatas nekuriamas.

## Kitos patikros

- Greitas dvigubas mygtuko paspaudimas neturi siųsti dviejų užklausų.
- Ta pati paskyra iš antro seno lango gauna „Jūs jau turite rezervaciją šiai veiklai.“.
- Atsijungęs lankytojas nukreipiamas prisijungti.
- Atšauktai veiklai RPC grąžina „Ši veikla atšaukta.“.
- RPC `user_id` parametro neturi: tapatybė gaunama tik iš `auth.uid()`.

DB užrakinimo testas turi būti atliktas su pritaikyta migracija tikroje Supabase
arba vietinėje PostgreSQL bazėje. API vienetų testai tikrina HTTP elgesį ir klaidų
pranešimus, tačiau patys neįrodo PostgreSQL konkurencijos veikimo.
