import { ApiError } from '../../core/api/types';
import { FieldSpec } from './target-fields';

export type Obj = Record<string, unknown>;

/** Tekst pola formularza dla wartości z rekordu. */
export function toText(spec: FieldSpec, v: unknown): string {
  if (v === undefined || v === null) return '';
  switch (spec.kind) {
    case 'ids': return Array.isArray(v) ? v.join(', ') : String(v);
    case 'json': return JSON.stringify(v, null, 2);
    case 'any': return typeof v === 'string' ? v : JSON.stringify(v);
    default: return String(v);
  }
}

export type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

/** Zamienia tekst z formularza na wartość do `changes`. `original` pozwala zachować typ pola `any`. */
export function parseText(spec: FieldSpec, text: string, original: unknown): Parsed {
  const t = text.trim();
  switch (spec.kind) {
    case 'ids': return { ok: true, value: t ? [...new Set(t.split(/[\s,;]+/).filter(Boolean))] : [] };
    case 'json':
      if (!t) return { ok: false, error: 'Podaj wartość JSON.' };
      try { return { ok: true, value: JSON.parse(t) }; } catch { return { ok: false, error: 'Niepoprawny JSON.' }; }
    case 'any':
      if (typeof original === 'string' || original === undefined) return { ok: true, value: text };
      try { return { ok: true, value: JSON.parse(t) }; } catch { return { ok: false, error: 'Wartość ma być zapisana jako JSON.' }; }
    default: return { ok: true, value: text };
  }
}

export interface ChangesResult { changes: Obj; errors: Record<string, string>; }

/**
 * Buduje `changes` tylko z pól zmienionych względem `baseline` (tekst z chwili wyboru rekordu).
 * Dzięki temu po konflikcie 409 korekta zostaje, a pola nietknięte przez eksperta biorą bieżące dane serwera.
 */
export function buildChanges(specs: FieldSpec[], texts: Record<string, string>, baseline: Record<string, string>, original: Obj): ChangesResult {
  const changes: Obj = {};
  const errors: Record<string, string> = {};
  for (const s of specs) {
    const text = texts[s.key] ?? '';
    if (text === (baseline[s.key] ?? '')) continue;
    const r = parseText(s, text, original[s.key]);
    if (r.ok) changes[s.key] = r.value; else errors[s.key] = r.error;
  }
  return { changes, errors };
}

/** Obiekt `changes` z jednego pola JSON (typy bez rejestru). */
export function genericChanges(text: string): ChangesResult {
  if (!text.trim()) return { changes: {}, errors: {} };
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v)) return { changes: v as Obj, errors: {} };
  } catch { /* poniżej */ }
  return { changes: {}, errors: { changes: 'Podaj obiekt JSON, np. {"pole": "wartość"}.' } };
}

export const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export interface FieldDiff { key: string; before: unknown; after: unknown; }

/** Różnice pole po polu (pomija pola audytu nadawane przez serwer). */
export function diffValues(before: Obj, after: Obj, ignore: string[] = AUDIT_FIELDS): FieldDiff[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !ignore.includes(k));
  return keys.filter((k) => !sameValue(before[k], after[k])).map((k) => ({ key: k, before: before[k], after: after[k] }));
}
export const AUDIT_FIELDS = ['revision', 'review_status', 'latest_decision_id', 'id'];

/** Pola rekordu do podglądu (bez pól audytu). */
export const visibleFields = (value: Obj): [string, unknown][] =>
  Object.entries(value).filter(([k]) => !AUDIT_FIELDS.includes(k));

/** Krótki opis pozycji kolejki z pól rekordu danego typu. */
export function itemTitle(type: string, value: Obj, id: string): string {
  const s = (k: string) => (typeof value[k] === 'string' && value[k] ? (value[k] as string) : '');
  const text = type === 'fact' ? [s('key'), display(value['value'])].filter((x) => x !== '—').join(': ')
    : type === 'link' ? [s('relation'), s('rationale')].filter(Boolean).join(' – ')
    : s('title') || s('event') || s('action') || s('rationale') || s('sector_code') || s('name');
  const t = text || id;
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
}

export function display(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  return typeof v === 'string' ? v : JSON.stringify(v, null, 1);
}

export interface FieldErrors { byField: Record<string, string>; general: string[]; }

/**
 * `Problem.details[].field` bywa pusty (walidacja schematu), więc nazwę pola wyciągamy też z treści
 * komunikatu (`'pole' is a required property`). Reszta trafia do listy ogólnej.
 */
export function bindServerErrors(err: ApiError, known: string[]): FieldErrors {
  const byField: Record<string, string> = {};
  const general: string[] = [];
  for (const d of err.fieldErrors) {
    const quoted = d.message.match(/^'([^']+)'/)?.[1];
    const key = [d.field, quoted].find((k): k is string => !!k && known.includes(k));
    if (key) byField[key] = d.message; else general.push(d.field ? `${d.field}: ${d.message}` : d.message);
  }
  if (!err.fieldErrors.length) general.push(err.detail);
  return { byField, general };
}
