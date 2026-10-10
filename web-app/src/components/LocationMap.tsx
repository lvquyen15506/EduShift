'use client';

type LocationMapProps = { location: string; latitude?: number | null; longitude?: number | null };
export default function LocationMap({ location, latitude, longitude }: LocationMapProps) {
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const query = hasCoordinates ? `${latitude},${longitude}` : location;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  return <div className="location-map"><div className="location-map-head"><span>⌖ {location}</span><a href={directions} target="_blank" rel="noreferrer">Chỉ đường ↗</a></div>{hasCoordinates ? <iframe title={`Bản đồ ${location}`} loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`} /> : <a className="location-map-search" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer">Mở địa điểm trên Google Maps ↗</a>}</div>;
}
