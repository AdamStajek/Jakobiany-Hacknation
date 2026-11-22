import { boundsOf, FieldPin, pinsFeatureCollection } from './map-sync';

describe('pinsFeatureCollection', () => {
  it('tworzy punkt na pinezkę z id, nazwą i kolorem', () => {
    const pins: FieldPin[] = [{id: 'a', name: 'Północne', coordinates: [19, 50], color: '#16a34a'}];
    const {features} = pinsFeatureCollection(pins);
    expect(features[0].properties).toEqual({id: 'a', name: 'Północne', color: '#16a34a'});
    expect(features[0].geometry).toEqual({type: 'Point', coordinates: [19, 50]});
  });

  it('bez pinezek daje pustą kolekcję', () => {
    expect(pinsFeatureCollection([]).features).toEqual([]);
  });
});

describe('boundsOf', () => {
  const square = {type: 'Polygon' as const, coordinates: [[[19, 50], [20, 50], [20, 51], [19, 51], [19, 50]]]};

  it('obejmuje samą geometrię bez wody', () => {
    expect(boundsOf(square, null)).toEqual([[19, 50], [20, 51]]);
  });

  it('rozszerza prostokąt o punkt wody', () => {
    expect(boundsOf(square, [18, 52])).toEqual([[18, 50], [20, 52]]);
  });
});
