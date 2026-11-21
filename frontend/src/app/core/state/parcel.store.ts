import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { Parcel } from '../api/types';

const MAX_GEOJSON_BYTES = 600_000;

/** Stan wyboru działki: wyszukiwanie, kliknięcie na mapie, import GeoJSON. */
@Injectable({providedIn: 'root'})
export class ParcelStore {
  private readonly api = inject(ApiService);

  readonly parcel = signal<Parcel | null>(null);
  readonly choices = signal<Parcel[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  /** Oryginalny GeoJSON, gdy działka pochodzi z importu (analiza wysyła geometrię zamiast ID). */
  readonly importedGeometry = signal<object | null>(null);

  select(parcel: Parcel, geojson: object | null = null) {
    this.parcel.set(parcel);
    this.choices.set([]);
    this.importedGeometry.set(geojson);
    this.error.set('');
  }

  clear() {
    this.parcel.set(null);
    this.choices.set([]);
    this.importedGeometry.set(null);
  }

  async search(query: string) {
    const text = query.trim();
    if (!text) { this.error.set('Wpisz numer działki lub wybierz ją na mapie.'); return; }
    await this.load(() => this.api.searchParcels(text));
  }

  /** Ładuje działkę z linku, o ile nie jest już wybrana. */
  async open(id: string) {
    if (this.parcel()?.id === id) return;
    await this.load(() => this.api.searchParcels(id));
  }

  /** Własna granica narysowana na mapie. */
  async importGeometry(geometry: object) {
    if (this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      const geojson = {type: 'Feature', properties: {}, geometry};
      this.select(await this.api.importParcel(geojson), geojson);
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się użyć narysowanej granicy.'));
    } finally {
      this.loading.set(false);
    }
  }

  async searchPoint(lat: number, lon: number) {
    await this.load(() => this.api.parcelsByPoint(lat, lon));
  }

  async importFile(file: File) {
    if (this.loading()) return;
    this.error.set('');
    if (file.size > MAX_GEOJSON_BYTES) { this.error.set('Plik GeoJSON musi mieć mniej niż 600 kB.'); return; }
    this.loading.set(true);
    try {
      const geojson: object = JSON.parse(await file.text());
      this.select(await this.api.importParcel(geojson), geojson);
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się odczytać prawidłowego pliku GeoJSON.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async load(request: () => Promise<{parcels: Parcel[]}>) {
    if (this.loading()) return;
    this.error.set('');
    this.choices.set([]);
    this.loading.set(true);
    try {
      const {parcels} = await request();
      if (parcels.length === 1) this.select(parcels[0]);
      else this.choices.set(parcels);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
