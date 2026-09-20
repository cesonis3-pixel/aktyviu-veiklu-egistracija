const vilnius = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function toVilniusInput(value: string): string {
  const parts = Object.fromEntries(vilnius.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// A datetime-local value always means Lithuanian wall time, independently of
// the browser/server TZ. Reject DST gaps and ambiguous autumn times explicitly.
export function parseActivityTime(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return new Date(value);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(value)) value = value.slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(NaN);
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall)) return new Date(NaN);
  const candidates = [2, 3].map(offset => new Date(wall - offset * 3600000))
    .filter(date => toVilniusInput(date.toISOString()) === value);
  return candidates.length === 1 ? candidates[0] : new Date(NaN);
}
