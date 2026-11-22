import type { Geometry } from '../../core/api/types';
import type { Field } from '../../core/state/fields.store';
import { fieldPins, fieldShapes, mapGeometry } from './field-map';

const square = (x: number): Geometry => ({type: 'Polygon', coordinates: [[[x, 0], [x + 2, 0], [x + 2, 4], [x, 4], [x, 0]]]});
const field = (id: string, x: number): Field =>
  ({id, name: `Pole ${id}`, color: 'green', crop: null, parcels: [{id: `${id}.1`, area_ha: 1, geometry: square(x)}], status: null});
const empty: Field = {...field('e', 0), parcels: []};

describe('field-map', () => {
  it('tworzy kształt tylko dla pól z geometrią', () => {
    expect(fieldShapes([field('a', 0), empty]).map((s) => s.id)).toEqual(['a']);
  });

  it('stawia pinezkę w środku obwiedni działek pola', () => {
    const [pin] = fieldPins([field('a', 10), empty]);
    expect(pin.id).toBe('a');
    expect(pin.coordinates).toEqual([11, 2]);
    expect(fieldPins([empty])).toEqual([]);
  });

  it('dopasowuje mapę do wybranego pola albo do wszystkich', () => {
    const a = field('a', 0);
    const b = field('b', 10);
    expect(mapGeometry([a, b], a)).toEqual(mapGeometry([a], null));
    expect(mapGeometry([a, b], null)).not.toEqual(mapGeometry([a], null));
    expect(mapGeometry([], null)).toBeNull();
  });
});
