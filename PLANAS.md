# Projekto „Aktyvių veiklų registracija“ planas

## 1. Projekto idėja

Sukurti internetinę sistemą, kurioje žmonės galėtų skelbti aktyvias veiklas, peržiūrėti jų pasiūlą ir rezervuoti vietą pasirinktoje veikloje. Organizatorius matys savo sukurtas veiklas ir jų dalyvius, o dalyvis – savo rezervacijas ir jų būsenas.

Organizatorius ir dalyvis yra vartotojo atliekami veiksmai, o ne atskiros paskyrų rūšys. Tas pats prisijungęs vartotojas gali kurti veiklas ir dalyvauti veiklose. Pirmajame etape nekuriama atskira administratoriaus rolė, mokėjimai ar laukiančiųjų eilė.

## 2. Pagrindinis procesas

1. Organizatorius prisijungia ir sukuria veiklą: nurodo pavadinimą, aprašymą, vietą, datą, laiką ir vietų skaičių.
2. Dalyvis peržiūri veiklas, prisijungia ir rezervuoja vieną vietą pasirinktoje veikloje.
3. Po sėkmingos rezervacijos laisvų vietų skaičius sumažėja vienetu. Dalyvis rezervaciją mato puslapyje „Mano rezervacijos“, o organizatorius – savo veiklos dalyvių sąraše.
4. Dalyvis atšaukia savo rezervaciją.
5. Rezervacija pažymima atšaukta, laisvų vietų skaičius padidėja vienetu, o atnaujintą rezultatą mato abi pusės. Laisvą vietą gali rezervuoti kitas vartotojas.

Pavyzdys: veikloje yra viena vieta. Jurgita ją rezervuoja, todėl veikla tampa pilna. Jurgitai atšaukus rezervaciją, veikloje vėl lieka viena laisva vieta.

## 3. Pagrindinės rezervavimo taisyklės

- Neprisijungęs žmogus gali matyti veiklų sąrašą ir veiklos informaciją, tačiau rezervacijai būtina prisijungti.
- Tas pats vartotojas gali ir kurti veiklas, ir jose dalyvauti; atskiros organizatoriaus ir dalyvio paskyros nereikalingos.
- Vienas vartotojas konkrečioje veikloje gali turėti tik vieną aktyvią rezervaciją. Rezervacija visada skirta vienai vietai.
- Atšaukus rezervaciją, vieta vėl tampa laisva. Vartotojas gali rezervuoti iš naujo, jeigu veikla dar vyksta ateityje, nėra atšaukta ir turi laisvų vietų.
- Pilnos, atšauktos arba jau prasidėjusios veiklos rezervuoti negalima.
- Rezervaciją gali atšaukti tik ją sukūręs vartotojas. Pirmajame etape tai leidžiama iki veiklos pradžios.
- Veiklą redaguoti ir atšaukti gali tik jos kūrėjas. Kitų vartotojų veiklų valdyti negalima.
- Vietų skaičius turi būti teigiamas sveikasis skaičius. Jo negalima sumažinti žemiau aktyvių rezervacijų skaičiaus.
- Organizatoriui atšaukus veiklą, jos aktyvios rezervacijos taip pat pažymimos atšauktomis. Veikla išlieka matoma su atšaukimo būsena, tačiau rezervacijos nebepriimamos.
- Paskutinės vietos negali rezervuoti du žmonės vienu metu. Ši taisyklė užtikrinama duomenų bazėje, ne vien rezervavimo mygtuko išjungimu.
- Laisvos vietos apskaičiuojamos: bendras vietų skaičius minus aktyvių rezervacijų skaičius. Atšauktos rezervacijos vietų neužima.

## 4. Pagrindiniai puslapiai

| Puslapis | Paskirtis | Prieiga |
| --- | --- | --- |
| Veiklų sąrašas | Rodyti veiklų pavadinimus, laiką, vietą, būseną ir laisvų vietų skaičių. | Visiems |
| Veiklos informacija | Rodyti aprašymą, vietų likutį ir rezervavimo arba atšaukimo veiksmą pagal vartotojo būseną. | Informacija visiems; veiksmai prisijungus |
| Registracija ir prisijungimas | Sukurti paskyrą, prisijungti ir pateikti autentifikavimo klaidas. | Neprisijungusiems |
| Mano veiklos | Rodyti vartotojo sukurtas veiklas ir jų valdymo nuorodas. | Prisijungus |
| Nauja veikla | Pateikti veiklos kūrimo formą. | Prisijungus |
| Veiklos valdymas | Redaguoti arba atšaukti savo veiklą ir matyti rezervacijų sąrašą. | Tik veiklos kūrėjui |
| Mano rezervacijos | Rodyti aktyvias bei atšauktas rezervacijas ir leisti atšaukti savo aktyvią rezervaciją. | Prisijungus |

