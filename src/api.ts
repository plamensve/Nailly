import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type Profile = { id: string; display_name: string; role: 'client' | 'artist'; avatar_url: string | null; city: string | null; bio: string };\nexport type Studio = { id: string; owner_id: string; name: string; city: string; address: string | null; bio: string; phone: string | null };
export type Look = { id: string; studio_id: string; title: string; image_url: string; price_eur: number; studios: Studio };
export type Slot = { id: string; studio_id: string; starts_at: string; ends_at: string };
export type Booking = { id: string; studio_id: string; client_id: string; client_name: string; slot_id: string; starts_at: string; status: string; studios: Studio };

export async function listLooks(): Promise<Look[]> {
  const { data, error } = await supabase.from('portfolio_looks').select('id,studio_id,title,image_url,price_eur,studios(id,owner_id,name,city,address,bio,phone)').eq('published', true).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []) as unknown as Look[];
}
export async function looksByIds(ids: string[]): Promise<Look[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('portfolio_looks').select('id,studio_id,title,image_url,price_eur,studios(id,owner_id,name,city,address,bio,phone)').eq('published', true).in('id', ids);
  if (error) throw error;
  const byId = new Map((data || []).map((look: any) => [look.id, look]));
  return ids.map(id => byId.get(id)).filter(Boolean) as Look[];
}
export async function listSlots(studioId: string): Promise<Slot[]> {
  const { data, error } = await supabase.rpc('available_slots', { for_studio: studioId });
  if (error) throw error;
  return (data || []) as Slot[];
}
export async function pickPortfolioImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access in iPhone Settings.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.72, base64: true });
  return result.canceled ? null : result.assets[0];
}
export async function uploadAvatar(userId: string, asset: ImagePicker.ImagePickerAsset) {
  if (!asset.base64) throw new Error('Could not read the selected profile photo.');
  const file = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(file, decode(asset.base64), { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('avatars').getPublicUrl(file);
  const { error } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
  if (error) { await supabase.storage.from('avatars').remove([file]); throw error; }
  return data.publicUrl;
}
export async function uploadLook(studioId: string, title: string, price: number, asset: ImagePicker.ImagePickerAsset) {
  if (!asset.base64) throw new Error('Could not read the selected image. Please choose a JPEG photo.');
  const file = `${studioId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error: uploadError } = await supabase.storage.from('portfolio').upload(file, decode(asset.base64), { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('portfolio').getPublicUrl(file);
  const { data: created, error } = await supabase.from('portfolio_looks').insert({ studio_id: studioId, title, price_eur: price, image_url: data.publicUrl, storage_path: file, published: true }).select('id').single();
  if (error) {
    await supabase.storage.from('portfolio').remove([file]);
    throw error;
  }
  return created.id as string;
}
export function friendlyError(error: unknown) { return error instanceof Error ? error.message : String(error); }
