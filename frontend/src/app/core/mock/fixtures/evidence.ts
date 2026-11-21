/** Fixtures Evidence Lens (1C): dowody z różnymi lokalizatorami, wersja bez kopii, wersja z kopią. */
const SRC = { id: 'src-bzp', provider: 'mock', name: 'Ogłoszenie BZP (dane demonstracyjne)', retrieved_at: '2026-11-20T08:00:00Z' };

export const EVIDENCE_EXTRA: Record<string, any> = {
  'ev-002': {
    id: 'ev-002', source: { id: 'src-xlsx', provider: 'contest_xlsx', identifier: 'Risk_Miner_dane_projekty.xlsx', retrieved_at: '2026-11-21T12:00:00Z' },
    quote: '2022/BZP 00058537/01', locator: { kind: 'table', sheet: 'Projekty', row: 2, column: 'N' },
  },
  'ev-003': {
    id: 'ev-003', source: SRC, document_id: 'doc-2', document_version_id: 'ver-2',
    quote: 'Termin wykonania: 12 miesięcy od podpisania umowy.', locator: { kind: 'docx', paragraph: 'p-14' }, char_offsets: { start: 0, end: 17 },
  },
  'ev-004': {
    id: 'ev-004', source: { ...SRC, original_url: 'https://example.invalid/bzp/4' }, locator: { kind: 'record_field', field: 'works_location.region_code' },
  },
};

const base = { revision: 1, media_type: 'application/pdf', sha256: 'a'.repeat(64), source: SRC, extraction_status: 'ready' };
export const DOCUMENT_VERSIONS: Record<string, any> = {
  'doc-1/ver-1': { ...base, id: 'ver-1', document_id: 'doc-1', issued_on: '2022-02-01', content_url: '/api/v1/documents/doc-1/versions/ver-1/content' },
  'doc-2/ver-2': { ...base, id: 'ver-2', document_id: 'doc-2', media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
};

export const DOCUMENT_COPY = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
