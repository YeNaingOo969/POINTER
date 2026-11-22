// Switch between mock data and the real PHP backend.
// Backend team: set USE_MOCK to false and point API_BASE at your PHP endpoints (see HANDOFF.md).
export const USE_MOCK = true;
export const API_BASE = '/api';

// Fake network delay for mock responses, so loading states get exercised.
export const MOCK_DELAY_MS = 250;

// OpenRouteService key for road routes, from .env (never commit it). Empty = straight-line previews.
export const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY ?? '';
