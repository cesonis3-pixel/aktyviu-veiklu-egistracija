export function reservationError(code?: string) {
  switch (code) {
    case "P0001": return { status: 401, message: "Prisijunkite prie paskyros." };
    case "P0002": return { status: 404, message: "Veikla nerasta." };
    case "P0003": return { status: 409, message: "Ši veikla atšaukta." };
    case "P0004":
    case "23505": return { status: 409, message: "Jūs jau turite rezervaciją šiai veiklai." };
    case "P0005": return { status: 409, message: "Vietų nebeliko." };
    case "P0006": return { status: 409, message: "Aktyvi rezervacija nerasta." };
    case "P0007": return { status: 409, message: "Ši veikla jau prasidėjo." };
    case "P0014": return { status: 403, message: "Negalite rezervuoti savo sukurtos veiklos." };
    default: return { status: 500, message: "Nepavyko pakeisti rezervacijos. Bandykite dar kartą." };
  }
}
