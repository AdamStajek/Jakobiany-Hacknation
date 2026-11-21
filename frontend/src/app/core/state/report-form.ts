import { Crop, Report } from '../api/types';
import type { AnalysisForm } from './analysis.store';

/** Fragment raportu, z którego odtwarzamy parametry analizy. */
export type ReportFormSource = Pick<Report, 'date' | 'scenario' | 'soil_observation'> & {
  metrics: {crop: {label: string}; root: {input_mm?: number} | null};
};

/**
 * Parametry formularza opisane przez raport (bez przeliczania wyników).
 * Raport nie zwraca identyfikatora uprawy, więc dopasowujemy ją po etykiecie; null, gdy lista upraw nie jest wczytana.
 * Faza, siew i potwierdzenie użytkowania nie są w raporcie — wracają do wartości domyślnych.
 */
export function formFromReport(report: ReportFormSource, crops: Crop[]): AnalysisForm | null {
  const crop = crops.find((c) => c.label === report.metrics.crop.label);
  if (!crop) return null;
  const irrigationMm = report.metrics.root?.input_mm ?? 0;
  return {
    crop: crop.id, date: report.date, stage: null, sowing: null,
    irrigation: irrigationMm > 0, irrigation_mm: irrigationMm,
    scenario_mm: report.scenario?.input_mm ?? 0, confirm_land: false,
    soil_observation: report.soil_observation ?? null,
  };
}
