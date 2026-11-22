import { ConfirmedDescription, DemoNotificationQuery } from '../api/types';

export const NOTIFY_KEY = 'pw.notify.v1';
export type NotifyChannel = 'email' | 'app';
type NotifySettings = {enabled: boolean; channel: NotifyChannel; email: string};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Czytelny komunikat o błędzie adresu albo pusty ciąg, gdy adres jest poprawny. */
export function emailProblem(value: string): string {
  const email = value.trim();
  if (!email) return 'Wpisz adres e-mail.';
  return EMAIL_RE.test(email) ? '' : 'Adres e-mail wygląda na niepełny. Przykład: jan@poczta.pl';
}

/** Parametry zapytania o przykład: tylko niepuste wartości z opisu pola i nazwa wybranego pola. */
export function demoQuery(description: ConfirmedDescription | null, fieldName: string | null): DemoNotificationQuery {
  const query: DemoNotificationQuery = {};
  if (fieldName?.trim()) query.field_name = fieldName.trim();
  if (description?.soil.value) query.soil = description.soil.value;
  if (description?.terrain.value) query.terrain = description.terrain.value;
  return query;
}

/** Odczyt zapisanych ustawień; uszkodzony zapis daje null. */
export function parseSettings(raw: string | null): NotifySettings | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const {enabled, channel, email} = value as Record<string, unknown>;
    if (typeof enabled !== 'boolean' || (channel !== 'email' && channel !== 'app') || typeof email !== 'string') return null;
    return {enabled, channel, email};
  } catch { return null; }
}
