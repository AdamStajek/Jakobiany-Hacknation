import { FIELD_HIT_PX, FieldShape, fieldsFeatureCollection, markersFeatureCollection } from './map-fields';

const square = (x: number) => ({type: 'Polygon' as const, coordinates: [[[x, 50], [x + 1, 50], [x + 1, 51], [x, 51], [x, 50]]]});
const FIELDS: FieldShape[] = [
  {id: 'a', name: 'Północne', color: '#16a34a', geometry: square(19)},
  {id: 'b', name: 'Za lasem', color: '#2563eb', geometry: square(20)},
];

describe('fieldsFeatureCollection', () => {
  it('tworzy osobny obiekt na pole z id, nazwą i kolorem', () => {
    const {features} = fieldsFeatureCollection(FIELDS, null);
    expect(features.length).toBe(2);
    expect(features[0].properties).toEqual({id: 'a', name: 'Północne', color: '#16a34a', state: 'normal'});
    expect(features[1].geometry).toEqual(FIELDS[1].geometry as GeoJSON.Geometry);
  });

  it('wybrane pole jest „selected”, reszta „dim”', () => {
    const states = fieldsFeatureCollection(FIELDS, 'b').features.map((f) => f.properties?.['state']);
    expect(states).toEqual(['dim', 'selected']);
  });

  it('wyciszona warstwa ma stan „muted” niezależnie od wyboru', () => {
    const states = fieldsFeatureCollection(FIELDS, null, true).features.map((f) => f.properties?.['state']);
    expect(states).toEqual(['muted', 'muted']);
  });

  it('wybrane pole w wyciszonej warstwie jest „selected”, reszta „muted”', () => {
    const states = fieldsFeatureCollection(FIELDS, 'b', true).features.map((f) => f.properties?.['state']);
    expect(states).toEqual(['muted', 'selected']);
  });

  it('bez pól daje pustą kolekcję', () => {
    expect(fieldsFeatureCollection([], 'a').features).toEqual([]);
  });

  it('ma dodatnią tolerancję kliknięcia w granicę', () => {
    expect(FIELD_HIT_PX).toBeGreaterThan(0);
  });

  it('znaczniki mają numery tylko na życzenie', () => {
    expect(markersFeatureCollection([[1, 2], [3, 4]], true).features.map((f) => f.properties?.['n'])).toEqual([1, 2]);
    expect(markersFeatureCollection([[1, 2]], false).features[0].properties).toEqual({});
  });
});
