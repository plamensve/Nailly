import { supabase } from './supabase';

const baseUrl = process.env.EXPO_PUBLIC_MATCH_API_URL?.replace(/\/$/, '');
export function matchingConfigured() { return Boolean(baseUrl); }
async function bearer() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to use visual search.');
  return data.session.access_token;
}
export async function matchPhoto(base64: string): Promise<string[]> {
  if (!baseUrl) throw new Error('Visual search is not configured yet.');
  const response = await fetch(`${baseUrl}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await bearer()}` }, body: JSON.stringify({ image_base64: base64 }) });
  if (!response.ok) throw new Error(`Visual search returned ${response.status}`);
  const result = await response.json();
  return (result.results || []).map((item: { look_id: string }) => item.look_id);
}
export async function indexLook(lookId: string) {
  if (!baseUrl) return;
  const response = await fetch(`${baseUrl}/index/${lookId}`, { method: 'POST', headers: { Authorization: `Bearer ${await bearer()}` } });
  if (!response.ok) throw new Error(`Indexing returned ${response.status}`);
}
