// "Featured" places keep their name visible when the map is zoomed out and get a wider clear
// circle in the 3D city. The database has no flag for it, so the frontend decides: the places
// people review most.
const FEATURED_MIN_REVIEWS = 900;

export const isFeatured = (place) => (place.rating?.count ?? 0) >= FEATURED_MIN_REVIEWS;
