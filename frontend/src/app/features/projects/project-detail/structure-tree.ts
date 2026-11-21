import { TreeNode } from 'primeng/api';
import { Contract, ContractChange, Notice, Procedure, ProcedurePart } from '../../../core/api/types';
import { CHANGE_DIMENSION, CONTRACT_BASIS, NOTICE_KIND, PROCEDURE_STATUS } from '../../../core/labels';

/** Dane węzła drzewa: etykieta, dodatkowy opis i dowody (do Evidence Lens). */
export interface StructureData { kind: string; detail?: string; evidenceIds: string[]; }
export type StructureNode = TreeNode<StructureData>;

const node = (key: string, label: string, data: StructureData, children: StructureNode[] = [], expanded = false): StructureNode =>
  ({ key, label, data, children, expanded, leaf: !children.length });

const change = (c: ContractChange): StructureNode =>
  node(c.id, c.description, {
    kind: 'Zmiana',
    detail: [c.effective_on, c.dimensions.map((d) => CHANGE_DIMENSION[d]).join(', '), c.legal_basis].filter(Boolean).join(' · '),
    evidenceIds: c.evidence_ids,
  });

const contract = (c: Contract): StructureNode =>
  node(c.id, `Umowa${c.contractor ? ' – ' + c.contractor.name : ''}`, {
    kind: 'Umowa', detail: CONTRACT_BASIS[c.basis] ?? c.basis, evidenceIds: c.evidence_ids,
  }, c.changes.map(change));

const notice = (n: Notice): StructureNode =>
  node(n.id, `${NOTICE_KIND[n.kind] ?? n.kind}: ${n.identifier.value}`, {
    kind: 'Ogłoszenie', detail: n.published_at?.slice(0, 10), evidenceIds: n.evidence_ids,
  });

const part = (p: ProcedurePart): StructureNode =>
  node(p.id, `Część ${p.number}${p.title ? ' – ' + p.title : ''}`, { kind: 'Część', detail: p.outcome, evidenceIds: p.evidence_ids });

/** Postępowanie → części, umowy (ze zmianami), ogłoszenia. */
export function buildStructure(procedures: Procedure[]): StructureNode[] {
  return procedures.map((p) => node(p.id, p.title, {
    kind: 'Postępowanie', detail: p.status ? PROCEDURE_STATUS[p.status] : undefined, evidenceIds: p.evidence_ids,
  }, [...p.parts.map(part), ...p.contracts.map(contract), ...p.notices.map(notice)], true));
}
