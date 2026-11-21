import type { ReviewStatus, RiskKind } from './api/types';

/** Typy współdzielone z kontraktem API (docs/Risk_Miner_2_0_Plan_Projektu.md, sekcje 4–5). */

export type ClaimType = 'SOURCE_FACT' | 'CALCULATED' | 'MODEL_INFERENCE';
export type EventKind = RiskKind;
export type ExpertStatus = ReviewStatus;
export type Confidence = 'low' | 'moderate' | 'high';

/** Odniesienie do źródła – podstawa Evidence Lens (`sourceId` to id dowodu w backendzie). */
export interface EvidenceRef {
  sourceId: string;
  title: string;
  url?: string;
  documentVersionId?: string;
  page?: number;
  paragraphId?: string;
  fragment?: string;
  fetchedAt?: string;
  expertStatus?: ExpertStatus;
}
