import { Field, attentionReasons, isStale } from '../../core/state/fields.store';

export type CropStat = {key: string; label: string; fields: number; areaHa: number | null};
export type FieldRow = {
  id: string;
  name: string;
  cropLabel: string;
  areaHa: number | null;
  parcels: number;
  /** Status z ostatniego raportu (z backendu), `null` gdy brak raportu. */
  risk: string | null;
  reasons: string[];
  reportDate: string | null;
  stale: boolean;
};
export type FarmStats = {
  fields: number;
  parcels: number;
  /** Suma tylko wtedy, gdy powierzchnia jest znana dla wszystkich działek. */
  totalAreaHa: number | null;
  crops: CropStat[];
  attention: {id: string; name: string; reasons: string[]}[];
  withoutReport: string[];
  stale: string[];
  /** Najnowsza data raportu spośród pól. */
  lastReportDate: string | null;
  rows: FieldRow[];
};

const NO_CROP = 'Uprawa nieokreślona';

/** Powierzchnia pola, gdy znana dla każdej działki (jak w karcie pola). */
export function fieldArea(field: Field): number | null {
  return field.parcels.every((p) => p.area_ha != null) ? field.parcels.reduce((sum, p) => sum + (p.area_ha ?? 0), 0) : null;
}

const sumKnown = (areas: (number | null)[]): number | null => (areas.every((a) => a !== null) ? areas.reduce<number>((s, a) => s + (a ?? 0), 0) : null);

/** Tylko sumowanie i grupowanie danych pól; status i powody uwagi pochodzą ze sklepu/backendu. */
export function farmStats(fields: Field[], cropLabel: (id: string) => string, now = Date.now()): FarmStats {
  const rows: FieldRow[] = fields.map((field) => ({
    id: field.id, name: field.name,
    cropLabel: field.crop ? cropLabel(field.crop) || field.crop : NO_CROP,
    areaHa: fieldArea(field), parcels: field.parcels.length,
    risk: field.status?.risk ?? null,
    reasons: attentionReasons(field.status),
    reportDate: field.status?.date ?? null,
    stale: !!field.status && isStale(field.status, now),
  }));
  const groups = new Map<string, FieldRow[]>();
  for (const row of rows) groups.set(row.cropLabel, [...(groups.get(row.cropLabel) ?? []), row]);
  const crops = [...groups].map(([label, items]): CropStat => ({key: label, label, fields: items.length, areaHa: sumKnown(items.map((r) => r.areaHa))}))
    .sort((a, b) => b.fields - a.fields || a.label.localeCompare(b.label, 'pl'));
  const dates = rows.flatMap((r) => (r.reportDate ? [r.reportDate] : [])).sort();
  return {
    fields: rows.length,
    parcels: rows.reduce((s, r) => s + r.parcels, 0),
    totalAreaHa: rows.length ? sumKnown(rows.map((r) => r.areaHa)) : null,
    crops,
    attention: rows.filter((r) => r.reasons.length).map((r) => ({id: r.id, name: r.name, reasons: r.reasons})),
    withoutReport: rows.filter((r) => !r.reportDate).map((r) => r.name),
    stale: rows.filter((r) => r.stale).map((r) => r.name),
    lastReportDate: dates.at(-1) ?? null,
    rows,
  };
}
