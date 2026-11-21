/** Trasy, na które nie wracamy po zalogowaniu (zapętlenie albo ekrany jednorazowe). */
const EXCLUDED = ['/zaloguj', '/rejestracja', '/potwierdz-email', '/zapomniane-haslo', '/reset-hasla'];
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f]/;

/**
 * Zwraca bezpieczny adres powrotu po zalogowaniu: tylko ścieżka wewnątrz aplikacji
 * (zaczyna się od jednego „/”, bez schematu i podwójnego ukośnika), inaczej adres zastępczy.
 */
export function safeReturnUrl(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || CONTROL_CHARS.test(raw)) return fallback;
  const path = raw.split(/[?#]/)[0];
  return EXCLUDED.some((p) => path === p || path.startsWith(p + '/')) ? fallback : raw;
}

/** Parametry zapytania dla linku do logowania, który wraca na podaną stronę. */
export function loginQuery(returnUrl: string): {returnUrl?: string} {
  const safe = safeReturnUrl(returnUrl, '');
  return safe ? {returnUrl: safe} : {};
}
