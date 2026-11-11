// Demo-only storage for simulated actions (login, reviews, saves, check-ins)
// while USE_MOCK is true. Lives in this browser's localStorage, never on a server; the real
// backend replaces every use of this file. Storage can be unavailable (private mode), so all
// access is guarded and the app keeps working, just without remembering.

const KEY = 'yg.demo';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* not remembered, fine for a demo */
  }
}

/** Read one top-level entry (e.g. 'session', 'reviews'). */
export function readDemo(name, fallback) {
  return load()[name] ?? fallback;
}

/** Replace one top-level entry; returns the new value. */
export function writeDemo(name, value) {
  const data = load();
  data[name] = value;
  save(data);
  return value;
}
