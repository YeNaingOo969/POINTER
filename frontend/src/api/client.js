// Low-level helpers used by api.js. Pages never call these directly.
import { API_BASE, MOCK_DELAY_MS } from './config.js';

/** Resolve mock data after a short delay, returning a copy so callers can't mutate the source. */
export function mockResponse(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), MOCK_DELAY_MS);
  });
}

/** Call a PHP JSON endpoint, e.g. request('places.php', { query: { category: 'cafe' } }). */
export async function request(path, { method = 'GET', query, body } = {}) {
  const url = new URL(`${API_BASE}/${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (!res.ok) throw new Error(`API ${method} ${path} failed: ${res.status}`);
  return res.json();
}
