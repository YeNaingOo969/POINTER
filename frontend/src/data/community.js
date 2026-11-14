// Mock posts, conversations and notifications for the customer pages (phase 2). DEMO data: the
// shops are the made-up demo businesses #20–#24 in places.js, the texts are invented.
// Times are relative to "now" so deals never look stale in a demo. Shapes = HANDOFF.md.

const HOUR = 3600 * 1000;
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR).toISOString();

/** posts rows: type 'normal' | 'discount'; discount posts have discountText, ticketLimit, expiresAt. */
export const posts = [
  { id: 101, placeId: 20, type: 'discount', content: 'Hot afternoons call for iced coffee. Show your POINTER ticket for 20% off any iced drink.', imageUrl: null, discountText: '20% off every iced coffee', ticketLimit: 50, expiresAt: at(30), isPinned: true, createdAt: at(-20) },
  { id: 102, placeId: 22, type: 'discount', content: 'Our mohinga is back with fresh fish cakes. First 30 bowls with a ticket: 1,000 Ks off.', imageUrl: null, discountText: '1,000 Ks off a bowl of mohinga', ticketLimit: 30, expiresAt: at(9), isPinned: false, createdAt: at(-6) },
  { id: 103, placeId: 21, type: 'discount', content: 'Thanaka facial + hand massage for weekday mornings.', imageUrl: null, discountText: '15% off the thanaka facial', ticketLimit: 20, expiresAt: at(70), isPinned: false, createdAt: at(-30) },
  { id: 104, placeId: 23, type: 'discount', content: 'Book two nights by the lake and the second breakfast is on us.', imageUrl: null, discountText: 'Free breakfast on night two', ticketLimit: 10, expiresAt: at(120), isPinned: false, createdAt: at(-50) },
  { id: 105, placeId: 24, type: 'discount', content: 'Free blood-pressure check with any purchase this week.', imageUrl: null, discountText: 'Free blood-pressure check', ticketLimit: 40, expiresAt: at(-3), isPinned: false, createdAt: at(-80) },
  { id: 106, placeId: 20, type: 'normal', content: 'New: palm-sugar latte with a pinch of sea salt. Ask for it at the counter!', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: at(-3) },
  { id: 107, placeId: 22, type: 'normal', content: 'Open from 6 am every day, also on public holidays.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: true, createdAt: at(-40) },
  { id: 108, placeId: 21, type: 'normal', content: 'We are closed on Sundays — see you Monday at 10.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: at(-12) },
  { id: 109, placeId: 23, type: 'normal', content: 'Rainy-season tip: ask us for an umbrella before you walk to Karaweik.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: at(-26) },
];

/** Tickets other people already took (counts towards ticket_limit). */
export const takenElsewhere = { 101: 12, 102: 26, 103: 4, 104: 6, 105: 7 };

/** Owner user id → display name (owners talk as their shop in messages). */
export const owners = {
  1: { id: 1, name: 'Golden Bean Café', placeId: 20 },
  2: { id: 2, name: 'Lotus Nail Spa', placeId: 21 },
  3: { id: 3, name: 'Shwe Mohinga Corner', placeId: 22 },
  4: { id: 4, name: 'Kandaw Lake Guesthouse', placeId: 23 },
  5: { id: 5, name: 'Pyay Road Pharmacy', placeId: 24 },
};

/** A first conversation every demo user starts with (already accepted by the shop). */
export const seedMessages = [
  { id: 1, senderId: 1, receiverId: 'me', body: 'Hi! Thanks for saving Golden Bean Café. Ask us anything about the menu.', status: 'accepted', isRead: false, createdAt: at(-5) },
];

/** notifications rows: type + refId (what it points to). */
export const seedNotifications = [
  { id: 1, type: 'new_deal', refId: 101, isRead: false, createdAt: at(-20) },
  { id: 2, type: 'message', refId: 1, isRead: false, createdAt: at(-5) },
  { id: 3, type: 'review_reply', refId: 19, isRead: true, createdAt: at(-48) },
];
