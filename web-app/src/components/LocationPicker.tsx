'use client';
import { useEffect, useState } from 'react';
type Props = { initialLocation?: string; initialLatitude?: number | null; initialLongitude?: number | null };
type SearchResult = { display_name: string; lat: string; lon: string; countrycode?: string };
type PhotonResult = { properties?: { name?: string; street?: string; city?: string; state?: string; country?: string }; geometry?: { coordinates?: [number, number] } };
type GeoPoint = { latitude: number; longitude: number };
const isVietnam = (latitude: number, longitude: number) => latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110;
const distance = (item: SearchResult, point: GeoPoint) => Math.hypot(Number(item.lat) - point.latitude, Number(item.lon) - point.longitude);
function nearest(items: SearchResult[], point: GeoPoint | null) { return point ? [...items].sort((a, b) => distance(a, point) - distance(b, point)) : items; }
function unique(items: SearchResult[]) { const seen = new Set<string>(); return items.filter(item => { const key = Number(item.lat).toFixed(5) + ',' + Number(item.lon).toFixed(5); if (seen.has(key)) return false; seen.add(key); return true; }); }
async function photonSearch(value: string, signal: AbortSignal, point: GeoPoint | null): Promise<SearchResult[]> {
  const nearby = point ? '&lat=' + point.latitude + '&lon=' + point.longitude : '';
  const response = await fetch('https://photon.komoot.io/api/?lang=default&limit=20' + nearby + '&q=' + encodeURIComponent(value), { signal });
  if (!response.ok) throw new Error('search failed');
  const data = await response.json() as { features?: PhotonResult[] };
  return (data.features || []).flatMap(item => { const coordinates = item.geometry?.coordinates; if (!coordinates || !isVietnam(coordinates[1], coordinates[0])) return []; const p = item.properties || {}; const name = p.name || [p.street, p.city].filter(Boolean).join(', '); const display_name = [name, p.city, p.state, p.country].filter((part, index, all) => part && all.indexOf(part) === index).join(', '); return display_name ? [{ display_name, lat: String(coordinates[1]), lon: String(coordinates[0]) }] : []; });
}
function mapUrl(latitude: number, longitude: number) { const delta = 0.0035; return 'https://www.openstreetmap.org/export/embed.html?bbox=' + (longitude - delta) + ',' + (latitude - delta) + ',' + (longitude + delta) + ',' + (latitude + delta) + '&layer=mapnik&marker=' + latitude + ',' + longitude; }
export default function LocationPicker({ initialLocation = '', initialLatitude = null, initialLongitude = null }: Props) {
  const [query, setQuery] = useState(initialLocation); const [results, setResults] = useState<SearchResult[]>([]); const [selected, setSelected] = useState({ location: initialLocation, latitude: initialLatitude, longitude: initialLongitude });
  const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState(false); const [searched, setSearched] = useState(false);
  const [nearby, setNearby] = useState<GeoPoint | null>(null); const [areaHint, setAreaHint] = useState('');
  useEffect(() => { navigator.geolocation?.getCurrentPosition(position => { const point = { latitude: position.coords.latitude, longitude: position.coords.longitude }; setNearby(point); fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=' + point.latitude + '&lon=' + point.longitude, { headers: { 'Accept-Language': 'vi' } }).then(response => response.ok ? response.json() : Promise.reject(new Error('reverse failed'))).then(data => setAreaHint(data.address?.city || data.address?.town || data.address?.municipality || data.address?.state || '')).catch(() => undefined); }, () => undefined, { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 }); }, []);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || value === selected.location) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true); setSearchError(false); setSearched(false);
      try {
        const scopedValue = areaHint && !value.toLocaleLowerCase().includes(areaHint.toLocaleLowerCase()) ? value + ' ' + areaHint : value;
        const viewbox = nearby ? '&viewbox=' + (nearby.longitude - 0.8) + ',' + (nearby.latitude + 0.8) + ',' + (nearby.longitude + 0.8) + ',' + (nearby.latitude - 0.8) : '';
        const nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=12&countrycodes=vn&bounded=0' + viewbox + '&q=' + encodeURIComponent(scopedValue);
        const [nominatim, photon] = await Promise.allSettled([
          fetch(nominatimUrl, { signal: controller.signal, headers: { 'Accept-Language': 'vi' } }).then(response => response.ok ? response.json() as Promise<SearchResult[]> : Promise.reject(new Error('search failed'))),
          photonSearch(scopedValue, controller.signal, nearby),
        ]);
        const nominatimItems = nominatim.status === 'fulfilled' ? nominatim.value : [];
        const photonItems = photon.status === 'fulfilled' ? photon.value : [];
        const localItems = unique([...nominatimItems, ...photonItems].filter(item => isVietnam(Number(item.lat), Number(item.lon))));
        if (!localItems.length && nominatim.status === 'rejected' && photon.status === 'rejected') throw new Error('search failed');
        setResults(nearest(localItems, nearby).slice(0, 8)); setSearched(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') { try { setResults(nearest(await photonSearch(value, controller.signal, nearby), nearby).slice(0, 8)); setSearched(true); } catch { setResults([]); setSearchError(true); setSearched(true); } }
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected.location, nearby, areaHint]);
  function choose(item: SearchResult) { setQuery(item.display_name); setResults([]); setSelected({ location: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) }); }
  const map = selected.latitude != null && selected.longitude != null ? mapUrl(selected.latitude, selected.longitude) : '';
  return <div className='location-picker'><label>Tên quán / địa chỉ<input name='location' required value={query} onChange={event => { setQuery(event.target.value); setResults([]); setSearched(false); setSelected({ location: '', latitude: null, longitude: null }); }} placeholder='Ví dụ: bún ốc, Highlands Hồ Gươm...' autoComplete='off' /></label>{searching && <div className='location-status'>Đang tìm quán {areaHint ? 'gần ' + areaHint : 'gần bạn'}...</div>}{results.length > 0 && <div className='location-results' role='listbox' aria-label='Địa điểm gợi ý'>{results.map(item => <button type='button' key={item.lat + item.lon} onClick={() => choose(item)}>{item.display_name}</button>)}</div>}{!searching && searched && !searchError && results.length === 0 && <div className='location-status'>Chưa tìm thấy địa điểm. Hãy thêm quận, thành phố, ví dụ “bún ốc Cầu Giấy”.</div>}{searchError && <div className='location-status location-status-error'>Không thể tìm địa điểm lúc này. Kiểm tra mạng rồi thử lại.</div>}<input type='hidden' name='latitude' value={selected.latitude ?? ''} /><input type='hidden' name='longitude' value={selected.longitude ?? ''} /><p>Gõ tên quán hoặc địa chỉ, chọn một gợi ý OpenStreetMap để ghim bản đồ chính xác.</p>{map && <iframe title='Vị trí đã chọn' loading='lazy' src={map} />}</div>;
}
