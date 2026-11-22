import bbox from '@turf/bbox';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Geometry } from '../../core/api/types';
import { markersFeatureCollection } from './map-fields';

const EMPTY = {type: 'FeatureCollection' as const, features: []};

/** Pinezka pola widoczna po oddaleniu mapy (gdy granice działek są zbyt małe). */
export type FieldPin = {id: string; name: string; coordinates: [number, number]; color: string};

/** Dane do narysowania na mapie: wybrana działka, woda, znaczniki i pinezki pól. */
export type MapData = {
  geometry: Geometry | null;
  surface?: GeoJSON.FeatureCollection<GeoJSON.Point>;
  water: [number, number] | null;
  markers: [number, number][];
  numberedMarkers: boolean;
  pins: FieldPin[];
};

export type Bounds = [[number, number], [number, number]];

/** Punkty pinezek z `properties` id, name i color (do stylowania warstw). */
export function pinsFeatureCollection(pins: FieldPin[]): GeoJSON.FeatureCollection {
  return {type: 'FeatureCollection', features: pins.map((pin) =>
    ({type: 'Feature' as const, properties: {id: pin.id, name: pin.name, color: pin.color}, geometry: {type: 'Point' as const, coordinates: pin.coordinates}}))};
}

/** Prostokąt obejmujący geometrię oraz (opcjonalnie) punkt stałej wody. */
export function boundsOf(geometry: Geometry, water: [number, number] | null): Bounds {
  const [west, south, east, north] = bbox({type: 'Feature', properties: {}, geometry} as never);
  return [
    [Math.min(west, water?.[0] ?? west), Math.min(south, water?.[1] ?? south)],
    [Math.max(east, water?.[0] ?? east), Math.max(north, water?.[1] ?? north)],
  ];
}

/** Dopasowuje mapę do geometrii (i wody); bez animacji, gdy użytkownik ją ogranicza. */
export function fitMapTo(map: MapLibreMap, geometry: Geometry, water: [number, number] | null) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  map.fitBounds(boundsOf(geometry, water), {padding: 56, maxZoom: 17, duration: reduced ? 0 : 600});
}

/** Wpisuje dane do źródeł GeoJSON mapy (działka, woda, znaczniki, pinezki). */
export function syncMapData(map: MapLibreMap, data: MapData) {
  const source = (id: string) => map.getSource(id) as GeoJSONSource;
  source('surface').setData(data.surface ?? EMPTY);
  source('markers').setData(markersFeatureCollection(data.markers, data.numberedMarkers));
  source('pins').setData(pinsFeatureCollection(data.pins));
  source('parcel').setData((data.geometry ? {type: 'Feature', properties: {}, geometry: data.geometry} : EMPTY) as GeoJSON.GeoJSON);
  source('water').setData(data.water ? {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: data.water}} : EMPTY);
}