Bendroje navigacijoje pateikiamos veiklų, savo veiklų, savo rezervacijų ir prisijungimo arba atsijungimo nuorodos.

## 5. Technologijos

| Technologija | Naudojimas projekte |
| --- | --- |
| Next.js | Puslapiai, bendri komponentai, formos ir serverio logika. |
| Supabase | PostgreSQL duomenų bazė, duomenų užklausos ir rezervavimo funkcijos. |
| Supabase Auth | Vartotojų registracija, prisijungimas, atsijungimas ir sesijų valdymas. |
| Supabase RLS | Prieigos prie lentelių eilučių ribojimas pagal prisijungusį vartotoją. |
| GitHub | Bendras kodo saugojimas ir pakeitimų peržiūra projekto įgyvendinimo metu. |
| Vercel | Next.js programos publikavimas ir aplinkos kintamųjų nustatymas. |

Slapti raktai nelaikomi kode ir neperduodami naršyklei. Supabase privilegijuotas raktas negali būti naudojamas kliento pusėje.

## 6. Duomenų bazė

### `activities` – veiklos

| Laukas | Tipas | Paskirtis ir apribojimai |
| --- | --- | --- |
| `id` | `uuid` | Pirminis raktas. |
| `creator_id` | `uuid` | Privaloma nuoroda į `auth.users.id`; veiklos kūrėjas. |
| `title` | `text` | Privalomas netuščias pavadinimas. |
| `description` | `text` | Veiklos aprašymas. |
| `location` | `text` | Privaloma netuščia susitikimo vieta. |
| `starts_at` | `timestamptz` | Privaloma pradžios data ir laikas; kuriant turi būti ateityje. |
| `capacity` | `integer` | Bendras vietų skaičius, didesnis už nulį. |
| `status` | `text` | Tik `active` arba `cancelled`; numatyta `active`. |
| `created_at` | `timestamptz` | Sukūrimo laikas. |
| `updated_at` | `timestamptz` | Paskutinio atnaujinimo laikas. |

Pilnumas nėra atskirai saugoma veiklos būsena: jis nustatomas pagal vietų ir aktyvių rezervacijų skaičių.

### `reservations` – rezervacijos

| Laukas | Tipas | Paskirtis ir apribojimai |
| --- | --- | --- |
| `id` | `uuid` | Pirminis raktas. |
| `activity_id` | `uuid` | Privaloma nuoroda į `activities.id`. |
| `user_id` | `uuid` | Privaloma nuoroda į `auth.users.id`; rezervuojantis vartotojas. |
| `status` | `text` | Tik `active` arba `cancelled`; numatyta `active`. |
| `created_at` | `timestamptz` | Rezervacijos įrašo sukūrimo laikas. |
| `updated_at` | `timestamptz` | Paskutinio būsenos pakeitimo laikas. |
| `cancelled_at` | `timestamptz`, leidžiama `null` | Atšaukimo laikas; aktyviai rezervacijai – `null`. |

Porai (`activity_id`, `user_id`) taikomas unikalumo apribojimas. Pakartotinai rezervuojant po atšaukimo, esamas įrašas aktyvuojamas iš naujo ir išvalomas `cancelled_at`. Taip vienai vartotojo ir veiklos porai visada lieka vienas įrašas. Pilna rezervacijos pakeitimų istorija pirmajame etape nekaupiama.

### Lentelių ryšiai

- Viena veikla turi daug rezervacijų: `activities.id` → `reservations.activity_id` (1:N).
- Vienas vartotojas gali sukurti daug veiklų: `auth.users.id` → `activities.creator_id` (1:N).
- Vienas vartotojas gali turėti rezervacijų skirtingose veiklose: `auth.users.id` → `reservations.user_id` (1:N).
- Pirmajame etape veiklos ir rezervacijos fiziškai netrinamos – naudojamas atšaukimas.

### Prieigos kontrolė ir vietų apsauga

Abiem lentelėms įjungiama RLS. Veiklų informaciją gali skaityti visi. Veiklos kūrėjas nustatomas pagal prisijungusio vartotojo `auth.uid()` ir negali būti savavališkai pakeistas. Savo rezervacijas gali skaityti dalyvis, o konkrečios veiklos rezervacijas – tos veiklos kūrėjas. Viešai pateikiami tik vietų skaičiai, ne dalyvių rezervacijų įrašai. Pirmajame etape organizatoriaus sąraše dalyvis atpažįstamas pagal vartotojo ID; el. pašto adresai neviešinami.

