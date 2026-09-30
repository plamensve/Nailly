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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(`${baseUrl}/search`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ image_base64: base64 }) });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.detail === 'string' ? body.detail : `Visual search returned ${response.status}. Please try again.`);
    }
    const result = await response.json();
    return parsePhotoMatches(result.results);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Visual search timed out. Please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
export async function indexLook(lookId: string) {
  if (!baseUrl) return;
  const response = await fetch(`${baseUrl}/index/${lookId}`, { method: 'POST', headers: { Authorization: `Bearer ${await bearer()}` } });
  if (!response.ok) throw new Error(`Indexing returned ${response.status}`);
}
