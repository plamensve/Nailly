import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type Profile = { id: string; display_name: string; role: 'client' | 'artist'; avatar_url: string | null; city: string | null; bio: string };
export type Studio = { id: string; owner_id: string; name: string; city: string; address: string | null; bio: string; phone: string | null };
export type Look = { id: string; studio_id: string; title: string; image_url: string; storage_path: string | null; price_eur: number; studios: Studio };
export type Slot = { id: string; studio_id: string; starts_at: string; ends_at: string };
export type Booking = { id: string; studio_id: string; client_id: string; client_name: string; slot_id: string; look_id: string | null; starts_at: string; status: string; studios: Studio; portfolio_looks?: { id: string; title: string; image_url: string; price_eur: number } | null };
export type RatingSummary = { avg_rating: number | null; rating_count: number };
export type BookingRating = { id: string; booking_id: string; rater_id: string; target_type: 'studio' | 'client'; rating: number; comment: string };

export async function listLooks(): Promise<Look[]> {
  const { data, error } = await supabase.from('portfolio_looks').select('id,studio_id,title,image_url,storage_path,price_eur,studios(id,owner_id,name,city,address,bio,phone)').eq('published', true).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []) as unknown as Look[];
}
export async function looksByIds(ids: string[]): Promise<Look[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('portfolio_looks').select('id,studio_id,title,image_url,storage_path,price_eur,studios(id,owner_id,name,city,address,bio,phone)').eq('published', true).in('id', ids);
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
export async function replaceLookImage(look: Look, asset: ImagePicker.ImagePickerAsset) {
  if (!asset.base64) throw new Error('Could not read the selected image.');
  const file = `${look.studio_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error: uploadError } = await supabase.storage.from('portfolio').upload(file, decode(asset.base64), { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('portfolio').getPublicUrl(file);
  const { data: updated, error } = await supabase.from('portfolio_looks').update({ image_url: data.publicUrl, storage_path: file }).eq('id', look.id).select('id,studio_id,title,image_url,storage_path,price_eur,studios(id,owner_id,name,city,address,bio,phone)').single();
  if (error) {
    await supabase.storage.from('portfolio').remove([file]);
    throw error;
  }
  if (look.storage_path && look.storage_path !== file) await supabase.storage.from('portfolio').remove([look.storage_path]).catch(() => undefined);
  return updated as unknown as Look;
}
export async function updateLook(lookId: string, title: string, price: number) {
  const { data, error } = await supabase.from('portfolio_looks').update({ title: title.trim(), price_eur: price }).eq('id', lookId).select('id,studio_id,title,image_url,storage_path,price_eur,studios(id,owner_id,name,city,address,bio,phone)').single();
  if (error) throw error;
  return data as unknown as Look;
}
export async function getBookingRating(bookingId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('booking_ratings').select('id,booking_id,rater_id,target_type,rating,comment').eq('booking_id', bookingId).eq('rater_id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data as BookingRating | null;
}
export async function rateBooking(bookingId: string, targetType: 'studio' | 'client', rating: number, comment: string) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to leave a rating.');
  const { error } = await supabase.from('booking_ratings').upsert({ booking_id: bookingId, rater_id: auth.user.id, target_type: targetType, rating, comment: comment.trim() }, { onConflict: 'booking_id,rater_id' });
  if (error) throw error;
}
export async function getStudioRatings(studioIds: string[]): Promise<Record<string, RatingSummary>> {
  const uniqueIds = [...new Set(studioIds.filter(Boolean))];
  if (!uniqueIds.length) return {};
  const { data, error } = await supabase.rpc('studio_ratings_for_ids', { for_studios: uniqueIds });
  if (error) throw error;
  const result: Record<string, RatingSummary> = {};
  for (const row of data || []) {
    result[row.studio_id] = {
      avg_rating: row.avg_rating == null ? null : Number(row.avg_rating),
      rating_count: Number(row.rating_count || 0),
    };
  }
  return result;
}
export async function getStudioRating(studioId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.rpc('studio_rating', { for_studio: studioId }).single();
  if (error) throw error;
  return { avg_rating: data?.avg_rating == null ? null : Number(data.avg_rating), rating_count: Number(data?.rating_count || 0) };
}
export async function getClientRating(clientId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.rpc('client_rating', { for_client: clientId }).single();
  if (error) throw error;
  return { avg_rating: data?.avg_rating == null ? null : Number(data.avg_rating), rating_count: Number(data?.rating_count || 0) };
}
export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Account deletion failed.');
  await supabase.auth.signOut();
}
export function friendlyError(error: unknown) { return error instanceof Error ? error.message : String(error); }
