import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api/api.service';
import type { Parcel, Report } from '../api/types';
import { AnalysisStore } from './analysis.store';
import { ATTENTION_DRY_DAYS, FieldsStore, FieldStatus, STORAGE_KEY, attentionReasons, isStale, statusFromReport } from './fields.store';

const parcel = (id: string): Parcel => ({
  id, source: 'test', commune: null, region: null, area_ha: 2, centroid: [19, 52], geometry: {type: 'Polygon', coordinates: []},
});
const status = (patch: Partial<FieldStatus> = {}): FieldStatus => ({
  risk: 'Niskie w modelu', date: '2026-06-01', savedAt: new Date().toISOString(), analysisId: 'a1', parcelId: 'P1', dryDays: 0, balanceMm: 5, ...patch,
});
const report = (id: string, metrics: object = {risk: 'Podwyższone', recent: {dry_spell_days: 9, crop_balance_mm: -12}}): Report =>
  ({parcel: parcel(id), date: '2026-06-01', analysis_id: 'an-1', metrics}) as Partial<Report> as Report;

function setup(api: Partial<Record<keyof ApiService, unknown>> = {}) {
  const current = signal<Report | null>(null);
  TestBed.configureTestingModule({providers: [
    {provide: ApiService, useValue: api},
    {provide: AnalysisStore, useValue: {report: current}},
  ]});
  return {store: TestBed.inject(FieldsStore), current};
}
const newField = (id = 'P1') => ({name: ' Pole przy lesie ', color: 'blue' as const, crop: 'wheat', parcels: [{id, area_ha: 2, geometry: parcel(id).geometry}]});

describe('FieldsStore', () => {
  beforeEach(() => localStorage.clear());

  it('dodaje pole i zapisuje je w localStorage', () => {
    const {store} = setup();
    const field = store.add(newField());
    expect(field.name).toBe('Pole przy lesie');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('odczytuje zapisane pola przy starcie i pomija uszkodzone wpisy', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{id: 'x', name: 'A', color: 'zły', crop: null, parcels: [], status: null}, 5, {name: 'bez id'}]));
    const {store} = setup();
    expect(store.fields().map((f) => f.id)).toEqual(['x']);
    expect(store.fields()[0].color).toBe('green');
  });

  it('uszkodzony JSON daje pustą listę i komunikat błędu', () => {
    localStorage.setItem(STORAGE_KEY, '{nie json');
    const {store} = setup();
    expect(store.fields()).toEqual([]);
    expect(store.error()).toContain('odczytać');
  });

  it('usuwa pole', () => {
    const {store} = setup();
    const {id} = store.add(newField());
    store.remove(id);
    expect(store.fields()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('zapisuje status z raportu tylko w polach z daną działką', () => {
    const {store} = setup();
    store.add(newField('P1'));
    store.add({...newField('P2'), name: 'Inne'});
    store.recordReport(report('P2'));
    expect(store.fields()[0].status).toBeNull();
    expect(store.fields()[1].status).toMatchObject({risk: 'Podwyższone', dryDays: 9, balanceMm: -12, parcelId: 'P2'});
  });

  it('nowy raport w AnalysisStore aktualizuje status pola', () => {
    const {store, current} = setup();
    store.add(newField('P1'));
    current.set(report('P1'));
    TestBed.tick();
    expect(store.fields()[0].status?.analysisId).toBe('an-1');
  });

  it('lista „wymaga uwagi” zawiera tylko pola z sygnałami', () => {
    const {store} = setup();
    store.add(newField('P1'));
    store.add({...newField('P2'), name: 'Spokojne'});
    store.recordReport(report('P1'));
    store.recordReport(report('P2', {risk: 'Niskie w modelu', recent: {dry_spell_days: 0, crop_balance_mm: 4}}));
    expect(store.attention().map((i) => i.field.parcels[0].id)).toEqual(['P1']);
  });

  it('resolve rozróżnia rozpoznany, niejednoznaczny i nierozpoznany numer', async () => {
    const answers: Record<string, Parcel[]> = {a: [parcel('a')], b: [parcel('b1'), parcel('b2')], c: []};
    const {store} = setup({searchParcels: async (q: string) => ({parcels: answers[q]})});
    expect((await store.resolve('a')).state).toBe('recognized');
    expect((await store.resolve('b')).state).toBe('ambiguous');
    expect((await store.resolve('c')).state).toBe('unrecognized');
  });

  it('resolve traktuje 404 jako nierozpoznany, a inny błąd jako błąd', async () => {
    const {store} = setup({searchParcels: async (q: string) => { throw new HttpErrorResponse({status: q === 'x' ? 404 : 500}); }});
    expect((await store.resolve('x')).state).toBe('unrecognized');
    expect((await store.resolve('y')).state).toBe('error');
  });
});

describe('statusy pól', () => {
  it('uznaje raport za nieaktualny po 14 dniach', () => {
    const now = Date.parse('2026-06-20T12:00:00Z');
    expect(isStale(status({savedAt: '2026-06-10T12:00:00Z'}), now)).toBe(false);
    expect(isStale(status({savedAt: '2026-06-05T12:00:00Z'}), now)).toBe(true);
    expect(isStale(status({savedAt: 'brak'}), now)).toBe(true);
  });

  it('wylicza powody uwagi z sygnałów raportu', () => {
    expect(attentionReasons(null)).toEqual([]);
    expect(attentionReasons(status())).toEqual([]);
    expect(attentionReasons(status({risk: 'Sygnał niedoboru'}))).toHaveLength(1);
    expect(attentionReasons(status({dryDays: ATTENTION_DRY_DAYS}))).toHaveLength(1);
    expect(attentionReasons(status({balanceMm: -1}))).toHaveLength(1);
  });

  it('statusFromReport znosi brak danych z ostatnich dni', () => {
    expect(statusFromReport(report('P1', {risk: 'Brak podstaw do oceny', recent: null}))).toMatchObject({dryDays: null, balanceMm: null});
  });
});