Rezervavimas vykdomas per duomenų bazės funkciją (RPC) vienoje transakcijoje:

1. Patikrinti prisijungimą; vartotojo ID imti iš sesijos, o ne pasitikėti kliento pateikta reikšme.
2. Užrakinti pasirinktos veiklos eilutę naudojant `SELECT ... FOR UPDATE`.
3. Patikrinti veiklos būseną, pradžios laiką, esamą vartotojo rezervaciją ir aktyvių rezervacijų skaičių.
4. Jei vieta yra, sukurti arba iš naujo aktyvuoti rezervaciją. Jei vietos nėra, grąžinti aiškią klaidą.
5. Užbaigti transakciją ir iš naujo nuskaityti vietų likutį.

Rezervacijos atšaukimas, veiklos atšaukimas ir talpos keitimas taip pat vykdomi kontroliuojamomis funkcijomis, užrakinant tą pačią veiklos eilutę prieš tikrinant ir keičiant duomenis. Taip lygiagrečios operacijos negali pažeisti vietų limito. Veiklos atšaukimas ir jos rezervacijų atšaukimas atliekami vienoje transakcijoje.

Tiesioginės rezervacijų rašymo operacijos iš kliento draudžiamos. Veiklos pakeitimai taip pat turi eiti per patikras užtikrinančias funkcijas. Funkcijų vykdymo teisės suteikiamos tik reikiamiems naudotojams; privilegijuotose funkcijose aiškiai tikrinama tapatybė, nuosavybė ir nustatomas saugus `search_path`. Vien RLS ar patikrinimo naršyklėje nepakanka paskutinei vietai apsaugoti.

## 7. Povilo ir Jurgitos darbų pasidalijimas

| Komandos narys | Atsakomybė pirmame etape | Konkretūs darbai |
| --- | --- | --- |
| Povilas | Organizatoriaus dalis | Veiklos kūrimo forma, „Mano veiklos“, savo veiklos redagavimas ir atšaukimas, dalyvių sąrašas, kūrėjo teisių tikrinimas. |
| Jurgita | Dalyvio dalis | Veiklų sąrašas ir informacija, vietų likučio rodymas, rezervavimas, „Mano rezervacijos“, savo rezervacijos atšaukimas, pilnos ir atšauktos veiklos pranešimai. |

Šis pasidalijimas nusako programavimo atsakomybes, o ne vartotojų teisių apribojimus. Abu komandos nariai testuoja abi sistemos naudojimo puses ir peržiūri vienas kito įgyvendintą pagrindinį procesą.

## 8. Bendros projekto dalys

Povilas ir Jurgita kartu suderina bei įgyvendina:

- Next.js projekto struktūrą, bendrą dizainą, navigaciją ir pritaikymą telefonui.
- Supabase projektą, lenteles, ryšius, apribojimus ir duomenų bazės migracijas.
- Supabase Auth registraciją, prisijungimą, atsijungimą ir sesijų valdymą.
- RLS taisykles, rezervavimo funkcijas ir vienalaikių užklausų apsaugą.
- Bendrus formų validavimo, įkėlimo, tuščio sąrašo ir klaidų pranešimus lietuviškai.
- Vienodą datų rodymą Lietuvos laiku ir laiko juostos išsaugojimą duomenų bazėje.
- Vietų likučio ir rezervacijų atnaujinimą po veiksmų bei grįžus į puslapį. Pirmajame etape pakanka pakartotinio duomenų nuskaitymo; nuolatinis tiesioginis atnaujinimas neprivalomas.
- Bandomuosius duomenis, integracinį testavimą, dokumentaciją ir publikavimą Vercel.
- Darbo su GitHub tvarką įgyvendinimo metu: atskiras užduotis, pakeitimų peržiūrą ir suderinimą prieš sujungimą.

## 9. Bandomosios veiklos

| Veikla | Aprašymas | Vieta | Bendras vietų skaičius | Bandymo paskirtis |
| --- | --- | --- | --- | --- |
| Žygis parke | Lengvas bendras pasivaikščiojimas pažintiniu maršrutu. | Vingio parkas, Vilnius | 10 | Įprastas rezervavimas ir kelių dalyvių sąrašas. |
| Lauko treniruotė | Bendro fizinio pasirengimo treniruotė pradedantiesiems. | Kalnų parkas, Vilnius | 5 | Kelių rezervacijų, atšaukimo ir vietų likučio tikrinimas. |
| Individuali irklavimo pamoka | Vieno dalyvio įvadinė pamoka su organizatoriumi. | Galvės ežeras, Trakai | **1** | Paskutinės vietos konkurencija, pilna veikla ir pakartotinis rezervavimas po atšaukimo. |

