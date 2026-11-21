/** Fixtures zgodne z docs/openapi.yaml (luźno typowane; typy sprawdza warstwa API). */
export const PROJECTS: any[] = [
  {
    id: 'p-001', revision: 1, kind: 'historical', status: 'completed', title: 'Rozbudowa oczyszczalni ścieków w Kowalewie',
    sector_code: 'water_sewage', primary_subsector_codes: ['wwtp'], work_type: 'construction_or_extension',
    external_ids: [{ scheme: 'bzp', value: '2022/BZP 00058537/01' }], enrichment_status: 'matched',
    evidence_ids: ['ev-001'], counts: { procedures: 1, risks: 3, links: 2 },
  },
  {
    id: 'p-002', revision: 1, kind: 'historical', status: 'in_progress', title: 'Budowa sieci kanalizacyjnej w gminie Zielona',
    sector_code: 'water_sewage', primary_subsector_codes: ['sewer_network'], work_type: 'construction_or_extension',
    external_ids: [{ scheme: 'kpo', value: 'KPOD.03.15-IW.13-0004/25' }], enrichment_status: 'needs_review',
    evidence_ids: [], counts: { procedures: 2, risks: 1, links: 3 },
  },
  {
    id: 'p-004', revision: 1, kind: 'historical', status: 'completed', title: 'Budowa sieci kanalizacyjnej w gminie Zielona – etap II',
    sector_code: 'water_sewage', primary_subsector_codes: ['sewer_network'], work_type: 'construction_or_extension',
    external_ids: [{ scheme: 'kpo', value: 'KPOD.03.15-IW.13-0004/25' }, { scheme: 'bzp', value: '2024/BZP 00555111' }], enrichment_status: 'matched',
    evidence_ids: [], counts: { procedures: 1, risks: 2, links: 1 },
  },
  {
    id: 'p-003', revision: 1, kind: 'historical', status: 'unknown', title: 'Modernizacja stacji uzdatniania wody',
    sector_code: 'water_sewage', primary_subsector_codes: ['water_treatment'], work_type: 'reconstruction_or_renovation',
    external_ids: [{ scheme: 'bzp', value: '2022/BZP 00987654' }], enrichment_status: 'unmatched',
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

const CONF = { level: 'moderate', rationale: 'Dane demonstracyjne.' };

/** Rozszerzenia karty projektu (1B) dla p-001: postępowanie, umowa ze zmianą, dokument, powiązanie. */
export const DETAIL_EXTRAS: Record<string, any> = {
  'p-001': {
    procedures: [{
      id: 'proc-1', title: 'Rozbudowa oczyszczalni ścieków w Kowalewie', status: 'awarded',
      parts: [{ id: 'part-1', number: '1', title: 'Roboty budowlane', outcome: 'awarded', evidence_ids: ['ev-001'] }],
      notices: [{
        id: 'n-1', identifier: { scheme: 'bzp', value: '2022/BZP 00058537/01' }, kind: 'procurement', published_at: '2022-03-01T08:00:00Z',
        source: { id: 'src-bzp', provider: 'mock', name: 'Ogłoszenie BZP (dane demonstracyjne)', retrieved_at: '2026-11-20T08:00:00Z' }, evidence_ids: ['ev-001'],
      }],
      contracts: [{
        id: 'c-1', basis: 'signed', contractor: { name: 'Wodbud sp. z o.o.' }, amounts: [], milestones: [], evidence_ids: ['ev-001'],
        changes: [{ id: 'ch-1', effective_on: '2023-05-10', description: 'Aneks: wydłużenie terminu o 30 dni', dimensions: ['schedule'], evidence_ids: ['ev-001'] }],
      }],
      evidence_ids: ['ev-001'],
    }],
    documents: [{
      id: 'doc-1', document_type: 'SWZ', current_version_id: 'ver-1', versions: [{
        id: 'ver-1', document_id: 'doc-1', revision: 1, media_type: 'application/pdf', sha256: 'abc', extraction_status: 'ready',
        source: { id: 'src-up', provider: 'uploaded_file', retrieved_at: '2026-11-20T08:00:00Z' },
      }],
    }],
    links: [{
      id: 'l-1', revision: 1, review_status: 'proposed', from: { type: 'project', id: 'p-001' }, to: { type: 'procedure', id: 'proc-1' },
      relation: 'project_has_procedure', method: 'verified_identifier', confidence: { level: 'high', rationale: 'Zgodny numer BZP.' },
      rationale: 'Identyfikator BZP zgodny z projektem.', evidence_ids: ['ev-001'],
      signals: [{ feature: 'bzp_id', direction: 'supports', explanation: 'Numer identyczny.' }],
    }],
    timeline: [{ date: '2022-03-01', target: { type: 'notice', id: 'n-1' }, label: 'Publikacja ogłoszenia', evidence_ids: ['ev-001'] },
      { date: '2023-05-10', target: { type: 'contract_change', id: 'ch-1' }, label: 'Aneks: wydłużenie terminu', evidence_ids: ['ev-001'] }],
    amounts: [{ kind: 'contract_initial', value: '12500000.00', currency: 'PLN', vat: 'net', evidence_ids: ['ev-001'] }],
    works_location: { region_code: '04', region: 'kujawsko-pomorskie', locality: 'Kowalewo', evidence_ids: ['ev-001'] },
    geo_signals: [{ metric: 'population_density', value: '72.5', unit: 'people_per_km2', year: 2023, geographic_level: 'municipality', evidence_ids: ['ev-001'] }],
  },
};

export const RISKS: Record<string, any[]> = {
  'p-001': [
    { id: 'r-1', revision: 1, review_status: 'proposed', claim_type: 'MODEL_INFERENCE', confidence: CONF, evidence_ids: ['ev-001'],
      project_id: 'p-001', kind: 'OBSERVED_EVENT', risk_code: 'R06', title: 'Harmonogram i zależności', signal: 'Przedłużono termin.',
      event: 'Przedłużono termin o 30 dni.', causes: [], measures: [],
      impacts: [{ dimension: 'time', kind: 'observed', description: 'Przedłużono termin', value: '30', unit: 'days', evidence_ids: ['ev-001'] }] },
    { id: 'r-2', revision: 1, review_status: 'approved', claim_type: 'SOURCE_FACT', confidence: CONF, evidence_ids: ['ev-001'],
      project_id: 'p-001', kind: 'POTENTIAL_RISK', risk_code: 'R03', title: 'Kolizje oraz prawa i dostęp do nieruchomości',
      signal: 'Brak zgody właściciela.', event: 'Możliwy brak dostępu do terenu.', causes: [], measures: [], impacts: [] },
  ],
};

export const FACTS: Record<string, any[]> = {
  'p-001': [
    { id: 'f-1', revision: 1, review_status: 'proposed', claim_type: 'SOURCE_FACT', confidence: CONF, evidence_ids: ['ev-001'],
      subject: { type: 'project', id: 'p-001' }, key: 'network_length_m', value: '2000', unit: 'm' },
  ],
};
