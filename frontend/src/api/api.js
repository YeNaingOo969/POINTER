// The only module pages use to get or send data.
// Each function returns mock data while USE_MOCK is true; its comment names the PHP endpoint
// the backend should provide (see HANDOFF.md for the full contract).
import { USE_MOCK } from './config.js';
import { mockResponse, mockError, request, setCsrfToken, hasCsrfToken } from './client.js';
import { getRoute as routedRoute } from './routing.js';
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

/** Mock only: accounts registered in this browser, plus database accounts. */
const DEMO_EMAIL = 'demo@pointer.app';
const DEMO_PASSWORD = 'pointer-demo';

const SEED_USERS = [
  { id: 1, name: 'Ye Naing Oo', email: 'yno@gmail.com', role: 'owner' },
  { id: 2, name: 'Lotus Spa Owner', email: 'owner2@pointer.mm', role: 'owner' },
  { id: 3, name: 'Mohinga Corner Owner', email: 'owner3@pointer.mm', role: 'owner' },
  { id: 4, name: 'Guesthouse Owner', email: 'owner4@pointer.mm', role: 'owner' },
  { id: 5, name: 'Pharmacy Owner', email: 'owner5@pointer.mm', role: 'owner' },
  { id: 6, name: 'Demo User', email: 'demo@pointer.app', role: 'user' },
  { id: 7, name: 'Mya Aung', email: 'owner@pointer.app', role: 'owner' },
  { id: 8, name: 'Ko Zaw', email: 'pending@pointer.app', role: 'user' },
  { id: 9, name: 'Thiri Swe', email: 'thiri@pointer.app', role: 'user' },
  { id: 10, name: 'Min Khant', email: 'minkhant@pointer.app', role: 'user' },
  { id: 11, name: 'Sophie Martin', email: 'sophie@pointer.app', role: 'user' },
  { id: 12, name: 'Aung Paing', email: 'aungpaing@pointer.app', role: 'user' },
  { id: 13, name: 'Hnin Nu Wai', email: 'hnin@pointer.app', role: 'user' },
  { id: 14, name: 'Kyaw Zin Oo', email: 'kyawzin@pointer.app', role: 'user' },
  { id: 15, name: 'Su Myat Noe', email: 'sumyat@pointer.app', role: 'user' },
  { id: 16, name: 'Ei Phyu Thin', email: 'eiphyu@pointer.app', role: 'user' },
  { id: 17, name: 'Zaw Min Tun', email: 'zawmin@pointer.app', role: 'owner' },
  { id: 18, name: 'Admin U Min Thant', email: 'admin@pointer.app', role: 'admin' },
];

async function mockUsers() {
  const users = readDemo('users', []);
  const commonHash = await mockHash(DEMO_PASSWORD);
  const seeded = SEED_USERS.map((u) => ({ ...u, passwordHash: commonHash }));
  const existingEmails = new Set(users.map((u) => u.email.toLowerCase()));
  return [...users, ...seeded.filter((s) => !existingEmails.has(s.email.toLowerCase()))];
}
const publicUser = ({ id, name, role }) => ({ id, name, role });

/**
 * The logged-in user, or null for a visitor, plus a CSRF token for later POST/DELETE requests.
 * GET /api/session.php → { user: { id, name, role: 'user' | 'admin' } | null, csrfToken }
 */
export async function getSession() {
  if (USE_MOCK) return mockResponse(readDemo('session', null) ?? { user: null });
  try {
    const session = await request('session.php');
    setCsrfToken(session.csrfToken);
    return session;
  } catch (err) {
    return { user: null, apiUnavailable: true };
  }
}

async function postAuth(path, body) {
  if (!hasCsrfToken()) {
    const session = await request('session.php').catch(() => null);
    if (session?.csrfToken) setCsrfToken(session.csrfToken);
  }
  try {
    return await request(path, { method: 'POST', body });
  } catch (err) {
    if (err.status === 403 && /csrf|security token/i.test(err.message || '')) {
      const session = await request('session.php').catch(() => null);
      if (session?.csrfToken) {
        setCsrfToken(session.csrfToken);
        return await request(path, { method: 'POST', body });
      }
    }
    throw err;
  }
}