Ruošiant demonstraciją, šioms veikloms nustatomos būsimos datos, pavyzdžiui, po 7, 8 ir 9 dienų nuo duomenų paruošimo. Veiklas sukuria bent du skirtingi bandomieji vartotojai. Atšauktos veiklos scenarijui naudojama papildoma veikla arba viena iš bandomųjų veiklų po pagrindinių bandymų.

## 10. Projekto įgyvendinimo eiga

1. **Suderinti apimtį.** Patvirtinti šiame plane aprašytus puslapius, duomenų laukus, taisykles ir atsakomybes. Rezultatas – bendra pirmojo etapo užduočių seka.
2. **Paruošti pagrindą.** Sukurti Next.js ir Supabase konfigūraciją, aplinkos kintamuosius, bendrą navigaciją. Rezultatas – lokaliai veikiantis projektas.
3. **Paruošti duomenų bazę ir autentifikavimą.** Sukurti lenteles, apribojimus, RLS ir kontroliuojamas duomenų keitimo funkcijas; įgyvendinti registraciją bei prisijungimą. Rezultatas – patikrinta prieiga pagal vartotoją.
4. **Įgyvendinti organizatoriaus dalį.** Povilas sukuria veiklos kūrimą, sąrašą, valdymą ir dalyvių peržiūrą. Rezultatas – vartotojas gali valdyti savo veiklas.
5. **Įgyvendinti dalyvio dalį.** Jurgita sukuria veiklų peržiūrą, rezervavimą, rezervacijų sąrašą ir atšaukimą. Ši dalis gali būti kuriama lygiagrečiai su organizatoriaus dalimi, suderinus duomenų sutartį. Rezultatas – vartotojas gali rezervuoti ir atlaisvinti vietą.
6. **Sujungti procesą.** Abu patikrina kelią nuo veiklos sukūrimo iki vietos atlaisvinimo, sutvarko būsenų ir klaidų rodymą. Rezultatas – nuosekliai veikiantis pagrindinis scenarijus.
7. **Testuoti.** Paruošti bandomąsias veiklas ir paskyras, vykdyti toliau pateiktą planą, ištaisyti klaidas. Rezultatas – užfiksuoti bandymų rezultatai ir įvykdyti priėmimo kriterijai.
8. **Publikuoti ir pristatyti.** Įgyvendinimo pabaigoje paruošti Vercel aplinką, Supabase Auth grįžimo adresus ir naudojimo instrukciją. Rezultatas – pasiekiama programa ir paruošta demonstracija.

Tai būsimo įgyvendinimo planas. Šio dokumento parengimas neapima kitų failų keitimo, Git veiksmų ar publikavimo.

## 11. Testavimo planas

Bandymams naudojamas neprisijungęs lankytojas ir bent trys paskyros: veiklos kūrėjas bei du dalyviai. Lygiagretiems bandymams naudojamos atskiros sesijos. Prieš kiekvieną bandymą paruošiama žinoma veiklos ir rezervacijų būsena.

