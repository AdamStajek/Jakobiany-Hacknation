import bbox from '@turf/bbox';
import type { Geometry } from '../../core/api/types';
import { Field, fieldsGeometry, toServerColor } from '../../core/state/fields.store';
import type { FieldShape } from '../../shared/map/map-fields';
import type { FieldPin } from '../../shared/map/wodo-map';

/** Osobny obiekt na pole (kolor, nazwa, geometria wszystkich jego działek). */
export function fieldShapes(fields: Field[]): FieldShape[] {
  return fields.flatMap((field) => {
    const geometry = fieldsGeometry([field]);
    return geometry ? [{id: field.id, name: field.name, color: toServerColor(field.color), geometry}] : [];
  });
}

/** Jedna pinezka na pole (środek jego działek), widoczna po oddaleniu mapy. */
export function fieldPins(fields: Field[]): FieldPin[] {
  return fields.flatMap((field) => {
    const polygons = field.parcels.flatMap(({geometry}) =>
      geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]);
    if (!polygons.length) return [];
    const [w, s, e, n] = bbox({type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon', coordinates: polygons}} as never);
    return [{id: field.id, name: field.name, color: toServerColor(field.color), coordinates: [(w + e) / 2, (s + n) / 2] as [number, number]}];
  });
}

/** Dopasowanie mapy: wybrane pole albo wszystkie pola razem (MultiPolygon). */
export function mapGeometry(fields: Field[], selected: Field | null): Geometry | null {
  return fieldsGeometry(selected ? [selected] : fields);
}
