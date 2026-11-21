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
