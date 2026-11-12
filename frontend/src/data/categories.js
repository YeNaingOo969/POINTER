// The seven category groups from the scope document (2026-11-12), shaped like the team
// database's categories table (id, name, icon). `icon` is a short key the frontend uses for the
// group's colour and icon (see --cat-* in src/styles/tokens.css). A shop that fits no group uses Other.

export const categories = [
  { id: 1, name: 'Food & drink', icon: 'food' },
  { id: 2, name: 'Stay', icon: 'stay' },
  { id: 3, name: 'Places to visit', icon: 'visit' },
  { id: 4, name: 'Shopping', icon: 'shop' },
  { id: 5, name: 'Health', icon: 'health' },
  { id: 6, name: 'Beauty & wellness', icon: 'beauty' },
  { id: 7, name: 'Other', icon: 'other' },
];