| Nr. | Scenarijus | Laukiamas rezultatas |
| --- | --- | --- |
| 1 | Neprisijungęs lankytojas atidaro sąrašą ir veiklos informaciją. | Informacija matoma, rezervavimui prašoma prisijungti. |
| 2 | Vartotojas užsiregistruoja, prisijungia ir atsijungia. | Sesija valdoma teisingai; atsijungus rezervuoti negalima. |
| 3 | Prisijungęs vartotojas sukuria veiklą su teisingais duomenimis. | Veikla matoma bendrame ir kūrėjo sąrašuose, kūrėjas nustatytas pagal sesiją. |
| 4 | Kuriama veikla su tuščiu pavadinimu, netinkama data ar nuliniu / neigiamu vietų skaičiumi. | Netinkami duomenys atmetami ir pateikiama aiški klaida. |
| 5 | Vartotojas rezervuoja vietą laisvoje veikloje. | Sukuriama viena aktyvi rezervacija, likutis sumažėja vienetu; ją mato dalyvis ir kūrėjas. |
| 6 | Tas pats vartotojas rezervuoja tą pačią veiklą dar kartą, taip pat dviem lygiagrečiomis užklausomis. | Lieka tik viena aktyvi rezervacija ir užimama tik viena vieta. |
| 7 | Dalyvis atšaukia savo rezervaciją ir pakartoja atšaukimo užklausą. | Rezervacija atšaukta, vieta atlaisvinama tik vieną kartą; likutis neviršija talpos. |
| 8 | Po atšaukimo vartotojas rezervuoja iš naujo. | Esamas įrašas aktyvuojamas, jei tenkinamos rezervavimo taisyklės. |
| 9 | Bandoma rezervuoti pilną, atšauktą arba jau prasidėjusią veiklą. | Užklausa atmetama, aktyvi rezervacija nesukuriama. |
| 10 | Du skirtingi vartotojai vienu metu rezervuoja veiklą, turinčią vieną laisvą vietą. | Tik viena užklausa sėkminga; kita gauna pranešimą, kad vietų nebėra. Duomenų bazėje tik viena aktyvi rezervacija. |
| 11 | Kitas vartotojas bando redaguoti ar atšaukti svetimą veiklą arba atšaukti svetimą rezervaciją. | Veiksmai atmetami tiek per sąsają, tiek tiesioginėmis API / RPC užklausomis. |
| 12 | Tas pats vartotojas sukuria veiklą ir rezervuoja vietą veikloje. | Abu veiksmai galimi su ta pačia paskyra, nekeičiant rolės. |
| 13 | Kūrėjas mažina talpą žemiau aktyvių rezervacijų skaičiaus. | Pakeitimas atmetamas; lygiagretus rezervavimas taip pat negali viršyti talpos. |
| 14 | Kūrėjas atšaukia veiklą su aktyviomis rezervacijomis. | Veikla ir jos rezervacijos atšaukiamos kartu; dalyviai mato atšaukimą, naujos rezervacijos nepriimamos. |
| 15 | Veiklos atšaukimas ir rezervavimas vyksta vienu metu. | Galutinė veikla atšaukta ir neturi aktyvių rezervacijų. |
| 16 | Lankytojas arba nesusijęs vartotojas tiesiogiai užklausia svetimas rezervacijas ar bando apeiti RPC. | RLS ir duomenų bazės teisės neleidžia skaityti svetimų rezervacijų ar apeiti keitimo taisyklių; viešas likutis matomas. |
| 17 | Puslapis perkraunamas arba atidaromas kitoje sesijoje po rezervavimo ir atšaukimo. | Rodoma duomenų bazės būsena ir teisingas vietų likutis. |
| 18 | Programa naudojama telefone; užklausa lėta arba nepavyksta. | Turinys įskaitomas, matoma įkėlimo ar klaidos būsena; sėkmė nerodoma negavus patvirtinimo. |
| 19 | Pagrindinis procesas vykdomas Vercel aplinkoje. | Prisijungimas, veiklos kūrimas, rezervavimas ir atšaukimas veikia publikuotoje programoje. |

Pagrindinį procesą patikrinti rankiniu būdu abiem komandos nariams. Kritines duomenų bazės taisykles – unikalumą, paskutinės vietos apsaugą, atšaukimą ir prieigos ribojimą – papildomai tikrinti integraciniais testais. Vienalaikiškumo bandymas turi siųsti realias lygiagrečias užklausas, o ne vien spausti mygtukus paeiliui. Po bandymų patikrinti duomenų bazės įrašus, ne tik sąsajos pranešimus.

## 12. Galutinis projekto rezultatas

Baigtas pirmasis etapas – Vercel publikuota lietuviška internetinė programa, kurioje lankytojas gali peržiūrėti veiklas, o prisijungęs vartotojas gali kurti ir valdyti savo veiklas, rezervuoti vieną vietą veikloje bei atšaukti savo rezervaciją. Organizatorius mato savo veiklos rezervacijas, dalyvis – savo rezervacijų būsenas.

Projektas laikomas įgyvendintu, kai:

- Veikia visas procesas: veiklos sukūrimas → rezervavimas → rezultato peržiūra abiem pusėms → rezervacijos atšaukimas → atlaisvintos vietos rezervavimas.
- Duomenys išlieka perkrovus puslapį, o vietų skaičius atitinka aktyvias rezervacijas.
- Viena paskyra gali atlikti organizatoriaus ir dalyvio veiksmus.
- RLS ir duomenų bazės funkcijos apsaugo svetimus duomenis bei neleidžia viršyti vietų skaičiaus net esant lygiagrečioms užklausoms.
- Paruoštos bent trys bandomosios veiklos, įskaitant veiklą su viena vieta, ir sėkmingai atliktas testavimo planas.
- Parengta paleidimo bei naudojimo instrukcija, aiškus komandos darbų pasidalijimas ir veikianti demonstracija.
