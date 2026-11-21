import { ApiError, Assessment } from '../../core/api/types';
import { API_ERROR_HINT } from '../../core/labels';

/** Komunikat dla użytkownika: znany kod → podpowiedź, w innym razie szczegół z backendu. */
export function errorText(e: ApiError): string {
  if (e.status === 413) return API_ERROR_HINT['payload_too_large'];
  return API_ERROR_HINT[e.code] ?? e.detail;
}

type Level = 'low' | 'moderate' | 'high' | 'insufficient_evidence';
const ORDER: Level[] = ['insufficient_evidence', 'low', 'moderate', 'high'];

/**
 * API nie zwraca jednej „pewności” analizy, więc przyjmujemy poziom najsłabszego twierdzenia
 * (ryzyka, rekomendacje, przedziały odchyleń). Brak twierdzeń oznacza brak podstaw.
 */
export function overallConfidence(a: Assessment): { level: Level; rationale: string } {
  const all = [
    ...a.risks.map((c) => c.confidence),
    ...a.recommendations.map((c) => c.confidence),
    a.deviations.cost.confidence,
    a.deviations.time.confidence,
  ];
  if (!all.length) return { level: 'insufficient_evidence', rationale: 'Analiza nie zawiera twierdzeń, które można ocenić.' };
  const weakest = all.reduce((w, c) => (ORDER.indexOf(c.level) < ORDER.indexOf(w.level) ? c : w));
  return { level: weakest.level, rationale: `Najsłabsze twierdzenie w analizie: ${weakest.rationale}` };
}

/** Identyfikator analizy z wyników zakończonego zadania. */
export function assessmentIdFrom(results: { resource_type: string; resource_id: string }[]): string | undefined {
  return results.find((r) => r.resource_type === 'assessment')?.resource_id;
}
