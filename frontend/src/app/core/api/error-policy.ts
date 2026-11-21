import { HttpContext, HttpContextToken } from '@angular/common/http';
import { API_ERROR_HINT } from '../labels';
import { ApiError } from './types';

/**
 * Zakres globalnej obsługi błędów dla żądania:
 * - `default`: tylko błędy infrastruktury (brak sieci, 401, 403, 5xx); resztę (404/409/413/415/422) komunikuje widok;
 * - `all`: dodatkowo toast dla 404/409/413/415/422 (gdy widok nie ma własnego komunikatu);
 * - `none`: globalny handler milczy (widok obsługuje wszystko sam).
 */
export type ErrorScope = 'default' | 'all' | 'none';

export const ERROR_SCOPE = new HttpContextToken<ErrorScope>(() => 'default');

export const withErrorScope = (scope: ErrorScope, ctx = new HttpContext()) => ctx.set(ERROR_SCOPE, scope);

/** Statusy, które globalny handler zgłasza zawsze (poza `none`). */
export const isInfraError = (e: ApiError) => e.status === 0 || e.status === 401 || e.status === 403 || e.status >= 500;

/** Statusy zgłaszane globalnie tylko przy `scope: 'all'`. */
export const isContentError = (e: ApiError) => [404, 409, 413, 415, 422].includes(e.status);

/** Komunikat dla użytkownika: znany kod → podpowiedź, potem wyjątki po statusie, w innym razie szczegół z backendu. */
export function describeError(e: ApiError): { summary: string; detail: string } {
  if (e.status === 0) return { summary: 'Brak połączenia', detail: 'Nie można połączyć się z serwerem.' };
  const hint = API_ERROR_HINT[e.code];
  if (e.status === 401) return { summary: 'Wymagane logowanie', detail: hint ?? 'Sesja jest nieważna lub brakuje tokenu.' };
  if (e.status === 403) return { summary: 'Brak uprawnień', detail: hint ?? 'Wybrana rola nie ma dostępu do tej operacji.' };
  if (e.status === 404) return { summary: 'Nie znaleziono', detail: hint ?? 'Zasób nie istnieje lub został usunięty.' };
  if (e.status === 409) return { summary: 'Konflikt zmian', detail: hint ?? e.detail };
  if (e.status === 413) return { summary: 'Plik za duży', detail: API_ERROR_HINT['payload_too_large'] };
  if (e.status === 415) return { summary: 'Nieobsługiwany typ pliku', detail: API_ERROR_HINT['unsupported_document_type'] };
  if (e.status >= 500) return { summary: 'Błąd serwera', detail: 'Serwer nie mógł zrealizować żądania. Spróbuj ponownie za chwilę.' };
  return { summary: 'Nie udało się wykonać operacji', detail: hint ?? e.detail };
}
