import { useStore } from '../store';

const BASE = '/api';

export function useApi() {
  const { apiKey, geminiKey } = useStore(s => ({ apiKey: s.apiKey, geminiKey: s.geminiKey }));

  async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(BASE + path, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function post<T>(path: string, body: any): Promise<T> {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, geminiKey, ...body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  return { get, post, apiKey, geminiKey };
}
