# Projekto testavimas

Patikrų data: 2026-09-15.

## Apimtis ir rezultatų patikimumas

Peržiūrėti esami automatiniai testai, dalyvio ir organizatoriaus komponentai,
API maršrutai, Supabase klientai, `supabase/schema.sql` ir migracijos.
Paleistos žemiau nurodytos vietinės patikros. Gyvoje Supabase bazėje SQL
nevykdytas, jos politikos ir pritaikytos funkcijų versijos nepatikrintos.
Povilo ir Jurgitos rankinių bandymų rezultatų šiame darbe negauta.

Automatinių testų sėkmė reiškia tik jų tikrinamos kodo dalies sėkmę.
Imituotas RPC atsakymas neįrodo tikro įrašo sukūrimo, RLS veikimo ar dviejų
vienalaikių PostgreSQL transakcijų rezultato. Todėl visi 10 pilnų scenarijų
žemiau dar pažymėti kaip reikalaujantys rankinės patikros.

## Testų lentelė

Stulpelyje „Ką darėme“ atskirta atlikta kodo / automatinė patikra ir dar planuojami rankiniai veiksmai.

| Testas | Ką darėme | Ko tikėjomės | Kas iš tikrųjų nutiko | Rezultatas |
| --- | --- | --- | --- | --- |
| 1. Neprisijungęs vartotojas negali rezervuoti | Automatiškai iškvietėme rezervavimo API su imituotu neprisijungusiu vartotoju. Rankiniu būdu: atsijungti, atidaryti veiklą ir bandyti rezervuoti; išsiųsti POST į `/api/reservations` be sesijos. | UI prašo prisijungti, API grąžina 401, rezervacija nesukuriama. | API teste gautas 401, RPC nebuvo iškviestas. Tikroje DB įrašų skaičius netikrintas. | Reikia patikrinti rankiniu būdu. |
| 2. Tas pats vartotojas negali rezervuoti du kartus | Patikrinome API reakciją į imituotus `P0004` ir `23505`. Rankiniu būdu: ta pačia paskyra iš dviejų langų rezervuoti tą pačią veiklą. | Antras bandymas atmetamas; rodoma „Jūs jau turite rezervaciją šiai veiklai.“; tai pačiai porai lieka vienas įrašas. | API automatiškai grąžino 409 ir teisingą tekstą. SQL kode yra dublikato patikra ir UNIQUE; gyvos DB apribojimas netikrintas. | Reikia patikrinti rankiniu būdu. |
| 3. Negalima keisti svetimų duomenų | Peržiūrėjome RLS, `auth.uid()`, `cancel_activity()` ir `cancel_reservation()`. API testas patikrino, kad perduotas svetimas `user_id` nepersiunčiamas į rezervavimo RPC. Rankiniu būdu: Povilo sesijoje bandyti pakeisti Jurgitos veiklą tiesiogine Supabase užklausa, atšaukti jos veiklą ir jos rezervaciją; sukeisti roles. | Svetima veikla ir rezervacija nepasikeičia. Atšaukiant svetimą veiklą gaunamas 403; neturint savo rezervacijos – klaida. Tiesioginis UPDATE nesuteikia teisės keisti svetimo įrašo. | Tapatybės parametro atmetimo API testas praėjo. SQL kode rastos savininko patikros, bet realios užklausos su dviem paskyromis neatliktos. | Reikia patikrinti rankiniu būdu. |
| 4. Savo rezervacijos atšaukimas aktyvioje veikloje | API teste iškvietėme DELETE ir patikrinome `cancel_reservation` RPC parinkimą. Rankiniu būdu: užrašyti laisvų vietų skaičių, atšaukti savo aktyvią rezervaciją, perkrauti puslapį ir patikrinti DB. | Rezervacija tampa `cancelled`, įrašas išlieka, laisvų vietų padaugėja viena (jei tuo metu niekas kitas nerezervuoja). | API parinko reikiamą RPC; SQL peržiūroje rastas statuso UPDATE ir tik aktyvių rezervacijų skaičiavimas. Tikras DB pokytis netikrintas. | Reikia patikrinti rankiniu būdu. |
| 5. Pilna veikla | API testui pateikėme imituotą RPC klaidą `P0005`. Rankiniu būdu: užpildyti veiklą ir mėginti rezervuoti iš kitos paskyros, įskaitant seną puslapį. | 409 ir „Vietų nebeliko.“; aktyvių rezervacijų skaičius neviršija capacity. | API klaidos tekstas ir statusas patvirtinti automatiškai. Tikro vietų limito vykdymas DB netikrintas. | Reikia patikrinti rankiniu būdu. |
| 6. Atšaukta veikla | Automatiškai atvaizdavome atšauktas korteles ir detales; patikrinome API `P0003` atsakymą ir seno puslapio reakciją. Rankiniu būdu: bandyti rezervuoti jau atšauktą veiklą ir iš iki atšaukimo atidaryto puslapio. | Nėra aktyvaus rezervavimo mygtuko; serveris grąžina „Ši veikla atšaukta.“; naujo įrašo nėra. | UI testuose rezervavimo veiksmo nėra. API grąžino 409; imituotas pasenęs puslapis parodė klaidą ir paprašė atnaujinti duomenis. Tikras DB bandymas neatliktas. | Reikia patikrinti rankiniu būdu. |
| 7. Puslapio atnaujinimas | Auth testas patikrino sesijos slapukus ir naują serverio vartotojo nuskaitymą su imituotais Auth atsakymais. Rankiniu būdu: rezervuoti, perkrauti detales ir „Mano rezervacijos“, pakartoti po atšaukimo. | Paskyra išlieka prisijungusi, rezervacija, veiklos statusas ir vietų skaičius atitinka Supabase. | Sesijos testas praėjo. Rezervacijų duomenų išlikimas tikroje naršyklėje po perkrovimo nepatikrintas. | Reikia patikrinti rankiniu būdu. |
| 8. Ta pati paskyra kitoje naršyklėje | Peržiūrėjome Supabase duomenų skaitymą. Rankiniu būdu: prisijungti ta pačia paskyra dviejose naršyklėse; vienoje rezervuoti arba atšaukti, kitoje perkrauti puslapį. | Abiejose naršyklėse po atnaujinimo sutampa rezervacijos, veiklos statusas ir laisvos vietos. | Dviejų naršyklių bandymas neatliktas; tokio automatinio integracinio testo nėra. Automatinis realaus laiko sinchronizavimas be perkrovimo nevertinamas. | Reikia patikrinti rankiniu būdu. |
| 9. Paskutinė vieta dviem vartotojams | Peržiūrėjome `FOR UPDATE` ir vietų perskaičiavimą. Rankiniu būdu: A ir B mato 1 vietą; A rezervuoja, B neperkrauna ir bando rezervuoti. Pakartoti spaudžiant beveik vienu metu. | Tik viena aktyvi rezervacija; vienam sėkmė, kitam „Vietų nebeliko.“; laisvų vietų 0. | Vietinis API testas patvirtino tik imituotos vietų trūkumo klaidos apdorojimą. Dvi tikros konkuruojančios transakcijos nepaleistos. | Reikia patikrinti rankiniu būdu. |
| 10. Organizatorius atšaukia veiklą | Peržiūrėjome organizatoriaus RPC ir automatiškai patikrinome dalyvio atšauktos veiklos rodymą su sena rezervacija. Rankiniu būdu: Jurgita atšaukia savo veiklą, kurioje Povilas turi rezervaciją; patikrinti abu DB įrašus ir dalyvio puslapius. | Veikla tampa `cancelled`, nei ji, nei senos rezervacijos neištrinamos; matomi pavadinimas, data, vieta, rezervacija ir „Veikla atšaukta“; nauja rezervacija atmetama. | Komponentų testai išlaikė informaciją ir paslėpė rezervavimo veiksmus; statuso konvertavimo testas praėjo. Organizatoriaus RPC realioje bazėje nevykdytas. | Reikia patikrinti rankiniu būdu. |

