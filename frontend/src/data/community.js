// Mock posts, conversations and notifications synchronized with pointer_db MySQL database.

export const posts = [
  { id: 1, placeId: 25, type: 'discount', content: 'Hot afternoons call for iced milk tea. Show your POINTER ticket for 20% off any iced drink.', imageUrl: null, discountText: '20% off every iced drink', ticketLimit: 50, expiresAt: '2026-12-05T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T10:00:00+06:30' },
  { id: 2, placeId: 25, type: 'discount', content: 'Thingyan week special: A free crispy samosa with every bowl of mohinga before 10 AM.', imageUrl: null, discountText: 'Free samosa with mohinga before 10 AM', ticketLimit: 25, expiresAt: '2026-11-18T22:00:00+06:30', isPinned: false, createdAt: '2026-11-16T12:00:00+06:30' },
  { id: 3, placeId: 25, type: 'normal', content: 'New menu item: Warm steamed Shan tofu with chili oil and crispy shallots available every weekend!', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: '2026-11-17T08:30:00+06:30' },
  { id: 4, placeId: 20, type: 'discount', content: 'Specialty cold brew season: 25% discount on all cold brew and pour-over single origins.', imageUrl: null, discountText: '25% off all cold brew & pour-over', ticketLimit: 40, expiresAt: '2026-11-28T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T09:00:00+06:30' },
  { id: 5, placeId: 20, type: 'discount', content: 'Morning combo deal: Order any coffee and get 50% off our freshly baked homemade croissants.', imageUrl: null, discountText: '50% off croissants with coffee', ticketLimit: 30, expiresAt: '2026-11-19T12:00:00+06:30', isPinned: false, createdAt: '2026-11-16T14:00:00+06:30' },
  { id: 6, placeId: 20, type: 'normal', content: 'Our quiet second-floor co-working space now has high-speed fiber Wi-Fi and power outlets at every table.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: true, createdAt: '2026-11-17T09:00:00+06:30' },
  { id: 7, placeId: 22, type: 'discount', content: 'Our signature Danubyu Mohinga with crispy chickpea fritter: 1,000 Ks discount per bowl!', imageUrl: null, discountText: '1,000 Ks off Danubyu Mohinga', ticketLimit: 50, expiresAt: '2026-11-25T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T07:00:00+06:30' },
  { id: 8, placeId: 22, type: 'normal', content: 'Open early from 6:00 AM every single morning. Best hot breakfast in downtown Yangon!', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: '2026-11-17T06:00:00+06:30' },
  { id: 9, placeId: 21, type: 'discount', content: 'Weekday pampering: 20% discount on organic gel manicure and herbal foot spa pedicure combo.', imageUrl: null, discountText: '20% off Gel Mani & Pedi Combo', ticketLimit: 25, expiresAt: '2026-12-02T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T11:00:00+06:30' },
  { id: 10, placeId: 21, type: 'discount', content: 'Traditional Thanaka & herbal facial treatment: 15% off Monday to Thursday.', imageUrl: null, discountText: '15% off Thanaka Herbal Facial', ticketLimit: 15, expiresAt: '2026-11-22T23:59:59+06:30', isPinned: false, createdAt: '2026-11-16T15:00:00+06:30' },
  { id: 11, placeId: 21, type: 'normal', content: 'Imported OPI non-toxic nail polishes in 40+ new seasonal pastel shades have arrived.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: '2026-11-17T11:00:00+06:30' },
  { id: 12, placeId: 23, type: 'discount', content: 'Lake view staycation: 15,000 Ks discount per night when booking 2 consecutive nights.', imageUrl: null, discountText: '15,000 Ks off 2+ nights stay', ticketLimit: 12, expiresAt: '2026-12-10T23:59:59+06:30', isPinned: true, createdAt: '2026-11-15T16:00:00+06:30' },
  { id: 13, placeId: 23, type: 'discount', content: 'Complimentary breakfast overlooking Kandawgyi Lake on night two of your reservation.', imageUrl: null, discountText: 'Free lake-view breakfast on day 2', ticketLimit: 15, expiresAt: '2026-11-24T23:59:59+06:30', isPinned: false, createdAt: '2026-11-16T16:00:00+06:30' },
  { id: 14, placeId: 24, type: 'discount', content: 'Health week: Free blood-pressure & glucose check + 10% off multivitamins with ticket.', imageUrl: null, discountText: 'Free health check + 10% off vitamins', ticketLimit: 45, expiresAt: '2026-11-30T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T08:00:00+06:30' },
  { id: 15, placeId: 24, type: 'normal', content: 'Registered senior pharmacist is on-site daily from 8:00 AM to 10:00 PM for medical advice.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: '2026-11-17T08:00:00+06:30' },
  { id: 16, placeId: 26, type: 'discount', content: 'Family pantry deal: 1,500 Ks off a 5 kg premium Shwebo Pawsan rice bag.', imageUrl: null, discountText: '1,500 Ks off 5 kg Shwebo Pawsan', ticketLimit: 30, expiresAt: '2026-11-26T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T13:00:00+06:30' },
  { id: 17, placeId: 26, type: 'discount', content: 'Buy 2 large bottles of cooking oil, receive 1 packet of premium rice noodles free.', imageUrl: null, discountText: 'Free rice noodles with 2 cooking oils', ticketLimit: 20, expiresAt: '2026-11-21T23:59:59+06:30', isPinned: false, createdAt: '2026-11-16T17:00:00+06:30' },
  { id: 18, placeId: 26, type: 'normal', content: 'Cold beverages, fresh drinking water bottles, and dairy items restocked every morning at 8:00 AM.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: '2026-11-17T07:30:00+06:30' },
  { id: 19, placeId: 28, type: 'discount', content: 'Book lovers discount: 15% off all vintage Myanmar history books and hand-drawn city maps.', imageUrl: null, discountText: '15% off vintage books & maps', ticketLimit: 25, expiresAt: '2026-11-29T23:59:59+06:30', isPinned: true, createdAt: '2026-11-16T10:30:00+06:30' },
  { id: 20, placeId: 28, type: 'normal', content: 'Rare colonial-era postcards and restored Yangon architectural prints now on display in our gallery corner.', imageUrl: null, discountText: null, ticketLimit: null, expiresAt: null, isPinned: false, createdAt: '2026-11-17T10:00:00+06:30' },
  { id: 21, placeId: 20, type: 'discount', content: 'Past promotional offer: Free mini-cookie with any espresso.', imageUrl: null, discountText: 'Free cookie with espresso', ticketLimit: 20, expiresAt: '2026-11-10T18:00:00+06:30', isPinned: false, createdAt: '2026-11-05T09:00:00+06:30' },
];

/** Tickets count already taken towards limits in database */
export const takenElsewhere = {
  1: 6,
  2: 4,
  4: 5,
  5: 3,
  7: 6,
  9: 4,
  10: 3,
  12: 2,
  14: 3,
  16: 4,
  17: 2,
  19: 3,
};

/** Owner user id -> shop display info */
export const owners = {
  1: { id: 1, name: 'Golden Bean Café', placeId: 20 },
  2: { id: 2, name: 'Lotus Nail Spa', placeId: 21 },
  3: { id: 3, name: 'Shwe Mohinga Corner', placeId: 22 },
  4: { id: 4, name: 'Kandaw Lake Guesthouse', placeId: 23 },
  5: { id: 5, name: 'Pyay Road Pharmacy', placeId: 24 },
  7: { id: 7, name: 'Mya Tea House & Grocery', placeId: 25 },
  17: { id: 17, name: 'Yangon Heritage Books & Crafts', placeId: 28 },
};

/** Initial messages from database `messages` table for demo user (id 6) */
export const seedMessages = [
  { id: 1, senderId: 7, receiverId: 6, body: 'Hi! Thanks for saving Mya Tea House. Ask us anything about the menu.', status: 'accepted', isRead: true, createdAt: '2026-11-17T18:00:00+06:30' },
  { id: 2, senderId: 6, receiverId: 7, body: 'Thanks! Do you still have the palm-sugar latte?', status: 'accepted', isRead: true, createdAt: '2026-11-17T19:00:00+06:30' },
  { id: 3, senderId: 7, receiverId: 6, body: 'Yes, every day until 6 pm. Show your ticket for 20% off.', status: 'accepted', isRead: true, createdAt: '2026-11-17T20:00:00+06:30' },
  { id: 4, senderId: 1, receiverId: 6, body: 'Hello! Welcome to Golden Bean Café. Feel free to ask about our beans or reservations.', status: 'accepted', isRead: true, createdAt: '2026-11-18T08:00:00+06:30' },
  { id: 5, senderId: 6, receiverId: 1, body: 'Hi! Is the second-floor seating suitable for working with laptops?', status: 'accepted', isRead: true, createdAt: '2026-11-18T08:30:00+06:30' },
  { id: 6, senderId: 1, receiverId: 6, body: 'Yes, absolutely! We have power sockets and high-speed fiber Wi-Fi on every desk.', status: 'accepted', isRead: true, createdAt: '2026-11-18T08:45:00+06:30' },
  { id: 7, senderId: 6, receiverId: 2, body: 'Hi! Do I need to book in advance for the gel manicure deal on Saturday?', status: 'accepted', isRead: true, createdAt: '2026-11-18T09:10:00+06:30' },
  { id: 8, senderId: 2, receiverId: 6, body: 'Hello! Saturdays get quite busy, so booking 1 day ahead is recommended. What time works best for you?', status: 'accepted', isRead: true, createdAt: '2026-11-18T09:30:00+06:30' },
  { id: 9, senderId: 3, receiverId: 6, body: 'မင်္ဂလာပါ! ရွှေမုန့်ဟင်းခါးဆိုင်မှ ကြိုဆိုပါတယ်။ မနက် ၆ နာရီကနေ နေ့လယ် ၁ နာရီအထိ ဖွင့်ပါတယ်ခင်ဗျာ။', status: 'accepted', isRead: true, createdAt: '2026-11-18T07:00:00+06:30' },
  { id: 10, senderId: 6, receiverId: 3, body: 'ဟုတ်ကဲ့ပါ အကို။ ငါးဖယ် မုန့်ဟင်းခါး သီးသန့် ပါဆယ်မှာလို့ရပါသလားခင်ဗျ?', status: 'accepted', isRead: true, createdAt: '2026-11-18T07:20:00+06:30' },
  { id: 11, senderId: 3, receiverId: 6, body: 'ရပါတယ်ခင်ဗျာ။ ဘယ်အချိန်ယူယူ အဆင်သင့်ရအောင် ကြိုချိုင့်ထည့်ထားပေးပါမယ်။', status: 'accepted', isRead: true, createdAt: '2026-11-18T07:35:00+06:30' },
  { id: 12, senderId: 11, receiverId: 6, body: 'Hi! I noticed your review on Rangoon Tea House. Any specific curry you would recommend for visitors?', status: 'sent', isRead: true, createdAt: '2026-11-18T10:15:00+06:30' },
];

/** notifications rows from database */
export const seedNotifications = [
  { id: 1, type: 'new_deal', refId: 4, isRead: true, createdAt: '2026-11-18T09:00:00+06:30' },
  { id: 2, type: 'message', refId: 8, isRead: true, createdAt: '2026-11-18T09:30:00+06:30' },
  { id: 3, type: 'review_reply', refId: 28, isRead: true, createdAt: '2026-11-17T12:00:00+06:30' },
  { id: 4, type: 'new_deal', refId: 1, isRead: true, createdAt: '2026-11-16T10:00:00+06:30' },
  { id: 5, type: 'message', refId: 12, isRead: true, createdAt: '2026-11-18T10:15:00+06:30' },
];

/** owner_upgrades rows from database */
export const ownerUpgrades = [
  { id: 1, userId: 1, months: 3, amount: 30000, paymentMethod: 'KBZPay', paymentRef: 'KPAY-2026001', status: 'approved', startsAt: '2026-11-15T09:00:00+06:30', expiresAt: '2027-05-15T23:59:59+06:30' },
  { id: 2, userId: 2, months: 3, amount: 30000, paymentMethod: 'WavePay', paymentRef: 'WAVE-2026002', status: 'approved', startsAt: '2026-11-15T09:00:00+06:30', expiresAt: '2027-05-15T23:59:59+06:30' },
  { id: 3, userId: 3, months: 1, amount: 12000, paymentMethod: 'KBZPay', paymentRef: 'KPAY-2026003', status: 'approved', startsAt: '2026-11-15T09:00:00+06:30', expiresAt: '2027-08-15T23:59:59+06:30' },
  { id: 4, userId: 4, months: 12, amount: 100000, paymentMethod: 'KBZPay', paymentRef: 'KPAY-2026004', status: 'approved', startsAt: '2026-11-15T09:00:00+06:30', expiresAt: '2027-11-15T23:59:59+06:30' },
  { id: 5, userId: 5, months: 12, amount: 100000, paymentMethod: 'CBPay', paymentRef: 'CBPAY-2026005', status: 'approved', startsAt: '2026-11-15T09:00:00+06:30', expiresAt: '2027-11-15T23:59:59+06:30' },
  { id: 6, userId: 7, months: 12, amount: 100000, paymentMethod: 'Wave Pay', paymentRef: 'SEED-OWNER-001', status: 'approved', startsAt: '2026-11-07T11:31:12+06:30', expiresAt: '2027-11-07T23:59:59+06:30' },
  { id: 7, userId: 8, months: 3, amount: 30000, paymentMethod: 'KBZPay', paymentRef: 'SEED-PENDING-001', status: 'pending', startsAt: null, expiresAt: null },
  { id: 8, userId: 17, months: 1, amount: 12000, paymentMethod: 'KBZPay', paymentRef: 'KPAY-2026008', status: 'approved', startsAt: '2026-11-10T10:00:00+06:30', expiresAt: '2027-05-10T23:59:59+06:30' },
];

/** Other customer tickets from database `tickets` table */
export const customerTickets = [
  { id: 5, postId: 16, code: 'MG-H2NM', userName: 'Ko Zaw', createdAt: '2026-11-17T14:00:00+06:30', usedAt: '2026-11-17T15:30:00+06:30' },
  { id: 7, postId: 1, code: 'MT-9A1B', userName: 'Thiri Swe', createdAt: '2026-11-17T10:00:00+06:30', usedAt: null },
  { id: 8, postId: 1, code: 'MT-2C3D', userName: 'Min Khant', createdAt: '2026-11-17T15:00:00+06:30', usedAt: '2026-11-17T16:00:00+06:30' },
  { id: 18, postId: 4, code: 'GB-4Y5Z', userName: 'Sophie Martin', createdAt: '2026-11-17T14:30:00+06:30', usedAt: '2026-11-17T15:45:00+06:30' },
  { id: 25, postId: 7, code: 'SM-9N0P', userName: 'Min Khant', createdAt: '2026-11-17T07:30:00+06:30', usedAt: '2026-11-17T08:45:00+06:30' },
  { id: 30, postId: 9, code: 'LN-1Y2Z', userName: 'Thiri Swe', createdAt: '2026-11-17T14:00:00+06:30', usedAt: null },
  { id: 31, postId: 9, code: 'LN-3A4B', userName: 'Hnin Nu Wai', createdAt: '2026-11-17T16:00:00+06:30', usedAt: '2026-11-17T17:30:00+06:30' },
];

/** User id -> Name map */
export const people = {
  1: 'Ye Naing Oo',
  2: 'Lotus Spa Owner',
  3: 'Mohinga Corner Owner',
  4: 'Guesthouse Owner',
  5: 'Pharmacy Owner',
  6: 'Demo User',
  7: 'Mya Aung',
  8: 'Ko Zaw',
  9: 'Thiri Swe',
  10: 'Min Khant',
  11: 'Sophie Martin',
  12: 'Aung Paing',
  13: 'Hnin Nu Wai',
  14: 'Kyaw Zin Oo',
  15: 'Su Myat Noe',
  16: 'Ei Phyu Thin',
  17: 'Zaw Min Tun',
  18: 'Admin U Min Thant',
};
