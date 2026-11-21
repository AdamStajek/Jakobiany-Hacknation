import { InformationState, MatchStatus, ProjectStatus, ReviewStatus, Schemas } from './api/types';

export type Tone = 'success' | 'info' | 'warn' | 'danger' | 'secondary';
export interface StatusMeta { label: string; icon: string; tone: Tone; }

export const JOB_STATUS: Record<Schemas['Job']['status'], StatusMeta> = {
  queued: { label: 'W kolejce', icon: 'pi pi-clock', tone: 'secondary' },
  running: { label: 'W toku', icon: 'pi pi-spin pi-spinner', tone: 'info' },
  succeeded: { label: 'Zakończone', icon: 'pi pi-check-circle', tone: 'success' },
  partial: { label: 'Częściowo', icon: 'pi pi-exclamation-triangle', tone: 'warn' },
  failed: { label: 'Błąd', icon: 'pi pi-times-circle', tone: 'danger' },
};

export const MATCH_STATUS: Record<MatchStatus, StatusMeta> = {
  found: { label: 'Znaleziono', icon: 'pi pi-search', tone: 'info' },
  matched: { label: 'Dopasowano', icon: 'pi pi-check-circle', tone: 'success' },
  needs_review: { label: 'Do sprawdzenia', icon: 'pi pi-eye', tone: 'warn' },
  unmatched: { label: 'Nie znaleziono', icon: 'pi pi-minus-circle', tone: 'secondary' },
  error: { label: 'Błąd', icon: 'pi pi-times-circle', tone: 'danger' },
};

export const REVIEW_STATUS: Record<ReviewStatus, StatusMeta> = {
  proposed: { label: 'Propozycja', icon: 'pi pi-hourglass', tone: 'info' },
  approved: { label: 'Zatwierdzone', icon: 'pi pi-check-circle', tone: 'success' },
  corrected: { label: 'Poprawione', icon: 'pi pi-pencil', tone: 'success' },
  rejected: { label: 'Odrzucone', icon: 'pi pi-times-circle', tone: 'danger' },
  needs_evidence: { label: 'Wymaga dowodów', icon: 'pi pi-question-circle', tone: 'warn' },
  superseded: { label: 'Zastąpione', icon: 'pi pi-history', tone: 'secondary' },
};

export const PROJECT_STATUS: Record<ProjectStatus, StatusMeta> = {
  planned: { label: 'Planowany', icon: 'pi pi-calendar', tone: 'info' },
  in_progress: { label: 'W realizacji', icon: 'pi pi-cog', tone: 'info' },
  completed: { label: 'Zakończony', icon: 'pi pi-check-circle', tone: 'success' },
  cancelled: { label: 'Anulowany', icon: 'pi pi-ban', tone: 'danger' },
  unknown: { label: 'Nieznany', icon: 'pi pi-question-circle', tone: 'secondary' },
};

export const INFO_STATE: Record<InformationState, StatusMeta> = {
  confirmed: { label: 'Potwierdzone', icon: 'pi pi-check-circle', tone: 'success' },
  partially_confirmed: { label: 'Częściowo potwierdzone', icon: 'pi pi-minus-circle', tone: 'warn' },
  missing_from_package: { label: 'Brak w pakiecie', icon: 'pi pi-exclamation-circle', tone: 'danger' },
  not_addressed: { label: 'Nie omówiono', icon: 'pi pi-question-circle', tone: 'warn' },
  conflicting_sources: { label: 'Sprzeczne źródła', icon: 'pi pi-exclamation-triangle', tone: 'danger' },
  not_applicable: { label: 'Nie dotyczy', icon: 'pi pi-minus', tone: 'secondary' },
  confirmed_not_done: { label: 'Potwierdzono brak', icon: 'pi pi-times-circle', tone: 'danger' },
};

export const EVENT_KIND = {
  OBSERVED_EVENT: { label: 'Zdarzenie historyczne', icon: 'pi pi-history', tone: 'secondary' as Tone },
  POTENTIAL_RISK: { label: 'Potencjalne ryzyko', icon: 'pi pi-bolt', tone: 'warn' as Tone },
};

