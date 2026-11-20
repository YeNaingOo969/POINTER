// Customer features of phase 2: posts and deals, tickets, messages, blocking, reports and
// notifications (flowcharts 2, 2a–2d in docs/flows). Re-exported by api.js, so pages keep importing
// from one place. While USE_MOCK is true everything is simulated in this browser (demo-store.js);
// each comment names the PHP endpoint and the tables behind it (HANDOFF.md has the full contract).
import { USE_MOCK } from './config.js';
import { mockResponse, mockError, request } from './client.js';
import { readDemo, writeDemo } from './demo-store.js';
import { places as placeRows } from '../data/places.js';
import { categories } from '../data/categories.js';
import { takenElsewhere, owners, seedMessages, seedNotifications, customerTickets, people } from '../data/community.js';
import { allPosts, isLive, withEdits } from './mock-shared.js';

const TICKET_HOURS = 2;
const HOUR = 3600 * 1000;

// ---- mock helpers ----

function me() {
  const session = readDemo('session', null);
  if (!session) throw Object.assign(new Error('Login required'), { status: 401 });
  return session.user;
}
const meOrNull = () => readDemo('session', null)?.user ?? null;
const placeById = (id) => withEdits(placeRows.find((p) => p.id === id));
const summary = (p) => ({
  id: p.id, name: p.name, address: p.address, ownerId: p.ownerId,
  category: categories.find((c) => c.id === p.categoryId) ?? null,
});

export const SEED_USER_TICKETS = [
  { id: 1, postId: 1, code: 'MT-7Q4K', status: 'active', createdAt: '2026-03-15T10:00:00+06:30', usedAt: null },
  { id: 2, postId: 4, code: 'GB-8X2M', status: 'active', createdAt: '2026-03-16T11:30:00+06:30', usedAt: null },
  { id: 3, postId: 7, code: 'SM-4K9P', status: 'used', createdAt: '2026-03-17T08:45:00+06:30', usedAt: '2026-03-17T09:15:00+06:30' },
  { id: 4, postId: 16, code: 'MG-3PX8', status: 'expired', createdAt: '2026-03-20T14:00:00+06:30', usedAt: null },
  { id: 49, postId: 17, code: 'MG-XT5N', status: 'active', createdAt: '2026-04-03T14:00:00+06:30', usedAt: null },
  { id: 50, postId: 10, code: 'LN-KN5S', status: 'active', createdAt: '2026-04-04T11:00:00+06:30', usedAt: null },
];

const blockedIds = () => {
  const user = meOrNull();
  const defaultBlocks = user?.id === 6 ? [8] : [];
  return new Set(readDemo('blocks', defaultBlocks));
};
const myTickets = () => {
  const user = meOrNull();
  const defaultTickets = user?.id === 6 ? SEED_USER_TICKETS : [];
  return readDemo('tickets', defaultTickets);
};

/** Ticket as the API returns it: status follows the 2-hour rule (tickets.created_at + 2 h) unless preset. */
export function ticketOut(t) {
  const expiresAt = t.expiresAt ?? new Date(new Date(t.createdAt).getTime() + TICKET_HOURS * HOUR).toISOString();
  let status = t.status;
  if (status === 'unused') status = 'active';
  if (!status) {
    status = t.usedAt ? 'used' : Date.now() > new Date(expiresAt).getTime() ? 'expired' : 'active';
  }
  return { ...t, status, expiresAt };
}

export function postOut(p) {
  const place = placeById(p.placeId);
  const mine = myTickets().filter((t) => t.postId === p.id).length;
  const seeded = customerTickets.filter((t) => t.postId === p.id).length;
  const taken = (takenElsewhere[p.id] ?? 0) + seeded + mine;
  return {
    ...p,
    place: summary(place),
    ticketsTaken: p.type === 'discount' ? taken : null,
    ticketsLeft: p.type === 'discount' ? Math.max(0, p.ticketLimit - taken) : null,
    ended: p.type === 'discount' && (new Date(p.expiresAt) < new Date() || taken >= p.ticketLimit),
  };
}

