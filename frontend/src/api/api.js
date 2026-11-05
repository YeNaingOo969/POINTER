// The only module pages use to get or send data.
// Each function returns mock data while USE_MOCK is true; its comment names the PHP endpoint
// the backend should provide (see HANDOFF.md for the full contract).
import { USE_MOCK, ORS_API_KEY } from './config.js';
import { mockResponse, request } from './client.js';
import { orsRoute, previewRoute } from './routing.js';
import { readDemo, writeDemo } from './demo-store.js';
import { places } from '../data/places.js';
import { reviews } from '../data/reviews.js';

/** Mock only: crowd reports made in this browser replace the demo value. */
const withLocalCrowd = (place) => ({ ...place, crowd: readDemo('crowd', {})[place.id] ?? place.crowd });

function requireDemoUser() {
  const session = readDemo('session', null);
  if (!session) throw Object.assign(new Error('Login required'), { status: 401 });
  return session.user;
}

/**
 * All places shown on the Explore map.
 * GET /api/places.php → Place[]  (shape: src/data/places.js)
 */
export function getPlaces() {
  return USE_MOCK ? mockResponse(places.map(withLocalCrowd)) : request('places.php');
}

/**
 * One place by its slug.
 * GET /api/places.php?slug=shwedagon-pagoda → Place, or 404 { "error": "..." }
 */
export async function getPlace(slug) {
  if (!USE_MOCK) return request('places.php', { query: { slug } });
  const place = places.find((p) => p.slug === slug);
  if (!place) throw new Error(`Place not found: ${slug}`);
  return mockResponse(withLocalCrowd(place));
}

// ---- Session (login is simulated until the login page, M5) ----

/**
 * The logged-in user, or null for a visitor.
 * GET /api/session.php → { user: { id, name, role: 'user' | 'admin' } } or { user: null }
 */
export function getSession() {
  return USE_MOCK ? mockResponse(readDemo('session', { user: null })) : request('session.php');
}

/** Mock only: log in as a demo user (the real flow is POST /api/login.php from login.html). */
export function loginDemo() {
  return mockResponse(writeDemo('session', { user: { id: 999, name: 'Demo user', role: 'user' } }));
}

/** POST /api/logout.php */
export function logout() {
  return USE_MOCK ? mockResponse(writeDemo('session', null)) : request('logout.php', { method: 'POST' });
}

// ---- Reviews ----

/**
 * Reviews of one place, newest first.
 * GET /api/reviews.php?place_id=1 → Review[]  (shape: src/data/reviews.js)
 */
export function getReviews(placeId) {
  if (!USE_MOCK) return request('reviews.php', { query: { place_id: placeId } });
  const mine = readDemo('reviews', []).filter((r) => r.placeId === placeId);
  const all = [...mine, ...reviews.filter((r) => r.placeId === placeId)];
  return mockResponse(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

/**
 * Add a review (logged-in users). 401 when not logged in.
 * POST /api/reviews.php { placeId, rating: 1–5, text } → Review
 */
export async function addReview(placeId, { rating, text }) {
  if (!USE_MOCK) return request('reviews.php', { method: 'POST', body: { placeId, rating, text } });
  const user = requireDemoUser();
  const review = { id: Date.now(), placeId, user: { id: user.id, name: user.name }, rating, text, createdAt: new Date().toISOString() };
  writeDemo('reviews', [review, ...readDemo('reviews', [])]);
  return mockResponse(review);
}

// ---- Saves, check-ins, crowd reports ----

/**
 * The logged-in user's status for one place.
 * GET /api/my-place.php?place_id=1 → { saved: bool, checkedInAt: ISO string | null }
 */
export async function getMyPlace(placeId) {
  if (!USE_MOCK) return request('my-place.php', { query: { place_id: placeId } });
  if (!readDemo('session', null)) return mockResponse({ saved: false, checkedInAt: null });
  return mockResponse({
    saved: readDemo('saved', []).includes(placeId),
    checkedInAt: readDemo('checkins', {})[placeId] ?? null,
  });
}

/**
 * Save or unsave a place (logged-in users).
 * POST /api/saves.php { placeId } / DELETE /api/saves.php?place_id=1 → { saved }
 */
export async function setSaved(placeId, saved) {
  if (!USE_MOCK) {
    return saved
      ? request('saves.php', { method: 'POST', body: { placeId } })
      : request('saves.php', { method: 'DELETE', query: { place_id: placeId } });
  }
  requireDemoUser();
  const list = readDemo('saved', []).filter((id) => id !== placeId);
  writeDemo('saved', saved ? [...list, placeId] : list);
  return mockResponse({ saved });
}

/**
 * Check in at a place (logged-in users; Food Passport rules still to be agreed).
 * POST /api/checkins.php { placeId } → { checkedInAt }
 */
export async function checkIn(placeId) {
  if (!USE_MOCK) return request('checkins.php', { method: 'POST', body: { placeId } });
  requireDemoUser();
  const checkedInAt = new Date().toISOString();
  writeDemo('checkins', { ...readDemo('checkins', {}), [placeId]: checkedInAt });
  return mockResponse({ checkedInAt });
}

/**
 * Report how busy a place is right now (logged-in users).
 * POST /api/crowd-reports.php { placeId, level: 'low' | 'medium' | 'high' } → Place.crowd
 */
export async function reportCrowd(placeId, level) {
  if (!USE_MOCK) return request('crowd-reports.php', { method: 'POST', body: { placeId, level } });
  requireDemoUser();
  const current = withLocalCrowd(places.find((p) => p.id === placeId)).crowd;
  const crowd = { level, reportedAt: new Date().toISOString(), reports: (current?.reports ?? 0) + 1 };
  writeDemo('crowd', { ...readDemo('crowd', {}), [placeId]: crowd });
  return mockResponse(crowd);
}

/**
 * A route from `from` to `to` ([lng, lat] each) for 'walk' or 'car' (shape: src/api/routing.js).
 * With VITE_ORS_API_KEY in .env: OpenRouteService road routes with turn-by-turn steps.
 * Without: a straight-line preview estimate.
 * Optional later: GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk — a PHP proxy to
 * OpenRouteService so the key stays on the server; same response shape.
 */
export function getRoute(from, to, mode) {
  return ORS_API_KEY ? orsRoute(from, to, mode) : previewRoute(from, to, mode);
}
