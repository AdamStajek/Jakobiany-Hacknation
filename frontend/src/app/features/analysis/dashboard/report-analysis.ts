import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Report } from '../../../core/api/types';
import { ConsentStore } from '../../../core/state/consent.store';
import { formatDate, formatDateTime } from '../../../shared/format';
import { KpiCard } from '../../../shared/ui/kpi-card';
import { Segmented, SegmentOption } from '../../../shared/ui/segmented';
import { SatelliteChart, SeasonChart, SoilChart, WaterBalanceChart } from './charts';
import { ReportEnvironment } from './report-environment';
import { ReportQuestion } from './report-question';
import { RootWaterScale } from './root-water-scale';

type ReportMode = 'simple' | 'advanced';

@Component({
  selector: 'app-report-analysis',
  imports: [DecimalPipe, PercentPipe, KpiCard, Segmented, ReportEnvironment, ReportQuestion, RootWaterScale,
    WaterBalanceChart, SoilChart, SatelliteChart, SeasonChart],
  host: {class: 'block'},
  templateUrl: './report-analysis.html',
})
export class ReportAnalysis {
  readonly report = input.required<Report>();
  readonly experimentsRequested = output<void>();
  private readonly consent = inject(ConsentStore);
  protected readonly modes: SegmentOption<ReportMode>[] = [
    {label: 'Prosty', value: 'simple', icon: 'pi-eye'},
    {label: 'Zaawansowany', value: 'advanced', icon: 'pi-chart-bar'},
  ];
  protected readonly mode = signal<ReportMode>(this.consent.read('report-mode') === 'advanced' ? 'advanced' : 'simple');
  protected readonly advanced = computed(() => this.mode() === 'advanced');
  protected readonly day = computed(() => formatDate(this.report().date));
  protected readonly sources = computed(() => Object.fromEntries(this.report().sources.map(s => [s.key, s])));
  protected readonly missing = computed(() => Object.entries(this.report().missing));
  protected readonly sourceRows = computed(() => this.report().sources.map(s => ({
    ...s, retrieved: formatDateTime(s.retrieved_at),
    published: s.publication_date && s.publication_date.length >= 10 ? formatDate(s.publication_date) : s.publication_date,
  })));
  protected readonly historyFinding = computed(() => {
    const h = this.report().metrics.history;
    return h.seasons.length
      ? `W ${h.negative_seasons} z ${h.seasons.length} ocenionych sezonów opad był niższy niż parowanie referencyjne.`
      : 'Za mało danych, żeby ustalić, jak często powracał niedobór opadów.';
  });
  protected setMode(value: ReportMode) {
    this.mode.set(value);
    this.consent.write('report-mode', value);
  }
}