/** Posts a visitor may see: not from shops whose owner they blocked. */
const visiblePosts = () => allPosts().filter((p) => {
  const place = placeById(p.placeId);
  return isLive(place) && !blockedIds().has(place.ownerId);
});

// ---- posts and deals ----

/**
 * Active discount posts for the Deals page.
 * GET /api/deals.php?sort=ending|newest&group=food → Post[] (posts.type = 'discount', not expired,
 * ticket_limit not reached, place visible and its owner not blocked by the user)
 */
export function getDeals({ sort = 'ending', group = null } = {}) {
  if (!USE_MOCK) return request('deals.php', { query: { sort, group: group ?? undefined } });
  let list = visiblePosts().filter((p) => p.type === 'discount').map(postOut).filter((p) => !p.ended);
  if (group) list = list.filter((p) => p.place.category?.group === group);
  list.sort(sort === 'newest'
    ? (a, b) => b.createdAt.localeCompare(a.createdAt)
    : (a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return mockResponse(list);
}

/**
 * One post (a deal link from Home or a notification).
 * GET /api/posts.php?id=101 → Post · 404 { error: 'Post not found' }
 */
export function getPost(id) {
  if (!USE_MOCK) return request('posts.php', { query: { id } });
  const row = allPosts().find((p) => p.id === Number(id));
  return row ? mockResponse(postOut(row)) : mockError('Post not found', 404);
}

/**
 * A place's posts, pinned first, then newest (ended deals are left out).
 * GET /api/posts.php?place_id=20 → Post[]
 */
export function getPlacePosts(placeId) {
  if (!USE_MOCK) return request('posts.php', { query: { place_id: placeId } });
  const list = allPosts().filter((p) => p.placeId === Number(placeId)).map(postOut).filter((p) => !p.ended)
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt));
  return mockResponse(list);
}

/**
 * Home feed: newest posts from all shops and the deals ending soonest.
 * GET /api/home.php → { posts: Post[] (6), deals: Post[] (4) }
 */
export async function getHome() {
  if (!USE_MOCK) return request('home.php');
  const all = visiblePosts().map(postOut).filter((p) => !p.ended);
  return mockResponse({
    posts: [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    deals: all.filter((p) => p.type === 'discount').sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)).slice(0, 4),
  });
}

// ---- tickets ----

/**
 * The user's ticket for a deal, or null. Visitors get null.
 * GET /api/my-ticket.php?post_id=101 → Ticket | null
 */
export function getMyTicket(postId) {
  if (!USE_MOCK) return request('my-ticket.php', { query: { post_id: postId } });
  if (!meOrNull()) return mockResponse(null);
  const t = myTickets().find((x) => x.postId === Number(postId));
  return mockResponse(t ? ticketOut(t) : null);
}

/**
 * Take a ticket for a deal (one per user per post).
 * POST /api/tickets.php { postId } → 201 Ticket · 401 · 409 already has one · 410 deal ended / no tickets left
 * Ticket = { id, postId, code, status: active|used|expired, createdAt, expiresAt (= created_at + 2 h), usedAt }
 */
export async function takeTicket(postId) {
  if (!USE_MOCK) {
    try {
      return await request('tickets.php', { method: 'POST', body: { postId } });
    } catch (err) {
      if (err.status && err.status < 500) throw err;
    }
  }
  const user = me();
  const row = allPosts().find((p) => p.id === Number(postId));
  if (!row || row.type !== 'discount') return mockError('Post not found', 404);
  const current = myTickets();
  if (current.some((t) => t.postId === row.id)) return mockError('You already have a ticket for this deal', 409);
  if (postOut(row).ended) return mockError('This deal has ended', 410);
  const place = placeById(row.placeId);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const prefix = place.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const code = `${prefix}-${Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')}`;
  const ticket = { id: Date.now(), postId: row.id, code, status: 'unused', createdAt: new Date().toISOString(), usedAt: null };
  writeDemo('tickets', [ticket, ...current]);
  return mockResponse(ticketOut(ticket));
}

