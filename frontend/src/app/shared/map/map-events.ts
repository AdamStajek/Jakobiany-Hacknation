import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { FIELD_HIT_PX } from './map-fields';

/** Poniżej tego przybliżenia klik w mapę nie wskazuje działki (zbyt duża niepewność punktu). */
const MIN_PICK_ZOOM = 12;

/** Stan i reakcje komponentu potrzebne do obsługi zdarzeń mapy. */
export type MapEventHandlers = {
  /** Trwa rysowanie lub tuż po nim: kliknięcia mapy są ignorowane. */
  clicksBlocked: () => boolean;
  drawing: () => boolean;
  markMode: () => boolean;
  onPoint: (point: {lat: number; lon: number}) => void;
  onField: (id: string) => void;
  onPin: (id: string) => void;
  onZoomHint: () => void;
  onZoomHintClear: () => void;
};

/** Id pola, w którego granicę (z tolerancją palca) trafiło kliknięcie. */
function fieldAt(map: MapLibreMap, point: {x: number; y: number}): string | null {
  if (!map.getLayer('fields-line')) return null;
  const box: [[number, number], [number, number]] = [[point.x - FIELD_HIT_PX, point.y - FIELD_HIT_PX], [point.x + FIELD_HIT_PX, point.y + FIELD_HIT_PX]];
  const id = map.queryRenderedFeatures(box, {layers: ['fields-line']})[0]?.properties['id'];
  return typeof id === 'string' ? id : null;
}

/** Kliknięcia w mapę (wybór działki, pola, znacznik) oraz podpowiedź o zbliżeniu; wywołać przed załadowaniem warstw. */
export function registerMapClicks(map: MapLibreMap, handlers: MapEventHandlers) {
  map.on('click', (event) => {
    if (handlers.clicksBlocked()) return;
    const point = {lat: event.lngLat.lat, lon: event.lngLat.lng};
    if (handlers.markMode()) { handlers.onPoint(point); return; }
    const fieldId = fieldAt(map, event.point);
    if (fieldId) { handlers.onField(fieldId); return; }
    if (map.getLayer('pin-points') && map.queryRenderedFeatures(event.point, {layers: ['pin-clusters', 'pin-points']}).length) return;
    if (map.getZoom() < MIN_PICK_ZOOM) { handlers.onZoomHint(); return; }
    handlers.onZoomHintClear();
    handlers.onPoint(point);
  });
  map.on('zoomend', () => { if (map.getZoom() >= MIN_PICK_ZOOM) handlers.onZoomHintClear(); });
}

/** Kliknięcia w pinezki i grupy pinezek oraz kursor „rączka” nad nimi; wywołać po dodaniu warstw. */
export function registerPinEvents(map: MapLibreMap, handlers: MapEventHandlers) {
  map.on('click', 'pin-clusters', (event) => {
    const feature = event.features?.[0];
    if (!feature || handlers.drawing() || handlers.markMode()) return;
    const source = map.getSource('pins') as GeoJSONSource;
    void source.getClusterExpansionZoom(Number(feature.properties['cluster_id'])).then((zoom) =>
      map.easeTo({center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5}));
  });
  map.on('click', 'pin-points', (event) => {
    const id = event.features?.[0]?.properties['id'];
    if (typeof id !== 'string' || handlers.drawing() || handlers.markMode()) return;
    handlers.onPin(id);
  });
  for (const layer of ['pin-clusters', 'pin-points', 'fields-line']) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = 'crosshair'; });
  }
}
