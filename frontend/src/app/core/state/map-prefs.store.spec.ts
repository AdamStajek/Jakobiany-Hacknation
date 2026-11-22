import { TestBed } from '@angular/core/testing';
import { ConsentStore } from './consent.store';
import { MAP_PREFS_KEY, MapPrefsStore } from './map-prefs.store';

describe('MapPrefsStore', () => {
  beforeEach(() => { localStorage.clear(); TestBed.resetTestingModule(); });

  it('domyślnie pokazuje mapę OSM', () => {
    expect(TestBed.inject(MapPrefsStore).basemap()).toBe('osm');
  });

  it('za zgodą zapisuje wybór i odczytuje go przy starcie', () => {
    TestBed.inject(ConsentStore).grant();
    const store = TestBed.inject(MapPrefsStore);
    store.basemap.set('orto');
    TestBed.tick();
    expect(localStorage.getItem(MAP_PREFS_KEY)).toBe('orto');

    TestBed.resetTestingModule();
    expect(TestBed.inject(MapPrefsStore).basemap()).toBe('orto');
  });

  it('bez zgody trzyma wybór tylko w pamięci', () => {
    const store = TestBed.inject(MapPrefsStore);
    store.basemap.set('orto');
    TestBed.tick();
    expect(localStorage.getItem(MAP_PREFS_KEY)).toBeNull();
    expect(store.basemap()).toBe('orto');
  });
});
