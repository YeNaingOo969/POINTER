// Open / closed status from a place's openingHours, in Yangon time (Asia/Yangon, UTC+6:30),
// whatever the visitor's own clock is set to.
//
// openingHours: [{ day: 'mon' … 'sun', open: 'HH:MM', close: 'HH:MM' }] — one row per open day, as
//   stored in places.open_hours (JSON text). A day can have two rows (lunch break). A missing day is
//   closed; an empty list means the hours are not known. close '24:00' (or before open) runs past midnight.

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Current weekday index (0 = Sunday) and minutes since midnight in Yangon. */
function yangonNow(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Yangon', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { day: DAYS.indexOf(parts.weekday.toLowerCase()), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Is this row for weekday index `day` (0 = Sunday)? */
const isDay = (row, day) => DAYS.indexOf(row.day) === day;

/**
 * @returns {{ state: 'open' | 'closed' | 'unknown', until?: string, next?: string }}
 *   `until`: closing time while open; `next`: today's opening time while closed before it.
 */
export function openStatus(openingHours, now = new Date()) {
  if (!openingHours?.length) return { state: 'unknown' };
  const { day, minutes } = yangonNow(now);
  for (const row of openingHours) {
    const { open, close } = row;
    const start = toMinutes(open);
    let end = toMinutes(close);
    if (end <= start) end += 24 * 60; // runs past midnight
    if (isDay(row, day) && minutes >= start && minutes < end) return { state: 'open', until: close };
    // Opened yesterday and still running past midnight.
    if (end > 24 * 60 && isDay(row, (day + 6) % 7) && minutes < end - 24 * 60) return { state: 'open', until: close };
  }
  const laterToday = openingHours
    .filter((row) => isDay(row, day) && toMinutes(row.open) > minutes)
    .map(({ open }) => open)
    .sort()[0];
  return { state: 'closed', next: laterToday };
}

/** "10:00–20:00" for today in Yangon, or null when closed all day / unknown. */
export function todaysHours(openingHours, now = new Date()) {
  if (!openingHours?.length) return null;
  const { day } = yangonNow(now);
  const today = openingHours.filter((row) => isDay(row, day));
  return today.length ? today.map(({ open, close }) => `${open}–${close}`).join(', ') : null;
}

/**
 * Hours for each day of the week, Monday first: [{ day: 'mon', hours: '10:00–17:00' | null }],
 * plus which row is today in Yangon. null hours = closed that day. Empty input = not known.
 */
export function weekHours(openingHours, now = new Date()) {
  if (!openingHours?.length) return null;
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const today = DAYS[yangonNow(now).day];
  return order.map((day) => {
    const ranges = openingHours.filter((row) => isDay(row, DAYS.indexOf(day)));
    return {
      day,
      today: day === today,
      hours: ranges.length ? ranges.map(({ open, close }) => `${open}–${close}`).join(', ') : null,
    };
  });
}
