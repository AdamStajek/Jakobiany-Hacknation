import { describe, expect, it } from 'vitest';
import { formFromReport, ReportFormSource } from './report-form';

const crops = [{id: 'wheat', label: 'Pszenica ozima'}, {id: 'potato', label: 'Ziemniak'}];
const source = (patch: Partial<ReportFormSource> = {}, root: {input_mm?: number} | null = null): ReportFormSource => ({
  date: '2024-07-05', scenario: null, soil_observation: null, metrics: {crop: {label: 'Ziemniak'}, root}, ...patch,
});

describe('formFromReport', () => {
  it('odtwarza uprawę i datę z raportu', () => {
    const form = formFromReport(source(), crops);
    expect(form?.crop).toBe('potato');
    expect(form?.date).toBe('2024-07-05');
    expect(form?.irrigation).toBe(false);
  });

  it('odtwarza nawadnianie, scenariusz i obserwację gleby', () => {
    const form = formFromReport(source({scenario: {input_mm: 10, depletion_reduction_mm: [1, 2], note: ''}, soil_observation: 'dry'}, {input_mm: 12}), crops);
    expect(form).toMatchObject({irrigation: true, irrigation_mm: 12, scenario_mm: 10, soil_observation: 'dry'});
  });

  it('zwraca null, gdy lista upraw nie jest wczytana lub nie zawiera uprawy', () => {
    expect(formFromReport(source(), [])).toBeNull();
    expect(formFromReport(source(), [{id: 'wheat', label: 'Pszenica ozima'}])).toBeNull();
  });
});
