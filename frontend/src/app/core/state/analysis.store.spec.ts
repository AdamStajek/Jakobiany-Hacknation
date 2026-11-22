import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api/api.service';
import { AnalysisRequest, Parcel, Report } from '../api/types';
import { AnalysisForm, AnalysisStore } from './analysis.store';
import { ConsentStore } from './consent.store';
import { ParcelStore } from './parcel.store';

describe('AnalysisStore experiment results', () => {
  const parcel = {id: 'Pole A'} as Parcel;
  const date = '2024-07-01';
  const result = {'wilgotnosc-gleby': 'moist'};
  const report = {analysis_id: 'original', date, parcel, metrics: {}} as Report;
  const form: AnalysisForm = {crop: 'wheat', date, stage: null, sowing: null, irrigation: false,
    irrigation_mm: 0, scenario_mm: 0, confirm_land: false, soil_observation: null};

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('przywraca zapisany wynik tylko dla tej samej działki i daty, także po odtworzeniu store', async () => {
    const selected = signal(parcel);
    const api = {
      saveExperiments: async () => ({...report, analysis_id: 'updated', experiment_results: result}),
      analyzeWithProgress: vi.fn<(request: AnalysisRequest) => Promise<Report>>(async () => report),
    };
    const configure = () => TestBed.configureTestingModule({providers: [
      {provide: ParcelStore, useValue: {parcel: selected, importedGeometry: () => null}},
      {provide: ApiService, useValue: api},
    ]});

    configure();
    TestBed.inject(ConsentStore).grant();
    const before = TestBed.inject(AnalysisStore);
    before.report.set(report);
    await before.saveExperiment(report, 'wilgotnosc-gleby', 'moist');

    TestBed.resetTestingModule();
    configure();
    const restored = TestBed.inject(AnalysisStore);
    await restored.analyze(form);
    expect(api.analyzeWithProgress.mock.calls.at(-1)?.[0].experiment_results).toEqual(result);

    await restored.analyze({...form, date: '2024-07-02'});
    expect(api.analyzeWithProgress.mock.calls.at(-1)?.[0].experiment_results).toBeUndefined();

    selected.set({...parcel, id: 'Pole B'});
    await restored.analyze(form);
    expect(api.analyzeWithProgress.mock.calls.at(-1)?.[0].experiment_results).toBeUndefined();
  });
});
