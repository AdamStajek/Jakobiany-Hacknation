import { TestBed } from '@angular/core/testing';
import { ConsentStore } from './consent.store';
import { EXPERIMENT_PLAN_KEY, ExperimentPlanStore } from './experiment-plan.store';

describe('ExperimentPlanStore', () => {
  beforeEach(() => localStorage.clear());

  it('bez zgody trzyma zamiar tylko w pamięci karty', () => {
    const store = TestBed.inject(ExperimentPlanStore);
    expect(store.save('wsiakanie-wody', 'Pole 1', '2026-11-23')).toBe('session');
    expect(store.find('wsiakanie-wody', 'Pole 1')?.startDate).toBe('2026-11-23');
    expect(localStorage.getItem(EXPERIMENT_PLAN_KEY)).toBeNull();
  });

  it('za zgodą zapisuje w localStorage, a ponowny zapis aktualizuje wpis', () => {
    TestBed.inject(ConsentStore).grant();
    const store = TestBed.inject(ExperimentPlanStore);
    expect(store.save('deszczomierz', 'Pole 1', '2026-11-23')).toBe('saved');
    store.save('deszczomierz', 'Pole 1', '2026-11-25');
    const saved = JSON.parse(localStorage.getItem(EXPERIMENT_PLAN_KEY) ?? '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].startDate).toBe('2026-11-25');
  });

  it('wczytuje zapisane zamiary za zgodą i pomija uszkodzone wpisy', () => {
    localStorage.setItem('pw.consent.v1', 'granted');
    localStorage.setItem(EXPERIMENT_PLAN_KEY, JSON.stringify([
      {slug: 'a', fieldName: 'P', startDate: '2026-01-01', savedAt: 'x'}, {slug: 1},
    ]));
    expect(TestBed.inject(ExperimentPlanStore).intents().map((i) => i.slug)).toEqual(['a']);
  });

  it('cofnięcie zgody usuwa kopię z przeglądarki', () => {
    const consent = TestBed.inject(ConsentStore);
    consent.grant();
    const store = TestBed.inject(ExperimentPlanStore);
    store.save('a', 'P', '2026-01-01');
    TestBed.tick();
    consent.deny();
    TestBed.tick();
    expect(localStorage.getItem(EXPERIMENT_PLAN_KEY)).toBeNull();
    expect(store.intents().length).toBe(1);
  });
});
