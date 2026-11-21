import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import type { Report } from '../api/types';
import { AnalysisStore } from './analysis.store';
import { AuthStore } from './auth.store';
import { Field, NewField, Resolution, STORAGE_KEY, attentionReasons, fieldFromServer, readField, statusFromReport, toServerLastReport } from './fields.model';

export * from './fields.model';

export type FieldsSource = 'server' | 'local';
export type MigrationResult = {moved: number; failed: number};

/**
 * Pola użytkownika. Zalogowany: źródłem jest serwer. Gość: localStorage tej przeglądarki.
 * Komponenty widzą jedną powierzchnię (`fields`, `add`, `remove`, `recordReport`) niezależnie od źródła.
 */
@Injectable({providedIn: 'root'})
export class FieldsStore {
  private readonly api = inject(ApiService);
  private readonly analysis = inject(AnalysisStore);
  private readonly auth = inject(AuthStore);

  /** Skąd pochodzą pola widoczne w aplikacji. */
  readonly source = computed<FieldsSource>(() => (this.auth.loggedIn() ? 'server' : 'local'));
  private readonly local = signal<Field[]>([]);
  private readonly remote = signal<Field[]>([]);
  readonly fields = computed(() => (this.source() === 'server' ? this.remote() : this.local()));
  /** Pola zapisane w tej przeglądarce (do przeniesienia na konto po zalogowaniu). */
  readonly localFields = this.local.asReadonly();
  /** Trwa pobieranie pól z serwera. */
  readonly loading = signal(false);
  readonly migrating = signal(false);
  /** Komunikat o problemie z zapisem lub odczytem pól (przeglądarka albo serwer). */
  readonly error = signal('');
  readonly attention = computed(() => this.fields()
    .map((field) => ({field, reasons: attentionReasons(field.status)}))
    .filter((item) => item.reasons.length > 0));

  constructor() {
    this.local.set(this.read());
    effect(() => {
      const user = this.auth.user();
      untracked(() => { if (user) void this.load(); else this.remote.set([]); });
    });
    // Każdy nowy raport odświeża status pól, które zawierają jego działkę.
    effect(() => {
      const report = this.analysis.report();
      if (report) untracked(() => void this.recordReport(report));
    });
  }

  /** Pobiera pola z serwera (tylko dla zalogowanego). */
  async load() {
    if (!this.auth.loggedIn()) return;
    this.loading.set(true);
    try {
      this.remote.set((await this.api.serverFields()).map(fieldFromServer));
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się pobrać pól z konta. Spróbuj ponownie.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Dodaje pole w aktywnym źródle; przy błędzie ustawia `error` i zwraca null. */
  async add(input: NewField): Promise<Field | null> {
    const clean = {...input, name: input.name.trim()};
    let field: Field;
    if (this.source() === 'server') {
      try {
        const body = {name: clean.name, color: clean.color, crop: clean.crop, parcels: clean.parcels.map(({id, geometry}) => ({id, geometry}))};
        field = {...fieldFromServer(await this.api.createServerField(body)), parcels: clean.parcels};
      } catch (error) {
        this.error.set(errorMessage(error, 'Nie udało się zapisać pola na koncie. Spróbuj ponownie.'));
        return null;
      }
      this.error.set('');
      this.remote.update((list) => [...list, field]);
    } else {
      field = {...clean, id: crypto.randomUUID(), status: null};
      this.local.update((list) => [...list, field]);
      this.persist();
    }
    const report = this.analysis.report();
    if (report) await this.recordReport(report);
    return this.fields().find((f) => f.id === field.id) ?? field;
  }

  async remove(id: string) {
    if (this.source() === 'server') {
      try {
        await this.api.deleteServerField(id);
        this.error.set('');
      } catch (error) {
        this.error.set(errorMessage(error, 'Nie udało się usunąć pola z konta. Spróbuj ponownie.'));
        return;
      }
      this.remote.update((list) => list.filter((f) => f.id !== id));
    } else {
      this.local.update((list) => list.filter((f) => f.id !== id));
      this.persist();
    }
  }

  /** Zapisuje status z raportu w polach zawierających jego działkę (lokalnie albo przez PUT last-report). */
  async recordReport(report: Report) {
    const hit = (f: Field) => f.parcels.some((p) => p.id === report.parcel.id);
    if (!this.fields().some(hit)) return;
    const status = statusFromReport(report);
    if (this.source() === 'local') {
      this.local.update((list) => list.map((f) => (hit(f) ? {...f, status} : f)));
      this.persist();
      return;
    }
    const targets = this.remote().filter(hit);
    this.remote.update((list) => list.map((f) => (hit(f) ? {...f, status} : f)));
    const body = toServerLastReport(status);
    if (!body) return;
    try {
      await Promise.all(targets.map((f) => this.api.putLastReport(f.id, body)));
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się zapisać raportu przy polu na koncie.'));
    }
  }

  /** Przenosi pola z przeglądarki na konto. Przeniesione znikają z localStorage, nieprzeniesione zostają. */
  async migrateLocal(): Promise<MigrationResult> {
    const result: MigrationResult = {moved: 0, failed: 0};
    if (!this.auth.loggedIn() || this.migrating()) return result;
    this.migrating.set(true);
    for (const field of this.local()) {
      try {
        const body = {name: field.name, color: field.color, crop: field.crop, parcels: field.parcels.map(({id, geometry}) => ({id, geometry}))};
        const created = await this.api.createServerField(body);
        const last = field.status ? toServerLastReport(field.status) : null;
        if (last) await this.api.putLastReport(created.id, last);
        this.local.update((list) => list.filter((f) => f.id !== field.id));
        this.persist();
        result.moved++;
      } catch {
        result.failed++;
      }
    }
    this.migrating.set(false);
    await this.load();
    if (result.failed) this.error.set(`Nie udało się przenieść ${result.failed} pól. Zostały w tej przeglądarce, spróbuj ponownie.`);
    return result;
  }

  /** Usuwa kopię pól zapisaną w tej przeglądarce (np. gdy użytkownik nie chce ich przenosić). */
  discardLocal() {
    this.local.set([]);
    this.persist();
  }

  /** Rozpoznaje jeden wpisany numer działki przez wyszukiwarkę backendu. */
  async resolve(token: string): Promise<Resolution> {
    try {
      const {parcels} = await this.api.searchParcels(token);
      if (parcels.length === 0) return {state: 'unrecognized'};
      return parcels.length === 1 ? {state: 'recognized', parcel: parcels[0]} : {state: 'ambiguous', candidates: parcels};
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 422)) return {state: 'unrecognized'};
      return {state: 'error', message: errorMessage(error)};
    }
  }

  private read(): Field[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data: unknown = JSON.parse(raw);
      return Array.isArray(data) ? data.map(readField).filter((f): f is Field => f !== null) : [];
    } catch {
      this.error.set('Nie udało się odczytać zapisanych pól z przeglądarki.');
      return [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.local()));
      if (this.source() === 'local') this.error.set('');
    } catch {
      this.error.set('Nie udało się zapisać pól w przeglądarce (brak miejsca lub zablokowany zapis). Zmiany znikną po odświeżeniu.');
    }
  }
}
