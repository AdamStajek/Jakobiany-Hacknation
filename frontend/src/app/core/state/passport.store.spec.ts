import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api/api.service';
import type { AnalysisProgress, Passport } from '../api/types';
import { AnalysisStore } from './analysis.store';
import { PassportStore } from './passport.store';

const passport: Passport = {parcel_id: 'p1', analysis_as_of: '2026-11-21', summary: []};

type Call = {parcelId: string; onProgress: (p: AnalysisProgress) => void; signal?: AbortSignal;
  resolve: (p: Passport) => void; reject: (e: unknown) => void};

function setup() {
  const calls: Call[] = [];
  const api = {
    passportWithProgress: (parcelId: string, _asOf: string, _crop: string | null, onProgress: (p: AnalysisProgress) => void, signal?: AbortSignal) =>
      new Promise<Passport>((resolve, reject) => {
        calls.push({parcelId, onProgress, signal, resolve, reject});
        signal?.addEventListener('abort', () => reject(new DOMException('Anulowano', 'AbortError')));
      }),
  };
  TestBed.configureTestingModule({providers: [
    {provide: ApiService, useValue: api},
    {provide: AnalysisStore, useValue: {init: () => Promise.resolve(), range: () => ({min: '2016-01-01', max: '2026-11-21'})}},
  ]});
  return {store: TestBed.inject(PassportStore), calls};
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('PassportStore', () => {
  it('ładuje dane z postępem i zapisuje je w pamięci', async () => {
    const {store, calls} = setup();
    const loading = store.load('p1', 'wheat');
    await tick();
    expect(store.entry('p1', 'wheat').loading).toBe(true);
    calls[0].onProgress({done: 1, total: 4, label: 'Pogoda'});
    expect(store.entry('p1', 'wheat')).toMatchObject({loading: true, percent: 25, progress: 'Pobrano: Pogoda (1/4)'});
    calls[0].resolve(passport);
    await loading;
    expect(store.entry('p1', 'wheat')).toMatchObject({loading: false, data: passport, percent: null});
  });

  it('nie pobiera ponownie z pamięci ani nie dubluje trwającego żądania, chyba że force', async () => {
    const {store, calls} = setup();
    const first = store.load('p1', null);
    await tick();
    void store.load('p1', null);
    await tick();
    expect(calls).toHaveLength(1);
    calls[0].resolve(passport);
    await first;
    await store.load('p1', null);
    expect(calls).toHaveLength(1);
    const forced = store.load('p1', null, true);
    await tick();
    expect(calls).toHaveLength(2);
    calls[1].resolve(passport);
    await forced;
  });

  it('anulowanie kończy ładowanie bez błędu', async () => {
    const {store} = setup();
    const loading = store.load('p1', null);
    await tick();
    store.cancel('p1', null);
    await loading;
    expect(store.entry('p1', null)).toMatchObject({loading: false, error: '', data: null});
  });

  it('błąd pokazuje komunikat i pozwala spróbować ponownie', async () => {
    const {store, calls} = setup();
    const loading = store.load('p1', null);
    await tick();
    calls[0].reject(new Error('boom'));
    await loading;
    expect(store.entry('p1', null).error).not.toBe('');
    const retry = store.load('p1', null, true);
    await tick();
    expect(calls).toHaveLength(2);
    calls[1].resolve(passport);
    await retry;
    expect(store.entry('p1', null).data).toEqual(passport);
  });
});
