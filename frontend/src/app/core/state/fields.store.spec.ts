import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api/api.service';
import type { Parcel, Report, ServerField, User } from '../api/types';
import { AnalysisStore } from './analysis.store';
import { AuthStore } from './auth.store';
import { ATTENTION_DRY_DAYS, FieldsStore, FieldStatus, STORAGE_KEY, attentionReasons, isStale, statusFromReport } from './fields.store';

const parcel = (id: string): Parcel => ({
  id, source: 'test', commune: null, region: null, area_ha: 2, centroid: [19, 52], geometry: {type: 'Polygon', coordinates: []},
});
const status = (patch: Partial<FieldStatus> = {}): FieldStatus => ({
  risk: 'Niskie w modelu', date: '2026-06-01', savedAt: new Date().toISOString(), analysisId: 'a1', parcelId: 'P1', dryDays: 0, balanceMm: 5, ...patch,
});
const report = (id: string, metrics: object = {risk: 'Podwyższone', recent: {dry_spell_days: 9, crop_balance_mm: -12}}): Report =>
  ({parcel: parcel(id), date: '2026-06-01', analysis_id: 'an-1', metrics}) as Partial<Report> as Report;

function setup(api: Partial<Record<keyof ApiService, unknown>> = {}, loggedIn = false) {
  const current = signal<Report | null>(null);
  const user = signal<User | null>(loggedIn ? account : null);
  TestBed.configureTestingModule({providers: [
    {provide: ApiService, useValue: api},
    {provide: AnalysisStore, useValue: {report: current}},
    {provide: AuthStore, useValue: {user, loggedIn: computed(() => user() !== null)}},
  ]});
  return {store: TestBed.inject(FieldsStore), current, user};
}
const account: User = {id: 'u1', email: 'a@b.pl', username: 'ala', email_verified: true, role: 'user'};
const serverField = (patch: Partial<ServerField> = {}): ServerField =>
  ({id: 's1', name: 'Z serwera', color: 'blue', crop: 'wheat', parcels: [{id: 'P1', geometry: parcel('P1').geometry}], last_report: null, ...patch});
const newField = (id = 'P1') => ({name: ' Pole przy lesie ', color: 'blue' as const, crop: 'wheat', parcels: [{id, area_ha: 2, geometry: parcel(id).geometry}]});

