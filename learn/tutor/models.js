// Which AI model the tutor talks to, and how it gets in. Two ways, the first that works:
//   1. a key a grown-up pasted into the tutor's settings: kept in this browser only
//      (localStorage), sent straight to Anthropic or OpenAI;
//   2. the dev server: started with RADIUS_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY set,
//      tools/serve.py passes requests on under /llm/<provider>/ and adds the key, so the browser
//      never sees it.
// Radius (the pi.dev gateway) does not answer browsers directly, so its requests always go through
// the dev server; a pasted Radius key travels with them and the server passes it on.
import { createModels, anthropicProvider, openaiProvider, radiusProvider } from '../../vendor/pi-durable/pi-durable.js';

export const PROVIDERS = {
  radius: { name: 'Radius', make: radiusProvider, proxy: '/llm/radius/v1', viaServer: true, default: 'claude-sonnet-5-5',
    suggested: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'gpt-6-sol', 'gpt-6-luna'] },
  anthropic: { name: 'Anthropic', make: anthropicProvider, proxy: '/llm/anthropic', default: 'claude-sonnet-5-5',
    suggested: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'] },
  openai: { name: 'OpenAI', make: openaiProvider, proxy: '/llm/openai/v1', default: 'gpt-6-sol',
    suggested: ['gpt-6-sol', 'gpt-6-luna'] },
};

const KEY = 'kids.tutor.';
const get = k => { try { return localStorage.getItem(KEY + k) ?? ''; } catch { return ''; } };
const set = (k, v) => { try { if (v) localStorage.setItem(KEY + k, v); else localStorage.removeItem(KEY + k); } catch { /* private mode */ } };
export const storedKey = id => get('key.' + id);
export const setStoredKey = (id, key) => set('key.' + id, key.trim());

let server = null;
// the providers the dev server has a key for
export function serverProviders() {
  return server ??= fetch(new URL('/llm/providers', location.href)).then(r => r.ok ? r.json() : []).then(l => Array.isArray(l) ? l : []).catch(() => []);
}
export async function available() {
  const s = await serverProviders();
  return Object.keys(PROVIDERS).filter(id => storedKey(id) || s.includes(id));
}

// the chosen model: { provider, modelId }, or null when no provider can be reached
export async function chosenModel() {
  const ok = await available();
  const provider = ok.includes(get('provider')) ? get('provider') : ok[0];
  if (!provider) return null;
  const modelId = get('model.' + provider) || PROVIDERS[provider].default;
  return { provider, modelId };
}
export const choose = (provider, modelId) => { set('provider', provider); if (modelId) set('model.' + provider, modelId); };

export function tutorModels(extra = []) {
  const models = createModels();
  for (const [id, P] of Object.entries(PROVIDERS)) {
    const base = P.make();
    models.setProvider({
      ...base,
      auth: { apiKey: { name: `${P.name} (learn tutor)`, resolve: async () => {
        const key = storedKey(id);
        if (key && P.viaServer) return { auth: { apiKey: key, baseUrl: new URL(P.proxy, location.href).href }, source: 'this browser, through the dev server' };
        if (key) return { auth: { apiKey: key }, source: 'this browser' };
        if ((await serverProviders()).includes(id)) return { auth: { apiKey: 'added-by-dev-server', baseUrl: new URL(P.proxy, location.href).href }, source: 'dev server' };
        return undefined;
      } } },
    });
  }
  for (const p of extra) models.setProvider(p);
  return models;
}

// the chat models a provider offers, the suggested ones first
export function modelList(models, provider) {
  const all = models.getModels(provider).map(m => m.id);
  const sug = PROVIDERS[provider]?.suggested ?? [];
  return [...sug.filter(id => all.includes(id) || !all.length), ...all.filter(id => !sug.includes(id)).sort()];
}
