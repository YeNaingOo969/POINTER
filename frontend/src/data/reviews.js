// Mock reviews for the place detail page (milestone M3). DEMO data: fictional users and texts.
// Shape (proposed, see HANDOFF.md): text is whatever the user typed (plain string, any language).

export const reviews = [
  { id: 1, placeId: 1, user: { id: 11, name: 'Thiri' }, rating: 5, text: 'Came at sunset — the stupa really glows. Bring socks, the marble gets hot in the afternoon.', createdAt: '2026-10-28T18:20:00+06:30' },
  { id: 2, placeId: 1, user: { id: 12, name: 'Min Khant' }, rating: 5, text: 'ညနေပိုင်း မိသားစုနဲ့ လာတာ အရမ်းအေးချမ်းတယ်။ မီးထွန်းပွဲရက်မှာ ပိုလှတယ်။', createdAt: '2026-10-21T19:05:00+06:30' },
  { id: 3, placeId: 1, user: { id: 13, name: 'Sophie' }, rating: 4, text: 'Beautiful, but the south stairs were crowded. The east entrance was quieter.', createdAt: '2026-10-12T16:40:00+06:30' },
  { id: 4, placeId: 2, user: { id: 14, name: 'Aung Paing' }, rating: 4, text: 'Right in the middle of downtown — easy to combine with City Hall and the park.', createdAt: '2026-10-30T11:10:00+06:30' },
  { id: 5, placeId: 2, user: { id: 15, name: 'Hnin' }, rating: 5, text: 'ရုံးဆင်းချိန် ဝင်ဖူးတာ စိတ်အေးရတယ်။', createdAt: '2026-10-18T17:45:00+06:30' },
  { id: 6, placeId: 12, user: { id: 16, name: 'Kyaw Zin' }, rating: 4, text: 'Great for jade and longyi. Closed on Mondays, so plan ahead.', createdAt: '2026-10-25T13:30:00+06:30' },
  { id: 7, placeId: 12, user: { id: 17, name: 'Mai' }, rating: 3, text: 'Fun to walk around, but bargain — first prices are high.', createdAt: '2026-10-09T15:00:00+06:30' },
  { id: 8, placeId: 7, user: { id: 18, name: 'Ei Phyu' }, rating: 5, text: 'Kandawgyi boardwalk at golden hour with Karaweik in view — my favourite walk.', createdAt: '2026-10-27T17:50:00+06:30' },
];
