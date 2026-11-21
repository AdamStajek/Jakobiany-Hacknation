import { HttpErrorResponse } from '@angular/common/http';

/** Zamienia błąd HTTP backendu na czytelny komunikat dla rolnika. */
export function errorMessage(error: unknown, fallback = 'Nie udało się pobrać danych. Spróbuj ponownie.'): string {
  const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return String(detail[0]?.msg ?? fallback).replace(/^Value error, /, '');
  if (error instanceof HttpErrorResponse && error.status === 0) return 'Serwer analizy jest niedostępny. Spróbuj odświeżyć stronę.';
  if (error instanceof HttpErrorResponse && error.status === 503) return 'Baza działek jest jeszcze przygotowywana. Spróbuj za kilka minut lub wczytaj granicę z pliku GeoJSON.';
  if (error instanceof HttpErrorResponse && error.status === 429) return 'Trwają inne analizy. Spróbuj ponownie za chwilę.';
  return fallback;
}
