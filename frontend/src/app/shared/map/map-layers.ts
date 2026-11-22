import type { Map as MapLibreMap } from 'maplibre-gl';

const EMPTY = {type: 'FeatureCollection' as const, features: []};

/** Powyżej tego przybliżenia pinezki znikają, bo widać już granice. */
export const PIN_MAX_ZOOM = 14.5;
/** Od tego przybliżenia pole ma etykietę z nazwą. */
const FIELD_LABEL_MIN_ZOOM = 12;

/** Dodaje źródła i warstwy mapy (kolejność = kolejność rysowania). */
export function addMapLayers(map: MapLibreMap) {
  for (const id of ['parcel', 'fields', 'water', 'markers', 'me']) map.addSource(id, {type: 'geojson', data: EMPTY});
  map.addSource('pins', {type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 48, clusterMaxZoom: 13});
  map.addLayer({id: 'parcel-fill', type: 'fill', source: 'parcel', paint: {'fill-color': '#EE8106', 'fill-opacity': 0.16}});
  map.addLayer({id: 'parcel-line', type: 'line', source: 'parcel', paint: {'line-color': '#EE8106', 'line-width': 3}});
  map.addLayer({id: 'fields-fill', type: 'fill', source: 'fields',
    paint: {'fill-color': ['get', 'color'], 'fill-opacity': ['match', ['get', 'state'], 'selected', 0.32, 'dim', 0.06, 'muted', 0.05, 0.22]}});
  map.addLayer({id: 'fields-line', type: 'line', source: 'fields',
    paint: {'line-color': ['get', 'color'], 'line-width': ['match', ['get', 'state'], 'selected', 5, 'dim', 1.5, 'muted', 1.25, 2.5],
      'line-opacity': ['match', ['get', 'state'], 'dim', 0.5, 'muted', 0.75, 1]}});
  map.addLayer({id: 'fields-label', type: 'symbol', source: 'fields', minzoom: FIELD_LABEL_MIN_ZOOM,
    layout: {'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': 13, 'text-optional': true},
    paint: {'text-color': '#1f2937', 'text-halo-color': '#fff', 'text-halo-width': 1.5,
      'text-opacity': ['match', ['get', 'state'], 'dim', 0.55, 'muted', 0.75, 1]}});
  map.addLayer({id: 'water-point', type: 'circle', source: 'water',
    paint: {'circle-radius': 7, 'circle-color': '#0369a1', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
  map.addLayer({id: 'marker-points', type: 'circle', source: 'markers',
    paint: {'circle-radius': ['case', ['has', 'n'], 12, 6], 'circle-color': '#944518', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
  map.addLayer({id: 'marker-numbers', type: 'symbol', source: 'markers', filter: ['has', 'n'],
    layout: {'text-field': ['to-string', ['get', 'n']], 'text-font': ['sans-serif'], 'text-size': 13, 'text-allow-overlap': true},
    paint: {'text-color': '#fff'}});
  map.addLayer({id: 'pin-clusters', type: 'circle', source: 'pins', filter: ['has', 'point_count'], maxzoom: PIN_MAX_ZOOM,
    paint: {'circle-color': '#944518', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3,
      'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 15, 25]}});
  map.addLayer({id: 'pin-cluster-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], maxzoom: PIN_MAX_ZOOM,
    layout: {'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['sans-serif'], 'text-size': 13, 'text-allow-overlap': true},
    paint: {'text-color': '#fff'}});
  map.addLayer({id: 'pin-points', type: 'circle', source: 'pins', filter: ['!', ['has', 'point_count']], maxzoom: PIN_MAX_ZOOM,
    paint: {'circle-color': ['get', 'color'], 'circle-radius': 9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3}});
  map.addLayer({id: 'pin-labels', type: 'symbol', source: 'pins', filter: ['!', ['has', 'point_count']], minzoom: 9, maxzoom: PIN_MAX_ZOOM,
    layout: {'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-optional': true},
    paint: {'text-color': '#1f2937', 'text-halo-color': '#fff', 'text-halo-width': 1.5}});
  // Niebieska kropka „tu jesteś” jak w Google Maps: półprzezroczysta poświata + kropka z białą obwódką.
  map.addLayer({id: 'me-halo', type: 'circle', source: 'me', paint: {'circle-radius': 16, 'circle-color': '#4285f4', 'circle-opacity': 0.25}});
  map.addLayer({id: 'me-dot', type: 'circle', source: 'me',
    paint: {'circle-radius': 7, 'circle-color': '#4285f4', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3}});
}
