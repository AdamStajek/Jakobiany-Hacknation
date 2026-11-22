import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import type { Geometry, Passport } from '../api/types';
import { AnalysisStore } from './analysis.store';
import { isRegistryId } from './parcel.store';
import type { Field } from './fields.store';

export type PassportEntry = {loading: boolean; error: string; data: Passport | null; progress: string; percent: number | null};
const EMPTY: PassportEntry = {loading: false, error: '', data: null, progress: '', percent: null};

/** Dane działek pobierane z API (z postępem przez WebSocket) i trzymane w pamięci (klucz: działka + uprawa). */
@Injectable({providedIn: 'root'})
export class PassportStore {
  private readonly api = inject(ApiService);
  private readonly analysis = inject(AnalysisStore);
  private readonly entries = signal<Record<string, PassportEntry>>({});
  private readonly running = new Map<string, AbortController>();

  entry(parcelId: string, crop: string | null): PassportEntry {
    return this.entries()[key(parcelId, crop)] ?? EMPTY;
  }

  /** Po cichu ładuje dane pierwszej działki pola, żeby były gotowe, zanim użytkownik je otworzy. */
  prefetch(field: Field) {
    const parcel = field.parcels[0];
    if (parcel) void this.load(parcel.id, field.crop === 'unknown' ? null : field.crop ?? null, false, parcel.geometry);
  }

  /** `geometry`: granica działki zapisanej z importu GeoJSON (jej ID nie istnieje w rejestrze). */
  async load(parcelId: string, crop: string | null, force = false, geometry?: Geometry | null) {
    const id = key(parcelId, crop);
    const current = this.entries()[id];
    if (this.running.has(id) || (current?.data && !force)) return;
    const abort = new AbortController();
    this.running.set(id, abort);
    this.set(id, {...EMPTY, loading: true, progress: 'Łączymy się z serwerem…'});
    try {
      await this.analysis.init();
      const asOf = this.analysis.range().max;
      if (!asOf) throw new Error('Brak daty analizy');
      const geojson = geometry && !isRegistryId(parcelId) ? {type: 'Feature', properties: {}, geometry} : undefined;
      const data = await this.api.passportWithProgress(parcelId, asOf, crop, ({done, total, label}) => {
        if (abort.signal.aborted) return;
        this.set(id, {...EMPTY, loading: true, progress: total ? `Pobrano: ${label} (${done}/${total})` : 'Pobieramy dane ze źródeł…',
          percent: total ? Math.round((done / total) * 100) : null});
      }, abort.signal, geojson);
      this.set(id, {...EMPTY, data});
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') this.set(id, current ?? EMPTY);
      else this.set(id, {...EMPTY, error: errorMessage(error, 'Nie udało się pobrać danych działki. Spróbuj ponownie.')});
    } finally {
      this.running.delete(id);
    }
  }

  /** Przerywa trwające pobieranie (np. po zmianie pola); wcześniejsze dane w pamięci zostają. */
  cancel(parcelId: string, crop: string | null) {
    this.running.get(key(parcelId, crop))?.abort();
  }

  private set(id: string, entry: PassportEntry) {
    this.entries.update((all) => ({...all, [id]: entry}));
  }
}

const key = (parcelId: string, crop: string | null) => `${parcelId}|${crop ?? ''}`;
