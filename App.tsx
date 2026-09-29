import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from './src/supabase';
import { indexLook, matchPhoto, matchingConfigured } from './src/matching';
import { Booking, deleteMyAccount, friendlyError, getBookingRating, getClientRating, getStudioRating, listLooks, listSlots, looksByIds, Look, pickPortfolioImage, Profile, rateBooking, replaceLookImage, Slot, Studio, updateLook, uploadAvatar, uploadLook } from './src/api';
import { legalPages } from './src/legal';
import type { LegalPageKey } from './src/legal';

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
function Toast({ title, detail, type = 'success', onClose }: { title: string; detail: string; type?: 'success' | 'error' | 'info'; onClose: () => void }) {
  return <Pressable onPress={onClose} style={[styles.toast, type === 'error' && styles.toastError, type === 'info' && styles.toastInfo]}><View style={styles.toastIcon}><Text style={styles.toastIconText}>{type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</Text></View><View style={{ flex: 1 }}><Text style={styles.toastTitle}>{title}</Text><Text style={styles.toastDetail}>{detail}</Text></View><Text style={styles.toastClose}>×</Text></Pressable>;
}
function LookCard({ look, favorite, saved, onPress }: { look: Look; favorite: () => void; saved: boolean; onPress: () => void }) {
  return <Pressable style={styles.card} onPress={onPress}><Image source={{ uri: look.image_url }} style={styles.cardImage} /><Pressable style={styles.heart} onPress={favorite}><Text style={styles.heartText}>{saved ? '♥' : '♡'}</Text></Pressable><View style={styles.cardBody}><Text numberOfLines={1} style={styles.cardTitle}>{look.title}</Text><Text numberOfLines={1} style={styles.caption}>{look.studios.name}</Text><View style={styles.between}><Text style={styles.tiny}>⌖ {look.studios.city}</Text><Text style={styles.price}>€{look.price_eur}</Text></View></View></Pressable>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'client' | 'artist'>('client');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{title:string;detail:string;type?:'success'|'error'|'info'} | null>(null);
  const [tab, setTab] = useState<Tab>('Discover');
  const [profileSection, setProfileSection] = useState<'saved' | 'appointments' | 'designs' | null>(null);
  const [screen, setScreen] = useState<'home' | 'results' | 'look' | 'auth' | 'studio' | 'appointment' | 'edit-look' | 'legal'>('home');
  const [looks, setLooks] = useState<Look[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [selected, setSelected] = useState<Look | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [legalKey, setLegalKey] = useState<LegalPageKey | 'account'>('privacy');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [matchedLooks, setMatchedLooks] = useState<Look[]>([]);
  const [matchState, setMatchState] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (userId?: string) => {
    try {
      const nextLooks = await listLooks(); setLooks(nextLooks); setError('');
      if (userId) {
        const [savedResult, bookingsResult, studioResult, profileResult] = await Promise.all([
          supabase.from('saved_looks').select('look_id').eq('user_id', userId),
          supabase.from('bookings').select('id,studio_id,client_id,client_name,slot_id,look_id,starts_at,status,studios(id,owner_id,name,city,address,bio,phone),portfolio_looks(id,title,image_url,price_eur)').order('starts_at', { ascending: false }),
          supabase.from('studios').select('id,owner_id,name,city,address,bio,phone').eq('owner_id', userId).maybeSingle(),
          supabase.from('profiles').select('id,display_name,role,avatar_url,city,bio').eq('id', userId).maybeSingle(),
        ]);
        if (savedResult.error) throw savedResult.error;
        if (bookingsResult.error) throw bookingsResult.error;
        if (studioResult.error) throw studioResult.error;
        if (profileResult.error) throw profileResult.error;
        const accountRole = profileResult.data?.role || session?.user.user_metadata?.role || 'client';
        setRole(accountRole === 'artist' ? 'artist' : 'client');
        setProfile(profileResult.data as Profile | null);
        setSaved((savedResult.data || []).map(x => x.look_id));
        setBookings((bookingsResult.data || []) as unknown as Booking[]);
        setStudio(studioResult.data as Studio | null);
      } else { setSaved([]); setBookings([]); setStudio(null); setRole('client'); setProfile(null); }
    } catch (e) { setError(friendlyError(e)); }
  }, []);
  useEffect(() => {
    const handleAuthUrl = async (url: string) => {
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          setScreen('home');
          setTab('Profile');
          Alert.alert('Email confirmed', 'Your Nailly account is ready.');
        }
      } catch (e) {
        message('Email confirmation', e);
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleAuthUrl(url); });
    const linkSubscription = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { listener.subscription.unsubscribe(); linkSubscription.remove(); };
  }, []);
  useEffect(() => { refresh(session?.user.id); }, [session?.user.id, refresh]);
  useEffect(() => { if (selected) listSlots(selected.studio_id).then(setSlots).catch(e => setError(friendlyError(e))); }, [selected]);

  async function choosePhoto() {
    try {
      const asset = await pickPortfolioImage();
      if (!asset) return;
      setPhoto(asset.uri); setTab('Discover'); setScreen('results'); setMatchedLooks([]);
      if (!matchingConfigured()) { setMatchState('Visual similarity ranking will appear after the matching service is deployed.'); return; }
      if (!session) { setMatchState('Sign in to search by photo.'); return; }
      if (!asset.base64) { setMatchState('Choose a JPEG photo to search.'); return; }
      setMatchState('Finding similar designs…');
      try { const matches = await matchPhoto(asset.base64); setMatchedLooks(await looksByIds(matches)); setMatchState(matches.length ? 'Ranked by visual similarity.' : 'No indexed matches yet. Browse recent work below.'); }
      catch (e) { setMatchState(`Search unavailable: ${friendlyError(e)}`); }
    } catch (e) { message('Photo', e); }
  }
  async function toggleSaved(lookId: string) {
    if (!session) { setScreen('auth'); return; }
    const wasSaved = saved.includes(lookId);
    const query = wasSaved ? supabase.from('saved_looks').delete().eq('user_id', session.user.id).eq('look_id', lookId) : supabase.from('saved_looks').insert({ user_id: session.user.id, look_id: lookId });
    const { error: saveError } = await query;
    if (saveError) message('Could not save', saveError); else setSaved(current => wasSaved ? current.filter(id => id !== lookId) : [...current, lookId]);
  }
  async function requestBooking(slot: Slot) {
    if (!session || !selected) { setScreen('auth'); return; }
    if (selected.studios.owner_id === session.user.id) {
      setToast({ title: 'This is your studio', detail: 'Studio owners cannot request appointments from their own studio.', type: 'info' });
      return;
    }
    setBusy(true);
    try {
      const { error: bookingError } = await supabase.from('bookings').insert({ client_id: session.user.id, studio_id: selected.studio_id, slot_id: slot.id, look_id: selected.id, starts_at: slot.starts_at, client_name: session.user.user_metadata?.display_name || session.user.email || '', status: 'requested' });
      if (bookingError) throw bookingError;
      setToast({ title: 'Appointment requested', detail: 'The studio can now confirm your appointment.', type: 'success' });
      await refresh(session.user.id); setSlots(await listSlots(selected.studio_id)); setTab('Bookings'); setScreen('home');
    } catch (e) { setToast({ title: 'Could not request this time', detail: friendlyError(e), type: 'error' }); setSlots(await listSlots(selected.studio_id).catch(() => [])); } finally { setBusy(false); }
  }
  async function changeBooking(id: string, status: 'confirmed' | 'cancelled') {
    const { error: updateError } = await supabase.rpc('set_booking_status', { booking_id: id, next_status: status });
    if (updateError) message('Could not update booking', updateError); else await refresh(session?.user.id);
  }
  function selectTab(next: Tab) { setTab(next); setScreen('home'); refresh(session?.user.id); }
  function openAppointment(booking: Booking) { setSelectedBooking(booking); setScreen('appointment'); }
  function openLegal(key: LegalPageKey | 'account') { setLegalKey(key); setScreen('legal'); }
  function goBack() { if (screen === 'edit-look') setScreen('look'); else setScreen('home'); }
  const filteredLooks = looks.filter(look => [look.title, look.studios.name, look.studios.city].some(value => value.toLowerCase().includes(query.trim().toLowerCase())));
  const grid = (items: Look[]) => <View style={styles.grid}>{items.map(look => <LookCard key={look.id} look={look} saved={saved.includes(look.id)} favorite={() => toggleSaved(look.id)} onPress={() => { setSelected(look); setScreen('look'); }} />)}</View>;

  const profileSavedLooks = looks.filter(look => saved.includes(look.id));
  const profileAppointments = session ? bookings.filter(b => b.client_id === session.user.id) : [];
  const profileDesigns = role === 'artist' && studio ? looks.filter(look => look.studio_id === studio.id) : [];
  const renderProfileSection = () => {
    if (!profileSection) return null;
    if (profileSection === 'saved') return <View style={styles.profileSection}><View style={styles.profileSectionHead}><Text style={styles.sectionSmall}>Saved designs</Text><Text style={styles.countBadge}>{profileSavedLooks.length}</Text></View>{profileSavedLooks.length ? grid(profileSavedLooks) : <Empty title="No saved designs yet" detail="Tap the heart on a look and it will appear here." />}</View>;
    if (profileSection === 'designs') return <View style={styles.profileSection}><View style={styles.profileSectionHead}><Text style={styles.sectionSmall}>My designs</Text><Text style={styles.countBadge}>{profileDesigns.length}</Text></View>{profileDesigns.length ? grid(profileDesigns) : <Empty title="Your portfolio is waiting" detail="Publish your first nail design from the studio dashboard." />}</View>;
    return <View style={styles.profileSection}><View style={styles.profileSectionHead}><Text style={styles.sectionSmall}>Appointments</Text><Text style={styles.countBadge}>{profileAppointments.length}</Text></View>{profileAppointments.length ? profileAppointments.map(b => <Pressable key={b.id} style={styles.profileBooking} onPress={() => openAppointment(b)}><View style={{flex:1}}><Text style={styles.cardTitle}>{b.studios?.name || 'Nail studio'}</Text><Text style={styles.caption}>{formatTime(b.starts_at)}</Text></View><View style={styles.statusBadge}><Text style={styles.statusText}>{b.status.toUpperCase()}</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>) : <Empty title="No appointments yet" detail="Your requested and confirmed appointments will appear here." />}</View>;
  };
  const upcomingAppointment = session ? bookings
    .filter(b => ['requested','confirmed'].includes(b.status) && new Date(b.starts_at) > new Date() && (b.client_id === session.user.id || b.studios?.owner_id === session.user.id))
    .sort((a,b) => a.starts_at.localeCompare(b.starts_at))[0] : undefined;
  const ownsSelectedLook = Boolean(session && selected && selected.studios.owner_id === session.user.id);
  const renderLegalMenu = () => <View style={styles.legalMenu}><Text style={styles.sectionSmall}>Legal & privacy</Text><Pressable style={styles.settingsRow} onPress={() => openLegal('privacy')}><View><Text style={styles.settingsTitle}>Privacy Policy</Text><Text style={styles.settingsCaption}>How Nailly handles your data</Text></View><Text style={styles.rowChevron}>›</Text></Pressable><Pressable style={styles.settingsRow} onPress={() => openLegal('terms')}><View><Text style={styles.settingsTitle}>Terms of Service</Text><Text style={styles.settingsCaption}>Rules for clients and artists</Text></View><Text style={styles.rowChevron}>›</Text></Pressable><Pressable style={styles.settingsRow} onPress={() => openLegal('gdpr')}><View><Text style={styles.settingsTitle}>Privacy & GDPR rights</Text><Text style={styles.settingsCaption}>Access, correction and deletion rights</Text></View><Text style={styles.rowChevron}>›</Text></Pressable><Pressable style={styles.settingsRow} onPress={() => openLegal('community')}><View><Text style={styles.settingsTitle}>Community Guidelines</Text><Text style={styles.settingsCaption}>Content, bookings and review standards</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>{session && <Pressable style={[styles.settingsRow,styles.dangerRow]} onPress={() => openLegal('account')}><View><Text style={styles.dangerTitle}>Delete account & data</Text><Text style={styles.settingsCaption}>Permanently remove your Nailly account</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>}</View>;

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {screen !== 'home' && <Pressable onPress={goBack}><Text style={styles.back}>‹ Back</Text></Pressable>}
    {screen === 'auth' ? <AuthScreen onDone={() => { setTab('Profile'); setScreen('home'); }} />
    : screen === 'studio' ? <StudioScreen session={session} studio={studio} looks={looks} bookings={bookings} onRefresh={() => refresh(session?.user.id)} notify={(title,detail,type) => setToast({title,detail,type})} onOpenBooking={openAppointment} onStudioCreated={async () => { await refresh(session?.user.id); setToast({title:'Studio created',detail:'Your studio is live. Add your first design or available appointment.',type:'success'}); }} />
    : screen === 'appointment' && selectedBooking ? <AppointmentScreen booking={selectedBooking} session={session} onStatus={async (id,status) => { await changeBooking(id,status); await refresh(session?.user.id); const refreshed = bookings.find(b => b.id === id); if (refreshed) setSelectedBooking({...refreshed,status}); }} notify={(title,detail,type) => setToast({title,detail,type})} />
    : screen === 'edit-look' && selected ? <EditLookScreen look={selected} onSaved={async updated => { setSelected(updated); await refresh(session?.user.id); setScreen('look'); setToast({title:'Design updated',detail:'Your changes are live in Nailly.',type:'success'}); }} notify={(title,detail,type) => setToast({title,detail,type})} />
    : screen === 'legal' ? <LegalScreen pageKey={legalKey} onOpen={openLegal} onDelete={async () => { await deleteMyAccount(); setSelectedBooking(null); setSelected(null); setScreen('home'); setTab('Discover'); }} notify={(title,detail,type) => setToast({title,detail,type})} />
    : screen === 'look' && selected ? <><View style={styles.lookHeroWrap}><Image source={{ uri: selected.image_url }} style={styles.heroImage} />{ownsSelectedLook && <Pressable style={styles.editFab} onPress={() => setScreen('edit-look')}><Text style={styles.editFabIcon}>✎</Text></Pressable>}</View><View style={styles.lookTitleRow}><View style={{flex:1}}><Text style={styles.eyebrow}>NAIL STUDIO · {selected.studios.city.toUpperCase()}</Text><Text style={styles.title}>{selected.studios.name}</Text></View>{ownsSelectedLook && <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>YOUR DESIGN</Text></View>}</View><Text style={styles.body}>{selected.studios.bio || 'Discover the artist behind this look.'}</Text><View style={styles.pill}><Text style={styles.pillText}>✦ {selected.title}  ·  From €{selected.price_eur}</Text></View>{ownsSelectedLook ? <View style={styles.ownerNotice}><Text style={styles.ownerNoticeTitle}>Studio owner view</Text><Text style={styles.ownerNoticeText}>You cannot book your own studio. Use the edit button to update this design or open your studio dashboard to manage availability.</Text><Button label="Open studio dashboard" secondary onPress={() => setScreen('studio')} /></View> : <><Text style={styles.section}>Available appointments</Text>{slots.length ? slots.map(slot => <Pressable key={slot.id} style={styles.slot} onPress={() => requestBooking(slot)} disabled={busy}><Text style={styles.slotText}>{formatTime(slot.starts_at)}</Text><Text style={styles.link}>{busy ? 'Please wait' : 'Request →'}</Text></Pressable>) : <Text style={styles.body}>No free times listed yet.</Text>}</>}{selected.studios.address && <Text style={styles.body}>⌖ {selected.studios.address}, {selected.studios.city}</Text>}</>
    : screen === 'results' ? <><Text style={styles.eyebrow}>YOUR INSPIRATION</Text><Text style={styles.title}>Find your look.</Text>{photo && <Pressable style={styles.uploaded} onPress={choosePhoto}><Image source={{ uri: photo }} style={styles.thumb} /><Text style={styles.cardTitle}>Your photo  ·  Change</Text></Pressable>}<Text style={styles.section}>Studio work</Text><Text style={styles.body}>{matchState}</Text>{grid(matchedLooks.length ? matchedLooks : looks)}</>
    : tab === 'Discover' ? <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.eyebrow}>YOUR NEXT NAIL MOMENT</Text><Text style={styles.headline}>Find the nails{'\n'}you love.</Text><Text style={styles.body}>From inspiration to the artist who can make it yours.</Text>{upcomingAppointment && <Pressable style={styles.upcomingCard} onPress={() => openAppointment(upcomingAppointment)}><View style={styles.upcomingIcon}><Text style={styles.upcomingIconText}>▤</Text></View><View style={{flex:1}}><Text style={styles.upcomingLabel}>{upcomingAppointment.studios?.owner_id === session?.user.id ? 'UPCOMING CLIENT APPOINTMENT' : 'YOUR NEXT APPOINTMENT'}</Text><Text style={styles.upcomingTitle}>{upcomingAppointment.studios?.name || 'Nail studio'}</Text><Text style={styles.upcomingMeta}>{formatTime(upcomingAppointment.starts_at)} · {upcomingAppointment.status}</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>}<Pressable style={styles.upload} onPress={choosePhoto}><Text style={styles.camera}>▧</Text><View><Text style={styles.cardTitle}>Upload inspiration</Text><Text style={styles.caption}>Choose a photo from your gallery</Text></View></Pressable><Text style={styles.section}>Explore nail looks</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search design, studio or city" placeholderTextColor="#ad9ca5" style={[styles.input, { marginBottom: 20 }]} />{looks.length ? grid(filteredLooks) : <Empty title="The gallery is growing" detail="Studios will appear here once they publish their first designs." />}</>
    : tab === 'Saved' ? <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.title}>Saved looks</Text>{!session ? <Button label="Sign in to save looks" onPress={() => setScreen('auth')} /> : saved.length ? grid(looks.filter(look => saved.includes(look.id))) : <Empty title="Your collection starts here" detail="Tap the heart on a nail look to save it." />}</>
    : tab === 'Bookings' ? <><Text style={styles.brand}>nailly<Text style={{ color: colors.coral }}>.</Text></Text><Text style={styles.title}>Appointments</Text>{!session ? <Button label="Sign in to view bookings" onPress={() => setScreen('auth')} /> : bookings.filter(b => b.client_id === session.user.id).length ? bookings.filter(b => b.client_id === session.user.id).map(b => <Pressable key={b.id} style={styles.appointmentListCard} onPress={() => openAppointment(b)}>{b.portfolio_looks?.image_url ? <Image source={{uri:b.portfolio_looks.image_url}} style={styles.appointmentThumb}/> : <View style={styles.appointmentThumbFallback}><Text style={styles.appointmentThumbIcon}>▤</Text></View>}<View style={{flex:1}}><Text style={styles.cardTitle}>{b.studios?.name || 'Nail studio'}</Text><Text style={styles.caption}>{formatTime(b.starts_at)}</Text><Text style={styles.appointmentStatus}>{b.status.toUpperCase()}</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>) : <Empty title="Nothing booked yet" detail="Choose a studio and request an available time." />}</>
    : <><View style={styles.profileTop}><Text style={styles.brandCompact}>nailly<Text style={{color:colors.coral}}>.</Text></Text><Text style={styles.profileKicker}>MY NAILLY</Text></View>{session ? <><View style={styles.profileCard}><Pressable style={styles.avatarPress} onPress={async()=>{try{const asset=await pickPortfolioImage();if(!asset)return;await uploadAvatar(session.user.id,asset);await refresh(session.user.id);setToast({title:'Profile photo updated',detail:'Your new photo is live.',type:'success'});}catch(e){setToast({title:'Photo upload failed',detail:friendlyError(e),type:'error'});}}}>{profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={styles.avatarLarge}/>:<View style={styles.avatarFallbackLarge}><Text style={styles.avatarLetter}>{(profile?.display_name||session.user.email||'N').charAt(0).toUpperCase()}</Text></View>}<View style={styles.avatarEditLarge}><Text style={styles.avatarEditText}>＋</Text></View></Pressable><Text style={styles.profileNameLarge}>{profile?.display_name||session.user.user_metadata?.display_name||'Nailly member'}</Text><View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{role==='artist'?'✦ Nail artist':'♡ Nail lover'}</Text></View><Text style={styles.profileEmail}>{session.user.email}</Text><Text style={styles.changePhoto}>Tap photo to change</Text></View><View style={styles.statRow}><Pressable onPress={()=>setProfileSection(profileSection==='saved'?null:'saved')} style={[styles.statCard,profileSection==='saved'&&styles.statCardActive]}><Text style={styles.statNumber}>{saved.length}</Text><Text style={[styles.statLabel,profileSection==='saved'&&styles.statLabelActive]}>Saved</Text></Pressable><Pressable onPress={()=>setProfileSection(profileSection==='appointments'?null:'appointments')} style={[styles.statCard,profileSection==='appointments'&&styles.statCardActive]}><Text style={styles.statNumber}>{bookings.filter(x=>x.client_id===session.user.id&&x.status!=='cancelled').length}</Text><Text style={[styles.statLabel,profileSection==='appointments'&&styles.statLabelActive]}>Appointments</Text></Pressable>{role==='artist'?<Pressable onPress={()=>setProfileSection(profileSection==='designs'?null:'designs')} style={[styles.statCard,profileSection==='designs'&&styles.statCardActive]}><Text style={styles.statNumber}>{studio?looks.filter(x=>x.studio_id===studio.id).length:0}</Text><Text style={[styles.statLabel,profileSection==='designs'&&styles.statLabelActive]}>Designs</Text></Pressable>:<Pressable onPress={()=>{setTab('Discover');setScreen('home')}} style={styles.statCard}><Text style={styles.statNumber}>♡</Text><Text style={styles.statLabel}>Discover</Text></Pressable>}</View>{role==='artist'?(studio?<Pressable style={styles.studioPreview} onPress={()=>setScreen('studio')}><View style={styles.studioPreviewTop}><View style={styles.studioMark}><Text style={styles.studioMarkText}>✦</Text></View><View style={{flex:1}}><Text style={styles.studioPreviewLabel}>YOUR STUDIO</Text><Text style={styles.studioPreviewName}>{studio.name}</Text><Text style={styles.studioPreviewMeta}>⌖ {studio.city}{studio.address?' · '+studio.address:''}</Text></View><Text style={styles.chevron}>›</Text></View><Text style={styles.studioPreviewBio} numberOfLines={2}>{studio.bio||'Add a description to tell clients what makes your studio special.'}</Text><View style={styles.manageBar}><Text style={styles.manageBarText}>Open studio dashboard</Text><Text style={styles.manageBarText}>→</Text></View></Pressable>:<View style={styles.ctaCard}><Text style={styles.ctaIcon}>✦</Text><Text style={styles.ctaTitle}>Build your studio presence</Text><Text style={styles.ctaText}>Create a polished profile, publish your work and receive appointment requests.</Text><Button label="Create your studio" onPress={()=>setScreen('studio')}/></View>):<><Text style={styles.sectionSmall}>Your shortcuts</Text><View style={styles.actionGrid}><Pressable style={styles.actionCard} onPress={()=>{setTab('Discover');setScreen('home')}}><Text style={styles.actionIcon}>⌕</Text><Text style={styles.actionTitle}>Discover</Text><Text style={styles.actionText}>Find your next look</Text></Pressable><Pressable style={styles.actionCard} onPress={()=>{setTab('Saved');setScreen('home')}}><Text style={styles.actionIcon}>♡</Text><Text style={styles.actionTitle}>Saved</Text><Text style={styles.actionText}>Your inspiration</Text></Pressable><Pressable style={styles.actionCard} onPress={()=>{setTab('Bookings');setScreen('home')}}><Text style={styles.actionIcon}>▤</Text><Text style={styles.actionTitle}>Bookings</Text><Text style={styles.actionText}>Appointments</Text></Pressable></View></>}{renderProfileSection()}<Pressable style={styles.signOutRow} onPress={()=>supabase.auth.signOut()}><Text style={styles.signOutText}>Sign out</Text><Text style={styles.signOutText}>→</Text></Pressable></>:<><Empty title="Welcome to Nailly" detail="Sign in as a client or create an artist account to show your work."/><Button label="Sign in or create account" onPress={()=>setScreen('auth')}/></>}{renderLegalMenu()}</>}
    {!!error && <View style={styles.notice}><Text style={styles.noticeText}>Data connection: {error}</Text><Button label="Try again" secondary onPress={() => refresh(session?.user.id)} /></View>}
  </ScrollView>{toast && <View style={styles.toastWrap}><Toast title={toast.title} detail={toast.detail} type={toast.type} onClose={() => setToast(null)} /></View>}<View style={styles.nav}>{tabNames.map((name,i)=><Pressable key={name} onPress={()=>selectTab(name)} style={styles.navItem}>{name==='Profile'&&profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={[styles.navAvatar,tab===name&&styles.navAvatarActive]}/>:<Text style={[styles.navIcon,i===0&&styles.discoverNavIcon,tab===name&&styles.active]}>{['⌕','♡','▤','◯'][i]}</Text>}<Text style={[styles.navLabel,tab===name&&styles.active]}>{name}</Text></Pressable>)}</View></SafeAreaView>;
}

