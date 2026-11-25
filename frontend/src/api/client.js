// Low-level helpers used by api.js. Pages never call these directly.
import { API_BASE, MOCK_DELAY_MS } from './config.js';

/** Resolve mock data after a short delay, returning a copy so callers can't mutate the source. */
export function mockResponse(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), MOCK_DELAY_MS);
  });
}

/** A failed request: `message` is the server's `{ "error": "..." }` text, `status` the HTTP code. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Mock helper: reject the way the real API would, after the same short delay. */
export function mockError(message, status) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new ApiError(message, status)), MOCK_DELAY_MS);
  });
}

// CSRF token from GET /api/session.php; sent as X-CSRF-Token on every non-GET request.
let csrfToken = null;
export const setCsrfToken = (token) => { csrfToken = token ?? null; };
export const hasCsrfToken = () => Boolean(csrfToken);

/**
 * Call a PHP JSON endpoint, e.g. request('places.php', { query: { id: 1 } }).
 * `body` is sent as JSON; `form` (an object, may hold File values) as multipart/form-data for
 * uploads — objects and arrays inside it are sent as JSON text.
 */
export async function request(path, { method = 'GET', query, body, form } = {}) {
  const url = new URL(`${API_BASE}/${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, value);
    }
  }

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  let payload = body ? JSON.stringify(body) : undefined;
  if (form) {
    payload = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (value == null) continue;
      payload.append(key, value instanceof Blob || typeof value !== 'object' ? value : JSON.stringify(value));
    }
  }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch(url, {
    method,
    headers,
    body: payload,
    credentials: 'same-origin',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.error ?? `API ${method} ${path} failed: ${res.status}`, res.status);
  }
  return res.json();
}
