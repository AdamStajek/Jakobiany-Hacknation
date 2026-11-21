/** Fixtures Expert Studio: kolejka, decyzje i dowody zgodne z kształtem backendu (ReviewItem/Decision). */
const conf = { level: 'moderate', rationale: 'Dane demonstracyjne.' };

export const REVIEW_ITEMS: any[] = [
  {
    target_type: 'fact', target_id: 'fact-m1', project_id: 'p-001', revision: 1, review_status: 'proposed', evidence_ids: ['ev-001'],
    value: { id: 'fact-m1', revision: 1, review_status: 'proposed', claim_type: 'SOURCE_FACT', confidence: conf, evidence_ids: ['ev-001'],
      subject: { type: 'project', id: 'p-001' }, key: 'network_length_m', value: '2000', unit: 'm' },
  },
  {
    target_type: 'risk', target_id: 'risk-m1', project_id: 'p-001', revision: 1, review_status: 'proposed', evidence_ids: ['ev-001'],
    value: { id: 'risk-m1', revision: 1, review_status: 'proposed', claim_type: 'MODEL_INFERENCE', confidence: conf, evidence_ids: ['ev-001'],
      project_id: 'p-001', kind: 'OBSERVED_EVENT', risk_code: 'R03', title: 'Brak zgody właściciela na dostęp do terenu', signal: 'Przedłużenie terminu',
      event: 'Przedłużono termin o 30 dni.', causes: [], impacts: [{ dimension: 'time', kind: 'observed', description: 'Opóźnienie', value: '30', unit: 'days', evidence_ids: ['ev-001'] }], measures: [] },
  },
  {
    target_type: 'link', target_id: 'link-m1', project_id: 'p-001', revision: 1, review_status: 'needs_evidence', evidence_ids: [],
    value: { id: 'link-m1', revision: 1, review_status: 'needs_evidence', from: { type: 'project', id: 'p-001' }, to: { type: 'procedure', id: 'proc-1' },
      relation: 'project_has_procedure', method: 'ranked', confidence: conf, rationale: 'Zgodny tytuł i zamawiający.', evidence_ids: [], signals: [] },
  },
];

export const DECISIONS: any[] = [];
const STATUS = { approve: 'approved', correct: 'corrected', reject: 'rejected', request_evidence: 'needs_evidence' } as const;

/** Zapisuje decyzję w pamięci; `null` oznacza konflikt rewizji (409). */
export function decide(body: { target_type: string; target_id: string; expected_revision: number; action: keyof typeof STATUS; reason: string; changes?: Record<string, unknown> }) {
  const item = REVIEW_ITEMS.find((i) => i.target_type === body.target_type && i.target_id === body.target_id);
  if (!item || body.expected_revision !== item.revision) return null;
  const before = structuredClone(item);
  const revision = item.revision + 1;
  item.value = { ...item.value, ...(body.changes ?? {}), revision, review_status: STATUS[body.action] };
  Object.assign(item, { revision, review_status: STATUS[body.action], evidence_ids: item.value.evidence_ids ?? item.evidence_ids });
  const d = { id: `decision-${DECISIONS.length + 1}`, target_type: item.target_type, target_id: item.target_id, action: body.action, reason: body.reason,
    actor_id: 'demo-expert', created_at: new Date().toISOString(), before, after: structuredClone(item) };
  DECISIONS.unshift(d);
  return d;
}