/**
 * Send a 6-digit OTP verification code to the user's email before creating the account.
 * POST /api/register-otp.php { name, email, password, resend? } → { ok, delivery, devCode?, expiresIn, resendCooldown }
 * 409 { error: 'Email already registered' } · 422 { error } · 429 rate limit
 */
export async function sendRegisterOtp({ name = '', email, password = '', resend = false }) {
  if (!USE_MOCK) {
    return await postAuth('register-otp.php', { name, email, password, resend });
  }
  const normalized = email.toLowerCase();
  const users = await mockUsers();
  if (users.some((u) => u.email.toLowerCase() === normalized)) {
    return mockError('Email already registered', 409);
  }
  const existing = readDemo('pendingOtp', null);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const pending = {
    email: normalized,
    name: name || existing?.name || 'POINTER User',
    passwordHash: password ? await mockHash(password) : existing?.passwordHash,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  writeDemo('pendingOtp', pending);
  return mockResponse({ ok: true, delivery: 'dev_preview', devCode: code, expiresIn: 600, resendCooldown: 60 });
}

/**
 * Verify the 6-digit email OTP, create the account, and log in.
 * POST /api/register.php { email, code } → 201 { user }
 * 409 { error: 'Email already registered' } · 422 { error } for invalid/expired code
 */
export async function verifyRegisterOtp({ email, code }) {
  if (!USE_MOCK) {
    return await postAuth('register.php', { email, code });
  }
  const normalized = email.toLowerCase();
  const pending = readDemo('pendingOtp', null);
  if (!pending || pending.email !== normalized) return mockError('No pending verification found.', 422);
  if (pending.expiresAt < Date.now()) return mockError('Verification code has expired.', 422);
  if (pending.code !== String(code).trim()) return mockError('Incorrect verification code', 422);
  const users = await mockUsers();
  if (users.some((u) => u.email.toLowerCase() === normalized)) return mockError('Email already registered', 409);
  const user = { id: Date.now(), name: pending.name, email: normalized, passwordHash: pending.passwordHash, role: 'user' };
  writeDemo('users', [...readDemo('users', []), user]);
  writeDemo('pendingOtp', null);
  return mockResponse(writeDemo('session', { user: publicUser(user) }));
}

/**
 * Create an account and log in (compat wrapper / direct verified flow).
 * POST /api/register.php { email, code } → { user }
 */
export async function register({ name, email, password, code }) {
  if (code) return verifyRegisterOtp({ email, code });
  return sendRegisterOtp({ name, email, password });
}

/**
 * Sign in or register via Google Identity Services ID token.
 * POST /api/google-auth.php { credential } → { user }
 */
export async function googleLogin({ credential }) {
  if (!USE_MOCK) {
    return await postAuth('google-auth.php', { credential });
  }
  const user = { id: 999, name: 'Google Demo User', email: 'google.demo@gmail.com', role: 'user' };
  return mockResponse(writeDemo('session', { user: publicUser(user) }));
}

/**
 * Log in.
 * POST /api/login.php { email, password } → { user }
 * 401 { error: 'Wrong email or password' }
 */
export async function login({ email, password }) {
  if (!USE_MOCK) {
    return await postAuth('login.php', { email, password });
  }
  const user = (await mockUsers()).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.passwordHash !== await mockHash(password)) return mockError('Wrong email or password', 401);
  return mockResponse(writeDemo('session', { user: publicUser(user) }));
}

/** Mock only: one-click demo login from the "Log in to continue" dialog. */
export function loginDemo() {
  return mockResponse(writeDemo('session', { user: { id: 6, name: 'Demo User', role: 'user' } }));
}

/** POST /api/logout.php → { user: null } */
export async function logout() {
  writeDemo('session', null);
  if (!USE_MOCK) {
    try {
      await request('logout.php', { method: 'POST' });
    } catch {
      /* ignore backend failure on logout */
    }
  }
  return mockResponse({ user: null });
}

// ---- My account (account.html) ----

