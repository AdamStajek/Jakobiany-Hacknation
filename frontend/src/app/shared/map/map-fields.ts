import type { Geometry } from '../../core/api/types';

/** Pole widoczne na mapie: jeden obiekt na pole (geometria wszystkich jego działek), kolor jako #rrggbb. */
export type FieldShape = {id: string; name: string; color: string; geometry: Geometry};

/** Stan pola względem wyboru: bez wyboru wszystkie są „normal”, po wyborze reszta jest przygaszona. */
export type FieldState = 'normal' | 'selected' | 'dim' | 'muted';

/** Odległość (px) od granicy pola, w której kliknięcie wybiera pole. */
export const FIELD_HIT_PX = 12;

/** Osobny obiekt GeoJSON na pole, z `properties` id, name, color i state (do stylowania warstw). `muted`: wyciszona warstwa (tło dla wybranej działki). */
export function fieldsFeatureCollection(fields: FieldShape[], selectedId: string | null, muted = false): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fields.map((field) => ({
      type: 'Feature' as const,
      properties: {id: field.id, name: field.name, color: field.color, state: muted ? 'muted' : stateOf(field.id, selectedId)},
      geometry: field.geometry as GeoJSON.Geometry,
    })),
  };
}

function stateOf(id: string, selectedId: string | null): FieldState {
  if (selectedId === null) return 'normal';
  return id === selectedId ? 'selected' : 'dim';
}

/** Znaczniki z numerem (1, 2, 3…) w kolejności dodawania; bez numeracji `properties` jest puste. */
export function markersFeatureCollection(markers: [number, number][], numbered: boolean): GeoJSON.FeatureCollection {
  return {type: 'FeatureCollection', features: markers.map((coordinates, index) =>
    ({type: 'Feature' as const, properties: numbered ? {n: index + 1} : {}, geometry: {type: 'Point' as const, coordinates}}))};
}
