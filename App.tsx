import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './src/supabase';

type Look = { id: string; title: string; studio: string; city: string; price: number; image: string };
const demo: Look[] = [
  { id: 'a', title: 'Soft bloom', studio: 'Atelier Rose', city: 'Sofia', price: 45, image: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=700&q=85' },
  { id: 'b', title: 'Classic nude', studio: 'Mira Nails', city: 'Sofia', price: 42, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=700&q=85' },
  { id: 'c', title: 'Cherry glaze', studio: 'The Nail Room', city: 'Plovdiv', price: 38, image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=700&q=85' },
  { id: 'd', title: 'Milky shimmer', studio: 'Studio Amelie', city: 'Varna', price: 40, image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=700&q=85' },
];
const ink = '#452638', pink = '#fce8e4', accent = '#ec817a', muted = '#877582';

export default function App() {
  const [tab, setTab] = useState('Discover');
  const [screen, setScreen] = useState('home');
  const [photo, setPhoto] = useState<string>();
  const [looks, setLooks] = useState<Look[]>(demo);
  const [selected, setSelected] = useState<Look>(demo[0]);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    let mounted = true;
    supabase.from('portfolio_looks').select('id,title,image_url,price_eur,studios(name,city)').eq('published', true).limit(30)
      .then(({ data, error }) => {
        if (!mounted || error || !data?.length) return;
        setLooks(data.map((r: any) => ({ id: String(r.id), title: r.title, image: r.image_url, price: Number(r.price_eur || 0), studio: r.studios?.name || 'Nail studio', city: r.studios?.city || '' })));
      });
    return () => { mounted = false; };
  }, []);
  async function upload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access', 'Please allow photo access to choose an inspiration.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (!result.canceled) { setPhoto(result.assets[0].uri); setScreen('results'); setTab('Discover'); }
  }
  function favorite(id: string) { setSaved(s => s.includes(id) ? s.filter(v => v !== id) : [...s, id]); }
  const cards = (items: Look[]) => <View style={styles.grid}>{items.map(look => <Pressable key={look.id} style={styles.card} onPress={() => { setSelected(look); setScreen('studio'); }}>
    <Image source={{ uri: look.image }} style={styles.cardPhoto} /><Pressable style={styles.heart} onPress={() => favorite(look.id)}><Text style={{ color: accent, fontSize: 23 }}>{saved.includes(look.id) ? '♥' : '♡'}</Text></Pressable>
    <View style={styles.cardBody}><Text style={styles.cardTitle} numberOfLines={1}>{look.title}</Text><Text style={styles.sub}>{look.studio}</Text><View style={styles.row}><Text style={styles.small}>⌖ {look.city}</Text><Text style={styles.price}>€{look.price}</Text></View></View>
  </Pressable>)}</View>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    {screen === 'studio' ? <><Pressable onPress={() => setScreen(photo ? 'results' : 'home')}><Text style={styles.back}>‹ Back</Text></Pressable><Image source={{ uri: selected.image }} style={styles.heroPhoto} />
      <Text style={styles.eyebrow}>NAIL STUDIO · {selected.city.toUpperCase()}</Text><Text style={styles.title}>{selected.studio}</Text><Text style={styles.body}>Explore this artist's work and find the look that feels like you.</Text>
      <View style={styles.pill}><Text style={styles.pillText}>✦ {selected.title}     ·     From €{selected.price}</Text></View><Text style={styles.section}>Book an appointment</Text>
      <Text style={styles.body}>Availability and bookings are coming in the next release.</Text><Pressable style={styles.button} onPress={() => Alert.alert('Coming soon', 'Booking will open after artist accounts and availability are connected.')}><Text style={styles.buttonText}>Notify me when booking opens →</Text></Pressable></>
    : tab === 'Discover' && screen === 'results' ? <><Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Discover</Text></Pressable><Text style={styles.eyebrow}>YOUR INSPIRATION</Text><Text style={styles.title}>Find your look.</Text>
      {photo && <Pressable style={styles.uploaded} onPress={upload}><Image source={{ uri: photo }} style={styles.thumbnail} /><View><Text style={styles.cardTitle}>Your photo</Text><Text style={styles.sub}>Tap to change</Text></View></Pressable>}
      <Text style={styles.section}>Explore studio work</Text><Text style={styles.body}>Visual similarity matching is being built. The looks below are examples, not ranked matches.</Text>{cards(looks)}</>
    : tab === 'Discover' ? <><Text style={styles.logo}>nailly<Text style={{ color: accent }}>.</Text></Text><Text style={styles.eyebrow}>YOUR NEXT NAIL MOMENT</Text><Text style={styles.headline}>Find the nails{'\n'}you love.</Text><Text style={styles.body}>From inspiration to the artist who can make it yours.</Text>
      <Pressable style={styles.upload} onPress={upload}><Text style={styles.camera}>▧</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Upload inspiration</Text><Text style={styles.sub}>Choose a photo from your gallery</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      <Text style={styles.section}>Explore nail looks</Text>{cards(looks)}</>
    : tab === 'Saved' ? <><Text style={styles.logo}>nailly<Text style={{ color: accent }}>.</Text></Text><Text style={styles.title}>Saved looks</Text><Text style={styles.body}>Your favorite designs in one place.</Text>{saved.length ? cards(looks.filter(x => saved.includes(x.id))) : <View style={styles.empty}><Text style={styles.emptyIcon}>♡</Text><Text style={styles.section}>Your collection starts here</Text><Text style={styles.body}>Tap the heart on a look to save it.</Text></View>}</>
    : <><Text style={styles.logo}>nailly<Text style={{ color: accent }}>.</Text></Text><Text style={styles.title}>{tab === 'Bookings' ? 'Appointments' : 'Your space'}</Text><View style={styles.empty}><Text style={styles.emptyIcon}>{tab === 'Bookings' ? '▤' : '✳'}</Text><Text style={styles.section}>{tab === 'Bookings' ? 'Nothing booked yet' : 'Welcome to Nailly'}</Text><Text style={styles.body}>{tab === 'Bookings' ? 'Your appointments will appear here.' : 'Client and artist profiles are coming next.'}</Text></View></>}
  </ScrollView><View style={styles.nav}>{([['⌕', 'Discover'], ['♡', 'Saved'], ['▤', 'Bookings'], ['◯', 'Profile']] as const).map(([icon, name]) => <Pressable key={name} style={styles.navItem} onPress={() => { setTab(name); setScreen('home'); }}><Text style={[styles.navIcon, tab === name && styles.active]}>{icon}</Text><Text style={[styles.navText, tab === name && styles.active]}>{name}</Text></Pressable>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#fffaf7' }, content: { padding: 22, paddingBottom: 35 }, logo: { fontSize: 31, fontWeight: '800', color: ink, letterSpacing: -1.5, marginBottom: 40 }, eyebrow: { color: accent, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 }, headline: { fontFamily: 'Georgia', fontSize: 44, lineHeight: 50, color: ink, marginBottom: 12 }, title: { fontFamily: 'Georgia', fontSize: 36, color: ink, marginBottom: 16 }, body: { fontSize: 15, lineHeight: 23, color: muted, marginBottom: 19 }, upload: { flexDirection: 'row', alignItems: 'center', backgroundColor: pink, padding: 17, borderRadius: 22, marginTop: 12, marginBottom: 32 }, camera: { backgroundColor: '#f6ccc6', borderRadius: 16, padding: 13, fontSize: 25, color: ink, marginRight: 13 }, chevron: { color: ink, fontSize: 29 }, section: { fontFamily: 'Georgia', fontSize: 23, color: ink, marginBottom: 17, marginTop: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, card: { width: '48%', backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', marginBottom: 15, borderWidth: 1, borderColor: '#f1e5e1' }, cardPhoto: { width: '100%', height: 165, backgroundColor: pink }, heart: { position: 'absolute', right: 9, top: 9, width: 33, height: 33, backgroundColor: 'white', borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, cardBody: { padding: 11 }, cardTitle: { fontSize: 15, fontWeight: '700', color: ink, marginBottom: 4 }, sub: { fontSize: 12, color: muted, marginBottom: 8 }, row: { flexDirection: 'row', justifyContent: 'space-between' }, small: { fontSize: 11, color: muted }, price: { fontSize: 12, color: ink, fontWeight: '700' }, nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#f1e5e1', backgroundColor: 'white', paddingVertical: 10 }, navItem: { flex: 1, alignItems: 'center' }, navIcon: { fontSize: 24, color: muted }, navText: { fontSize: 10, color: muted }, active: { color: accent, fontWeight: '700' }, back: { fontSize: 16, color: ink, marginBottom: 18 }, uploaded: { flexDirection: 'row', backgroundColor: pink, padding: 10, borderRadius: 18, alignItems: 'center', marginBottom: 20 }, thumbnail: { width: 70, height: 70, borderRadius: 13, marginRight: 15 }, heroPhoto: { width: '100%', height: 300, borderRadius: 22, marginBottom: 23, backgroundColor: pink }, pill: { backgroundColor: pink, borderRadius: 17, padding: 15, marginBottom: 20 }, pillText: { color: ink }, button: { backgroundColor: accent, borderRadius: 16, padding: 18, alignItems: 'center' }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700' }, empty: { backgroundColor: pink, borderRadius: 24, padding: 38, alignItems: 'center', marginTop: 30 }, emptyIcon: { color: accent, fontSize: 45, marginBottom: 12 } });
