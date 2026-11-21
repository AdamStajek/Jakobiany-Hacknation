import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../api/api.service';
import { Parcel } from '../api/types';
import { ParcelStore } from './parcel.store';

const parcel = (id: string): Parcel => ({
  id, source: 'test', commune: null, region: null, area_ha: 1, centroid: [19, 52],
  geometry: {type: 'Polygon', coordinates: []},
});

function setup(api: Partial<Record<keyof ApiService, unknown>>) {
  TestBed.configureTestingModule({providers: [{provide: ApiService, useValue: api}]});
  return TestBed.inject(ParcelStore);
}

describe('ParcelStore', () => {
  it('wybiera jedyną znalezioną działkę', async () => {
    const store = setup({searchParcels: async () => ({parcels: [parcel('A')]})});
    await store.search('A');
    expect(store.parcel()?.id).toBe('A');
    expect(store.choices()).toEqual([]);
  });

  it('przy kilku działkach prosi o wybór', async () => {
    const store = setup({searchParcels: async () => ({parcels: [parcel('A'), parcel('B')]})});
    await store.search('x');
    expect(store.parcel()).toBeNull();
    expect(store.choices().length).toBe(2);
  });

  it('odrzuca puste zapytanie bez wywołania API', async () => {
    const search = vi.fn();
    const store = setup({searchParcels: search});
    await store.search('   ');
    expect(search).not.toHaveBeenCalled();
    expect(store.error()).toContain('Wpisz');
  });

  it('pokazuje błąd backendu i zdejmuje stan ładowania', async () => {
    const store = setup({searchParcels: async () => { throw new HttpErrorResponse({status: 404, error: {detail: 'Brak.'}}); }});
    await store.search('x');
    expect(store.error()).toBe('Brak.');
    expect(store.loading()).toBe(false);
  });

  it('open() nie pobiera ponownie już wybranej działki', async () => {
    const search = vi.fn(async () => ({parcels: [parcel('A')]}));
    const store = setup({searchParcels: search});
    await store.open('A');
    await store.open('A');
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('importGeometry zapamiętuje GeoJSON do analizy', async () => {
    const store = setup({importParcel: async () => parcel('Działka z GeoJSON')});
    await store.importGeometry({type: 'Polygon', coordinates: []});
    expect(store.importedGeometry()).not.toBeNull();
    expect(store.parcel()?.id).toBe('Działka z GeoJSON');
  });

  it('odrzuca zbyt duży plik GeoJSON', async () => {
    const store = setup({});
    await store.importFile(new File(['x'.repeat(600_001)], 'a.geojson'));
    expect(store.error()).toContain('600 kB');
  });
});
