export async function api(path, body, method, headers) {
  const form = body instanceof FormData;
  const response = await fetch('/api' + path, {
    method: method || (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin',
    headers: {...(form ? {} : {'Content-Type': 'application/json'}), ...headers},
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Sorğu alınmadı (${response.status})`);
  }
  return response.json();
}

// Storage can be blocked (private mode, strict settings): the app keeps working without persistence.
export const storage = {
  get(key, area = 'localStorage') { try { return JSON.parse(window[area].getItem(key)); } catch { return null; } },
  set(key, value, area = 'localStorage') { try { value == null ? window[area].removeItem(key) : window[area].setItem(key, JSON.stringify(value)); } catch { /* not persisted */ } },
};

// crypto.randomUUID only exists on HTTPS/localhost; getRandomValues also works on plain http LAN addresses.
function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export const clientId = storage.get('transitClient') || (() => { const id = randomId(); storage.set('transitClient', id); return id; })();
