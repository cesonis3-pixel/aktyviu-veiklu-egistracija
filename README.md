# Baltic Winter v1.1

Baltic Winter yra ziemos veiklu platforma. Dalyviai gali perziureti veiklas,
registruoti ir atsaukti savo rezervacijas, o organizatoriai gali matyti savo
veiklas ir jas atsaukti. Veiklos bei rezervacijos saugomos esamoje Supabase
duomenu bazeje.

## Versija ir funkcijos

- Projekto versija: `v1.1`.
- `package.json` versija: `0.1.0`.
- Viesas veiklu sarasas ir veiklos detales.
- Registracija, prisijungimas ir atsijungimas per Supabase Auth.
- Viena rezervacija tam paciam vartotojui vienoje veikloje.
- Atomine paskutines vietos apsauga PostgreSQL lygiu.
- Rezervacijos atsaukimas, issaugant rezervacijos irasa istorijai.
- Organizatorius gali atsaukti tik savo veikla; veikla neistrinama.
- Atsaukta veikla lieka matoma, o naujos rezervacijos nebepriimamos.

## Technologijos

- Next.js `16.3.5` ir React `19.3.0`.
- TypeScript `6.0.3`.
- Supabase Auth, PostgreSQL ir `@supabase/ssr`.
- ESLint.
- GitHub projekto saugojimui ir esamas Vercel projektas diegimui.

## Paleidimas is GitHub (Windows PowerShell)

### 1. Klonuoti projekta

```powershell
git clone https://github.com/cesonis3-pixel/aktyviu-veiklu-egistracija.git
cd aktyviu-veiklu-egistracija
```

### 2. Idiegti priklausomybes

```powershell
npm.cmd install
```

### 3. Sukurti `.env.local`

Nukopijuokite sablona:

```powershell
Copy-Item .env.example .env.local
```

Tada `.env.local` faile irasykite esamo Supabase projekto reiksmes:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

README neskelbia jokiu realiu raktu, slaptazodziu ar `.env.local` reiksmiu.
Naršykleje naudojamas tik Supabase publishable key; `service_role` raktas
projekte nenaudojamas.

### 4. Paleisti lokaliai

```powershell
npm.cmd run dev
```

Atidarykite: http://localhost:3000

Produkcinio buildo patikra:

```powershell
npm.cmd run build
```

## Vieša versija

Projektas naudoja esama Vercel projekta. Konkreti vieša Vercel nuoroda siame
GitHub repo ir jo konfigūracijoje neirašyta. Ja rasite esamo Vercel projekto
dashboard'e prie **Domains**. Naujo Vercel projekto kurti nereikia.

## Projekto struktura

- `app/` - Next.js puslapiai, layout, autentifikavimo callback ir API marsrutai.
- `components/` - veiklu korteles, rezervavimo UI, organizatoriaus ir dalyvio UI.
- `lib/` - veiklu duomenu adapteriai, tipai, klaidu zemelapiai ir Supabase klientai.
- `supabase/` - DB schema, migracijos, seed bei paskutines vietos testavimo SQL.
- `tests/` - autentifikacijos, rezervaciju ir atsauktu veiklu automatiniai testai.

## Kur yra pagrindine logika

- Organizatoriaus funkcijos: `app/my-activities/page.tsx`,
  `components/my-activities.tsx` ir `app/api/activities/[id]/cancel/route.ts`.
- Dalyvio funkcijos: `app/activities/`, `components/activity-detail.tsx`,
  `app/my-reservations/page.tsx` ir `components/my-reservations.tsx`.
- Rezervaciju logika: `app/api/reservations/route.ts` ir
  `components/activity-detail.tsx`.
- Supabase DB funkcijos: `supabase/schema.sql` ir
  `supabase/migrations/` (`reserve_activity`, `cancel_reservation`,
  `cancel_activity`).

## Supabase migracijos

Migracijos yra kataloge [supabase/migrations](supabase/migrations):

- `20260915_atomic_reservations.sql` - rezervavimo atomika ir paskutines vietos apsauga.
- `20260915_reservation_race_condition.sql` - papildoma race condition ir UNIQUE apsauga.
- `20260915_cancel_activity.sql` - organizatoriaus veiklos atsaukimas.
- `20260915_update_irklavimo_to_ski_training.sql` - esamos veiklos atnaujinimas tuo paciu UUID.

SQL paleidziamas esamo Supabase projekto Dashboard -> **SQL Editor**. Jo nereikia
paleisti per `npm install`, `npm run dev` ar `npm run build`, ir sis projektas
nekurs naujos Supabase duomenu bazes.

## Patikros

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Detalesni automatiniai ir rankiniai scenarijai aprasyti [TESTAI.md](TESTAI.md).
Projekto darbu planas yra [PLANAS.md](PLANAS.md).

## Naujo clone rankine 13 punkto patikra

1. Sukurkite visiskai nauja tuscia aplanka.
2. GitHub repo puslapyje pasirinkite **Code -> Clone**.
3. Atsidarykite klonuota projekta VS Code.
4. Nukopijuokite `.env.example` i `.env.local` ir irasykite esamo Supabase projekto reiksmes.
5. PowerShell terminale paleiskite `npm.cmd install`.
6. Paleiskite `npm.cmd run dev`.
7. Atidarykite http://localhost:3000.
8. Patikrinkite prisijungima ir atidarykite viena veikla.
9. Patikrinkite rezervacija, veiklos atsaukimo busena ir puslapio perkrovima pagal [TESTAI.md](TESTAI.md).

`.env.local`, `node_modules`, `.next` ir kiti build failai nera skirti GitHub.
`.env.example`, `package.json`, `package-lock.json`, `supabase/schema.sql`,
migracijos, `tests/`, `app/`, `components/` ir `lib/` yra projekto saltinio dalis.
