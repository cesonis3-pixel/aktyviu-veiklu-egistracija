# Baltic Winter v1.1

Žiemos veiklų platforma, kurioje dalyviai rezervuoja ir atšaukia vietas, o organizatoriai gali atšaukti savo veiklas.

## Kas pasikeitė v1.1

- Rezervacijos saugomos Supabase.
- Atšaukus rezervaciją aktyvioje veikloje, vieta vėl tampa laisva.
- Paskutinės vietos negali rezervuoti du žmonės: DB rezervavimo funkcija užrakina veiklos įrašą ir patikrina likusias vietas.
- Organizatorius gali atšaukti savo veiklą.
- Dalyviui rodoma „Veikla atšaukta“, o senos rezervacijos išlieka.
- Į atšauktą veiklą rezervuoti nebegalima, net iš anksčiau atidaryto puslapio.
- Pridėtas [TESTAI.md](TESTAI.md) su automatinėmis patikromis ir rankinio testavimo scenarijais.
- Projektas veikia per bendrą Supabase DB ir esamą Vercel projektą.

## v1.1 atnaujinimas

Naudojami tie patys GitHub, Supabase ir Vercel projektai. `npm run build` vykdo
tik `next build`: DB nekuriama iš naujo, SQL migracijos ir seed nepaleidžiami.
Šiam atnaujinimui papildomo SQL nereikia, kai esamos veikiančios funkcijos jau įdiegtos.
Senas duomenis trynęs `supabase/seed-activities.sql` pakeistas tik skaitymo užklausa.
Prieš Push ir po deploy atlikite [v1.1 production patikrą](TESTAI.md#v11-production-patikra).

## Komanda

- Povilas – dalyvio dalis: veiklų peržiūra, rezervacijos ir atšauktų veiklų rodymas.
- Jurgita – organizatoriaus dalis: savo veiklų peržiūra ir atšaukimas.

## Technologijos

- Next.js
- Supabase
- GitHub
- Vercel
