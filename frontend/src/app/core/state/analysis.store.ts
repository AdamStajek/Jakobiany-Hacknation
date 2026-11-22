import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { AnalysisRequest, Crop, FarmerQuestion, Report } from '../api/types';
import { ParcelStore } from './parcel.store';
import { formFromReport } from './report-form';

export type AnalysisForm = Omit<AnalysisRequest, 'parcel_id' | 'geojson'>;

@Injectable({providedIn: 'root'})
export class AnalysisStore {
  private readonly api = inject(ApiService);
  private readonly parcels = inject(ParcelStore);

  readonly crops = signal<Crop[]>([]);
  readonly questions = signal<FarmerQuestion[]>([]);
  readonly questionError = signal('');
  readonly range = signal({min: '', max: ''});
  readonly report = signal<Report | null>(null);
  readonly progress = signal('');
  /** Postęp 0–100 z serwera; null = nieznany (pasek nieokreślony). */
  readonly percent = signal<number | null>(null);
  readonly error = signal('');
  readonly experimentError = signal('');
  readonly savingExperiment = signal(false);
  readonly running = computed(() => !!this.progress());
  /** [lon, lat] najbliższej stałej wody z ostatniego raportu. */
  readonly waterPoint = computed(() => this.report()?.sources.find((s) => s.key === 'land')?.nearest_water_point ?? null);

  /** Parametry ostatniej analizy uruchomionej w tej sesji, powiązane z identyfikatorem raportu. */
  private readonly submitted = signal<{analysisId: string; form: AnalysisForm} | null>(null);
  /**
   * Parametry, których dotyczy bieżący raport: dokładne z własnej analizy, a dla raportu otwartego z linku
   * odtworzone z jego treści. null, gdy nie ma raportu (formularz zostaje bez zmian).
   */
  readonly reportForm = computed<AnalysisForm | null>(() => {
    const report = this.report();
    if (!report) return null;
    const submitted = this.submitted();
    return submitted?.analysisId === report.analysis_id ? submitted.form : formFromReport(report, this.crops());
  });

  constructor() {
    // Zmiana działki unieważnia poprzedni raport (chyba że raport dotyczy tej samej działki).
    effect(() => {
      const parcel = this.parcels.parcel();
      untracked(() => {
        if (this.report()?.parcel.id !== parcel?.id) {
          this.report.set(null);
          this.experimentError.set('');
        }
      });
    });
  }

  async init() {
    if (!this.questions().length) {
      this.questionError.set('');
      void this.api.farmerQuestions()
        .then(questions => this.questions.set(questions))
        .catch(error => this.questionError.set(errorMessage(error, 'Nie udało się wczytać pytań o pole.')));
    }
    if (this.crops().length) return;
    try {
      const [health, crops] = await Promise.all([this.api.health(), this.api.crops()]);
      this.range.set({min: health.analysis_date_min, max: health.analysis_date_max});
      this.crops.set(crops);
    } catch (error) {
      this.error.set(errorMessage(error, 'Serwer analizy jest niedostępny. Spróbuj odświeżyć stronę.'));
    }
  }

  /** Odtwarza zapisany raport z linku (/dzialka/:id/analiza/:analysisId). */
  async load(analysisId: string) {
    if (this.report()?.analysis_id === analysisId || this.running()) return;
    this.error.set('');
    this.experimentError.set('');
    this.progress.set('Wczytujemy zapisany raport…');
    try {
      const report = await this.api.report(analysisId);
      this.parcels.select(report.parcel);
      this.report.set(report);
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie znaleziono raportu. Mógł wygasnąć po 14 dniach. Wykonaj analizę ponownie.'));
    } finally {
      this.progress.set('');
    }
  }

  async saveExperiment(report: Report, slug: string, value: string) {
    if (this.report() !== report || this.savingExperiment()) return;
    this.savingExperiment.set(true);
    this.experimentError.set('');
    try {
      const results = {...report.experiment_results};
      if (value) results[slug] = value;
      else delete results[slug];
      const updated = await this.api.saveExperiments(report.analysis_id, results);
      if (this.report() !== report) return;
      this.report.set({...updated, metrics: report.metrics});
      return updated;
    } catch (error) {
      if (this.report() === report) this.experimentError.set(errorMessage(error, 'Nie udało się zapisać wyniku próby.'));
    } finally {
      this.savingExperiment.set(false);
    }
  }

  private abort: AbortController | null = null;
  /** true tylko podczas analizy z serwera (nie przy wczytywaniu zapisanego raportu). */
  readonly analyzing = signal(false);

  /** Przerywa trwającą analizę (serwer dokończy ją w tle i zwolni slot). */
  cancel() { this.abort?.abort(); }

  async analyze(form: AnalysisForm) {
    const parcel = this.parcels.parcel();
    if (!parcel || this.running()) return;
    this.error.set('');
    this.experimentError.set('');
    this.report.set(null);
    this.percent.set(null);
    this.abort = new AbortController();
    this.analyzing.set(true);
    this.progress.set('Łączymy się z serwerem analizy…');
    try {
      const geojson = this.parcels.importedGeometry();
      const request = {...form, ...(geojson ? {geojson} : {parcel_id: parcel.id})};
      const report = await this.api.analyzeWithProgress(request, ({done, total, label}) => {
        if (!total) { this.progress.set('Pobieramy dane ze źródeł…'); return; }
        // Ostatnie ~10% to składanie raportu po zebraniu źródeł.
        this.percent.set(Math.round((done / total) * 90));
        this.progress.set(done < total ? `Pobrano: ${label} (${done}/${total})` : 'Łączymy dane i przygotowujemy zalecenia…');
      }, this.abort.signal);
      this.submitted.set({analysisId: report.analysis_id, form});
      this.report.set(report);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) this.error.set(errorMessage(error));
    } finally {
      this.abort = null;
      this.analyzing.set(false);
      this.percent.set(null);
      this.progress.set('');
    }
  }
}