export const STATUS_MAPS = {
  job: JOB_STATUS, match: MATCH_STATUS, review: REVIEW_STATUS, project: PROJECT_STATUS, info: INFO_STATE,
};

/* Karta projektu (1B) */
export const EXTRACTION_STATUS: Record<Schemas['DocumentVersion']['extraction_status'], StatusMeta> = {
  queued: { label: 'W kolejce', icon: 'pi pi-clock', tone: 'secondary' },
  running: { label: 'Ekstrakcja w toku', icon: 'pi pi-spin pi-spinner', tone: 'info' },
  ready: { label: 'Gotowe', icon: 'pi pi-check-circle', tone: 'success' },
  failed: { label: 'Błąd ekstrakcji', icon: 'pi pi-times-circle', tone: 'danger' },
};

export const PROCEDURE_STATUS: Record<string, string> = {
  open: 'Otwarte', awarded: 'Rozstrzygnięte', unawarded: 'Nierozstrzygnięte', cancelled: 'Unieważnione', unknown: 'Nieznany',
};
export const NOTICE_KIND: Record<string, string> = {
  procurement: 'Ogłoszenie o zamówieniu', correction: 'Sprostowanie', award: 'Wynik postępowania',
  contract_change: 'Zmiana umowy', contract_execution: 'Wykonanie umowy', other: 'Inne',
};
export const CONTRACT_BASIS: Record<string, string> = {
  signed: 'Podpisana', reconstructed_terms: 'Warunki odtworzone', notice_only: 'Tylko z ogłoszenia',
};
export const CHANGE_DIMENSION: Record<string, string> = {
  cost: 'koszt', schedule: 'termin', scope: 'zakres', contractor: 'wykonawca', other: 'inne',
};
export const MILESTONE_KIND: Record<string, string> = {
  signed: 'Podpisanie', planned_start: 'Planowany start', actual_start: 'Faktyczny start',
  baseline_finish: 'Planowane zakończenie', revised_finish: 'Zakończenie po zmianach',
  actual_finish: 'Faktyczne zakończenie', accepted: 'Odbiór', other: 'Inne',
};
export const LINK_METHOD: Record<string, string> = {
  verified_identifier: 'Zweryfikowany identyfikator', explicit_source: 'Jawne wskazanie w źródle',
  ranked: 'Ranking podobieństwa', expert: 'Decyzja eksperta',
};
export const SIGNAL_DIRECTION: Record<string, { label: string; tone: Tone }> = {
  supports: { label: 'potwierdza', tone: 'success' },
  contradicts: { label: 'przeczy', tone: 'danger' },
  missing: { label: 'brak danych', tone: 'warn' },
};
export const CONFIDENCE_LEVEL: Record<string, string> = {
  low: 'niska', moderate: 'umiarkowana', high: 'wysoka', insufficient_evidence: 'niewystarczające dowody',
};
export const ID_SCHEME_LABEL: Record<string, string> = {
  rm: 'Risk Miner', bzp: 'BZP', ted: 'TED', cst: 'CST', kpo: 'KPO', ocid: 'OCID', nip: 'NIP', regon: 'REGON', url: 'URL', other: 'Inny',
};
export const RESOURCE_TYPE: Record<string, string> = {
  project: 'projekt', procedure: 'postępowanie', part: 'część', notice: 'ogłoszenie', contract: 'umowa',
  contract_change: 'zmiana umowy', document: 'dokument', evidence: 'dowód', fact: 'fakt', risk: 'ryzyko',
};
/** Dostawca danych → etykieta grupy źródeł; `mock` oznaczamy jako dane demonstracyjne. */
export const PROVIDER_LABEL: Record<string, string> = {
  bzp: 'BZP (e-Zamówienia)', ted: 'TED', bip: 'BIP', contest_xlsx: 'Arkusz konkursowy', uploaded_file: 'Wgrany dokument',
  user_description: 'Opis użytkownika', sector_rules: 'Reguły sektorowe', mock: 'Dane demonstracyjne',
};
export const GEO_METRIC: Record<string, string> = { population_density: 'Gęstość zaludnienia' };
export const GEO_UNIT: Record<string, string> = { people_per_km2: 'osób/km²' };
export const GEO_LEVEL: Record<string, string> = { municipality: 'gmina', county: 'powiat', voivodeship: 'województwo' };

