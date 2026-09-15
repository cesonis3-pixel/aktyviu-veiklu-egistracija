export type Activity = {
  id: string;
  title: string;
  category: string;
  date: string;
  dateLabel: string;
  location: string;
  organizer: string;
  capacity: number;
  available: number;
  status?: "active" | "cancelled";
  image: string;
  imageAlt: string;
  description: string;
};

export const activities: Activity[] = [
  {
    id: "slidinejimo-isvyka",
    title: "Slidinėjimo išvyka",
    category: "Slidinėjimas",
    date: "2027-01-16T10:00:00+02:00",
    dateLabel: "2027 m. sausio 16 d. · 10:00",
    location: "Druskininkai",
    organizer: "Povilas",
    capacity: 12,
    available: 6,
    image: "/images/ski-tour.jpg",
    imageAlt: "Slidininkų grupė snieguotame miške",
    description:
      "Praleisk šeštadienį aktyviai ir atrask slidinėjimo džiaugsmą kartu su bendraminčiais. Susitiksime Druskininkuose, susipažinsime ir keliausime į trasas. Išvyka tinka tiek pradedantiesiems, tiek jau išbandžiusiems slides. Pasirūpink šilta apranga, pirštinėmis ir gera nuotaika – dėl reikalingos įrangos susitarsime prieš išvyką.",
  },
  {
    id: "zygis-gamtoje",
    title: "Žygis gamtoje",
    category: "Žygiai",
    date: "2027-01-23T11:00:00+02:00",
    dateLabel: "2027 m. sausio 23 d. · 11:00",
    location: "Kauno rajonas",
    organizer: "Jurgita",
    capacity: 10,
    available: 1,
    image: "/images/winter-forest.jpg",
    imageAlt: "Snieguotas takas tarp žiemos miško medžių",
    description:
      "Trumpam palik miesto šurmulį ir pasivaikščiok žiemos miško takais. Mūsų laukia maždaug 8 kilometrų nesudėtingas maršrutas Kauno rajone, ramus tempas ir sustojimas karštai arbatai. Avėk patogius, neslystančius batus, apsirenk pagal orą ir pasiimk termosą mėgstamo gėrimo.",
  },
  {
    id: "ziemos-aktyvi-veikla",
    title: "Žiemos aktyvi veikla",
    category: "Aktyvus laisvalaikis",
    date: "2027-02-06T10:30:00+02:00",
    dateLabel: "2027 m. vasario 6 d. · 10:30",
    location: "Trakai",
    organizer: "Povilas",
    capacity: 8,
    available: 0,
    image: "/images/winter-adventure.jpg",
    imageAlt: "Žiemos nuotykių dalyviai keliauja per snieguotą mišką",
    description:
      "Žiema kviečia pajudėti! Susitikime aktyviam rytui Trakų apylinkėse: pasivaikščiosime snieguotais takais, išbandysime komandines užduotis ir pabūsime gryname ore. Specialaus pasirengimo nereikia. Pasiimk šiltus, judėti patogius drabužius ir vandens.",
  },
];
