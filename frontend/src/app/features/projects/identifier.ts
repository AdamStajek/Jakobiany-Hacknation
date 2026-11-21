export type IdScheme = 'bzp' | 'kpo';

export const ID_SCHEMES: { value: IdScheme; label: string; hint: string }[] = [
  { value: 'bzp', label: 'BZP', hint: 'np. 2022/BZP 00058537/01' },
  { value: 'kpo', label: 'KPO', hint: 'np. KPOD.03.15-IW.13-0004/25' },
];

// Formaty na podstawie danych z backendu (arkusz konkursowy); BZP ma opcjonalny sufiks /NN.
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
