import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ConsentStore } from './consent.store';

export const EXPERIMENT_PLAN_KEY = 'pw.experiment-plans.v1';

/** Zamiar wykonania eksperymentu (jeszcze bez wyniku — ten zapisuje „Zapisz wynik”). */
type ExperimentIntent = {slug: string; fieldName: string; startDate: string; savedAt: string};
type PlanSaveResult = 'saved' | 'session' | 'failed';

function readIntent(value: unknown): ExperimentIntent | null {
  if (typeof value !== 'object' || value === null) return null;
  const {slug, fieldName, startDate, savedAt} = value as Record<string, unknown>;
  return typeof slug === 'string' && typeof fieldName === 'string' && typeof startDate === 'string' && typeof savedAt === 'string'
    ? {slug, fieldName, startDate, savedAt} : null;
}

/**
 * Zapisane zamiary eksperymentów. W pamięci tej karty zawsze; w localStorage tylko za zgodą (ConsentStore),
 * a cofnięcie zgody usuwa kopię z przeglądarki.
 */
@Injectable({providedIn: 'root'})
export class ExperimentPlanStore {
  private readonly consent = inject(ConsentStore);
  readonly intents = signal<ExperimentIntent[]>(this.load());

  constructor() {
    effect(() => {
      const allowed = this.consent.storageAllowed();
      untracked(() => { if (allowed) this.persist(); else this.consent.remove(EXPERIMENT_PLAN_KEY); });
    });
  }

  find(slug: string, fieldName: string): ExperimentIntent | undefined {
    return this.intents().find((item) => item.slug === slug && item.fieldName === fieldName);
  }

  /** Zapisuje (lub aktualizuje) zamiar dla pary eksperyment + pole. */
  save(slug: string, fieldName: string, startDate: string, now = new Date()): PlanSaveResult {
    const intent: ExperimentIntent = {slug, fieldName, startDate, savedAt: now.toISOString()};
    this.intents.update((items) => [...items.filter((item) => !(item.slug === slug && item.fieldName === fieldName)), intent]);
    const written = this.consent.write(EXPERIMENT_PLAN_KEY, JSON.stringify(this.intents()));
    return written === 'saved' ? 'saved' : written === 'failed' ? 'failed' : 'session';
  }

  private persist() { this.consent.write(EXPERIMENT_PLAN_KEY, JSON.stringify(this.intents())); }

  private load(): ExperimentIntent[] {
    try {
      const raw = this.consent.read(EXPERIMENT_PLAN_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(readIntent).filter((item): item is ExperimentIntent => item !== null) : [];
    } catch { return []; }
  }
}
