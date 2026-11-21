import { HttpErrorResponse } from '@angular/common/http';
import { WsError } from './api.service';

/** Zamienia błąd HTTP backendu na czytelny komunikat dla rolnika. */
export function errorMessage(error: unknown, fallback = 'Nie udało się pobrać danych. Spróbuj ponownie.'): string {
  if (error instanceof WsError) return error.message;
  const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return String(detail[0]?.msg ?? fallback).replace(/^Value error, /, '');
  if (error instanceof HttpErrorResponse && error.status === 0) return 'Serwer analizy jest niedostępny. Spróbuj odświeżyć stronę.';
  if (error instanceof HttpErrorResponse && error.status === 503) return 'Baza działek jest jeszcze przygotowywana. Spróbuj za kilka minut lub wczytaj granicę z pliku GeoJSON.';
  if (error instanceof HttpErrorResponse && error.status === 429) return 'Trwają inne analizy. Spróbuj ponownie za chwilę.';
  return fallback;
}

/** Komunikaty dla ekranów konta: status HTTP ma pierwszeństwo, bo serwer nie ujawnia, czy login istnieje. */
export function authErrorMessage(error: unknown, fallback = 'Nie udało się wykonać operacji. Spróbuj ponownie.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Nieprawidłowy login lub hasło.';
    if (error.status === 409) return 'Konto z takim adresem e-mail lub nazwą już istnieje.';
    if (error.status === 429) return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
    if (error.status === 410) return 'Link wygasł lub został już użyty. Poproś o nowy.';
  }
  return errorMessage(error, fallback);
}
