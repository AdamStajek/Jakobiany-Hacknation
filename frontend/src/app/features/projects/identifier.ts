export type IdScheme = 'bzp' | 'kpo';

export const ID_SCHEMES: { value: IdScheme; label: string; hint: string }[] = [
  { value: 'bzp', label: 'BZP', hint: 'np. 2023/BZP 00123456' },
  { value: 'kpo', label: 'KPO', hint: 'np. A2.1.1-0042' },
];

// Formaty wstępne – do potwierdzenia z backendem (frontend-braki.md §12).
const PATTERNS: Record<IdScheme, RegExp> = {
  bzp: /^\d{4}\/BZP\s?\d{8}(\/\d{2})?$/i,
  kpo: /^[A-Z0-9][A-Z0-9.\-/]{2,}$/i,
};

/** Zwraca komunikat błędu albo null, gdy identyfikator ma poprawny format. */
export function validateIdentifier(scheme: IdScheme, value: string): string | null {
  const v = value.trim();
  if (!v) return 'Wpisz identyfikator.';
  if (!PATTERNS[scheme].test(v)) {
    return `Niepoprawny format identyfikatora ${scheme.toUpperCase()} (${ID_SCHEMES.find((s) => s.value === scheme)!.hint}).`;
  }
  return null;
}