/**
 * All the user's tickets with their deal and shop, newest first.
 * GET /api/my-tickets.php → [Ticket & { post: Post }]
 */
export async function getMyTickets() {
  if (!USE_MOCK) {
    try {
      return await request('my-tickets.php');
    } catch {
      /* fallback */
    }
  }
  me();
  const posts = allPosts();
  return mockResponse(
    myTickets()
      .map((t) => {
        const row = posts.find((p) => p.id === t.postId);
        if (!row) return null;
        const shaped = postOut(row);
        return shaped?.place ? { ...ticketOut(t), post: shaped } : null;
      })
      .filter(Boolean)
  );
}

// ---- messages ----

function allMessages() {
  const user = me();
  const stored = readDemo('messages', null);
  if (stored) return stored;
  return writeDemo('messages', seedMessages.map((m) => ({ ...m, receiverId: m.receiverId === 'me' ? user.id : m.receiverId })));
}

/**
 * The user's conversations, newest first.
 * GET /api/conversations.php → [{ other: { id, name, placeId }, last: Message, unread, status: 'accepted' | 'request' }]
 */
export function getConversations() {
  if (!USE_MOCK) return request('conversations.php');
  const user = me();
  const byOther = new Map();
  for (const m of allMessages()) {
    const otherId = m.senderId === user.id ? m.receiverId : m.senderId;
    const list = byOther.get(otherId) ?? [];
    list.push(m);
    byOther.set(otherId, list);
  }
  const list = [...byOther.entries()].map(([otherId, msgs]) => {
    msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      other: owners[otherId] ?? { id: otherId, name: people[otherId] ?? `User ${otherId}`, placeId: null },
      last: msgs.at(-1),
      unread: msgs.filter((m) => m.receiverId === user.id && !m.isRead).length,
      status: msgs.some((m) => m.status === 'accepted') ? 'accepted' : 'request',
      blocked: blockedIds().has(otherId),
    };
  });
  return mockResponse(list.sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt)));
}

/**
 * Messages with one person (marks theirs as read).
 * GET /api/messages.php?with=1 → { other, status, blocked, messages: Message[] }
 * Message = { id, senderId, receiverId, body, status: 'request' | 'accepted', isRead, createdAt }
 */
