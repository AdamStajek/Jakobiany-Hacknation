import { Schemas, SectorRules, SectorRulesInput } from '../../core/api/types';

export type RiskCategory = SectorRulesInput['risk_categories'][number];
export type Checklist = SectorRulesInput['checklists'][number];
export type Requirement = Schemas['Requirement'];
export type Subsector = SectorRulesInput['subsectors'][number];
export type Phase = Schemas['Phase'];

/** Edytowalna część wiedzy sektorowej (bez pól `Reviewable`). */
export type RulesDraft = SectorRulesInput;
export type { SectorRules };
