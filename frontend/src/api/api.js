// The only module pages use to get or send data.
// Each function returns mock data while USE_MOCK is true; its comment names the PHP endpoint
// the backend should provide (see HANDOFF.md for the full contract).
import { USE_MOCK, ORS_API_KEY } from './config.js';
import { mockResponse, mockError, request, setCsrfToken } from './client.js';
import { orsRoute, previewRoute } from './routing.js';
import { readDemo, writeDemo } from './demo-store.js';
import { places as placeRows } from '../data/places.js';
import { categories } from '../data/categories.js';
import { reviews } from '../data/reviews.js';
import { isLive, subscriptionFor, withEdits } from './mock-shared.js';

function requireDemoUser() {
  const session = readDemo('session', null);
  if (!session) throw Object.assign(new Error('Login required'), { status: 401 });
  return session.user;
}

/** Mock only: join a place row with its category, the way places.php does it. */
const withCategory = ({ categoryId, ...p }) => ({ ...p, category: categories.find((c) => c.id === categoryId) ?? null });
const places = placeRows.map(withCategory);

/**
 * All places shown on the Explore map.
 * GET /api/places.php → Place[]  (shape: src/data/places.js, with `category` joined in)
 */
export function getPlaces() {
  if (!USE_MOCK) return request('places.php');
  // Shops whose owner the user blocked are left out (blocks.blocked_id = places.owner_id).
  const blocked = new Set(readDemo('blocks', []));
  return mockResponse(places.map(withEdits).filter((p) => isLive(p) && !blocked.has(p.ownerId)));
}

/**
 * One place by its id.
 * GET /api/places.php?id=1 → Place, or 404 { "error": "Place not found" }
 */
export async function getPlace(id) {
  if (!USE_MOCK) return request('places.php', { query: { id } });
  const place = places.find((p) => p.id === Number(id));
  if (!place) return mockError('Place not found', 404);
  return mockResponse(withEdits(place));
}

/**
 * The seven category groups, for filters and the business form.
 * GET /api/categories.php → [{ id, name, nameMy, group }]   (group: food | stay | visit | shop | health | beauty | other)
 */
export function getCategories() {
  return USE_MOCK ? mockResponse(categories) : request('categories.php');
}

// ---- Session, register, log in (login.html) ----

/** A place as other lists show it: just enough for a card and a link. */
const placeSummary = (p) => ({ id: p.id, name: p.name, address: p.address, category: p.category });

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
  return [...users, { id: 999, name: 'Demo user', email: DEMO_EMAIL, passwordHash: await mockHash(DEMO_PASSWORD), role: 'user' }];
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
  const user = { id: Date.now(), name, email: email.toLowerCase(), passwordHash: await mockHash(password), role: 'user' };
  writeDemo('users', [...users, user]);
  return mockResponse(writeDemo('session', { user: publicUser(user) }));
}

/**
 * Log in.
 * POST /api/login.php { email, password } → { user }
 * 401 { error: 'Wrong email or password' }
 */
