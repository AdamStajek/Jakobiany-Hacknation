/** Maksymalna liczba numerów w jednej liście (ochrona backendu przed zbyt wieloma zapytaniami). */
export const MAX_LIST_PARCELS = 40;

export type ParsedParcelList = {
  /** Unikalne numery w kolejności wpisania. */
  tokens: string[];
  /** Ile powtórzeń pominięto. */
  duplicates: number;
  /** Ile numerów odcięto powyżej limitu. */
  truncated: number;
};

/** Rozbija wklejony tekst (po jednym numerze w wierszu lub po przecinku/średniku) na unikalne numery działek. */
export function parseParcelList(text: string): ParsedParcelList {
  const seen = new Set<string>();
  const tokens: string[] = [];
  let duplicates = 0;
  let truncated = 0;
  for (const raw of text.split(/[\n\r\t,;]+/)) {
    const token = raw.trim().replace(/\s+/g, ' ');
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    if (tokens.length >= MAX_LIST_PARCELS) { truncated++; continue; }
    tokens.push(token);
  }
  return {tokens, duplicates, truncated};
}
