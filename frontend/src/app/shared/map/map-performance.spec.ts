import { describe, expect, it } from 'vitest';
import { isLite, performanceOptions } from './map-performance';

const desktop = {width: 1440, pixelRatio: 1};

describe('wydajność mapy', () => {
  it('desktop z dobrym łączem nie zmienia opcji', () => {
    expect(isLite(desktop)).toBe(false);
    expect(performanceOptions(desktop)).toEqual({});
  });

  it('telefon, oszczędzanie danych i wolne łącze włączają tryb lite', () => {
    expect(isLite({...desktop, width: 390})).toBe(true);
    expect(isLite({...desktop, connection: {saveData: true}})).toBe(true);
    expect(isLite({...desktop, connection: {effectiveType: '3g'}})).toBe(true);
    expect(isLite({...desktop, memory: 2})).toBe(true);
  });

  it('w trybie lite ogranicza pamięć kafelków i gęstość pikseli', () => {
    const options = performanceOptions({width: 390, pixelRatio: 3});
    expect(options.maxTileCacheSize).toBe(24);
    expect(options.pixelRatio).toBe(2);
    expect(options.fadeDuration).toBe(0);
  });
});