export async function login({ email, password }) {
  if (!USE_MOCK) return request('login.php', { method: 'POST', body: { email, password } });
  const user = (await mockUsers()).find((u) => u.email === email.toLowerCase());
  if (!user || user.passwordHash !== await mockHash(password)) return mockError('Wrong email or password', 401);
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

// ---- My account (account.html) ----

/**
 * The logged-in user's saved places (favorites), newest first. 401 when not logged in.
 * GET /api/my-saves.php → [{ place: PlaceSummary }]   PlaceSummary = { id, name, address, category }
 */
export async function getMySaves() {
  if (!USE_MOCK) return request('my-saves.php');
  requireDemoUser();
  const list = readDemo('saved', []).map((id) => ({ place: placeSummary(places.find((p) => p.id === id)) }));
  return mockResponse(list.reverse());
}

/**
 * The logged-in user's reviews, newest first. 401 when not logged in.
 * GET /api/my-reviews.php → [Review & { place: PlaceSummary }]
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
  const replies = readDemo('ownerReplies', {});
  const all = [...mine, ...reviews.filter((r) => r.placeId === placeId)]
    .map((r) => (replies[r.id] ? { ...r, ownerReply: replies[r.id] } : r));
  return mockResponse(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

/**
 * Add a review (logged-in users). 401 when not logged in, 409 for a second review of a place,
 * 403 when the user owns the place (owners can't review their own shop).
 * POST /api/reviews.php { placeId, rating: 1–5, text } → 201 Review
 */
export async function addReview(placeId, { rating, text }) {
  if (!USE_MOCK) return request('reviews.php', { method: 'POST', body: { placeId, rating, text } });
  const user = requireDemoUser();
  if (places.find((p) => p.id === placeId)?.ownerId === user.id) return mockError("You can't review your own shop", 403);
  if (readDemo('reviews', []).some((r) => r.placeId === placeId && r.user.id === user.id)) {
    return mockError('You already reviewed this place', 409);
  }
  const review = { id: Date.now(), placeId, user: { id: user.id, name: user.name }, rating, text, createdAt: new Date().toISOString(), updatedAt: null, ownerReply: null };
  writeDemo('reviews', [review, ...readDemo('reviews', [])]);
  return mockResponse(review);
}

/**
 * Edit your own review (rating and text). 403 for someone else's review.
 * PUT /api/reviews.php?id=12 { rating: 1–5, text } → Review (with updatedAt)
 */
export async function updateReview(id, { rating, text }) {
  if (!USE_MOCK) return request('reviews.php', { method: 'PUT', query: { id }, body: { rating, text } });
  const user = requireDemoUser();
  const all = readDemo('reviews', []);
  const review = all.find((r) => r.id === id);
  if (!review || review.user.id !== user.id) return mockError('Not your review', 403);
  const updated = { ...review, rating, text, updatedAt: new Date().toISOString() };
  writeDemo('reviews', all.map((r) => (r.id === id ? updated : r)));
  return mockResponse(updated);
}

// ---- Business requests ("Add your business", business.html) ----

/**
 * Send an "Add your business" request (logged-in users, one business per user).
 * POST /api/business-requests.php  multipart/form-data:
 *   name, categoryId, description, phone, openingHours (JSON text), lat, lng, photo (shop front, image),
 *   months (1 | 3 | 12), amount, paymentMethod (KBZPay | Wave Pay | AYA Pay), paymentRef, proof (image)
 * Saves a places row (status 'pending', owner_id = user, storefront_photo) and an owner_upgrades row
 * (months, amount, payment_method, payment_ref, payment_proof, status 'pending').
 * → 201 { id, status: 'pending', ...fields, photoUrl, payment: { months, amount, method, status }, createdAt }
 * 409 when the user already has a business or a pending request · 422 invalid input
 */
export async function submitBusinessRequest(fields) {
  if (!USE_MOCK) return request('business-requests.php', { method: 'POST', form: fields });
  const user = requireDemoUser();
  const existing = readDemo('businessRequest', null);
  if (existing && existing.userId === user.id && existing.status !== 'rejected') {
    return mockError('You already have a business request', 409);
  }
  const { photo, proof, months, amount, paymentMethod, paymentRef, ...rest } = fields;
  const saved = {
    id: Date.now(), userId: user.id, status: 'pending', ...rest, photoName: photo?.name ?? null,
    payment: { months, amount, method: paymentMethod, ref: paymentRef, proofName: proof?.name ?? null, status: 'pending' },
    createdAt: new Date().toISOString(),
  };
  writeDemo('businessRequest', saved);
  return mockResponse(saved);
}

/**
 * The logged-in user's business request, or null.
 * GET /api/my-business-request.php → { id, status: 'pending' | 'active' | 'rejected' | 'hidden', name, …, reason? } | null
 * (= places.status; hidden = hidden by the admin or the plan ended)
 */
export async function getMyBusinessRequest() {
  if (!USE_MOCK) return request('my-business-request.php');
  const user = requireDemoUser();
  // Demo owners (users 1–5) already have an approved shop.
  const owned = places.find((p) => p.ownerId === user.id);
  if (owned) {
    const sub = subscriptionFor(user.id);
    return mockResponse({ id: owned.id, status: 'active', name: owned.name, categoryId: owned.category?.id, placeId: owned.id,
      subscription: sub && { months: sub.months, expiresAt: sub.expiresAt, active: new Date(sub.expiresAt) > new Date() } });
  }
  const r = readDemo('businessRequest', null);
  return mockResponse(r && r.userId === user.id ? r : null);
}

// ---- Saves ----

/**
 * The logged-in user's status for one place.
 * GET /api/my-place.php?place_id=1 → { saved: bool, reviewId: number | null }
 * reviewId = the user's own review of this place (so the page can offer "Edit your review").
 */
export async function getMyPlace(placeId) {
  if (!USE_MOCK) return request('my-place.php', { query: { place_id: placeId } });
  const session = readDemo('session', null);
  if (!session) return mockResponse({ saved: false, reviewId: null });
  const own = readDemo('reviews', []).find((r) => r.placeId === placeId && r.user.id === session.user.id);
  return mockResponse({ saved: readDemo('saved', []).includes(placeId), reviewId: own?.id ?? null });
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
 * A route from `from` to `to` ([lng, lat] each) for 'walk' or 'car' (shape: src/api/routing.js).
 * With VITE_ORS_API_KEY in .env: OpenRouteService road routes with turn-by-turn steps.
 * Without: a straight-line preview estimate.
 * Optional later: GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk — a PHP proxy to
 * OpenRouteService so the key stays on the server; same response shape.
 */
export function getRoute(from, to, mode) {
  return ORS_API_KEY ? orsRoute(from, to, mode) : previewRoute(from, to, mode);
}

// Phase 2 customer features: deals, tickets, messages, blocks, reports, notifications.
export * from './community.js';

// Phase 2 shop-owner features: dashboard, posts, tickets at the counter, replies, renewal.
export * from './owner.js';
