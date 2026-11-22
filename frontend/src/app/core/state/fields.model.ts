import type { Geometry, LastReportInput, Parcel, Report, ServerField } from '../api/types';

export const FIELD_COLORS = ['green', 'blue', 'amber', 'purple', 'teal', 'pink'] as const;
export type FieldColor = (typeof FIELD_COLORS)[number];

/** `area_ha` zna tylko kopia lokalna i świeżo dodane pole; serwer jej nie zwraca. */
export type FieldParcel = {id: string; area_ha?: number; geometry: Geometry};

/** Skrót ostatniego zapisanego raportu pola (same sygnały z backendu, bez przeliczeń). */
export type FieldStatus = {
  risk: string;
  /** Data analizy z raportu (RRRR-MM-DD); dla pól z serwera: data zapisu raportu. */
  date: string;
  /** Kiedy raport zapisano. Od tego liczymy aktualność. */
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

/**
 * Status w formacie serwera (PUT /api/fields/{id}/last-report). Serwer wymaga liczb,
 * więc raport bez danych z ostatnich dni (null) nie jest zapisywany na koncie.
 */
export function toServerLastReport(status: FieldStatus): LastReportInput | null {
  if (status.dryDays === null || status.balanceMm === null) return null;
  return {risk: status.risk, dry_spell_days: status.dryDays, crop_balance_mm: status.balanceMm};
}

/** Serwer przyjmuje kolor wyłącznie jako #rrggbb (odcienie 500 palety Tailwind użyte w `field-colors.ts`). */
const FIELD_COLOR_HEX: Record<FieldColor, string> = {
  green: '#22c55e', blue: '#3b82f6', amber: '#f59e0b', purple: '#a855f7', teal: '#14b8a6', pink: '#ec4899',
};

export const toServerColor = (color: FieldColor): string => FIELD_COLOR_HEX[color];

const colorOf = (value: unknown): FieldColor =>
  FIELD_COLORS.find((c) => c === value || FIELD_COLOR_HEX[c] === String(value).toLowerCase()) ?? 'green';

/** Pole z odpowiedzi serwera na model aplikacji (nieznany kolor wraca do domyślnego). */
export function fieldFromServer(field: ServerField): Field {
  const last = field.last_report;
  return {
    id: field.id, name: field.name, color: colorOf(field.color), crop: field.crop ?? null, parcels: field.parcels,
    status: last ? {risk: last.risk, date: last.saved_at.slice(0, 10), savedAt: last.saved_at, analysisId: '', parcelId: '',
      dryDays: last.dry_spell_days ?? null, balanceMm: last.crop_balance_mm ?? null} : null,
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

/** Odczyt jednego pola z localStorage; uszkodzone wpisy zwracają null. */
export function readField(value: unknown): Field | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string' || !Array.isArray(value['parcels'])) return null;
  const parcels = value['parcels'].filter((p): p is FieldParcel => isRecord(p) && typeof p['id'] === 'string' && isRecord(p['geometry']));
  return {id: value['id'], name: value['name'], color: colorOf(value['color']), crop: typeof value['crop'] === 'string' ? value['crop'] : null,
    parcels, status: readStatus(value['status'])};
}

/** Jedna geometria (MultiPolygon) ze wszystkich działek podanych pól; null, gdy nie ma żadnej. */
export function fieldsGeometry(fields: Field[]): Geometry | null {
  const polygons = fields.flatMap((f) => f.parcels).flatMap(({geometry}) =>
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]);
  return polygons.length ? {type: 'MultiPolygon', coordinates: polygons} : null;
}