/**
 * The logged-in user's saved places (favorites), newest first. 401 when not logged in.
 * GET /api/my-saves.php → [{ place: PlaceSummary }]   PlaceSummary = { id, name, address, category }
 */
export async function getMySaves() {
  if (!USE_MOCK) {
    try {
      return await request('my-saves.php');
    } catch (err) {
      /* fallback to local store if backend unreachable */
    }
  }
  const user = requireDemoUser();
  const defaultSaves = [1, 7, 12, 17, 20, 25];
  const savedIds = readDemo('saved', defaultSaves);
  const list = savedIds
    .map((id) => places.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ place: placeSummary(p) }));
  return mockResponse(list.reverse());
}

/**
 * The logged-in user's reviews, newest first. 401 when not logged in.
 * GET /api/my-reviews.php → [Review & { place: PlaceSummary }]
 */
export async function getMyReviews() {
  if (!USE_MOCK) {
    try {
      return await request('my-reviews.php');
    } catch (err) {
      /* fallback to local store if backend unreachable */
    }
  }
  const user = requireDemoUser();
  const deleted = new Set(readDemo('reviewsDeleted', []));
  const added = readDemo('reviews', []);
  const allUserReviews = [...added, ...reviews.filter((r) => r.user.id === user.id)]
    .filter((r) => !deleted.has(r.id));
  const map = new Map();
  for (const r of allUserReviews) {
    if (!map.has(r.id)) map.set(r.id, r);
  }
  const list = [...map.values()]
    .map((r) => {
      const p = places.find((x) => x.id === r.placeId);
      return p ? { ...r, place: placeSummary(p) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mockResponse(list);
}

/**
 * Delete one of your own reviews. 403 for someone else's review.
 * DELETE /api/reviews.php?id=12 → { deleted: true }
 */
export async function deleteReview(id) {
  if (!USE_MOCK) {
    try {
      return await request('reviews.php', { method: 'DELETE', query: { id } });
    } catch (err) {
      if (err.status && err.status < 500) throw err;
    }
  }
  const user = requireDemoUser();
  const deleted = new Set(readDemo('reviewsDeleted', []));
  deleted.add(id);
  writeDemo('reviewsDeleted', [...deleted]);
  const all = readDemo('reviews', []);
  writeDemo('reviews', all.filter((r) => r.id !== id));
  return mockResponse({ deleted: true });
}

// ---- Reviews ----

/**
 * Reviews of one place, newest first.
 * GET /api/reviews.php?place_id=1 → Review[]  (shape: src/data/reviews.js, DB: reviews table)
 */
export function getReviews(placeId) {
  if (!USE_MOCK) return request('reviews.php', { query: { place_id: placeId } });
  const mine = readDemo('reviews', []).filter((r) => r.placeId === placeId);
  const replies = readDemo('ownerReplies', {});
  const all = [...mine, ...reviews.filter((r) => r.placeId === placeId)]
    .map((r) => {
      const withReply = replies[r.id] ? { ...r, ownerReply: replies[r.id] } : r;
      return { ...withReply, text: withReply.text || withReply.comment || '', comment: withReply.comment || withReply.text || '' };
    });
  return mockResponse(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

/**
 * Add a review (logged-in users). 401 when not logged in, 409 for a second review of a place,
 * 403 when the user owns the place (owners can't review their own shop).
 * POST /api/reviews.php { placeId, rating: 1–5, text, comment } → 201 Review
 */
export async function addReview(placeId, { rating, text, comment }) {
  const commentText = (comment !== undefined ? comment : text || '').trim();
  if (!USE_MOCK) return request('reviews.php', { method: 'POST', body: { placeId, rating, text: commentText, comment: commentText } });
  const user = requireDemoUser();
  if (places.find((p) => p.id === placeId)?.ownerId === user.id) return mockError("You can't review your own shop", 403);
  if (readDemo('reviews', []).some((r) => r.placeId === placeId && r.user.id === user.id)) {
    return mockError('You already reviewed this place', 409);
  }
  const review = {
    id: Date.now(),
    placeId,
    user: { id: user.id, name: user.name },
    rating,
    text: commentText,
    comment: commentText,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ownerReply: null
  };
  writeDemo('reviews', [review, ...readDemo('reviews', [])]);
  return mockResponse(review);
}

/**
 * Edit your own review (rating and text/comment). 403 for someone else's review.
 * PUT /api/reviews.php?id=12 { rating: 1–5, text, comment } → Review (with updatedAt)
 */
export async function updateReview(id, { rating, text, comment }) {
  const commentText = (comment !== undefined ? comment : text || '').trim();
  if (!USE_MOCK) return request('reviews.php', { method: 'PUT', query: { id }, body: { rating, text: commentText, comment: commentText } });
  const user = requireDemoUser();
  const all = readDemo('reviews', []);
  const review = all.find((r) => r.id === id);
  if (!review || review.user.id !== user.id) return mockError('Not your review', 403);
  const updated = { ...review, rating, text: commentText, comment: commentText, updatedAt: new Date().toISOString() };
  writeDemo('reviews', all.map((r) => (r.id === id ? updated : r)));
  return mockResponse(updated);
}

// ---- Business requests ("Add your business", business.html) ----

/**
 * Send an "Add your business" request (logged-in users, one business per user).
 * POST /api/business-requests.php  multipart/form-data:
 *   name, categoryId, description, phone, address, openingHours (JSON text), lat, lng, photo (shop front, image),
 *   months (1 | 3 | 6 | 12), amount, paymentMethod (KBZPay | Wave Pay | AYA Pay), paymentRef, proof (image)
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
  if (!USE_MOCK) {
    try {
      return await request('my-business-request.php');
    } catch {
      /* fallback to local store if backend unreachable */
    }
  }
  const user = requireDemoUser();
  // Demo owners (users 1–5, 7, 17) already have an approved shop.
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
  if (!USE_MOCK) {
    try {
      return await request('my-place.php', { query: { place_id: placeId } });
    } catch {
      /* fallback */
    }
  }
  const session = readDemo('session', null);
  if (!session) return mockResponse({ saved: false, reviewId: null });
  const defaultSaves = [1, 7, 12, 17, 20, 25];
  const own = readDemo('reviews', []).find((r) => r.placeId === placeId && r.user.id === session.user.id);
  return mockResponse({ saved: readDemo('saved', defaultSaves).includes(placeId), reviewId: own?.id ?? null });
}

/**
 * Save or unsave a place (logged-in users).
 * POST /api/saves.php { placeId } / DELETE /api/saves.php?place_id=1 → { saved }
 */
export async function setSaved(placeId, saved) {
  if (!USE_MOCK) {
    try {
      return await (saved
        ? request('saves.php', { method: 'POST', body: { placeId } })
        : request('saves.php', { method: 'DELETE', query: { place_id: placeId } }));
    } catch {
      /* fallback to local store */
    }
  }
  const user = requireDemoUser();
  const defaultSaves = [1, 7, 12, 17, 20, 25];
  const list = readDemo('saved', defaultSaves).filter((id) => id !== placeId);
  writeDemo('saved', saved ? [...list, placeId] : list);
  return mockResponse({ saved });
}

/**
 * A route from `from` to `to` ([lng, lat] each) for 'walk' or 'car' (shape: src/api/routing.js).
 * OpenRouteService when a key is configured, otherwise the keyless OSRM service — both give real
 * road routes with turn-by-turn steps. A dashed straight-line preview is the last-resort fallback.
 * Optional later: GET /api/route.php?from=lng,lat&to=lng,lat&mode=walk — a PHP proxy to
 * OpenRouteService so the key stays on the server; same response shape.
 */
export function getRoute(from, to, mode) {
  return routedRoute(from, to, mode);
}

// Phase 2 customer features: deals, tickets, messages, blocks, reports, notifications.
export * from './community.js';

// Phase 2 shop-owner features: dashboard, posts, tickets at the counter, replies, renewal.
export * from './owner.js';

// Phase 3 admin features: dashboard, applications, shops, categories, reports, users, audit log.
export * from './admin.js';