function Empty({ title, detail }: { title: string; detail: string }) { return <View style={styles.empty}><View style={styles.emptyArt}><View style={styles.emptyArtInner}><Text style={styles.emptyArtN}>n</Text><Text style={styles.emptyArtDot}>.</Text></View></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>; }


function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <View style={styles.stars}>{[1,2,3,4,5].map(star => <Pressable key={star} onPress={() => onChange(star)} style={styles.starButton}><Text style={[styles.star, star <= value && styles.starActive]}>★</Text></Pressable>)}</View>;
}

function AppointmentScreen({ booking, session, onStatus, notify }: { booking: Booking; session: Session | null; onStatus: (id: string, status: 'confirmed' | 'cancelled') => Promise<void>; notify: (title:string,detail:string,type?:'success'|'error'|'info') => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [summary, setSummary] = useState<{avg_rating:number|null;rating_count:number}>({avg_rating:null,rating_count:0});
  const [saving, setSaving] = useState(false);
  const isStudioOwner = Boolean(session && booking.studios?.owner_id === session.user.id);
  const isClient = Boolean(session && booking.client_id === session.user.id);
  const targetType: 'studio' | 'client' = isStudioOwner ? 'client' : 'studio';
  const appointmentPassed = new Date(booking.starts_at) <= new Date();
  const canRate = Boolean(session && (isStudioOwner || isClient) && appointmentPassed && ['confirmed','completed'].includes(booking.status));

  useEffect(() => {
    let active = true;
    Promise.all([
      getBookingRating(booking.id),
      isStudioOwner ? getClientRating(booking.client_id) : getStudioRating(booking.studio_id),
    ]).then(([own, nextSummary]) => {
      if (!active) return;
      if (own) { setRating(own.rating); setComment(own.comment || ''); }
      setSummary(nextSummary);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [booking.id, booking.client_id, booking.studio_id, isStudioOwner]);

  async function submitRating() {
    if (!rating) return notify('Choose a rating', 'Select between one and five stars.', 'info');
    setSaving(true);
    try {
      await rateBooking(booking.id, targetType, rating, comment);
      const next = isStudioOwner ? await getClientRating(booking.client_id) : await getStudioRating(booking.studio_id);
      setSummary(next);
      notify('Rating saved', 'Thank you for sharing a genuine appointment experience.', 'success');
    } catch (e) { notify('Could not save rating', friendlyError(e), 'error'); } finally { setSaving(false); }
  }

  return <><Text style={styles.profileKicker}>{isStudioOwner ? 'CLIENT APPOINTMENT' : 'YOUR APPOINTMENT'}</Text><Text style={styles.title}>{booking.studios?.name || 'Appointment'}</Text>
    <View style={styles.appointmentHeroCard}>
      {booking.portfolio_looks?.image_url ? <Image source={{uri:booking.portfolio_looks.image_url}} style={styles.appointmentHeroImage}/> : <View style={styles.appointmentHeroFallback}><Text style={styles.appointmentHeroIcon}>▤</Text></View>}
      <View style={{flex:1}}><Text style={styles.appointmentHeroDate}>{formatTime(booking.starts_at)}</Text><View style={styles.statusBadgeLarge}><Text style={styles.statusText}>{booking.status.toUpperCase()}</Text></View>{booking.portfolio_looks && <Text style={styles.appointmentDesignName}>{booking.portfolio_looks.title} · €{booking.portfolio_looks.price_eur}</Text>}</View>
    </View>
    <View style={styles.detailCard}><Text style={styles.detailLabel}>{isStudioOwner ? 'CLIENT' : 'STUDIO'}</Text><Text style={styles.detailValue}>{isStudioOwner ? booking.client_name : booking.studios?.name}</Text>{!isStudioOwner && booking.studios?.address && <Text style={styles.detailSub}>⌖ {booking.studios.address}, {booking.studios.city}</Text>}<View style={styles.ratingSummary}><Text style={styles.ratingSummaryStar}>★</Text><Text style={styles.ratingSummaryValue}>{summary.avg_rating == null ? 'New' : summary.avg_rating.toFixed(1)}</Text><Text style={styles.ratingSummaryCount}>{summary.rating_count ? `(${summary.rating_count} ratings)` : 'No ratings yet'}</Text></View></View>
    {isStudioOwner && booking.status === 'requested' && <Button label="Confirm appointment" onPress={() => onStatus(booking.id,'confirmed')} />}
    {(isStudioOwner || isClient) && ['requested','confirmed'].includes(booking.status) && <Button label="Cancel appointment" secondary onPress={() => onStatus(booking.id,'cancelled')} />}
    {canRate ? <View style={styles.reviewCard}><Text style={styles.sectionSmall}>{isStudioOwner ? 'Rate this client' : 'Rate this studio'}</Text><Text style={styles.formSub}>Ratings are available after a confirmed appointment has started.</Text><StarRating value={rating} onChange={setRating}/><Field label="Review (optional)" value={comment} onChangeText={setComment} multiline placeholder="Share a short, respectful review"/><Button label={saving?'Saving…':rating?'Save rating':'Choose a rating'} onPress={submitRating} disabled={saving}/></View> : <View style={styles.ratingLocked}><Text style={styles.ratingLockedTitle}>Ratings unlock after the appointment</Text><Text style={styles.caption}>Both client and studio can rate each other after a confirmed appointment has started.</Text></View>}
  </>;
}

function EditLookScreen({ look, onSaved, notify }: { look: Look; onSaved: (look: Look) => Promise<void>; notify: (title:string,detail:string,type?:'success'|'error'|'info') => void }) {
  const [title, setTitle] = useState(look.title);
  const [price, setPrice] = useState(String(look.price_eur));
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    const numericPrice = Number(price);
    if (!title.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) return notify('Check design details', 'Add a design name and a valid price.', 'info');
    setBusy(true);
    try {
      let updated = await updateLook(look.id, title, numericPrice);
      if (image) updated = await replaceLookImage(updated, image);
      await onSaved(updated);
    } catch (e) { notify('Could not update design', friendlyError(e), 'error'); } finally { setBusy(false); }
  }
  return <><View style={styles.editScreenHead}><View><Text style={styles.profileKicker}>EDIT DESIGN</Text><Text style={styles.title}>Polish your look.</Text></View><View style={styles.editIconBadge}><Text style={styles.editIconBadgeText}>✎</Text></View></View><Pressable style={styles.editImageWrap} onPress={async()=>{try{setImage(await pickPortfolioImage())}catch(e){notify('Photo',friendlyError(e),'error')}}}><Image source={{uri:image?.uri || look.image_url}} style={styles.editImage}/><View style={styles.changeImagePill}><Text style={styles.changeImageText}>✎ Change photo</Text></View></Pressable><View style={styles.formCard}><Field label="Design name" value={title} onChangeText={setTitle} placeholder="Design name"/><Field label="Starting price (€)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="45"/><Button label={busy?'Saving changes…':'Save design changes'} onPress={save} disabled={busy}/></View></>;
}

function LegalScreen({ pageKey, onOpen, onDelete, notify }: { pageKey: LegalPageKey | 'account'; onOpen: (key: LegalPageKey | 'account') => void; onDelete: () => Promise<void>; notify: (title:string,detail:string,type?:'success'|'error'|'info') => void }) {
  const [busy, setBusy] = useState(false);
  if (pageKey === 'account') {
    const confirmDelete = () => Alert.alert('Delete your Nailly account?', 'This permanently removes your account, profile, studio data, portfolio images and associated account data. This action cannot be undone.', [{text:'Cancel',style:'cancel'},{text:'Delete account',style:'destructive',onPress:async()=>{setBusy(true);try{await onDelete();}catch(e){notify('Account deletion failed',friendlyError(e),'error');setBusy(false);}}}]);
    return <><Text style={styles.profileKicker}>ACCOUNT & DATA</Text><Text style={styles.title}>Delete account</Text><View style={styles.deleteWarning}><Text style={styles.deleteWarningIcon}>!</Text><View style={{flex:1}}><Text style={styles.deleteWarningTitle}>Permanent action</Text><Text style={styles.deleteWarningText}>Deleting your account removes your Nailly identity and associated user-generated data that is not required to be retained by law.</Text></View></View><View style={styles.legalSection}><Text style={styles.legalHeading}>What is included</Text><Text style={styles.legalBody}>Profile information, profile photo, owned studio records, portfolio images, saved looks, appointment-linked account data, ratings and other account-associated records are included in the deletion flow.</Text></View><Button label={busy?'Deleting account…':'Delete my account and data'} onPress={confirmDelete} disabled={busy}/><Text style={styles.legalFootnote}>Store policies also require an external web route for account-deletion requests. A public URL must be configured before Google Play release.</Text></>;
  }
  const page = legalPages[pageKey];
  return <><Text style={styles.profileKicker}>LEGAL & PRIVACY</Text><Text style={styles.title}>{page.title}</Text><Text style={styles.legalSubtitle}>{page.subtitle}</Text><Text style={styles.legalDate}>Effective 29 September 2026</Text>{page.sections.map(section=><View key={section.heading} style={styles.legalSection}><Text style={styles.legalHeading}>{section.heading}</Text><Text style={styles.legalBody}>{section.body}</Text></View>)}<View style={styles.legalQuickLinks}><Text style={styles.sectionSmall}>More</Text>{(['privacy','terms','gdpr','community'] as LegalPageKey[]).filter(k=>k!==pageKey).map(k=><Pressable key={k} style={styles.settingsRow} onPress={()=>onOpen(k)}><Text style={styles.settingsTitle}>{legalPages[k].title}</Text><Text style={styles.rowChevron}>›</Text></Pressable>)}</View></>;
}

function AuthScreen({ onDone }: { onDone: () => void }) {
  const [register, setRegister] = useState(false), [artist, setArtist] = useState(false), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  async function submit() {
    if (!email.trim() || password.length < 6 || (register && !name.trim())) { Alert.alert('Check your details', 'Enter a name, email and a password of at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (register) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: 'nailly://auth/callback', data: { display_name: name.trim(), role: artist ? 'artist' : 'client' } } });
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

function StudioScreen({ session, studio, looks, bookings, onRefresh, notify, onOpenBooking, onStudioCreated }: { session: Session | null; studio: Studio | null; looks: Look[]; bookings: Booking[]; onRefresh: () => Promise<void>; notify: (title:string,detail:string,type?:'success'|'error'|'info') => void; onOpenBooking: (booking: Booking) => void; onStudioCreated: () => Promise<void> }) {
  const [name, setName] = useState(studio?.name || ''), [city, setCity] = useState(studio?.city || ''), [address, setAddress] = useState(studio?.address || ''), [bio, setBio] = useState(studio?.bio || ''), [phone, setPhone] = useState(studio?.phone || '');
  const [title, setTitle] = useState(''), [price, setPrice] = useState(''), [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null), [selectedTime, setSelectedTime] = useState<Date | null>(null), [showDatePicker, setShowDatePicker] = useState(false), [showTimePicker, setShowTimePicker] = useState(false), [busy, setBusy] = useState(false), [mySlots, setMySlots] = useState<Slot[]>([]);
  useEffect(() => { if (studio) supabase.from('availability_slots').select('id,studio_id,starts_at,ends_at').eq('studio_id', studio.id).gt('starts_at', new Date().toISOString()).order('starts_at').then(({ data }) => setMySlots(data || [])); }, [studio?.id]);
  async function saveStudio() {
    if (!session || !name.trim() || !city.trim()) return Alert.alert('Studio', 'Name and city are required.');
    setBusy(true);
    const payload = { name: name.trim(), city: city.trim(), address: address.trim() || null, bio: bio.trim(), phone: phone.trim() || null };
    const { error } = studio ? await supabase.from('studios').update(payload).eq('id', studio.id) : await supabase.from('studios').insert({ ...payload, owner_id: session.user.id });
    setBusy(false); if (error) notify('Could not save studio', friendlyError(error), 'error'); else if (!studio) { await onStudioCreated(); } else { await onRefresh(); notify('Studio updated', 'Your studio information has been saved.', 'success'); }
  }
  async function addLook() {
    if (!studio || !image || !title.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return Alert.alert('Portfolio', 'Add a photo, title and valid price in euros.');
    setBusy(true);
    try { const lookId = await uploadLook(studio.id, title.trim(), Number(price), image); if (matchingConfigured()) { try { await indexLook(lookId); } catch (indexError) { Alert.alert('Design published', `Visual indexing is pending: ${friendlyError(indexError)}`); } } setImage(null); setTitle(''); setPrice(''); await onRefresh(); notify('Design published', 'Your new nail design is now visible in Discover.', 'success'); } catch (e) { notify('Upload failed', friendlyError(e), 'error'); } finally { setBusy(false); }
  }
  async function addSlot() {
    if (!studio || !selectedDate || !selectedTime) return notify('Choose date and time', 'Select both a date and a start time for this appointment.', 'info');
    const start = new Date(selectedDate);
    start.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    if (start <= new Date()) return notify('Choose a future time', 'Availability must start in the future.', 'info');
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const { data, error } = await supabase.from('availability_slots').insert({ studio_id: studio.id, starts_at: start.toISOString(), ends_at: end.toISOString() }).select('id,studio_id,starts_at,ends_at').single();
    if (error) notify('Could not add appointment', friendlyError(error), 'error'); else { notify('Availability added', 'Clients can now request this appointment.', 'success'); setMySlots(current => [...current, data as Slot].sort((a,b) => a.starts_at.localeCompare(b.starts_at))); setSelectedDate(null); setSelectedTime(null); }
  }
  async function updateBooking(id: string, status: 'confirmed' | 'cancelled') { const { error } = await supabase.rpc('set_booking_status', { booking_id: id, next_status: status }); if (error) message('Booking', error); else await onRefresh(); }
  const studioLooks = studio ? looks.filter(x => x.studio_id === studio.id) : [];
  const studioBookings = studio ? bookings.filter(x => x.studio_id === studio.id) : [];
  return <><View style={styles.studioDashHead}><View><Text style={styles.profileKicker}>NAILLY FOR ARTISTS</Text><Text style={styles.studioDashTitle}>{studio ? studio.name : 'Create your studio'}</Text>{studio&&<Text style={styles.studioPreviewMeta}>⌖ {studio.city}{studio.address?' · '+studio.address:''}</Text>}</View>{studio&&<View style={styles.liveBadge}><Text style={styles.liveText}>● LIVE</Text></View>}</View>
    {studio&&<><View style={styles.dashStats}><View style={styles.dashStat}><Text style={styles.dashNumber}>{studioLooks.length}</Text><Text style={styles.statLabel}>Designs</Text></View><View style={styles.dashStat}><Text style={styles.dashNumber}>{studioBookings.filter(x=>x.status==='requested').length}</Text><Text style={styles.statLabel}>Requests</Text></View><View style={styles.dashStat}><Text style={styles.dashNumber}>{mySlots.length}</Text><Text style={styles.statLabel}>Open slots</Text></View></View><View style={styles.publicProfile}><Text style={styles.studioPreviewLabel}>PUBLIC PROFILE PREVIEW</Text><Text style={styles.studioPreviewName}>{studio.name}</Text><Text style={styles.studioPreviewBio}>{bio||'Tell clients what makes your studio special.'}</Text><Text style={styles.metricLine}>⌖ {city}{phone?'   ·   ☎ '+phone:''}</Text></View></>}
    <View style={styles.formCard}><View style={styles.formHeading}><View style={styles.formIconBox}><Text style={styles.formIconText}>{studio?'✎':'✦'}</Text></View><View style={{flex:1}}><Text style={styles.formTitle}>{studio?'Studio details':'Set up your studio'}</Text><Text style={styles.formSub}>{studio?'Keep your public profile polished and current.':'This is what Nailly clients will see.'}</Text></View></View><Field label="Studio name" value={name} onChangeText={setName} placeholder="Studio name"/><View style={styles.twoCol}><View style={styles.col}><Field label="City" value={city} onChangeText={setCity} placeholder="Sofia"/></View><View style={styles.col}><Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+359..."/></View></View><Field label="Address" value={address} onChangeText={setAddress} placeholder="Street and number"/><Field label="About your studio" value={bio} onChangeText={setBio} multiline placeholder="Your style, experience, atmosphere..."/><Button label={busy?'Saving…':studio?'Save profile changes':'Create studio profile'} onPress={saveStudio} disabled={busy}/></View>
    {studio&&<><View style={styles.sectionHeader}><View><Text style={styles.sectionSmall}>Portfolio</Text><Text style={styles.formSub}>Show clients your best work.</Text></View><Text style={styles.countBadge}>{studioLooks.length}</Text></View><View style={styles.formCard}><Pressable style={styles.portfolioPicker} onPress={async()=>{try{setImage(await pickPortfolioImage())}catch(e){notify('Photo',friendlyError(e),'error')}}}>{image?<Image source={{uri:image.uri}} style={styles.portfolioThumb}/>:<View style={styles.uploadCircle}><Text style={styles.actionIcon}>＋</Text></View>}<View style={{flex:1}}><Text style={styles.cardTitle}>{image?'Photo selected':'Add a new design'}</Text><Text style={styles.caption}>{image?'Tap to choose another':'Choose a portfolio photo'}</Text></View></Pressable><Field label="Design name" value={title} onChangeText={setTitle} placeholder="e.g. Soft bloom"/><Field label="Starting price (€)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="45"/><Button label={busy?'Publishing…':'Publish design'} onPress={addLook} disabled={busy}/></View>{studioLooks.length>0&&<View style={styles.miniGrid}>{studioLooks.map(x=><View key={x.id} style={styles.miniCard}><Image source={{uri:x.image_url}} style={styles.miniImage}/><Text style={styles.miniTitle} numberOfLines={1}>{x.title}</Text><Text style={styles.price}>€{x.price_eur}</Text></View>)}</View>}
    <View style={styles.sectionHeader}><View><Text style={styles.sectionSmall}>Availability</Text><Text style={styles.formSub}>Open times clients can request.</Text></View><Text style={styles.countBadge}>{mySlots.length}</Text></View><View style={styles.formCard}><View style={styles.pickerRow}><Pressable style={[styles.pickerCard,selectedDate&&styles.pickerCardSelected]} onPress={()=>{setShowDatePicker(v=>!v);setShowTimePicker(false)}}><Text style={styles.pickerLabel}>DATE</Text><Text style={styles.pickerValue}>{selectedDate?selectedDate.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}):'Choose date'}</Text><Text style={styles.pickerHint}>Calendar</Text></Pressable><Pressable style={[styles.pickerCard,selectedTime&&styles.pickerCardSelected]} onPress={()=>{setShowTimePicker(v=>!v);setShowDatePicker(false)}}><Text style={styles.pickerLabel}>TIME</Text><Text style={styles.pickerValue}>{selectedTime?selectedTime.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'Choose time'}</Text><Text style={styles.pickerHint}>Start time</Text></Pressable></View>{showDatePicker&&<View style={styles.pickerPanel}><DateTimePicker value={selectedDate||new Date()} mode="date" minimumDate={new Date()} display="inline" onChange={(_event,value)=>{if(value)setSelectedDate(value);setShowDatePicker(false)}}/></View>}{showTimePicker&&<View style={styles.pickerPanel}><DateTimePicker value={selectedTime||new Date()} mode="time" display="spinner" is24Hour onChange={(_event,value)=>{if(value)setSelectedTime(value);setShowTimePicker(false)}}/></View>}<Button label="Add available hour" onPress={addSlot}/>{mySlots.map(slot=><View style={styles.slot} key={slot.id}><View><Text style={styles.slotText}>{formatTime(slot.starts_at)}</Text><Text style={styles.caption}>60 min appointment</Text></View><Pressable onPress={async()=>{const {error}=await supabase.from('availability_slots').delete().eq('id',slot.id);if(error)notify('Could not remove time',friendlyError(error),'error');else setMySlots(v=>v.filter(x=>x.id!==slot.id));}}><Text style={styles.removeText}>Remove</Text></Pressable></View>)}</View>
    <View style={styles.sectionHeader}><View><Text style={styles.sectionSmall}>Booking requests</Text><Text style={styles.formSub}>Manage incoming appointments.</Text></View><Text style={styles.countBadge}>{studioBookings.filter(x=>x.status==='requested').length}</Text></View>{studioBookings.length?studioBookings.map(b=><View key={b.id} style={styles.bookingCard}><View style={styles.bookingTop}><View><Text style={styles.cardTitle}>{b.client_name||'Nailly client'}</Text><Text style={styles.caption}>{formatTime(b.starts_at)}</Text></View><View style={styles.statusBadge}><Text style={styles.statusText}>{b.status.toUpperCase()}</Text></View></View><Pressable style={styles.openDetailsRow} onPress={() => onOpenBooking(b)}><Text style={styles.link}>Open appointment details</Text><Text style={styles.link}>→</Text></Pressable>{b.status==='requested'&&<Button label="Confirm appointment" onPress={()=>updateBooking(b.id,'confirmed')}/>}{['requested','confirmed'].includes(b.status)&&<Button label="Cancel" secondary onPress={()=>updateBooking(b.id,'cancelled')}/>}</View>):<View style={styles.emptyMini}><Text style={styles.emptyIcon}>♡</Text><Text style={styles.cardTitle}>No booking requests yet</Text><Text style={styles.caption}>New client requests will appear here.</Text></View>}</>}

  </>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 40 }, brand: { fontSize: 31, fontWeight: '800', color: colors.ink, letterSpacing: -1.5, marginBottom: 40 }, eyebrow: { color: colors.coral, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 }, headline: { fontFamily: 'Georgia', fontSize: 44, lineHeight: 51, color: colors.ink, marginBottom: 12 }, title: { fontFamily: 'Georgia', fontSize: 36, color: colors.ink, marginBottom: 16 }, section: { fontFamily: 'Georgia', fontSize: 23, color: colors.ink, marginTop: 28, marginBottom: 16 }, body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 20 },
  button: { backgroundColor: colors.coral, borderRadius: 16, padding: 17, alignItems: 'center', marginVertical: 6 }, secondaryButton: { backgroundColor: colors.blush }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  upload: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, padding: 17, borderRadius: 22, marginTop: 12, marginBottom: 12 }, camera: { backgroundColor: '#f6ccc6', borderRadius: 16, padding: 13, fontSize: 25, color: colors.ink, marginRight: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, card: { width: '48%', backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', marginBottom: 15, borderWidth: 1, borderColor: colors.edge }, cardImage: { width: '100%', height: 165, backgroundColor: colors.blush }, heart: { position: 'absolute', right: 9, top: 9, width: 33, height: 33, backgroundColor: 'white', borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, heartText: { color: colors.coral, fontSize: 23 }, cardBody: { padding: 11 }, cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 5 }, caption: { fontSize: 12, color: colors.muted }, between: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }, tiny: { fontSize: 11, color: colors.muted }, price: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.edge, backgroundColor: 'white', paddingTop: 8, paddingBottom: 10 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 }, navIcon: { fontSize: 24, color: colors.muted, lineHeight: 28 }, discoverNavIcon: { fontSize: 31, lineHeight: 32, marginTop: -2 }, navAvatar: { width: 27, height: 27, borderRadius: 14, borderWidth: 1.5, borderColor: colors.edge, marginBottom: 1 }, navAvatarActive: { borderColor: colors.coral, borderWidth: 2 }, navLabel: { fontSize: 10, color: colors.muted }, active: { color: colors.coral, fontWeight: '700' }, back: { fontSize: 16, color: colors.ink, marginBottom: 20 }, heroImage: { width: '100%', height: 290, borderRadius: 22, marginBottom: 23, backgroundColor: colors.blush }, pill: { backgroundColor: colors.blush, borderRadius: 17, padding: 15, marginBottom: 20 }, pillText: { color: colors.ink }, slot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 13, padding: 15, marginBottom: 8 }, slotText: { color: colors.ink, fontSize: 14, marginVertical: 4 }, link: { color: colors.coral, fontWeight: '700' }, uploaded: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, padding: 10, borderRadius: 18, marginBottom: 20 }, thumb: { width: 70, height: 70, borderRadius: 13, marginRight: 15 }, empty: { alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 24, paddingHorizontal: 26, paddingVertical: 30, marginTop: 20 }, emptyIcon: { color: colors.coral, fontSize: 45 }, emptyArt: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, emptyArtInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#f4d8d3' }, emptyArtN: { color: colors.ink, fontSize: 28, fontWeight: '900', letterSpacing: -2 }, emptyArtDot: { color: colors.coral, fontSize: 30, fontWeight: '900', marginLeft: -1, marginTop: 7 }, emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21, lineHeight: 27, textAlign: 'center', marginBottom: 8 }, emptyDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 280 }, panel: { backgroundColor: 'white', borderColor: colors.edge, borderWidth: 1, borderRadius: 17, padding: 16, marginVertical: 8 }, notice: { backgroundColor: colors.blush, padding: 15, borderRadius: 15, marginTop: 20 }, noticeText: { color: colors.ink }, field: { marginBottom: 15 }, fieldLabel: { color: colors.ink, fontWeight: '700', marginBottom: 7 }, input: { borderWidth: 1, borderColor: colors.edge, backgroundColor: 'white', borderRadius: 12, padding: 13, fontSize: 15, color: colors.ink }, choiceRow: { flexDirection: 'row', marginBottom: 20 }, choice: { padding: 12, backgroundColor: 'white', borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: colors.edge }, choiceActive: { backgroundColor: colors.blush, borderColor: colors.coral }, choiceText: { color: colors.ink },

  // Profile
  profileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brandCompact: { fontSize: 29, fontWeight: '800', color: colors.ink, letterSpacing: -1.4 },
  profileKicker: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  profileCard: { backgroundColor: 'white', borderRadius: 26, borderWidth: 1, borderColor: colors.edge, paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center', shadowColor: '#452638', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  avatarPress: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarLarge: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.blush },
  avatarFallbackLarge: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f4d8d3' },
  avatarLetter: { color: colors.coral, fontSize: 38, fontWeight: '800' },
  avatarEditLarge: { position: 'absolute', right: 0, bottom: 1, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.coral, borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  avatarEditText: { color: 'white', fontSize: 17, fontWeight: '900', lineHeight: 18 },
  profileNameLarge: { fontFamily: 'Georgia', fontSize: 28, lineHeight: 34, color: colors.ink, marginTop: 15, textAlign: 'center' },
  roleBadge: { backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 9 },
  roleBadgeText: { color: colors.coral, fontSize: 11, fontWeight: '800' },
  profileEmail: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' },
  changePhoto: { color: colors.coral, fontSize: 11, fontWeight: '800', marginTop: 8 },
  statRow: { flexDirection: 'row', marginTop: 12, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 18, paddingVertical: 14, marginHorizontal: 3, alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  statCardActive: { backgroundColor: colors.blush, borderColor: colors.coral },
  statNumber: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  statLabelActive: { color: colors.coral, fontWeight: '800' },
  profileSection: { marginTop: 18 },
  profileSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  profileBooking: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 17, padding: 15, marginBottom: 9 },
  sectionSmall: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 4, marginBottom: 10 },
  actionGrid: { flexDirection: 'row', marginHorizontal: -3, marginBottom: 4 },
  actionCard: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 14, marginHorizontal: 3, minHeight: 112 },
  actionIcon: { color: colors.coral, fontSize: 23, fontWeight: '700' },
  actionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 10 },
  actionText: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  signOutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.edge },
  signOutText: { color: colors.muted, fontSize: 13, fontWeight: '700' },

  // Profile studio preview
  studioPreview: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 24, padding: 18, overflow: 'hidden' },
  studioPreviewTop: { flexDirection: 'row', alignItems: 'center' },
  studioMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  studioMarkText: { color: colors.coral, fontSize: 20, fontWeight: '800' },
  studioPreviewLabel: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  studioPreviewName: { color: colors.ink, fontFamily: 'Georgia', fontSize: 22, lineHeight: 28, marginTop: 3 },
  studioPreviewMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  studioPreviewBio: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 13 },
  chevron: { color: colors.coral, fontSize: 30, lineHeight: 32, marginLeft: 8 },
  manageBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.coral, marginHorizontal: -18, marginBottom: -18, marginTop: 16, paddingHorizontal: 16, paddingVertical: 14 },
  manageBarText: { color: 'white', fontSize: 12, fontWeight: '800' },
  ctaCard: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 24, padding: 20 },
  ctaIcon: { color: colors.coral, fontSize: 30 },
  ctaTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 23, lineHeight: 29, marginTop: 7 },
  ctaText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginVertical: 10 },

  // Studio dashboard
  studioDashHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  studioDashTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 30, lineHeight: 36, marginTop: 5, paddingRight: 8 },
  liveBadge: { backgroundColor: '#e9f7ee', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginLeft: 10 },
  liveText: { color: '#40875e', fontSize: 9, fontWeight: '900' },
  dashStats: { flexDirection: 'row', marginHorizontal: -3, marginBottom: 14 },
  dashStat: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 18, paddingVertical: 14, marginHorizontal: 3, alignItems: 'center' },
  dashNumber: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  publicProfile: { backgroundColor: colors.blush, borderRadius: 22, padding: 18, marginBottom: 14 },
  metricLine: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 17, marginTop: 12 },
  formCard: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 22, padding: 18, marginBottom: 14 },
  formHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  formIconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  formIconText: { color: colors.coral, fontSize: 18, fontWeight: '800' },
  formTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  formSub: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  twoCol: { flexDirection: 'row', marginHorizontal: -5 },
  col: { flex: 1, marginHorizontal: 5 },
  pickerRow: { flexDirection: 'row', marginHorizontal: -5, marginBottom: 12 },
  pickerCard: { flex: 1, marginHorizontal: 5, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.edge, borderRadius: 16, padding: 14, minHeight: 92, justifyContent: 'center' },
  pickerCardSelected: { backgroundColor: colors.blush, borderColor: colors.coral },
  pickerLabel: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  pickerValue: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 7 },
  pickerHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  pickerPanel: { backgroundColor: colors.canvas, borderRadius: 18, borderWidth: 1, borderColor: colors.edge, padding: 8, marginBottom: 12, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  countBadge: { backgroundColor: colors.blush, color: colors.coral, fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  portfolioPicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blush, borderRadius: 17, padding: 12, marginBottom: 15 },
  portfolioThumb: { width: 58, height: 58, borderRadius: 14, marginRight: 12, backgroundColor: 'white' },
  uploadCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  miniCard: { width: '31.3%', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 15, padding: 7, marginHorizontal: '1%', marginBottom: 8 },
  miniImage: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: colors.blush, marginBottom: 7 },
  miniTitle: { color: colors.ink, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  removeText: { color: '#b85d63', fontSize: 12, fontWeight: '800' },
  bookingCard: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 20, padding: 16, marginBottom: 10 },
  bookingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusBadge: { backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: colors.ink, fontSize: 8, fontWeight: '900' },
  emptyMini: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 20, padding: 24, alignItems: 'center' },

  // Appointment, editing and legal flows
  upcomingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 20, padding: 14, marginBottom: 14, shadowColor: '#452638', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  upcomingIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  upcomingIconText: { color: colors.coral, fontSize: 22, fontWeight: '800' },
  upcomingLabel: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  upcomingTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 3 },
  upcomingMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  rowChevron: { color: colors.coral, fontSize: 26, lineHeight: 28, marginLeft: 9 },

  appointmentListCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 19, padding: 12, marginBottom: 10 },
  appointmentThumb: { width: 62, height: 62, borderRadius: 14, marginRight: 12, backgroundColor: colors.blush },
  appointmentThumbFallback: { width: 62, height: 62, borderRadius: 14, marginRight: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  appointmentThumbIcon: { color: colors.coral, fontSize: 23 },
  appointmentStatus: { color: colors.coral, fontSize: 9, fontWeight: '900', marginTop: 6, letterSpacing: 0.7 },

  lookHeroWrap: { position: 'relative' },
  lookTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  editFab: { position: 'absolute', right: 14, top: 14, width: 46, height: 46, borderRadius: 23, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6, borderWidth: 1, borderColor: colors.edge },
  editFabIcon: { color: colors.coral, fontSize: 22, fontWeight: '900' },
  ownerBadge: { backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 2, marginLeft: 8 },
  ownerBadgeText: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  ownerNotice: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 20, padding: 17, marginTop: 12, marginBottom: 18 },
  ownerNoticeTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  ownerNoticeText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 8 },

  appointmentHeroCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 24, padding: 14, marginBottom: 14 },
  appointmentHeroImage: { width: 92, height: 92, borderRadius: 18, marginRight: 14, backgroundColor: colors.blush },
  appointmentHeroFallback: { width: 92, height: 92, borderRadius: 18, marginRight: 14, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  appointmentHeroIcon: { color: colors.coral, fontSize: 30 },
  appointmentHeroDate: { color: colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  appointmentDesignName: { color: colors.muted, fontSize: 11, marginTop: 9 },
  statusBadgeLarge: { alignSelf: 'flex-start', backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  detailCard: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 20, padding: 17, marginBottom: 12 },
  detailLabel: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  detailValue: { color: colors.ink, fontFamily: 'Georgia', fontSize: 22, marginTop: 6 },
  detailSub: { color: colors.muted, fontSize: 12, marginTop: 7 },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.edge },
  ratingSummaryStar: { color: '#d99a3e', fontSize: 18, marginRight: 6 },
  ratingSummaryValue: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  ratingSummaryCount: { color: colors.muted, fontSize: 11, marginLeft: 6 },
  reviewCard: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 22, padding: 18, marginTop: 14 },
  stars: { flexDirection: 'row', marginVertical: 14 },
  starButton: { paddingRight: 8, paddingVertical: 2 },
  star: { color: '#d7c9cf', fontSize: 34 },
  starActive: { color: '#d99a3e' },
  ratingLocked: { backgroundColor: colors.blush, borderRadius: 18, padding: 16, marginTop: 14 },
  ratingLockedTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 5 },

  editScreenHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  editIconBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  editIconBadgeText: { color: colors.coral, fontSize: 22, fontWeight: '900' },
  editImageWrap: { position: 'relative', marginBottom: 16 },
  editImage: { width: '100%', height: 300, borderRadius: 24, backgroundColor: colors.blush },
  changeImagePill: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'white', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  changeImageText: { color: colors.ink, fontSize: 11, fontWeight: '800' },

  openDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.blush, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },

  legalMenu: { marginTop: 22, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.edge },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 8 },
  settingsTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  settingsCaption: { color: colors.muted, fontSize: 10, marginTop: 3 },
  dangerRow: { borderColor: '#efd0d0', backgroundColor: '#fffafa' },
  dangerTitle: { color: '#aa4b54', fontSize: 13, fontWeight: '800' },
  legalSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: -6 },
  legalDate: { color: colors.coral, fontSize: 10, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  legalSection: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.edge, borderRadius: 18, padding: 17, marginTop: 10 },
  legalHeading: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 7 },
  legalBody: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  legalQuickLinks: { marginTop: 24 },
  legalFootnote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 12 },
  deleteWarning: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff4f4', borderWidth: 1, borderColor: '#efcccc', borderRadius: 20, padding: 16, marginBottom: 14 },
  deleteWarningIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#aa4b54', color: 'white', textAlign: 'center', paddingTop: 6, fontSize: 15, fontWeight: '900', marginRight: 11, overflow: 'hidden' },
  deleteWarningTitle: { color: '#8d3f47', fontSize: 14, fontWeight: '900' },
  deleteWarningText: { color: '#8f6669', fontSize: 11, lineHeight: 17, marginTop: 4 },

  // Floating feedback
  toastWrap: { position: 'absolute', left: 14, right: 14, bottom: 76, zIndex: 50 },
  toast: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#dfeee6', borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 9 },
  toastError: { borderColor: '#f0cccc' },
  toastInfo: { borderColor: colors.edge },
  toastIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  toastIconText: { color: colors.coral, fontSize: 18, fontWeight: '900' },
  toastTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  toastDetail: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  toastClose: { color: colors.muted, fontSize: 21, paddingLeft: 8 },
});
