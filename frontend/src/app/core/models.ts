/** Typy współdzielone z kontraktem API (docs/Risk_Miner_2_0_Plan_Projektu.md, sekcje 4–5). */

export type ClaimType = 'SOURCE_FACT' | 'CALCULATED' | 'MODEL_INFERENCE';
export type EventKind = 'OBSERVED_EVENT' | 'POTENTIAL_RISK';
export type ExpertStatus = 'proposed' | 'approved' | 'corrected' | 'rejected' | 'needs_evidence' | 'superseded';
export type Confidence = 'low' | 'moderate' | 'high';

/** Odniesienie do źródła – podstawa Evidence Lens. */
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