## Automatinės patikros

Komandos vykdytos PowerShell aplinkoje, naudojant `npm.cmd`.

| Patikra | Komanda | Faktinis galutinis rezultatas |
| --- | --- | --- |
| TypeScript | `npm.cmd run typecheck` | Sėkminga, išėjimo kodas 0. |
| ESLint | `npm.cmd run lint` | Sėkminga, išėjimo kodas 0. |
| Produkcinis build | `npm.cmd run build` | Sėkmingas, išėjimo kodas 0. Tai nepatvirtina gyvos DB funkcijų ar politikų. |
| Visi esami automatiniai testai | `node --test tests/auth.test.mjs tests/reservations.test.mjs tests/cancelled-activities.test.mjs` | 18 testų: 18 sėkmingų, 0 nesėkmingų, 0 praleistų. |

### Ką automatiniai testai iš tiesų patvirtino

- `tests/auth.test.mjs`: 7 testai. Slapukų rašymas, sesijos atnaujinimas, atsijungimas,
  anoniminiai prisijungimo puslapiai, PKCE callback ir jo klaidos, lietuviški klaidų
  pranešimai. Naudojamos tikros SSR / Next.js slapukų realizacijos, bet Auth HTTP atsakymai imituoti.
- `tests/reservations.test.mjs`: 6 testai. API tapatybės ir UUID patikros,
  tik veiklos UUID perdavimas RPC, 409 pranešimai dublikatui / pilnai / atšauktai veiklai,
  bendros klaidos bei atšaukimo RPC parinkimas. Supabase klientas ir RPC atsakymai imituoti.
