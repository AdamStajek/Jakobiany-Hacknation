/** Fixtures zgodne z docs/openapi.yaml (luźno typowane; typy sprawdza warstwa API). */
export const PROJECTS: any[] = [
  {
    id: 'p-001', revision: 1, kind: 'historical', status: 'completed', title: 'Rozbudowa oczyszczalni ścieków w Kowalewie',
    sector_code: 'water_sewage', primary_subsector_codes: ['wwtp'], work_type: 'construction_or_extension',
    external_ids: [{ kind: 'BZP', value: '2023/BZP 00123456' }], enrichment_status: 'matched',
    evidence_ids: ['ev-001'], counts: { procedures: 1, risks: 3, links: 2 },
  },
  {
    id: 'p-002', revision: 1, kind: 'historical', status: 'in_progress', title: 'Budowa sieci kanalizacyjnej w gminie Zielona',
    sector_code: 'water_sewage', primary_subsector_codes: ['sewer_network'], work_type: 'construction_or_extension',
    external_ids: [{ kind: 'KPO', value: 'A2.1.1-0042' }], enrichment_status: 'needs_review',
    evidence_ids: [], counts: { procedures: 2, risks: 1, links: 3 },
  },
  {
    id: 'p-003', revision: 1, kind: 'historical', status: 'unknown', title: 'Modernizacja stacji uzdatniania wody',
    sector_code: 'water_sewage', primary_subsector_codes: ['water_treatment'], work_type: 'reconstruction_or_renovation',
    external_ids: [{ kind: 'BZP', value: '2022/BZP 00987654' }], enrichment_status: 'unmatched',
    evidence_ids: [], counts: { procedures: 0, risks: 0, links: 0 },
  },
];

export const JOBS: Record<string, any> = {
  'job-partial': {
    id: 'job-partial', type: 'import', status: 'partial', created_at: '2026-11-21T10:00:00Z', finished_at: '2026-11-21T10:01:00Z',
    results: [{ resource_type: 'project', resource_id: 'p-001', href: '/projects/p-001' }],
    report: [
      { stage: 'import', status: 'matched', row: 2, project_id: 'p-001' },
      { stage: 'link', status: 'needs_review', row: 3, project_id: 'p-002' },
      { stage: 'validation', status: 'error', row: 4, error: { code: 'validation_failed', message: 'Brak identyfikatora publicznego.' } },
    ],
  },
};

export const EVIDENCE: Record<string, any> = {
  'ev-001': {
    id: 'ev-001', source: { id: 'src-bzp', provider: 'mock', title: 'Ogłoszenie BZP (dane demonstracyjne)', url: 'https://example.invalid/bzp/1', retrieved_at: '2026-11-20T08:00:00Z' },
    document_id: 'doc-1', document_version_id: 'ver-1', quote: 'Zamawiający wymaga wizji lokalnej.', locator: { kind: 'pdf', page: 3 },
  },
};
