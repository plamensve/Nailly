import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from './src/supabase';
import { Booking, friendlyError, listLooks, listSlots, Look, pickPortfolioImage, Slot, Studio, uploadLook } from './src/api';

const colors = { ink: '#452638', muted: '#877582', coral: '#ec817a', blush: '#fce8e4', canvas: '#fffaf7', edge: '#f2e6e3' };
const tabNames = ['Discover', 'Saved', 'Bookings', 'Profile'] as const;
type Tab = typeof tabNames[number];
const formatTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const message = (title: string, error: unknown) => Alert.alert(title, friendlyError(error));

function Button({ label, onPress, secondary, disabled }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondaryButton, disabled && { opacity: 0.5 }]}><Text style={[styles.buttonText, secondary && { color: colors.ink }]}>{label}</Text></Pressable>;
}
function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; secureTextEntry?: boolean; keyboardType?: 'email-address' | 'numeric' | 'default'; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#ad9ca5" secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} multiline={multiline} style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }]} /></View>;
}
function LookCard({ look, favorite, saved, onPress }: { look: Look; favorite: () => void; saved: boolean; onPress: () => void }) {
  return <Pressable style={styles.card} onPress={onPress}><Image source={{ uri: look.image_url }} style={styles.cardImage} /><Pressable style={styles.heart} onPress={favorite}><Text style={styles.heartText}>{saved ? '♥' : '♡'}</Text></Pressable><View style={styles.cardBody}><Text numberOfLines={1} style={styles.cardTitle}>{look.title}</Text><Text numberOfLines={1} style={styles.caption}>{look.studios.name}</Text><View style={styles.between}><Text style={styles.tiny}>⌖ {look.studios.city}</Text><Text style={styles.price}>€{look.price_eur}</Text></View></View></Pressable>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>('Discover');
  const [screen, setScreen] = useState<'home' | 'results' | 'look' | 'auth' | 'studio'>('home');
  const [looks, setLooks] = useState<Look[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [selected, setSelected] = useState<Look | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (userId?: string) => {
    try {
      const nextLooks = await listLooks(); setLooks(nextLooks); setError('');
      if (userId) {
        const [savedResult, bookingsResult, studioResult] = await Promise.all([
          supabase.from('saved_looks').select('look_id').eq('user_id', userId),
          supabase.from('bookings').select('id,studio_id,client_id,client_name,slot_id,starts_at,status,studios(id,owner_id,name,city,address,bio,phone)').order('starts_at', { ascending: false }),
          supabase.from('studios').select('id,owner_id,name,city,address,bio,phone').eq('owner_id', userId).maybeSingle(),
        ]);
        if (savedResult.error) throw savedResult.error;
        if (bookingsResult.error) throw bookingsResult.error;
        if (studioResult.error) throw studioResult.error;
        setSaved((savedResult.data || []).map(x => x.look_id));
        setBookings((bookingsResult.data || []) as unknown as Booking[]);
        setStudio(studioResult.data as Studio | null);
      } else { setSaved([]); setBookings([]); setStudio(null); }
    } catch (e) { setError(friendlyError(e)); }
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { refresh(session?.user.id); }, [session?.user.id, refresh]);
  useEffect(() => { if (selected) listSlots(selected.studio_id).then(setSlots).catch(e => setError(friendlyError(e))); }, [selected]);

  async function choosePhoto() { try { const asset = await pickPortfolioImage(); if (asset) { setPhoto(asset.uri); setTab('Discover'); setScreen('results'); } } catch (e) { message('Photo', e); } }
  async function toggleSaved(lookId: string) {
    if (!session) { setScreen('auth'); return; }
    const wasSaved = saved.includes(lookId);
    const query = wasSaved ? supabase.from('saved_looks').delete().eq('user_id', session.user.id).eq('look_id', lookId) : supabase.from('saved_looks').insert({ user_id: session.user.id, look_id: lookId });
    const { error: saveError } = await query;
    if (saveError) message('Could not save', saveError); else setSaved(current => wasSaved ? current.filter(id => id !== lookId) : [...current, lookId]);
  }
  async function requestBooking(slot: Slot) {
    if (!session || !selected) { setScreen('auth'); return; }
    setBusy(true);
    try {
      const { error: bookingError } = await supabase.from('bookings').insert({ client_id: session.user.id, studio_id: selected.studio_id, slot_id: slot.id, starts_at: slot.starts_at, client_name: session.user.user_metadata?.display_name || session.user.email || '', status: 'requested' });
      if (bookingError) throw bookingError;
      Alert.alert('Request sent', 'The studio can now confirm your appointment.');
      await refresh(session.user.id); setSlots(await listSlots(selected.studio_id)); setTab('Bookings'); setScreen('home');
    } catch (e) { message('Could not request this time', e); setSlots(await listSlots(selected.studio_id).catch(() => [])); } finally { setBusy(false); }
  }
  async function changeBooking(id: string, status: 'confirmed' | 'cancelled') {
    const { error: updateError } = await supabase.rpc('set_booking_status', { booking_id: id, next_status: status });
    if (updateError) message('Could not update booking', updateError); else await refresh(session?.user.id);
  }
  function selectTab(next: Tab) { setTab(next); setScreen('home'); refresh(session?.user.id); }
  const filteredLooks = looks.filter(look => [look.title, look.studios.name, look.studios.city].some(value => value.toLowerCase().includes(query.trim().toLowerCase())));
  const grid = (items: Look[]) => <View style={styles.grid}>{items.map(look => <LookCard key={look.id} look={look} saved={saved.includes(look.id)} favorite={() => toggleSaved(look.id)} onPress={() => { setSelected(look); setScreen('look'); }} />)}</View>;

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {screen !== 'home' && <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Back</Text></Pressable>}
    {screen === 'auth' ? <AuthScreen onDone={() => { setTab('Profile'); setScreen('home'); }} />
    : screen === 'studio' ? <StudioScreen session={session} studio={studio} looks={looks} bookings={bookings} onRefresh={() => refresh(session?.user.id)} />
    : screen === 'look' && selected ? <><Image source={{ uri: selected.image_url }} style={styles.heroImage} /><Text style={styles.eyebrow}>NAIL STUDIO · {selected.studios.city.toUpperCase()}</Text><Text style={styles.title}>{selected.studios.name}</Text><Text style={styles.body}>{selected.studios.bio || 'Discover the artist behind this look.'}</Text><View style={styles.pill}><Text style={styles.pillText}>✦ {selected.title}  ·  From €{selected.price_eur}</Text></View><Text style={styles.section}>Available appointments</Text>{slots.length ? slots.map(slot => <Pressable key={slot.id} style={styles.slot} onPress={() => requestBooking(slot)} disabled={busy}><Text style={styles.slotText}>{formatTime(slot.starts_at)}</Text><Text style={styles.link}>{busy ? 'Please wait' : 'Request →'}</Text></Pressable>) : <Text style={styles.body}>No free times listed yet.</Text>}{selected.studios.address && <Text style={styles.body}>⌖ {selected.studios.address}, {selected.studios.city}</Text>}</>
    : screen === 'results' ? <><Text style={styles.eyebrow}>YOUR INSPIRATION</Text><Text style={styles.title}>Find your look.</Text>{photo && <Pressable style={styles.uploaded} onPress={choosePhoto}><Image source={{ uri: photo }} style={styles.thumb} /><Text style={styles.cardTitle}>Your photo  ·  Change</Text></Pressable>}<Text style={styles.section}>Studio work</Text><Text style={styles.body}>Visual similarity ranking is in development. These are real studio designs, currently sorted by newest.</Text>{grid(looks)}</>
    : tab === 'Discover' ? <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.eyebrow}>YOUR NEXT NAIL MOMENT</Text><Text style={styles.headline}>Find the nails{'\n'}you love.</Text><Text style={styles.body}>From inspiration to the artist who can make it yours.</Text><Pressable style={styles.upload} onPress={choosePhoto}><Text style={styles.camera}>▧</Text><View><Text style={styles.cardTitle}>Upload inspiration</Text><Text style={styles.caption}>Choose a photo from your gallery</Text></View></Pressable><Text style={styles.section}>Explore nail looks</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search design, studio or city" placeholderTextColor="#ad9ca5" style={[styles.input, { marginBottom: 20 }]} />{looks.length ? grid(filteredLooks) : <Empty title="The gallery is growing" detail="Studios will appear here once they publish their first designs." />}</>
    : tab === 'Saved' ? <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.title}>Saved looks</Text>{!session ? <Button label="Sign in to save looks" onPress={() => setScreen('auth')} /> : saved.length ? grid(looks.filter(look => saved.includes(look.id))) : <Empty title="Your collection starts here" detail="Tap the heart on a nail look to save it." />}</>
    : tab === 'Bookings' ? <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.title}>Appointments</Text>{!session ? <Button label="Sign in to view bookings" onPress={() => setScreen('auth')} /> : bookings.filter(b => b.client_id === session.user.id).length ? bookings.filter(b => b.client_id === session.user.id).map(b => <View key={b.id} style={styles.panel}><Text style={styles.cardTitle}>{b.studios?.name || 'Nail studio'}</Text><Text style={styles.body}>{formatTime(b.starts_at)}  ·  {b.status}</Text>{b.status !== 'cancelled' && <Button label="Cancel request" secondary onPress={() => changeBooking(b.id, 'cancelled')} />}</View>) : <Empty title="Nothing booked yet" detail="Choose a studio and request an available time." />}</>
    : <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.title}>Your space</Text>{session ? <><Text style={styles.body}>{session.user.email}</Text><Button label={studio ? 'Manage your studio' : 'Create a studio'} onPress={() => setScreen('studio')} /><Button label="Sign out" secondary onPress={() => supabase.auth.signOut()} /></> : <><Empty title="Welcome to Nailly" detail="Sign in as a client or create an artist account to show your work." /><Button label="Sign in or create account" onPress={() => setScreen('auth')} /></>}</>}
    {!!error && <View style={styles.notice}><Text style={styles.noticeText}>Data connection: {error}</Text><Button label="Try again" secondary onPress={() => refresh(session?.user.id)} /></View>}
  </ScrollView><View style={styles.nav}>{tabNames.map((name, i) => <Pressable key={name} onPress={() => selectTab(name)} style={styles.navItem}><Text style={[styles.navIcon, tab === name && styles.active]}>{['⌕','♡','▤','◯'][i]}</Text><Text style={[styles.navLabel, tab === name && styles.active]}>{name}</Text></Pressable>)}</View></SafeAreaView>;
}

