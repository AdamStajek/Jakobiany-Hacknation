import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { AnalysisRequest, Crop, Report } from '../api/types';
import { ParcelStore } from './parcel.store';

export type AnalysisForm = Omit<AnalysisRequest, 'parcel_id' | 'geojson'>;

const STEPS = ['Pobieramy pogodę i historię opadów…', 'Sprawdzamy zdjęcia, glebę i otoczenie…', 'Łączymy dane i przygotowujemy zalecenia…'];

@Injectable({providedIn: 'root'})
export class AnalysisStore {
  private readonly api = inject(ApiService);
  private readonly parcels = inject(ParcelStore);

  readonly crops = signal<Crop[]>([]);
  readonly range = signal({min: '', max: ''});
  readonly report = signal<Report | null>(null);
  readonly progress = signal('');
  readonly error = signal('');
  readonly running = computed(() => !!this.progress());
  /** [lon, lat] najbliższej stałej wody z ostatniego raportu. */
  readonly waterPoint = computed(() => this.report()?.sources.find((s) => s.key === 'land')?.nearest_water_point ?? null);

  constructor() {
    // Zmiana działki unieważnia poprzedni raport.
    effect(() => { this.parcels.parcel(); untracked(() => this.report.set(null)); });
  }

  async init() {
    if (this.crops().length) return;
    try {
      const [health, crops] = await Promise.all([this.api.health(), this.api.crops()]);
      this.range.set({min: health.analysis_date_min, max: health.analysis_date_max});
      this.crops.set(crops);
    } catch (error) {
      this.error.set(errorMessage(error, 'Serwer analizy jest niedostępny. Spróbuj odświeżyć stronę.'));
    }
  }

  async analyze(form: AnalysisForm) {
    const parcel = this.parcels.parcel();
    if (!parcel || this.running()) return;
    this.error.set('');
    this.report.set(null);
    let step = 0;
    this.progress.set(STEPS[0]);
    const timer = setInterval(() => this.progress.set(STEPS[Math.min(++step, STEPS.length - 1)]), 4200);
    try {
      const geojson = this.parcels.importedGeometry();
      this.report.set(await this.api.analyze({...form, ...(geojson ? {geojson} : {parcel_id: parcel.id})}));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      clearInterval(timer);
      this.progress.set('');
    }
  }
}