describe('FieldsStore', () => {
  beforeEach(() => localStorage.clear());

  it('dodaje pole i zapisuje je w localStorage', async () => {
    const {store} = setup();
    const field = await store.add(newField());
    expect(field?.name).toBe('Pole przy lesie');
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

  it('usuwa pole', async () => {
    const {store} = setup();
    const field = await store.add(newField());
    await store.remove(field?.id ?? '');
    expect(store.fields()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('zapisuje status z raportu tylko w polach z daną działką', async () => {
    const {store} = setup();
    await store.add(newField('P1'));
    await store.add({...newField('P2'), name: 'Inne'});
    await store.recordReport(report('P2'));
    expect(store.fields()[0].status).toBeNull();
    expect(store.fields()[1].status).toMatchObject({risk: 'Podwyższone', dryDays: 9, balanceMm: -12, parcelId: 'P2'});
  });

  it('nowy raport w AnalysisStore aktualizuje status pola', async () => {
    const {store, current} = setup();
    await store.add(newField('P1'));
    current.set(report('P1'));
    TestBed.tick();
    expect(store.fields()[0].status?.analysisId).toBe('an-1');
  });

  it('lista „wymaga uwagi” zawiera tylko pola z sygnałami', async () => {
    const {store} = setup();
    await store.add(newField('P1'));
    await store.add({...newField('P2'), name: 'Spokojne'});
    await store.recordReport(report('P1'));
    await store.recordReport(report('P2', {risk: 'Niskie w modelu', recent: {dry_spell_days: 0, crop_balance_mm: 4}}));
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

describe('FieldsStore dla zalogowanego', () => {
  beforeEach(() => localStorage.clear());

  it('pobiera pola z serwera, a localStorage zostaje nietknięty', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{id: 'l1', name: 'Lokalne', color: 'green', crop: null, parcels: [], status: null}]));
    const {store} = setup({serverFields: async () => [serverField({last_report: {saved_at: '2026-06-01T10:00:00Z', risk: 'Podwyższone', dry_spell_days: 9, crop_balance_mm: -3}})]}, true);
    TestBed.tick();
    await vi.waitFor(() => expect(store.fields().map((f) => f.id)).toEqual(['s1']));
    expect(store.source()).toBe('server');
    expect(store.fields()[0].status).toMatchObject({risk: 'Podwyższone', dryDays: 9, balanceMm: -3, date: '2026-06-01'});
    expect(store.localFields().map((f) => f.id)).toEqual(['l1']);
  });

  it('błąd pobierania ustawia komunikat, a nie lokalną listę', async () => {
    const {store} = setup({serverFields: async () => { throw new HttpErrorResponse({status: 500}); }}, true);
    TestBed.tick();
    await vi.waitFor(() => expect(store.error()).not.toBe(''));
    expect(store.fields()).toEqual([]);
  });

  it('dodaje pole przez API (bez pola area_ha) i nie dotyka localStorage', async () => {
    const createServerField = vi.fn(async (body: {name: string}) => serverField({id: 'n1', name: body.name}));
    const {store} = setup({serverFields: async () => [], createServerField}, true);
    const field = await store.add(newField());
    expect(createServerField).toHaveBeenCalledWith({name: 'Pole przy lesie', color: 'blue', crop: 'wheat', parcels: [{id: 'P1', geometry: parcel('P1').geometry}]});
    expect(field?.id).toBe('n1');
    expect(store.fields().map((f) => f.id)).toEqual(['n1']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('nieudane dodanie zwraca null i pokazuje błąd', async () => {
    const {store} = setup({serverFields: async () => [], createServerField: async () => { throw new HttpErrorResponse({status: 500}); }}, true);
    expect(await store.add(newField())).toBeNull();
    expect(store.error()).not.toBe('');
    expect(store.fields()).toEqual([]);
  });

  it('usuwa pole przez API', async () => {
    const deleteServerField = vi.fn(async () => ({}));
    const {store} = setup({serverFields: async () => [serverField()], deleteServerField}, true);
    TestBed.tick();
    await vi.waitFor(() => expect(store.fields()).toHaveLength(1));
    await store.remove('s1');
    expect(deleteServerField).toHaveBeenCalledWith('s1');
    expect(store.fields()).toEqual([]);
  });

  it('po analizie zapisuje last-report na serwerze', async () => {
    const putLastReport = vi.fn(async () => serverField());
    const {store} = setup({serverFields: async () => [serverField()], putLastReport}, true);
    TestBed.tick();
    await vi.waitFor(() => expect(store.fields()).toHaveLength(1));
    await store.recordReport(report('P1'));
    expect(putLastReport).toHaveBeenCalledWith('s1', expect.objectContaining({risk: 'Podwyższone', dry_spell_days: 9, crop_balance_mm: -12}));
    expect(store.fields()[0].status?.risk).toBe('Podwyższone');
  });

  it('migruje pola z localStorage na konto i usuwa przeniesione', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {id: 'l1', name: 'Jedno', color: 'green', crop: null, parcels: [{id: 'P1', geometry: {type: 'Polygon', coordinates: []}}],
        status: {risk: 'Niskie w modelu', date: '2026-06-01', savedAt: '2026-06-01T10:00:00Z', analysisId: 'a', parcelId: 'P1', dryDays: 1, balanceMm: 2}},
      {id: 'l2', name: 'Drugie', color: 'blue', crop: null, parcels: [{id: 'P2', geometry: {type: 'Polygon', coordinates: []}}], status: null},
    ]));
    const createServerField = vi.fn(async (body: {name: string}) => {
      if (body.name === 'Drugie') throw new HttpErrorResponse({status: 500});
      return serverField({id: 'n1', name: body.name});
    });
    const putLastReport = vi.fn(async () => serverField());
    const {store} = setup({serverFields: async () => [], createServerField, putLastReport}, true);
    const result = await store.migrateLocal();
    expect(result).toEqual({moved: 1, failed: 1});
    expect(putLastReport).toHaveBeenCalledTimes(1);
    expect(store.localFields().map((f) => f.id)).toEqual(['l2']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
    expect(store.error()).toContain('1');
  });

  it('migracja nic nie robi dla gościa', async () => {
    const createServerField = vi.fn();
    const {store} = setup({createServerField});
    expect(await store.migrateLocal()).toEqual({moved: 0, failed: 0});
    expect(createServerField).not.toHaveBeenCalled();
  });

  it('wylogowanie wraca do pól lokalnych', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{id: 'l1', name: 'Lokalne', color: 'green', crop: null, parcels: [], status: null}]));
    const {store, user} = setup({serverFields: async () => [serverField()]}, true);
    TestBed.tick();
    await vi.waitFor(() => expect(store.fields().map((f) => f.id)).toEqual(['s1']));
    user.set(null);
    TestBed.tick();
    expect(store.fields().map((f) => f.id)).toEqual(['l1']);
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
