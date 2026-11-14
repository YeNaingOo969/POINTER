// Mock only: the rules the PHP backend applies everywhere, shared by api.js, community.js and
// owner.js so customers and owners see the same demo world (see docs/flows/README.md).
import { readDemo } from './demo-store.js';
import { posts as postRows, ownerUpgrades } from '../data/community.js';

/** Posts as they are now: seed posts + ones an owner made in this browser, with edits, minus deleted. */
export function allPosts() {
  const edits = readDemo('postEdits', {});
  const deleted = new Set(readDemo('postsDeleted', []));
  return [...readDemo('ownerPosts', []), ...postRows]
    .filter((p) => !deleted.has(p.id))
    .map((p) => ({ ...p, ...(edits[p.id] ?? {}) }));
}

/** The owner's latest approved owner_upgrades row (seed or a renewal approved in this browser). */
export function subscriptionFor(ownerId) {
  const rows = [...ownerUpgrades, ...readDemo('upgrades', [])]
    .filter((u) => u.userId === ownerId && u.status === 'approved')
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
  return rows[0] ?? null;
}

/** Visible on the map, search, Home and Deals: public places always; shops while paid up. */
export function isLive(place) {
  if (place.ownerId == null) return true;
  const sub = subscriptionFor(place.ownerId);
  return Boolean(sub && new Date(sub.expiresAt) > new Date());
}

/** A place row with the owner's edits made in this browser. */
export function withEdits(place) {
  return { ...place, ...(readDemo('placeEdits', {})[place.id] ?? {}) };
}
