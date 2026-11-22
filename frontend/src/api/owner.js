// Shop owner features (flowcharts 3, 3a–3c in docs/flows): dashboard, posts, checking tickets at
// the counter, review replies, editing the place and renewing the subscription. Re-exported by
// api.js. Mock data lives in this browser (demo-store.js); each comment names the PHP endpoint.
import { USE_MOCK } from "./config.js";
import { mockResponse, mockError, request } from "./client.js";
import { readDemo, writeDemo } from "./demo-store.js";
import { places as placeRows } from "../data/places.js";
import { categories } from "../data/categories.js";
import { reviews as seedReviews } from "../data/reviews.js";
import { customerTickets, owners } from "../data/community.js";
import { allPosts, subscriptionFor, withEdits } from "./mock-shared.js";
import { postOut, ticketOut, SEED_USER_TICKETS } from "./community.js";

const DAY = 24 * 3600 * 1000;

function me() {
  const session = readDemo("session", null);
  if (!session)
    throw Object.assign(new Error("Login required"), { status: 401 });
  return session.user;
}

/** The logged-in owner's place (one business per user), or a 403. */
function myPlaceRow() {
  const user = me();
  const row = placeRows.find((p) => p.ownerId === user.id);
  if (!row)
    throw Object.assign(new Error("You have no shop yet"), { status: 403 });
  return withEdits(row);
}

/** Mock only: sign in as the owner of a demo shop (1 = Golden Bean Café … 5 = Pyay Road Pharmacy). */
export function loginDemoOwner(ownerId = 1) {
  const o = owners[ownerId];
  return mockResponse(
    writeDemo("session", { user: { id: o.id, name: o.name, role: "user" } }),
  );
}

function subscriptionOut(sub) {
  if (!sub) return null;
  const daysLeft = Math.ceil((new Date(sub.expiresAt) - Date.now()) / DAY);
  return {
    months: sub.months,
    startsAt: sub.startsAt,
    expiresAt: sub.expiresAt,
    active: daysLeft > 0,
    daysLeft: Math.max(0, daysLeft),
  };
}

/** Every ticket for my posts: customers' (seed) and ones taken in this browser. */
function ticketsForPlace(placeId) {
  const posts = allPosts()
    .filter((p) => p.placeId === placeId)
    .map((p) => p.id);
  const used = readDemo("usedTickets", {});
  return [...customerTickets, ...readDemo("tickets", SEED_USER_TICKETS)]
    .filter((t) => posts.includes(t.postId))
    .map((t) => ticketOut(usedAtOverride(t, used)));
}

/** A code used at the counter wins over the seed ticket's preset status. */
function usedAtOverride(ticket, used) {
  return used[ticket.code]
    ? { ...ticket, usedAt: used[ticket.code], status: "used" }
    : { ...ticket, usedAt: ticket.usedAt ?? null };
}

/**
 * Everything the owner dashboard shows.
 * GET /api/owner/dashboard.php → { place, subscription: { months, startsAt, expiresAt, active, daysLeft } | null,
 *   pending: OwnerUpgrade | null, stats: { posts, activeDeals, ticketsTaken, ticketsUsed, rating }, posts: Post[], reviews: Review[] }
 * 403 when the user has no approved place.
 */
