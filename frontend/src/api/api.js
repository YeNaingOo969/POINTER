// The only module pages use to get or send data.
// Each function returns mock data while USE_MOCK is true; its comment names the PHP endpoint
// the backend should provide (see HANDOFF.md for the full contract).
import { USE_MOCK, ORS_API_KEY } from './config.js';
import { mockResponse, mockError, request, setCsrfToken } from './client.js';
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

// ---- Session, register, log in (login.html) ----

/** A place as other lists show it: just enough for a card and a link. */
const placeSummary = (p) => ({ id: p.id, slug: p.slug, name: p.name, township: p.township, categoryId: p.categoryId });

/** Mock only: SHA-256 hex of a password, so the demo store never holds the plain text. The real
 *  backend uses PHP password_hash() / password_verify() instead. */
async function mockHash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mock only: accounts registered in this browser, plus one ready-made test account. */
const DEMO_EMAIL = 'demo@pointer.test';
const DEMO_PASSWORD = 'pointer-demo';
async function mockUsers() {
  const users = readDemo('users', []);
  if (users.some((u) => u.email === DEMO_EMAIL)) return users;
  return [...users, { id: 999, name: 'Demo user', email: DEMO_EMAIL, passwordHash: await mockHash(DEMO_PASSWORD), role: 'user', status: 'active' }];
}
const publicUser = ({ id, name, role }) => ({ id, name, role });

/**
 * The logged-in user, or null for a visitor, plus a CSRF token for later POST/DELETE requests.
 * GET /api/session.php → { user: { id, name, role: 'user' | 'admin' } | null, csrfToken }
 */
export async function getSession() {
  if (USE_MOCK) return mockResponse(readDemo('session', null) ?? { user: null });
  const session = await request('session.php');
  setCsrfToken(session.csrfToken);
  return session;
}

/**
 * Create an account and log in.
 * POST /api/register.php { name, email, password } → { user }
 * 409 { error: 'Email already registered' } · 422 { error } for invalid input
 */
export async function register({ name, email, password }) {
  if (!USE_MOCK) return request('register.php', { method: 'POST', body: { name, email, password } });
  const users = await mockUsers();
  if (users.some((u) => u.email === email.toLowerCase())) return mockError('Email already registered', 409);
  const user = { id: Date.now(), name, email: email.toLowerCase(), passwordHash: await mockHash(password), role: 'user', status: 'active' };
  writeDemo('users', [...users, user]);
  return mockResponse(writeDemo('session', { user: publicUser(user) }));
}

/**
 * Log in.
 * POST /api/login.php { email, password } → { user }
 * 401 { error: 'Wrong email or password' } · 403 { error: 'This account is suspended' }
 */
export async function login({ email, password }) {
  if (!USE_MOCK) return request('login.php', { method: 'POST', body: { email, password } });
  const user = (await mockUsers()).find((u) => u.email === email.toLowerCase());
  if (!user || user.passwordHash !== await mockHash(password)) return mockError('Wrong email or password', 401);
  if (user.status === 'suspended') return mockError('This account is suspended', 403);
  return mockResponse(writeDemo('session', { user: publicUser(user) }));
}

/** Mock only: one-click demo login from the "Log in to continue" dialog. */
export function loginDemo() {
  return mockResponse(writeDemo('session', { user: { id: 999, name: 'Demo user', role: 'user' } }));
}

/** POST /api/logout.php → { user: null } */
export function logout() {
  return USE_MOCK ? mockResponse(writeDemo('session', null) ?? { user: null }) : request('logout.php', { method: 'POST' });
}

// ---- My Passport (passport.html) ----

/**
 * The logged-in user's saved places, newest first. 401 when not logged in.
 * GET /api/my-saves.php → [{ place: { id, slug, name, township, categoryId }, savedAt }]
 */
export async function getMySaves() {
  if (!USE_MOCK) return request('my-saves.php');
  requireDemoUser();
  const times = readDemo('savedAt', {});
  const list = readDemo('saved', []).map((id) => ({ place: placeSummary(places.find((p) => p.id === id)), savedAt: times[id] ?? null }));
  return mockResponse(list.reverse());
}

/**
 * The logged-in user's check-in stamps, newest first. 401 when not logged in.
 * GET /api/my-checkins.php → [{ place: { id, slug, name, township, categoryId }, checkedInAt }]
 */
export async function getMyCheckIns() {
  if (!USE_MOCK) return request('my-checkins.php');
  requireDemoUser();
  const list = Object.entries(readDemo('checkins', {}))
    .map(([id, checkedInAt]) => ({ place: placeSummary(places.find((p) => p.id === Number(id))), checkedInAt }))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  return mockResponse(list);
}

/**
 * The logged-in user's reviews, newest first. 401 when not logged in.
 * GET /api/my-reviews.php → [Review & { place: { id, slug, name } }]
 */
export async function getMyReviews() {
  if (!USE_MOCK) return request('my-reviews.php');
  const user = requireDemoUser();
  const list = readDemo('reviews', [])
    .filter((r) => r.user.id === user.id)
    .map((r) => ({ ...r, place: placeSummary(places.find((p) => p.id === r.placeId)) }));
  return mockResponse(list);
}

/**
 * Delete one of your own reviews. 403 for someone else's review.
 * DELETE /api/reviews.php?id=12 → { deleted: true }
 */
export async function deleteReview(id) {
  if (!USE_MOCK) return request('reviews.php', { method: 'DELETE', query: { id } });
  const user = requireDemoUser();
  const all = readDemo('reviews', []);
  const review = all.find((r) => r.id === id);
  if (!review || review.user.id !== user.id) return mockError('Not your review', 403);
  writeDemo('reviews', all.filter((r) => r.id !== id));
  return mockResponse({ deleted: true });
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
 * Add a review (logged-in users). 401 when not logged in, 409 for a second review of a place.
 * POST /api/reviews.php { placeId, rating: 1–5, text } → 201 Review
 */
export async function addReview(placeId, { rating, text }) {
  if (!USE_MOCK) return request('reviews.php', { method: 'POST', body: { placeId, rating, text } });
  const user = requireDemoUser();
  if (readDemo('reviews', []).some((r) => r.placeId === placeId && r.user.id === user.id)) {
    return mockError('You already reviewed this place', 409);
  }
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
  const times = { ...readDemo('savedAt', {}) };
  if (saved) times[placeId] = new Date().toISOString(); else delete times[placeId];
  writeDemo('savedAt', times);
  return mockResponse({ saved });
}

/**
 * Check in at a place (logged-in users; Food Passport rules still to be agreed).
 * POST /api/checkins.php { placeId } → { checkedInAt }
 */
export async function checkIn(placeId) {
  if (!USE_MOCK) return request('checkins.php', { method: 'POST', body: { placeId } });
  requireDemoUser();
  const existing = readDemo('checkins', {});
  const checkedInAt = existing[placeId] ?? new Date().toISOString(); // one stamp per place
  writeDemo('checkins', { ...existing, [placeId]: checkedInAt });
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