- `tests/cancelled-activities.test.mjs`: 5 testai. Aktyvios rezervacijos rodymas,
  senos rezervacijos informacijos išlaikymas atšauktoje veikloje, neaktyvūs registracijos
  veiksmai, pasenusio puslapio reakcija į serverio klaidą ir Supabase statuso konvertavimas.
  Naudojamas komponentų atvaizdavimas ir imituoti hook / tinklo atsakymai, ne tikra naršyklė.

Taigi lentelės 1, 2, 3, 4, 5, 6, 7 ir 10 scenarijų **dalys** turi automatinį
patvirtinimą. 8 scenarijus ir 9 scenarijaus konkurencija gyvoje DB automatiškai
nepatvirtinti. Pilnai rankiniu būdu reikia atlikti visus 10 scenarijų.

### Rasta ir pataisyta klaida

Pirmas visų testų paleidimas: 17 sėkmingų, 1 nesėkmingas.
`tests/auth.test.mjs` lietuviškų klaidų testas aptiko, kad bendram užklausų limitui
ir laiškų siuntimo limitui grąžinamas tas pats laiškų siuntimo pranešimas (`6 !== 7`).
`lib/auth-errors.ts` bendro HTTP 429 / `over_request_rate_limit` pranešimas pakeistas
į „Per daug užklausų. Palaukite ir bandykite dar kartą.“.
Autentifikacijos srautas, slapukai ir teisės nekeisti. Po pataisos visi 18 testų praėjo.

## Serverio ir Supabase apsaugų analizė

Toliau pateiktos išvados apie **projekte esančius SQL failus ir kodą**, o ne
patvirtinimas, kad gyvoje Supabase bazėje yra identiška konfigūracija.

