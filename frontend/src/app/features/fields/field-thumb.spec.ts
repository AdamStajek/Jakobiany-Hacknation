import { thumbPath } from './field-thumb';

const parcel = (coordinates: number[][][]) => ({id: 'p', geometry: {type: 'Polygon' as const, coordinates}});

describe('thumbPath', () => {
  it('daje pustą ścieżkę bez geometrii', () => {
    expect(thumbPath([])).toBe('');
  });

  it('rysuje domknięty obrys mieszczący się w 56×56', () => {
    const d = thumbPath([parcel([[[19, 50], [19.01, 50], [19.01, 50.01], [19, 50.01], [19, 50]]])]);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = (d.match(/-?\d+\.\d/g) ?? []).map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(56);
  });
});