function Empty({ title, detail }: { title: string; detail: string }) { return <View style={styles.empty}><Text style={styles.emptyIcon}>✳</Text><Text style={styles.section}>{title}</Text><Text style={styles.body}>{detail}</Text></View>; }

function AuthScreen({ onDone }: { onDone: () => void }) {
  const [register, setRegister] = useState(false), [artist, setArtist] = useState(false), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  async function submit() {
    if (!email.trim() || password.length < 6 || (register && !name.trim())) { Alert.alert('Check your details', 'Enter a name, email and a password of at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (register) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim(), role: artist ? 'artist' : 'client' } } });
        if (error) throw error;
        if (!data.session) Alert.alert('Check your email', 'Confirm your email address, then sign in.'); else onDone();
      } else { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; onDone(); }
    } catch (e) { message('Account', e); } finally { setBusy(false); }
  }
  return <><Text style={styles.eyebrow}>WELCOME TO NAILLY</Text><Text style={styles.title}>{register ? 'Join Nailly' : 'Welcome back'}</Text><Text style={styles.body}>{register ? 'Find your next look or share your work with clients.' : 'Sign in to save looks and manage appointments.'}</Text>
    {register && <><Field label="Your name" value={name} onChangeText={setName} placeholder="Your name" /><Text style={styles.fieldLabel}>Account type</Text><View style={styles.choiceRow}><Pressable onPress={() => setArtist(false)} style={[styles.choice, !artist && styles.choiceActive]}><Text style={styles.choiceText}>Client</Text></Pressable><Pressable onPress={() => setArtist(true)} style={[styles.choice, artist && styles.choiceActive]}><Text style={styles.choiceText}>Nail artist / studio</Text></Pressable></View></>}
    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
    <Button label={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} onPress={submit} disabled={busy} /><Button label={register ? 'I already have an account' : 'Create a new account'} secondary onPress={() => setRegister(!register)} /></>;
}

