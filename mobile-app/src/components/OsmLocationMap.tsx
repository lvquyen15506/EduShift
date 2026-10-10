import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { colors } from '../theme';

type Props = { location: string; latitude?: number | null; longitude?: number | null };
export function OsmLocationMap({ location, latitude, longitude }: Props) {
  const [mapReady, setMapReady] = useState(false);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!hasCoordinates) return <View style={styles.fallback}><Text style={styles.fallbackText}>Chưa có tọa độ chính xác cho địa điểm này.</Text></View>;
  const point = { latitude: latitude as number, longitude: longitude as number };
  async function openDirections() {
    const destination = `${point.latitude},${point.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else await Linking.openURL(url);
  }
  return <View style={styles.wrap}><MapView style={styles.map} initialRegion={{ ...point, latitudeDelta: 0.008, longitudeDelta: 0.008 }} onMapReady={() => setMapReady(true)}><UrlTile urlTemplate='https://tile.openstreetmap.de/{z}/{x}/{y}.png' maximumZ={19} flipY={false} /><Marker coordinate={point} title={location} /></MapView><View style={styles.footer}><Text style={styles.location} numberOfLines={2}>⌖ {location}</Text><Pressable accessibilityRole='button' onPress={() => { void openDirections(); }} style={styles.button}><Text style={styles.buttonText}>Chỉ đường</Text></Pressable></View><Text style={styles.attribution}>{mapReady ? '© OpenStreetMap contributors' : 'Đang tải bản đồ OpenStreetMap...'}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  map: { height: 190, width: '100%' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10 },
  location: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  button: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.magenta },
  buttonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  attribution: { paddingHorizontal: 10, paddingBottom: 8, color: colors.muted, fontSize: 9 },
  fallback: { padding: 12, borderRadius: 10, backgroundColor: colors.blush },
  fallbackText: { color: colors.muted, fontSize: 12 },
});
