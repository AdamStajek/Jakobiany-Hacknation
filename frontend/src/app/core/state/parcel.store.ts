import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { Geometry, Parcel } from '../api/types';

/** Identyfikator z rejestru (np. 301101_1.0001.123/4); inne ID to działki z importu GeoJSON. */
export const isRegistryId = (id: string) => REGISTRY_ID.test(id);
const REGISTRY_ID = /^\d{6}_[1-9]\.\d{4}\.(?:AR_\d+\.)?\d+(?:\/\d+)?\.?$/i;

/** Stan wyboru działki: wyszukiwanie i wybór granicy na mapie. */
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

  /**
   * Ładuje działkę z linku, o ile nie jest już wybrana. ID spoza rejestru (działka z importu GeoJSON)
   * nie da się wyszukać, więc wtedy używamy geometrii zapisanej w polu (`saved`).
   */
  async open(id: string, saved?: Geometry | null) {
    if (this.parcel()?.id === id) return;
    if (saved && !isRegistryId(id)) { await this.importGeometry(saved); return; }
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
