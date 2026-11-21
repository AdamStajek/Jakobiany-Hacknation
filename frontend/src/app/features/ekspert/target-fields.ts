import { ReviewTargetType } from '../../core/api/types';
import { CLAIM_TYPE_LABEL, EVENT_KIND, LINK_METHOD } from '../../core/labels';

/**
 * Rejestr `target_type → pola edytowalne` (zgodny z `editable_fields` backendu).
 * Tablice i obiekty są zastępowane w całości, więc edytujemy je jako JSON.
 */
export type FieldKind = 'text' | 'textarea' | 'select' | 'json' | 'ids' | 'any';

export interface FieldOption { label: string; value: string; }
export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  options?: FieldOption[];
  hint?: string;
}

const options = (m: Record<string, string>): FieldOption[] => Object.entries(m).map(([value, label]) => ({ value, label }));
const claimType: FieldSpec = { key: 'claim_type', label: 'Rodzaj twierdzenia', kind: 'select', options: options(CLAIM_TYPE_LABEL) };
const confidence: FieldSpec = { key: 'confidence', label: 'Pewność (poziom i uzasadnienie)', kind: 'json', hint: '{"level": "low|moderate|high", "rationale": "…"}' };
const evidenceIds: FieldSpec = { key: 'evidence_ids', label: 'Dowody (identyfikatory po przecinku)', kind: 'ids' };

export const TARGET_FIELDS: Partial<Record<ReviewTargetType, FieldSpec[]>> = {
  fact: [
    { key: 'key', label: 'Klucz faktu', kind: 'text' },
    { key: 'value', label: 'Wartość', kind: 'any' },
    { key: 'unit', label: 'Jednostka', kind: 'text' },
    claimType, confidence, evidenceIds,
    { key: 'subject', label: 'Przedmiot (typ i id)', kind: 'json', hint: '{"type": "project", "id": "…"}' },
  ],
  risk: [
    { key: 'risk_code', label: 'Kod ryzyka', kind: 'text', hint: 'Kod z katalogu, np. R03' },
    { key: 'kind', label: 'Rodzaj', kind: 'select', options: Object.entries(EVENT_KIND).map(([value, m]) => ({ value, label: m.label })) },
    { key: 'title', label: 'Tytuł', kind: 'text' },
    { key: 'signal', label: 'Sygnał', kind: 'textarea' },
    { key: 'event', label: 'Zdarzenie', kind: 'textarea' },
    { key: 'occurred_on', label: 'Data zdarzenia (RRRR-MM-DD)', kind: 'text' },
    { key: 'causes', label: 'Przyczyny', kind: 'json', hint: 'Lista: status (confirmed|hypothesized), description, evidence_ids' },
    { key: 'impacts', label: 'Skutki', kind: 'json', hint: 'Lista: dimension, kind (observed|potential), description, value, unit, evidence_ids' },
    { key: 'measures', label: 'Działania', kind: 'json', hint: 'Lista: kind (applied|suggested), description, effectiveness, evidence_ids' },
    claimType, confidence, evidenceIds,
  ],
  link: [
    { key: 'relation', label: 'Relacja', kind: 'text', hint: 'np. project_has_procedure' },
    { key: 'method', label: 'Metoda', kind: 'select', options: options(LINK_METHOD) },
    { key: 'rationale', label: 'Uzasadnienie', kind: 'textarea' },
    { key: 'from', label: 'Z (typ i id)', kind: 'json', hint: '{"type": "project", "id": "…"}' },
    { key: 'to', label: 'Do (typ i id)', kind: 'json', hint: '{"type": "procedure", "id": "…"}' },
    { key: 'signals', label: 'Sygnały dopasowania', kind: 'json', hint: 'Lista: feature, direction (supports|contradicts|missing), explanation' },
    confidence, evidenceIds,
  ],
  recommendation: [
    { key: 'kind', label: 'Rodzaj', kind: 'select', options: [
      { value: 'investigate', label: 'Zbadaj' }, { value: 'provide_information', label: 'Uzupełnij informacje' },
      { value: 'mitigate', label: 'Zaplanuj działanie zapobiegawcze' }, { value: 'proposed_clause', label: 'Proponowany zapis' },
    ] },
    { key: 'action', label: 'Działanie', kind: 'textarea' },
    { key: 'rationale', label: 'Uzasadnienie', kind: 'textarea' },
    { key: 'proposed_clause', label: 'Proponowany zapis', kind: 'textarea' },
    { key: 'related_to', label: 'Powiązane zasoby', kind: 'json', hint: 'Lista {"type": "risk", "id": "…"}' },
    claimType, confidence, evidenceIds,
  ],
};

/** Pozostałe typy: jedno pole z obiektem `changes` (JSON). */
export const GENERIC_FIELD: FieldSpec = {
  key: 'changes', label: 'Zmiany pól (obiekt JSON)', kind: 'json',
  hint: 'Tylko pola edytowalne danego typu; tablice i obiekty zastępują wartość w całości.',
};

export const fieldsFor = (t: ReviewTargetType): FieldSpec[] => TARGET_FIELDS[t] ?? [GENERIC_FIELD];
export const hasRegistry = (t: ReviewTargetType): boolean => !!TARGET_FIELDS[t];

/** Typy, dla których backend przyjmuje własne wpisy (`POST /expert/records`). */
export const RECORD_TYPES: ReviewTargetType[] = ['fact', 'link', 'risk', 'recommendation'];

/** Wartości początkowe formularza nowego wpisu (pola wymagane przez schemat). */
export function recordDefaults(t: ReviewTargetType, projectId: string): Record<string, string> {
  const conf = '{"level": "moderate", "rationale": ""}';
  switch (t) {
    case 'fact': return { claim_type: 'SOURCE_FACT', confidence: conf, subject: JSON.stringify({ type: 'project', id: projectId }) };
    case 'risk': return { kind: 'POTENTIAL_RISK', claim_type: 'MODEL_INFERENCE', confidence: conf, causes: '[]', impacts: '[]', measures: '[]' };
    case 'link': return { method: 'expert', confidence: conf, signals: '[]', from: JSON.stringify({ type: 'project', id: projectId }) };
    default: return { kind: 'investigate', claim_type: 'MODEL_INFERENCE', confidence: conf, related_to: JSON.stringify([{ type: 'project', id: projectId }]) };
  }
}
