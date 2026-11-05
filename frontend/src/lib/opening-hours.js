// Open / closed status from a place's openingHours, in Yangon time (Asia/Yangon, UTC+6:30),
// whatever the visitor's own clock is set to.
//
// openingHours: [{ days: 'mon-sun' | 'mon-sat' | 'tue' …, open: 'HH:MM', close: 'HH:MM' }]
//   An empty list means the hours are not known. close '24:00' (or before open) runs past midnight.

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

/** Does a 'mon-sat' style range (or a single day) include weekday `day`? */
function includesDay(range, day) {
  const [from, to = from] = range.split('-').map((d) => DAYS.indexOf(d));
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

/**
 * @returns {{ state: 'open' | 'closed' | 'unknown', until?: string, next?: string }}
 *   `until`: closing time while open; `next`: today's opening time while closed before it.
 */
export function openStatus(openingHours, now = new Date()) {
  if (!openingHours?.length) return { state: 'unknown' };
  const { day, minutes } = yangonNow(now);
  for (const { days, open, close } of openingHours) {
    const start = toMinutes(open);
    let end = toMinutes(close);
    if (end <= start) end += 24 * 60; // runs past midnight
    if (includesDay(days, day) && minutes >= start && minutes < end) return { state: 'open', until: close };
    // Opened yesterday and still running past midnight.
    if (end > 24 * 60 && includesDay(days, (day + 6) % 7) && minutes < end - 24 * 60) return { state: 'open', until: close };
  }
  const laterToday = openingHours
    .filter(({ days, open }) => includesDay(days, day) && toMinutes(open) > minutes)
    .map(({ open }) => open)
    .sort()[0];
  return { state: 'closed', next: laterToday };
}

/** "10:00–20:00" for today in Yangon, or null when closed all day / unknown. */
export function todaysHours(openingHours, now = new Date()) {
  if (!openingHours?.length) return null;
  const { day } = yangonNow(now);
  const today = openingHours.find(({ days }) => includesDay(days, day));
  return today ? `${today.open}–${today.close}` : null;
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
    const ranges = openingHours.filter(({ days }) => includesDay(days, DAYS.indexOf(day)));
    return {
      day,
      today: day === today,
      hours: ranges.length ? ranges.map(({ open, close }) => `${open}–${close}`).join(', ') : null,
    };
  });
}