export async function getOwnerDashboard() {
  if (!USE_MOCK) return request("owner/dashboard.php");
  const place = myPlaceRow();
  const posts = allPosts()
    .filter((p) => p.placeId === place.id)
    .map(postOut)
    .sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const replies = readDemo("ownerReplies", {});
  const reviews = [...readDemo("reviews", []), ...seedReviews]
    .filter((r) => r.placeId === place.id)
    .map((r) => ({ ...r, ownerReply: replies[r.id] ?? r.ownerReply ?? null }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tickets = ticketsForPlace(place.id);
  const pending =
    readDemo("renewals", []).find(
      (r) => r.userId === place.ownerId && r.status === "pending",
    ) ?? null;
  return mockResponse({
    place: {
      ...place,
      category: categories.find((c) => c.id === place.categoryId) ?? null,
    },
    subscription: subscriptionOut(subscriptionFor(place.ownerId)),
    pending,
    stats: {
      posts: posts.length,
      activeDeals: posts.filter((p) => p.type === "discount" && !p.ended)
        .length,
      ticketsTaken: tickets.length,
      ticketsUsed: tickets.filter((t) => t.status === "used").length,
      rating: place.rating,
    },
    posts,
    reviews,
  });
}

/**
 * New post. POST /api/owner/posts.php (multipart): type normal|discount, content, image?,
 * discountText, ticketLimit (1–500), expiresAt (ISO, in the future) — the last three for discounts.
 * → 201 Post · 422 invalid · 403 subscription not active
 */
export async function createPost(fields) {
  if (!USE_MOCK)
    return request("owner/posts.php", { method: "POST", form: fields });
  const place = myPlaceRow();
  const sub = subscriptionOut(subscriptionFor(place.ownerId));
  if (!sub?.active) return mockError("Your subscription is not active", 403);
  const error = checkPost(fields);
  if (error) return mockError(error, 422);
  const post = {
    id: Date.now(),
    placeId: place.id,
    type: fields.type,
    content: fields.content.trim(),
    imageUrl: null,
    discountText:
      fields.type === "discount" ? fields.discountText.trim() : null,
    ticketLimit: fields.type === "discount" ? Number(fields.ticketLimit) : null,
    expiresAt: fields.type === "discount" ? fields.expiresAt : null,
    isPinned: false,
    createdAt: new Date().toISOString(),
  };
  writeDemo("ownerPosts", [post, ...readDemo("ownerPosts", [])]);
  return mockResponse(postOut(post));
}

function checkPost(f) {
  if (!f.content?.trim() || f.content.trim().length > 1000)
    return "Write the post (up to 1000 characters)";
  if (f.type === "discount") {
    if (!f.discountText?.trim()) return "Say what the discount is";
    if (!(Number(f.ticketLimit) >= 1 && Number(f.ticketLimit) <= 500))
      return "Tickets: 1 to 500";
    if (!f.expiresAt || new Date(f.expiresAt) <= new Date())
      return "The end time must be in the future";
  }
  return null;
}

function ownPost(id) {
  const place = myPlaceRow();
  const post = allPosts().find((p) => p.id === Number(id));
  if (!post || post.placeId !== place.id)
    throw Object.assign(new Error("Not your post"), { status: 403 });
  return post;
}

/** PUT /api/owner/posts.php?id=101 { content, discountText, ticketLimit, expiresAt } → Post · 403 not yours · 422 */
export async function updatePost(id, fields) {
  if (!USE_MOCK)
    return request("owner/posts.php", {
      method: "PUT",
      query: { id },
      body: fields,
    });
  const post = ownPost(id);
  const error = checkPost({ ...post, ...fields });
  if (error) return mockError(error, 422);
  const edits = readDemo("postEdits", {});
  writeDemo("postEdits", {
    ...edits,
    [post.id]: { ...(edits[post.id] ?? {}), ...fields },
  });
  return mockResponse(postOut({ ...post, ...fields }));
}

/** PUT /api/owner/posts.php?id=101 { isPinned } → Post */
export function setPostPinned(id, isPinned) {
  return updatePost(id, { isPinned });
}

/** DELETE /api/owner/posts.php?id=101 → { deleted: true } (its tickets stay valid until they expire) */
export async function deletePost(id) {
  if (!USE_MOCK)
    return request("owner/posts.php", { method: "DELETE", query: { id } });
  const post = ownPost(id);
  writeDemo("postsDeleted", [...readDemo("postsDeleted", []), post.id]);
  return mockResponse({ deleted: true });
}

/**
 * Look up a ticket code at the counter (flowchart 3b) without using it.
 * GET /api/owner/ticket.php?code=GB-8X2M → { result: 'ok' | 'not_found' | 'other_shop' | 'used' | 'expired',
 *   ticket?: Ticket & { userName }, post?: Post }
 */
export async function checkTicket(code) {
  if (!USE_MOCK) return request("owner/ticket.php", { query: { code } });
  const place = myPlaceRow();
  const wanted = code.trim().toUpperCase();
  const used = readDemo("usedTickets", {});
  const raw = [
    ...customerTickets,
    ...readDemo("tickets", SEED_USER_TICKETS).map((t) => ({ ...t, userName: "Demo user" })),
  ].find((t) => t.code === wanted);
  if (!raw) return mockResponse({ result: "not_found" });
  const post = allPosts().find((p) => p.id === raw.postId);
  if (!post || post.placeId !== place.id)
    return mockResponse({ result: "other_shop" });
  const ticket = ticketOut(usedAtOverride(raw, used));
  const result = ticket.status === "active" ? "ok" : ticket.status;
  return mockResponse({ result, ticket, post: postOut(post) });
}

/**
 * Use a ticket: only for my post, active and less than 2 hours old.
 * POST /api/owner/ticket.php { code } → { result: 'used', ticket } · 409 { error: 'used' | 'expired' } · 404 · 403 other shop
 */
export async function confirmTicket(code) {
  if (!USE_MOCK)
    return request("owner/ticket.php", { method: "POST", body: { code } });
  const check = await checkTicket(code);
  if (check.result === "not_found")
    return mockError("No ticket with this code", 404);
  if (check.result === "other_shop")
    return mockError("This ticket is for another shop", 403);
  if (check.result !== "ok") return mockError(check.result, 409);
  const usedAt = new Date().toISOString();
  writeDemo("usedTickets", {
    ...readDemo("usedTickets", {}),
    [check.ticket.code]: usedAt,
  });
  return mockResponse({
    result: "used",
    ticket: { ...check.ticket, status: "used", usedAt },
  });
}

/**
 * Reply to a review of my place (owners can't delete reviews).
 * PUT /api/owner/review-reply.php?id=12 { reply } → Review (owner_reply set) · 403 not my place · 422 empty / > 600
 */
export async function replyToReview(reviewId, reply) {
  if (!USE_MOCK)
    return request("owner/review-reply.php", {
      method: "PUT",
      query: { id: reviewId },
      body: { reply },
    });
  myPlaceRow();
  const text = reply.trim();
  if (!text || text.length > 600)
    return mockError("Write a reply of up to 600 characters", 422);
  writeDemo("ownerReplies", {
    ...readDemo("ownerReplies", {}),
    [reviewId]: text,
  });
  return mockResponse({ id: reviewId, ownerReply: text });
}

/**
 * Edit my place. PUT /api/owner/place.php { description, phone, address, openingHours } → Place
 * (name, group and map pin changes go through the admin — not editable here.)
 */
export async function updateMyPlace(fields) {
  if (!USE_MOCK)
    return request("owner/place.php", { method: "PUT", body: fields });
  const place = myPlaceRow();
  if (!fields.description?.trim() || fields.description.trim().length < 10)
    return mockError("Describe your shop (10 characters or more)", 422);
  if (fields.phone && !/^[0-9+ ()-]{6,20}$/.test(fields.phone))
    return mockError("Check the phone number", 422);
  const address = fields.address?.trim() ?? place.address;
  if (address.length < 5 || address.length > 200)
    return mockError("Enter the street address (5–200 characters)", 422);
  const edits = readDemo("placeEdits", {});
  writeDemo("placeEdits", {
    ...edits,
    [place.id]: {
      description: fields.description.trim(),
      phone: fields.phone || null,
      address,
    },
  });
  return mockResponse({ ...place, ...fields });
}

/**
 * Renew: a new owner_upgrades row, checked by an admin (flowchart 4a).
 * POST /api/owner/renew.php (multipart) { months, amount, paymentMethod, paymentRef, proof } → 201 { id, status: 'pending', … }
 */
export async function renewSubscription(fields) {
  if (!USE_MOCK)
    return request("owner/renew.php", { method: "POST", form: fields });
  const user = me();
  myPlaceRow();
  if (!fields.paymentRef || fields.paymentRef.trim().length < 4)
    return mockError("Enter the transaction ID", 422);
  if (!fields.proof) return mockError("Add a screenshot of the payment", 422);
  const row = {
    id: Date.now(),
    userId: user.id,
    months: Number(fields.months),
    amount: Number(fields.amount),
    paymentMethod: fields.paymentMethod,
    paymentRef: fields.paymentRef.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  writeDemo("renewals", [
    row,
    ...readDemo("renewals", []).filter((r) => r.userId !== user.id),
  ]);
  return mockResponse(row);
}
