// Switch between mock data and the real PHP backend.
// Set USE_MOCK = true to run standalone without PHP/MySQL.
export const USE_MOCK = false;
export const API_BASE = '/api';

// Fake network delay for mock responses, so loading states get exercised.
export const MOCK_DELAY_MS = 250;

// OpenRouteService key for road routes, from .env (never commit it). Empty = straight-line previews.
export const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY ?? '';

// Optional Google OAuth Client ID fallback (primary config lives in config/auth.php via session.php).
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
