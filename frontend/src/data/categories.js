// The seven category groups from the scope document, shaped like the team's `categories` table
// (id, name_en, name_my, group_name). `group` is group_name: the short key the frontend uses for the
// group's colour and icon (--cat-* in src/styles/tokens.css). A shop that fits no group uses Other.

export const categories = [
  { id: 1, name: 'Food & drink', nameMy: 'စားသောက်ဆိုင်', group: 'food' },
  { id: 2, name: 'Stay', nameMy: 'တည်းခိုရန်', group: 'stay' },
  { id: 3, name: 'Places to visit', nameMy: 'လည်ပတ်စရာ', group: 'visit' },
  { id: 4, name: 'Shopping', nameMy: 'စျေးဝယ်ရန်', group: 'shop' },
  { id: 5, name: 'Health', nameMy: 'ကျန်းမာရေး', group: 'health' },
  { id: 6, name: 'Beauty & wellness', nameMy: 'အလှအပ', group: 'beauty' },
  { id: 7, name: 'Other', nameMy: 'အခြား', group: 'other' },
];
