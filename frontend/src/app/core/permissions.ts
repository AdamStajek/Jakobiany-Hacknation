export type Role = 'analyst' | 'expert' | 'operator';
export type Action =
  | 'import' | 'enrich' | 'decide' | 'edit-rules' | 'create-project' | 'analyse' | 'upload-document';

export const ROLES: { value: Role; label: string; home: string }[] = [
  { value: 'analyst', label: 'Analityk', home: '/projekty' },
  { value: 'expert', label: 'Ekspert', home: '/ekspert' },
  { value: 'operator', label: 'Operator', home: '/projekty' },
];

export const PERMISSIONS: Record<Action, Role[]> = {
  import: ['operator'],
  enrich: ['operator'],
  decide: ['expert'],
  'edit-rules': ['expert'],
  'create-project': ['analyst'],
  'upload-document': ['analyst'],
  analyse: ['analyst'],
};
