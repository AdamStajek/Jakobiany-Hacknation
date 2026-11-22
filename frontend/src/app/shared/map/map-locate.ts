import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

/**
 * Ustala lokalizację użytkownika: rysuje „tu jesteś” i (gdy `recenter()`) przesuwa mapę.
 * Błędy zgłasza tylko przy jawnym kliknięciu (`explicit`), start mapy jest cichy.
 */
export function requestUserLocation(map: MapLibreMap, explicit: boolean, recenter: () => boolean, onError: (message: string) => void) {
  if (!navigator.geolocation) { if (explicit) onError('Ta przeglądarka nie obsługuje geolokalizacji.'); return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    (map.getSource('me') as GeoJSONSource).setData({type: 'Feature', properties: {},
      geometry: {type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude]}});
    if (!recenter()) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: reduced ? 0 : 800});
  }, (err) => {
    if (!explicit) return;
    onError(err.code === err.PERMISSION_DENIED
      ? 'Lokalizacja jest zablokowana. Kliknij ikonę kłódki obok adresu i zezwól na lokalizację.'
      : 'Nie udało się ustalić lokalizacji (włącz usługi lokalizacji w systemie).');
  }, {timeout: 8000, maximumAge: 300000});
}
