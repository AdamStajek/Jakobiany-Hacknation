import { RulesDraft, SectorRules } from './rules.types';

export const cloneDraft = (r: SectorRules | RulesDraft): RulesDraft => {
  const { sector_code, based_on_id, description, subsectors, risk_categories, checklists, comparison_weights, rules } = r;
  return structuredClone({ sector_code, based_on_id, description, subsectors, risk_categories, checklists, comparison_weights, rules });
};

export const sameDraft = (a: RulesDraft, b: RulesDraft) => JSON.stringify(a) === JSON.stringify(b);

export const weightSum = (w: Record<string, number>) => Object.values(w).reduce((s, v) => s + (v || 0), 0);

/** Udział wagi w sumie (0–100). Gdy suma = 0, wszystkie udziały są 0. */
export function weightShares(w: Record<string, number>): Record<string, number> {
  const sum = weightSum(w);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, sum > 0 ? ((v || 0) / sum) * 100 : 0]));
}

const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

/** Walidacja po stronie klienta, zgodna z regułami backendu (`validate_rules`). */
export function validateDraft(d: RulesDraft): string[] {
  const errors: string[] = [];
  const codes = d.risk_categories.map((c) => c.code.trim());
  if (codes.some((c) => !c)) errors.push('Każda kategoria ryzyka musi mieć kod.');
  if (d.risk_categories.some((c) => !c.label.trim())) errors.push('Każda kategoria ryzyka musi mieć nazwę.');
  const dup = dupes(codes);
  if (dup.length) errors.push(`Kody kategorii muszą być unikalne (powtórzone: ${[...new Set(dup)].join(', ')}).`);

  const pairs = d.checklists.map((c) => `${c.subsector_code}|${c.phase}`);
  if (dupes(pairs).length) errors.push('Pary podsektor–faza w checklistach muszą być unikalne.');

  const known = new Set(codes);
  const unknown = new Set<string>();
  for (const c of d.checklists) {
    const reqCodes = c.requirements.map((r) => r.code.trim());
    if (reqCodes.some((x) => !x)) errors.push('Każda pozycja checklisty musi mieć kod.');
    else if (dupes(reqCodes).length) errors.push('Kody pozycji w jednej checkliście muszą być unikalne.');
    if (c.requirements.some((r) => !r.question.trim())) errors.push('Każda pozycja checklisty musi mieć pytanie.');
    if (c.requirements.some((r) => !(r.weight > 0))) errors.push('Waga pozycji checklisty musi być dodatnia.');
    c.requirements.forEach((r) => r.risk_codes.filter((x) => !known.has(x)).forEach((x) => unknown.add(x)));
  }
  d.rules.forEach((r) => r.risk_codes.filter((x) => !known.has(x)).forEach((x) => unknown.add(x)));
  if (unknown.size) errors.push(`Checklisty lub reguły używają kodów spoza katalogu: ${[...unknown].join(', ')}.`);

  if (Object.values(d.comparison_weights).some((v) => v < 0)) errors.push('Wagi podobieństwa nie mogą być ujemne.');
  if (!(weightSum(d.comparison_weights) > 0)) errors.push('Co najmniej jedna waga podobieństwa musi być dodatnia.');
  return [...new Set(errors)];
}

/** Obowiązująca wersja: najwyższa rewizja spośród zatwierdzonych/poprawionych. */
export function activeRules(items: SectorRules[]): SectorRules | null {
  const ok = items.filter((x) => x.review_status === 'approved' || x.review_status === 'corrected');
  return ok.sort((a, b) => b.revision - a.revision)[0] ?? null;
}
