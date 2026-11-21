import type { Evidence, Source } from './api/types';
import { asSource } from './api/types';

type Locator = Evidence['locator'];

/** Czytelny opis lokalizacji odczytu (strona PDF, akapit DOCX, komórka tabeli, pole rekordu). */
export function locatorLabel(l: Locator): string {
  switch (l.kind) {
    case 'pdf': return `PDF, strona ${l.page}`;
    case 'docx': return `DOCX, akapit ${l.paragraph}`;
    case 'table': {
      const cell = [l.sheet ? `arkusz „${l.sheet}”` : '', `wiersz ${l.row}`, l.column ? `kolumna ${l.column}` : ''].filter(Boolean);
      return `Tabela, ${cell.join(', ')}`;
    }
    case 'record_field': return `Pole rekordu: ${l.field}`;
  }
}

/** Źródło dowodu z obsługą pól `name`/`title` i `original_url`/`url` (mock bywa mniej ścisły). */
export type EvidenceSource = Source & { title?: string; url?: string };
export const evidenceSource = (e: Evidence): EvidenceSource => asSource(e.source) as EvidenceSource;
export const sourceTitle = (s: EvidenceSource) => s.name ?? s.title ?? s.identifier ?? s.id;
export const sourceUrl = (s: EvidenceSource) => s.original_url ?? s.url;

/** Cytat z zaznaczeniem zakresu `char_offsets` (jeśli mieści się w cytacie); inaczej cały cytat bez zaznaczenia. */
export function splitQuote(quote: string, offsets?: { start: number; end: number }): { before: string; mark: string; after: string } {
  if (!offsets || offsets.start < 0 || offsets.end > quote.length || offsets.start >= offsets.end) return { before: quote, mark: '', after: '' };
  return { before: quote.slice(0, offsets.start), mark: quote.slice(offsets.start, offsets.end), after: quote.slice(offsets.end) };
}