export const PART_OUTCOME: Record<string, string> = {
  awarded: 'Udzielono', unawarded: 'Nie udzielono', cancelled: 'Unieważniono', unknown: 'Nieustalone',
};

export const PHASE_LABEL: Record<Schemas['Phase'], string> = {
  planning: 'Planowanie', preparation: 'Przygotowanie', procurement: 'Zamówienie', contract_start: 'Start umowy',
  post_contract_design: 'Projektowanie po umowie', execution: 'Realizacja', commissioning: 'Odbiór i uruchomienie',
  closeout_and_warranty: 'Rozliczenie i gwarancja',
};
/** Cechy porównania projektów (klucze `comparison_weights`). */
export const WEIGHT_LABEL: Record<string, string> = {
  subsector: 'Podsektor', work_type: 'Rodzaj prac', function: 'Funkcja obiektu', technical: 'Parametry techniczne',
  organization: 'Organizacja i strony', cost: 'Koszt', schedule: 'Harmonogram', location: 'Lokalizacja', text: 'Podobieństwo tekstu',
};

/* Nowa inwestycja i analiza (1F) */
export const WORK_TYPE_LABEL: Record<string, string> = {
  construction_or_extension: 'Budowa lub rozbudowa', reconstruction_or_renovation: 'Przebudowa lub remont', mixed: 'Zakres mieszany',
};
export const THREAT_LEVEL: Record<string, StatusMeta> = {
  low: { label: 'Niskie', icon: 'pi pi-check-circle', tone: 'success' },
  moderate: { label: 'Umiarkowane', icon: 'pi pi-minus-circle', tone: 'warn' },
  high: { label: 'Wysokie', icon: 'pi pi-exclamation-triangle', tone: 'danger' },
  critical: { label: 'Krytyczne', icon: 'pi pi-exclamation-circle', tone: 'danger' },
  insufficient_evidence: { label: 'Niewystarczające dowody', icon: 'pi pi-question-circle', tone: 'secondary' },
};
export const CONFIDENCE_META: Record<string, StatusMeta> = {
  low: { label: 'Niska', icon: 'pi pi-minus-circle', tone: 'warn' },
  moderate: { label: 'Umiarkowana', icon: 'pi pi-minus-circle', tone: 'info' },
  high: { label: 'Wysoka', icon: 'pi pi-check-circle', tone: 'success' },
  insufficient_evidence: { label: 'Niewystarczające dowody', icon: 'pi pi-question-circle', tone: 'secondary' },
};
export const DEVIATION_DIMENSION: Record<string, string> = { cost: 'Koszt', time: 'Czas' };
export const RECOMMENDATION_KIND: Record<string, string> = {
  investigate: 'Zbadaj', provide_information: 'Uzupełnij informacje', mitigate: 'Zaplanuj działanie zapobiegawcze', proposed_clause: 'Proponowany zapis',
};
export const TWIN_DIRECTION: Record<string, StatusMeta> = {
  similar: { label: 'Podobne', icon: 'pi pi-equals', tone: 'success' },
  different: { label: 'Różne', icon: 'pi pi-arrows-h', tone: 'warn' },
};
export const DEVIATION_UNIT: Record<string, string> = { days: 'dni', percent: '%', PLN: 'PLN' };
export const API_ERROR_HINT: Record<string, string> = {
  stale_revision: 'Projekt został zmieniony przez kogoś innego. Wczytaj aktualną wersję i ponów zapis.',
  unsupported_document_type: 'Obsługiwane są tylko pliki PDF i DOCX.',
  payload_too_large: 'Plik jest za duży.',
  insufficient_input: 'Do analizy brakuje informacji. Uzupełnij poniższe pola.',
  assessment_not_ready: 'Wersja dokumentu nie jest jeszcze gotowa do analizy (trwa ekstrakcja).',
};