export function getMessages(otherId) {
  if (!USE_MOCK) return request('messages.php', { query: { with: otherId } });
  const user = me();
  const id = Number(otherId);
  const all = allMessages().map((m) => (m.senderId === id && m.receiverId === user.id ? { ...m, isRead: true } : m));
  writeDemo('messages', all);
  const thread = all.filter((m) => (m.senderId === id && m.receiverId === user.id) || (m.senderId === user.id && m.receiverId === id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return mockResponse({
    other: owners[id] ?? { id, name: people[id] ?? `User ${id}`, placeId: null },
    status: thread.some((m) => m.status === 'accepted') ? 'accepted' : thread.length ? 'request' : 'new',
    blocked: blockedIds().has(id),
    messages: thread,
  });
}

/**
 * Send a message. The first one to someone you haven't talked to is a request until they accept.
 * POST /api/messages.php { to, body } → 201 Message · 403 { error: 'Blocked' } (either side) · 422 empty / > 1000 chars
 */
export async function sendMessage(to, body) {
  if (!USE_MOCK) return request('messages.php', { method: 'POST', body: { to, body } });
  const user = me();
  const id = Number(to);
  if (blockedIds().has(id)) return mockError('Blocked', 403);
  const text = body.trim();
  if (!text || text.length > 1000) return mockError('Write a message of up to 1000 characters', 422);
  const all = allMessages();
  const accepted = all.some((m) => m.status === 'accepted' && (m.senderId === id || m.receiverId === id));
  const msg = { id: Date.now(), senderId: user.id, receiverId: id, body: text, status: accepted ? 'accepted' : 'request', isRead: false, createdAt: new Date().toISOString() };
  writeDemo('messages', [...all, msg]);
  return mockResponse(msg);
}

/**
 * Accept a message request from someone (the receiver's side), so both can chat freely.
 * POST /api/messages.php { accept: userId } → { status: 'accepted' }
 */
export async function acceptMessageRequest(userId) {
  if (!USE_MOCK) return request('messages.php', { method: 'POST', body: { accept: userId } });
  const user = me();
  const id = Number(userId);
  writeDemo('messages', allMessages().map((m) => (
    (m.senderId === id && m.receiverId === user.id) || (m.senderId === user.id && m.receiverId === id) ? { ...m, status: 'accepted' } : m)));
  return mockResponse({ status: 'accepted' });
}

// ---- blocking and reports ----

/**
 * People and shop owners the user blocked.
 * GET /api/blocks.php → [{ user: { id, name, placeId } }]
 */
export async function getMyBlocks() {
  if (!USE_MOCK) {
    try {
      return await request('blocks.php');
    } catch {
      /* fallback */
    }
  }
  me();
  return mockResponse([...blockedIds()].map((id) => ({ user: owners[id] ?? { id, name: people[id] ?? `User ${id}`, placeId: null } })));
}

/**
 * Block or unblock a user. Blocking a shop = blocking its owner (blocks.blocked_id = places.owner_id):
 * their place, posts and deals disappear for this user and neither can message the other.
 * POST /api/blocks.php { userId } → { blocked: true } · DELETE /api/blocks.php?user_id=1 → { blocked: false }
 */
export async function setBlocked(userId, blocked) {
  if (!USE_MOCK) {
    try {
      return await (blocked
        ? request('blocks.php', { method: 'POST', body: { userId } })
        : request('blocks.php', { method: 'DELETE', query: { user_id: userId } }));
    } catch {
      /* fallback */
    }
  }
  me();
  const set = blockedIds();
  if (blocked) set.add(Number(userId)); else set.delete(Number(userId));
  writeDemo('blocks', [...set]);
  return mockResponse({ blocked });
}

/**
 * Report a place, post, review, user or message.
 * POST /api/reports.php { targetType: place|post|review|user|message, targetId, reason } → 201 { id, status: 'open' }
 */
export async function submitReport({ targetType, targetId, reason }) {
  if (!USE_MOCK) return request('reports.php', { method: 'POST', body: { targetType, targetId, reason } });
  me();
  if (!reason?.trim()) return mockError('Please say what is wrong', 422);
  const report = { id: Date.now(), targetType, targetId, reason: reason.trim(), status: 'open', createdAt: new Date().toISOString() };
  writeDemo('reports', [report, ...readDemo('reports', [])]);
  return mockResponse({ id: report.id, status: 'open' });
}

// ---- notifications ----

/**
 * The user's notifications, newest first, each with a link the page can open.
 * GET /api/notifications.php → [{ id, type, refId, isRead, createdAt }]
 * types: new_deal (ref = post id) · message (ref = message id) · review_reply (ref = review id) ·
 * request_approved / request_rejected (ref = place id) · renewal_reminder (ref = owner_upgrades id)
 */
export function getNotifications() {
  if (!USE_MOCK) return request('notifications.php');
  if (!meOrNull()) return mockResponse([]);
  const readIds = new Set(readDemo('notificationsRead', []));
  return mockResponse(seedNotifications.map((n) => ({ ...n, isRead: n.isRead || readIds.has(n.id) })));
}

/** POST /api/notifications.php { read: 'all' } → { ok: true } */
export function markNotificationsRead() {
  if (!USE_MOCK) return request('notifications.php', { method: 'POST', body: { read: 'all' } });
  writeDemo('notificationsRead', seedNotifications.map((n) => n.id));
  return mockResponse({ ok: true });
}
