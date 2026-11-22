import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import type { Passport } from '../api/types';
import { AnalysisStore } from './analysis.store';

type PassportEntry = {loading: boolean; error: string; data: Passport | null};
const EMPTY: PassportEntry = {loading: false, error: '', data: null};

/** Paszporty działek pobierane z API i trzymane w pamięci (klucz: działka + uprawa), żeby nie ładować ich wielokrotnie. */
@Injectable({providedIn: 'root'})
export class PassportStore {
  private readonly api = inject(ApiService);
  private readonly analysis = inject(AnalysisStore);
  private readonly entries = signal<Record<string, PassportEntry>>({});

  entry(parcelId: string, crop: string): PassportEntry {
    return this.entries()[key(parcelId, crop)] ?? EMPTY;
  }

  async load(parcelId: string, crop: string, force = false) {
    const id = key(parcelId, crop);
    const current = this.entries()[id];
    if (current?.loading || (current?.data && !force)) return;
    this.set(id, {loading: true, error: '', data: null});
    try {
      await this.analysis.init();
      const asOf = this.analysis.range().max;
      if (!asOf) throw new Error('Brak daty analizy');
      this.set(id, {loading: false, error: '', data: await this.api.passport(parcelId, asOf, crop)});
    } catch (error) {
      this.set(id, {loading: false, error: errorMessage(error, 'Nie udało się pobrać paszportu pola. Spróbuj ponownie.'), data: null});
    }
  }

  private set(id: string, entry: PassportEntry) {
    this.entries.update((all) => ({...all, [id]: entry}));
  }
}

const key = (parcelId: string, crop: string) => `${parcelId}|${crop}`;