function StudioScreen({ session, studio, looks, bookings, onRefresh }: { session: Session | null; studio: Studio | null; looks: Look[]; bookings: Booking[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState(studio?.name || ''), [city, setCity] = useState(studio?.city || ''), [address, setAddress] = useState(studio?.address || ''), [bio, setBio] = useState(studio?.bio || ''), [phone, setPhone] = useState(studio?.phone || '');
  const [title, setTitle] = useState(''), [price, setPrice] = useState(''), [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [busy, setBusy] = useState(false), [mySlots, setMySlots] = useState<Slot[]>([]);
  useEffect(() => { if (studio) supabase.from('availability_slots').select('id,studio_id,starts_at,ends_at').eq('studio_id', studio.id).gt('starts_at', new Date().toISOString()).order('starts_at').then(({ data }) => setMySlots(data || [])); }, [studio?.id]);
  async function saveStudio() {
    if (!session || !name.trim() || !city.trim()) return Alert.alert('Studio', 'Name and city are required.');
    setBusy(true);
    const payload = { name: name.trim(), city: city.trim(), address: address.trim() || null, bio: bio.trim(), phone: phone.trim() || null };
    const { error } = studio ? await supabase.from('studios').update(payload).eq('id', studio.id) : await supabase.from('studios').insert({ ...payload, owner_id: session.user.id });
    setBusy(false); if (error) message('Studio', error); else { Alert.alert('Saved', 'Your studio is ready.'); await onRefresh(); }
  }
  async function addLook() {
    if (!studio || !image || !title.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return Alert.alert('Portfolio', 'Add a photo, title and valid price in euros.');
    setBusy(true);
    try { await uploadLook(studio.id, title.trim(), Number(price), image); setImage(null); setTitle(''); setPrice(''); await onRefresh(); Alert.alert('Published', 'Your design is visible in Discover.'); } catch (e) { message('Upload failed', e); } finally { setBusy(false); }
  }
  async function addSlot() {
    if (!studio || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return Alert.alert('Time', 'Use YYYY-MM-DD and HH:mm.');
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime()) || start <= new Date()) return Alert.alert('Time', 'Choose a future date and time.');
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const { data, error } = await supabase.from('availability_slots').insert({ studio_id: studio.id, starts_at: start.toISOString(), ends_at: end.toISOString() }).select('id,studio_id,starts_at,ends_at').single();
    if (error) message('Could not add time', error); else { setMySlots(current => [...current, data as Slot].sort((a,b) => a.starts_at.localeCompare(b.starts_at))); setDate(''); setTime(''); }
  }
  async function updateBooking(id: string, status: 'confirmed' | 'cancelled') { const { error } = await supabase.rpc('set_booking_status', { booking_id: id, next_status: status }); if (error) message('Booking', error); else await onRefresh(); }
  return <><Text style={styles.eyebrow}>FOR ARTISTS</Text><Text style={styles.title}>{studio ? 'Manage studio' : 'Create your studio'}</Text><Field label="Studio name" value={name} onChangeText={setName} placeholder="Studio name" /><Field label="City" value={city} onChangeText={setCity} placeholder="Sofia" /><Field label="Address" value={address} onChangeText={setAddress} placeholder="Street and number" /><Field label="About your studio" value={bio} onChangeText={setBio} multiline placeholder="Tell clients about your work" /><Field label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="Contact number" /><Button label={busy ? 'Saving…' : 'Save studio'} onPress={saveStudio} disabled={busy} />
    {studio && <><Text style={styles.section}>Add a nail design</Text><Pressable style={styles.uploaded} onPress={async () => { try { setImage(await pickPortfolioImage()); } catch (e) { message('Photo', e); } }}>{image ? <Image source={{ uri: image.uri }} style={styles.thumb} /> : <Text style={styles.camera}>▧</Text>}<Text style={styles.cardTitle}>{image ? 'Change photo' : 'Choose a portfolio photo'}</Text></Pressable><Field label="Design name" value={title} onChangeText={setTitle} placeholder="e.g. Soft bloom" /><Field label="Starting price (€)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="45" /><Button label={busy ? 'Uploading…' : 'Publish design'} onPress={addLook} disabled={busy} />
      <Text style={styles.section}>Your portfolio</Text>{looks.filter(x => x.studio_id === studio.id).map(x => <View key={x.id} style={styles.slot}><Text style={styles.slotText}>{x.title}</Text><Text style={styles.price}>€{x.price_eur}</Text></View>)}
      <Text style={styles.section}>Add a free hour</Text><Text style={styles.body}>Times use your phone's local time zone. Each appointment is 60 minutes.</Text><Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-01" /><Field label="Time (HH:mm)" value={time} onChangeText={setTime} placeholder="14:30" /><Button label="Add availability" onPress={addSlot} />{mySlots.map(slot => <View style={styles.slot} key={slot.id}><Text style={styles.slotText}>{formatTime(slot.starts_at)}</Text><Pressable onPress={async () => { const { error } = await supabase.from('availability_slots').delete().eq('id', slot.id); if (error) message('Could not remove time', error); else setMySlots(current => current.filter(x => x.id !== slot.id)); }}><Text style={styles.link}>Remove</Text></Pressable></View>)}
      <Text style={styles.section}>Client requests</Text>{bookings.filter(x => x.studio_id === studio.id).map(b => <View key={b.id} style={styles.panel}><Text style={styles.cardTitle}>{formatTime(b.starts_at)} · {b.status}</Text><Text style={styles.caption}>{b.client_name}</Text>{b.status === 'requested' && <Button label="Confirm appointment" onPress={() => updateBooking(b.id, 'confirmed')} />}{['requested','confirmed'].includes(b.status) && <Button label="Cancel" secondary onPress={() => updateBooking(b.id, 'cancelled')} />}</View>)}</>}
  </>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 40 }, brand: { fontSize: 31, fontWeight: '800', color: colors.ink, letterSpacing: -1.5, marginBottom: 40 }, eyebrow: { color: colors.coral, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 }, headline: { fontFamily: 'Georgia', fontSize: 44, lineHeight: 51, color: colors.ink, marginBottom: 12 }, title: { fontFamily: 'Georgia', fontSize: 36, color: colors.ink, marginBottom: 16 }, section: { fontFamily: 'Georgia', fontSize: 23, color: colors.ink, marginTop: 28, marginBottom: 16 }, body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 20 },
  button: { backgroundColor: colors.coral, borderRadius: 16, padding: 17, alignItems: 'center', marginVertical: 6 }, secondaryButton: { backgroundColor: colors.blush }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  upload: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, padding: 17, borderRadius: 22, marginTop: 12, marginBottom: 12 }, camera: { backgroundColor: '#f6ccc6', borderRadius: 16, padding: 13, fontSize: 25, color: colors.ink, marginRight: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, card: { width: '48%', backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', marginBottom: 15, borderWidth: 1, borderColor: colors.edge }, cardImage: { width: '100%', height: 165, backgroundColor: colors.blush }, heart: { position: 'absolute', right: 9, top: 9, width: 33, height: 33, backgroundColor: 'white', borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, heartText: { color: colors.coral, fontSize: 23 }, cardBody: { padding: 11 }, cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 5 }, caption: { fontSize: 12, color: colors.muted }, between: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }, tiny: { fontSize: 11, color: colors.muted }, price: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.edge, backgroundColor: 'white', paddingVertical: 10 }, navItem: { flex: 1, alignItems: 'center' }, navIcon: { fontSize: 24, color: colors.muted }, navLabel: { fontSize: 10, color: colors.muted }, active: { color: colors.coral, fontWeight: '700' }, back: { fontSize: 16, color: colors.ink, marginBottom: 20 }, heroImage: { width: '100%', height: 290, borderRadius: 22, marginBottom: 23, backgroundColor: colors.blush }, pill: { backgroundColor: colors.blush, borderRadius: 17, padding: 15, marginBottom: 20 }, pillText: { color: colors.ink }, slot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 13, padding: 15, marginBottom: 8 }, slotText: { color: colors.ink, fontSize: 14, marginVertical: 4 }, link: { color: colors.coral, fontWeight: '700' }, uploaded: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, padding: 10, borderRadius: 18, marginBottom: 20 }, thumb: { width: 70, height: 70, borderRadius: 13, marginRight: 15 }, empty: { alignItems: 'center', backgroundColor: colors.blush, borderRadius: 24, padding: 30, marginTop: 20 }, emptyIcon: { color: colors.coral, fontSize: 45 }, panel: { backgroundColor: 'white', borderColor: colors.edge, borderWidth: 1, borderRadius: 17, padding: 16, marginVertical: 8 }, notice: { backgroundColor: colors.blush, padding: 15, borderRadius: 15, marginTop: 20 }, noticeText: { color: colors.ink }, field: { marginBottom: 15 }, fieldLabel: { color: colors.ink, fontWeight: '700', marginBottom: 7 }, input: { borderWidth: 1, borderColor: colors.edge, backgroundColor: 'white', borderRadius: 12, padding: 13, fontSize: 15, color: colors.ink }, choiceRow: { flexDirection: 'row', marginBottom: 20 }, choice: { padding: 12, backgroundColor: 'white', borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: colors.edge }, choiceActive: { backgroundColor: colors.blush, borderColor: colors.coral }, choiceText: { color: colors.ink },
});
