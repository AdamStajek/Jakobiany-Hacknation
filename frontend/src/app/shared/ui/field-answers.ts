import { ProblemZone, Watering } from '../../core/api/types';

const DEFAULT_ZONE_TYPE = 'Inne';
const NO_ACCESS = 'brak dostępu';

type Normalized<T> = {items: T[]; warnings: string[]};

/** Strefa bez typu dostaje „Inne”, bez daty (lub z przyszłą) — dzień analizy. Nic nie jest odrzucane. */
export function normalizeZones(zones: ProblemZone[], day: string): Normalized<ProblemZone> {
  let fixed = 0;
  const items = zones.map(zone => {
    const type = zone.type || DEFAULT_ZONE_TYPE;
    const date = zone.date && zone.date <= day ? zone.date : day;
    if (type !== zone.type || date !== zone.date) fixed++;
    return {...zone, type, date};
  });
  const warnings = fixed ? [`Uzupełniliśmy typ („${DEFAULT_ZONE_TYPE}”) lub datę (dzień analizy) w miejscach problemowych: ${fixed}.`] : [];
  return {items, warnings};
}

/** Zdarzenia bez daty lub z datą po dniu analizy są pomijane (z komunikatem); ujemna dawka traktowana jako brak dawki. */
export function normalizeWatering(events: Watering[], day: string): Normalized<Watering> {
  const items = events
    .filter(event => event.date && event.date <= day)
    .map(event => ({date: event.date, dose_mm: event.dose_mm !== null && event.dose_mm >= 0 ? event.dose_mm : null}));
  const skipped = events.length - items.length;
  const warnings = skipped ? [`Pominęliśmy zdarzenia nawadniania bez daty lub z datą późniejszą niż dzień analizy: ${skipped}.`] : [];
  return {items, warnings};
}

/** „Brak dostępu” wyklucza inne źródła wody; przy sprzeczności zostaje tylko „brak dostępu”. */
export function normalizeSources(sources: string[]): Normalized<string> {
  if (sources.length > 1 && sources.some(source => source.toLowerCase() === NO_ACCESS)) {
    return {items: sources.filter(source => source.toLowerCase() === NO_ACCESS),
      warnings: ['Wybrano brak dostępu do wody razem z innymi źródłami. Uwzględniamy „brak dostępu”.']};
  }
  return {items: sources, warnings: []};
}
