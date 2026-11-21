import type { components } from './schema';

type S = components['schemas'];

export type Page<T> = Omit<S['Page'], 'items'> & { items: T[] };

export type Problem = S['Problem'];
export type Job = S['Job'];
export type Project = S['Project'];
export type ProjectInput = S['ProjectInput'];
export type ProjectDetail = S['ProjectDetail'];
export type ProjectKind = S['ProjectKind'];
export type ProjectStatus = S['ProjectStatus'];
export type MatchStatus = S['MatchStatus'];
export type Evidence = S['Evidence'];
export type Fact = S['Fact'];
export type Risk = S['Risk'];
export type RiskKind = S['RiskKind'];
export type ReviewStatus = S['ReviewStatus'];
export type ReviewTargetType = S['ReviewTargetType'];
export type ReviewItem = S['ReviewItem'];
export type DecisionInput = S['DecisionInput'];
export type Decision = S['Decision'];
export type SectorRules = S['SectorRules'];
export type SectorRulesInput = S['SectorRulesInput'];
export type AssessmentInput = S['AssessmentInput'];
export type Assessment = S['Assessment'];
export type Twin = S['Twin'];
export type InformationCheck = S['InformationCheck'];
export type InformationState = S['InformationState'];
export type DocumentVersion = S['DocumentVersion'];
export type Amount = S['Amount'];
export type Schemas = S;

/** Błąd API po normalizacji z `Problem` (RFC 7807). */
export interface ApiError {
  status: number;
  code: string;
  detail: string;
  fieldErrors: { field?: string; message: string }[];
  /** Ustawiane przy 409 – bieżąca rewizja, jeśli backend ją zwraca. */
  currentRevision?: number;
  network?: boolean;
}

export type Query = Record<string, string | number | boolean | null | undefined>;
