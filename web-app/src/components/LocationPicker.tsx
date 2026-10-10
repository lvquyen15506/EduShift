'use client';

import { useEffect, useRef, useState } from 'react';

type Props = { initialLocation?: string; initialLatitude?: number | null; initialLongitude?: number | null };
const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleMapsWindow = Window & { google?: any };
export default function LocationPicker({ initialLocation = '', initialLatitude = null, initialLongitude = null }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && Boolean((window as GoogleMapsWindow).google?.maps?.places));
  const [selected, setSelected] = useState({ location: initialLocation, latitude: initialLatitude, longitude: initialLongitude });
  useEffect(() => {
    if (!mapsKey) return;
    const existing = document.querySelector('script[data-edushift-maps]');
    if (existing) { existing.addEventListener('load', () => setReady(true), { once: true }); return; }
    const script = document.createElement('script'); script.dataset.edushiftMaps = 'true'; script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`; script.async = true; script.onload = () => setReady(true); document.head.appendChild(script);
  }, []);
  useEffect(() => {
    if (!ready || !inputRef.current || !(window as GoogleMapsWindow).google?.maps?.places) return;
    const autocomplete = new (window as GoogleMapsWindow).google.maps.places.Autocomplete(inputRef.current, { fields: ['formatted_address', 'geometry', 'name'], componentRestrictions: { country: 'vn' } });
    autocomplete.addListener('place_changed', () => { const place = autocomplete.getPlace(); const point = place.geometry?.location; if (!point) return; setSelected({ location: place.formatted_address || place.name || inputRef.current?.value || '', latitude: point.lat(), longitude: point.lng() }); });
    return () => (window as GoogleMapsWindow).google?.maps?.event?.clearInstanceListeners(autocomplete);
  }, [ready]);
  const fallbackMap = selected.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.location)}` : 'https://www.google.com/maps';
  return <div className="location-picker"><label>Tên quán / địa chỉ<input ref={inputRef} name="location" required defaultValue={selected.location} placeholder="Tìm tên quán, số nhà, đường..." autoComplete="off" /></label><input type="hidden" name="latitude" value={selected.latitude ?? ''} /><input type="hidden" name="longitude" value={selected.longitude ?? ''} /><p>{mapsKey ? (ready ? 'Chọn một địa điểm trong danh sách Google Maps để lưu chính xác vị trí.' : 'Đang tải tìm kiếm Google Maps...') : 'Nhập địa chỉ rồi mở Google Maps để kiểm tra. Admin cần cấu hình NEXT_PUBLIC_GOOGLE_MAPS_API_KEY để bật gợi ý tự động.'}</p>{selected.latitude != null && selected.longitude != null && <iframe title="Vị trí đã chọn" loading="lazy" src={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}&z=16&output=embed`} />}{!mapsKey && <a href={fallbackMap} target="_blank" rel="noreferrer">Mở Google Maps kiểm tra địa chỉ ↗</a>}</div>;
}
