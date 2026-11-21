import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import type { Geometry, Parcel, Report } from '../api/types';
import { AnalysisStore } from './analysis.store';

export const FIELD_COLORS = ['green', 'blue', 'amber', 'purple', 'teal', 'pink'] as const;
export type FieldColor = (typeof FIELD_COLORS)[number];

export type FieldParcel = {id: string; area_ha: number; geometry: Geometry};

/** Skrót ostatniego zapisanego raportu pola (same sygnały z backendu, bez przeliczeń). */
export type FieldStatus = {
  risk: string;
  /** Data analizy z raportu (RRRR-MM-DD). */
  date: string;
  /** Kiedy raport zapisano w tej przeglądarce (ISO). Od tego liczymy aktualność. */
  savedAt: string;
  analysisId: string;
  parcelId: string;
  dryDays: number | null;
  balanceMm: number | null;
};

export type Field = {
  id: string;
  name: string;
  color: FieldColor;
  crop: string | null;
  parcels: FieldParcel[];
  status: FieldStatus | null;
};

export type NewField = Pick<Field, 'name' | 'color' | 'crop' | 'parcels'>;

export type Resolution =
  | {state: 'recognized'; parcel: Parcel}
  | {state: 'ambiguous'; candidates: Parcel[]}
  | {state: 'unrecognized'}
  | {state: 'error'; message: string};

export const STORAGE_KEY = 'pw.fields.v1';
/** Raport po tylu dniach uznajemy za nieaktualny (tyle backend trzyma zapisane raporty). */
export const STALE_AFTER_DAYS = 14;
const DAY_MS = 86_400_000;
/** Próg listy „wymaga uwagi”: to filtr po sygnałach raportu, nie nowa ocena ryzyka. */
export const ATTENTION_DRY_DAYS = 7;
const ELEVATED_RISK = new Set(['Podwyższone', 'Sygnał niedoboru']);

export function isStale(status: FieldStatus, now = Date.now()): boolean {
  const saved = Date.parse(status.savedAt);
  return Number.isNaN(saved) || now - saved > STALE_AFTER_DAYS * DAY_MS;
}

/** Powody, dla których pole trafia na listę „wymaga uwagi” (puste = nie trafia). */
export function attentionReasons(status: FieldStatus | null): string[] {
  if (!status) return [];
  const reasons: string[] = [];
  if (ELEVATED_RISK.has(status.risk)) reasons.push(`Ryzyko: ${status.risk}`);
  if (status.dryDays != null && status.dryDays >= ATTENTION_DRY_DAYS) reasons.push(`${status.dryDays} dni bez istotnego opadu`);
  if (status.balanceMm != null && status.balanceMm < 0) reasons.push('Ujemny bilans wody uprawy');
  return reasons;
}

export function statusFromReport(report: Report, now = new Date()): FieldStatus {
  return {
    risk: report.metrics.risk, date: report.date, savedAt: now.toISOString(), analysisId: report.analysis_id, parcelId: report.parcel.id,
    dryDays: report.metrics.recent?.dry_spell_days ?? null, balanceMm: report.metrics.recent?.crop_balance_mm ?? null,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function readStatus(value: unknown): FieldStatus | null {
  if (!isRecord(value) || typeof value['risk'] !== 'string' || typeof value['savedAt'] !== 'string') return null;
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    risk: value['risk'], savedAt: value['savedAt'], date: String(value['date'] ?? ''), analysisId: String(value['analysisId'] ?? ''),
    parcelId: String(value['parcelId'] ?? ''), dryDays: num(value['dryDays']), balanceMm: num(value['balanceMm']),
  };
}

function readField(value: unknown): Field | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string' || !Array.isArray(value['parcels'])) return null;
  const parcels = value['parcels'].filter((p): p is FieldParcel => isRecord(p) && typeof p['id'] === 'string' && isRecord(p['geometry']));
  const color = FIELD_COLORS.find((c) => c === value['color']) ?? 'green';
  return {id: value['id'], name: value['name'], color, crop: typeof value['crop'] === 'string' ? value['crop'] : null, parcels,
    status: readStatus(value['status'])};
}

/** Pola użytkownika zapisane wyłącznie w tej przeglądarce (bez kont i serwera). */
@Injectable({providedIn: 'root'})
export class FieldsStore {
  private readonly api = inject(ApiService);
  private readonly analysis = inject(AnalysisStore);

  readonly fields = signal<Field[]>([]);
  /** Komunikat o problemie z pamięcią przeglądarki (odczyt/zapis). */
  readonly error = signal('');
  readonly attention = computed(() => this.fields()
    .map((field) => ({field, reasons: attentionReasons(field.status)}))
    .filter((item) => item.reasons.length > 0));

  constructor() {
    this.fields.set(this.read());
    // Każdy nowy raport odświeża status pól, które zawierają jego działkę.
    effect(() => {
      const report = this.analysis.report();
      if (report) untracked(() => this.recordReport(report));
    });
  }

  add(input: NewField): Field {
    const field: Field = {...input, name: input.name.trim(), id: crypto.randomUUID(), status: null};
    this.fields.update((list) => [...list, field]);
    const report = this.analysis.report();
    if (report) this.recordReport(report);
    this.persist();
    return this.fields().find((f) => f.id === field.id) ?? field;
  }

  remove(id: string) {
    this.fields.update((list) => list.filter((f) => f.id !== id));
    this.persist();
  }

  recordReport(report: Report) {
    if (!this.fields().some((f) => f.parcels.some((p) => p.id === report.parcel.id))) return;
    const status = statusFromReport(report);
    this.fields.update((list) => list.map((f) => (f.parcels.some((p) => p.id === report.parcel.id) ? {...f, status} : f)));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.fields()));
      this.error.set('');
    } catch {
      this.error.set('Nie udało się zapisać pól w przeglądarce (brak miejsca lub zablokowany zapis). Zmiany znikną po odświeżeniu.');
    }
  }
}
