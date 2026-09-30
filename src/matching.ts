import { supabase } from './supabase';
import { parsePhotoMatches, PhotoMatch } from './similarity';

const baseUrl = process.env.EXPO_PUBLIC_MATCH_API_URL?.replace(/\/$/, '');
export function matchingConfigured() { return Boolean(baseUrl); }
async function bearer() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to use visual search.');
  return data.session.access_token;
}
export async function matchPhoto(base64: string): Promise<PhotoMatch[]> {
  if (!baseUrl) throw new Error('Photo search needs a running matching server. Set EXPO_PUBLIC_MATCH_API_URL and restart Expo.');
  const token = await bearer();
  const request = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);
    try {
      const response = await fetch(`${baseUrl}/search`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ image_base64: base64 }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === 'string' ? body.detail : `Visual search returned ${response.status}. Please try again.`);
      }
      const result = await response.json();
      return parsePhotoMatches(result.results);
    } finally { clearTimeout(timeout); }
  };
  try {
    return await request();
  } catch (firstError) {
    // A freshly started inference container can exceed the native networking timeout.
    // Retry once: the model/container is normally warm by the second request.
    const message = firstError instanceof Error ? firstError.message.toLowerCase() : '';
    const transient = message.includes('timed out') || message.includes('timeout') || message.includes('fetch failed') || message.includes('network request failed');
    if (!transient) throw firstError;
    await new Promise(resolve => setTimeout(resolve, 1200));
    try { return await request(); }
    catch (secondError) {
      const secondMessage = secondError instanceof Error ? secondError.message.toLowerCase() : '';
      if (secondMessage.includes('timed out') || secondMessage.includes('timeout') || secondMessage.includes('fetch failed') || secondMessage.includes('network request failed')) {
        throw new Error('The visual-search server is taking too long to respond. Please retry in a moment.');
      }
      throw secondError;
    }
  }
}
export type NailAttributes = {
  shape: string;
  length: string;
  style: string;
  finish: string;
  colors: string[];
};
export async function analyzeNails(base64: string): Promise<NailAttributes> {
  if (!baseUrl) throw new Error('AI analysis needs a running matching server.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await bearer()}` },
      body: JSON.stringify({ image_base64: base64 }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `AI analysis returned ${response.status}.`);
    const a = body?.attributes || {};
    return {
      shape: a.shape?.value || 'almond',
      length: a.length?.value || 'medium',
      style: a.style?.value || 'minimalist',
      finish: a.finish?.value || 'glossy',
      colors: Array.isArray(a.colors) ? a.colors.map((x: any) => x.value).filter(Boolean).slice(0, 2) : [],
    };
  } finally { clearTimeout(timeout); }
}
export async function indexLook(lookId: string) {
  if (!baseUrl) return;
  const response = await fetch(`${baseUrl}/index/${lookId}`, { method: 'POST', headers: { Authorization: `Bearer ${await bearer()}` } });
  if (!response.ok) throw new Error(`Indexing returned ${response.status}`);
}