| Apsauga | Kas rasta kode | Patikros ribos |
| --- | --- | --- |
| Activities RLS | RLS įjungta. Yra viešo skaitymo politika; savininko skaitymo politika papildomai viešo skaitymo neriboja. INSERT / UPDATE / DELETE politikų pateiktoje schemoje nėra, todėl paprastiems klientams jos neleidžia tiesiogiai redaguoti svetimų veiklų. | Esamos papildomos gyvos DB politikos ir teisės nepatikrintos. RLS testuoti vartotojo sesija, ne administratoriaus SQL Editor role. |
| Reservations RLS | RLS įjungta. SELECT leidžiamas tik kai `auth.uid() = user_id`. Tiesioginės INSERT / UPDATE / DELETE teisės atimamos iš PUBLIC, anon ir authenticated. | RPC su SECURITY DEFINER apsaugą užtikrina jų pačių patikros; vien RLS joms nepakanka. |
| `auth.uid()` | Visos trys keitimo funkcijos gauna vartotoją iš sesijos ir atmeta NULL. Vartotojo ID iš naršyklės nepriimamas kaip RPC argumentas. API papildomai kviečia `auth.getUser()`. | Vietinis API testas neįrodo gyvos sesijos ir DB teisių konfigūracijos. |
| `reserve_activity()` | Užrakina activity eilutę `FOR UPDATE`, tikrina egzistavimą, statusą, datą, savo dublikatą, po užrakto suskaičiuoja aktyvias rezervacijas ir lygina su capacity. Įrašo arba atnaujina tik savo rezervaciją. | Reikia rankinio pilnos veiklos, pasenusio puslapio ir konkurencijos testo. |
| `cancel_reservation()` | Užrakina tą pačią activity eilutę; UPDATE ribojamas `activity_id`, `user_id = auth.uid()` ir aktyvia būsena. Keičia statusą į cancelled, netrina įrašo. | Jeigu vartotojas toje pačioje veikloje turi savo rezervaciją, bus atšaukta jo, ne kito vartotojo rezervacija. Tikrinti DB įrašus. |
| `cancel_activity()` | Užrakina veiklą, tikrina `creator_id = auth.uid()`, svetimam savininkui grąžina P0008 (API – 403). Keičia tik veiklos statusą ir updated_at, rezervacijų neliečia. | Esamuose automatiniuose testuose organizatoriaus API ir tikra savininko DB patikra netestuojami. |
| `UNIQUE(activity_id, user_id)` | Apribojimas yra schemoje; migracijos tikrina jo buvimą ir prideda, jei trūksta. Atšaukta rezervacija rezervuojant iš naujo aktyvinama tame pačiame įraše. | Tikras apribojimo buvimas ir senų duomenų dublikatai gyvoje DB netikrinti. |
| SECURITY DEFINER ir teisės | `schema.sql`, atomic ir cancel_activity migracijose keitimo RPC naudoja tuščią search_path bei kvalifikuotas lenteles; vykdymas atimtas iš PUBLIC / anon, suteiktas authenticated. | Atskira race_condition migracija perrašo reserve_activity naudodama `search_path = public`. Ji taip pat tikrina auth.uid(), užraktą ir statusą, bet galutinę versiją lemia paleidimo tvarka. |
| Viešas vietų skaičius | `get_public_activities()` skaičiuoja capacity minus tik aktyvios rezervacijos; grąžina ir atšauktas veiklas, negrąžina rezervavusių vartotojų ID. | Naudoja `search_path = public`; public schemos kūrimo teises ir funkcijos savininką patikrinti gyvoje DB. |
| Naršyklės raktas | Kliento konfigūracija naudoja `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; peržiūrėtoje realizacijoje service_role nenaudojamas. | `.env.local` turinys šiai analizei nebuvo skaitomas; build jį įprastai įkelia. |

**Išvada:** apsauga nėra vien paslėpti UI mygtukai: serveris tikrina sesiją,
DB funkcijos tikrina tapatybę, savininką, statusą ir talpą, naudojamas užraktas bei UNIQUE.
Per šią peržiūrą patvirtinto teisių apėjimo nerasta. Tai nėra gyvos Supabase
konfigūracijos saugumo sertifikavimas. Nustatyta klaidinančio teksto klaida buvo
pataisyta; ji nesuteikė papildomų teisių.

Veiklos **atšaukimas** yra UPDATE. Lentelės FK turi `ON DELETE CASCADE`, todėl
administratoriui iš tikrųjų ištrynus activity būtų pašalintos susietos rezervacijos.
Tai kitas veiksmas; `cancel_activity()` DELETE nevykdo.

## Rankinio testavimo organizavimas su Povilu ir Jurgita

1. Naudoti dvi skirtingas patvirtintas paskyras atskirose naršyklėse. Užrašyti,
   kuriam vartotojui priklauso testinė veikla, veiklos UUID ir pradinį vietų skaičių.
2. Turėti būsimą aktyvią veiklą su laisvomis vietomis, pilną veiklą ir atskirą veiklą
   atšaukimo bandymui. 9 scenarijui naudoti [vienos vietos testo instrukcijas](supabase/TESTAVIMAS-paskutine-vieta.md)
   ir [testo SQL](supabase/test-last-place.sql). Šio dokumentavimo metu jie nevykdyti.
3. 3 scenarijų tikrinti tiesioginėmis API / Supabase užklausomis su paprasto vartotojo
   sesija, net jei UI neturi tokio mygtuko. Svetimos veiklos atšaukimo adresas:
   `POST /api/activities/<Jurgitos-veiklos-UUID>/cancel`. Rezervacijoms naudojami
   `POST` / `DELETE /api/reservations` su `{ "activityId": "<UUID>" }`.
   Tiesioginio UPDATE atveju patikrinti, kad DB eilutė nepasikeitė: RLS gali tiesiog
   neleisti pasirinkti atnaujintinų eilučių, ne visada grąžinti klaidą.
4. 9 scenarijų pakartoti ir pasenusiu puslapiu, ir beveik vienalaikiu paspaudimu.
   Tarp bandymų laimėtojas atšaukia savo rezervaciją; abu atnaujina puslapius.
   Skaičiuoti `status = 'active'`: senos atšauktos eilutės gali likti istorijoje.
5. 10 scenarijuje iš anksto išsaugoti activity ir reservations ID. Po Jurgitos
   atšaukimo Povilas tikrina „Mano rezervacijos“ ir detales; DB palyginami tie patys ID.
6. Kiekvienam atliktam scenarijui įrašyti datą, atlikėją, faktinį UI / HTTP rezultatą
   ir DB patikros rezultatą. Tik tuomet pakeisti lentelės rezultatą. Nerašyti
   slaptažodžių, sesijos žetonų ar raktų į šį dokumentą.

Papildoma migracija šiam dokumentavimo darbui nesukurta. Prieš rankinius bandymus
projekto savininkams reikia patikrinti, kurios esamos migracijos jau pritaikytos;
šiame darbe SQL, Git commit, push, pull ir merge nevykdyti.
