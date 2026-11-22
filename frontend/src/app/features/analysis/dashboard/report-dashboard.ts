import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Report, Source } from '../../../core/api/types';
import { ConsentStore } from '../../../core/state/consent.store';
import { formatDate, formatDateTime } from '../../../shared/format';
import { ConfidenceChip } from '../../../shared/ui/confidence-chip';
import { KpiCard } from '../../../shared/ui/kpi-card';
import { Panel } from '../../../shared/ui/panel';
import { RiskScale } from '../../../shared/ui/risk-scale';
import { Segmented, SegmentOption } from '../../../shared/ui/segmented';
import { RouterLink } from '@angular/router';
import { SatelliteChart, SeasonChart, SoilChart, WaterBalanceChart } from './charts';
import { ReportEnvironment } from './report-environment';
import { ReportExperiments } from './report-experiments';
import { ReportRecommendations } from '../../../shared/ui/report-recommendations';

type ReportMode = 'simple' | 'advanced';
type Tone = 'danger' | 'warn' | 'success' | 'info';
const RISK: Record<string, {tone: Tone; icon: string}> = {
  'Podwyższone': {tone: 'danger', icon: 'pi-exclamation-triangle'},
  'Sygnał niedoboru': {tone: 'danger', icon: 'pi-exclamation-triangle'},
  'Niepewne': {tone: 'warn', icon: 'pi-question-circle'},
  'Niskie w modelu': {tone: 'success', icon: 'pi-check-circle'},
  'Brak sygnału z opadu i ET': {tone: 'success', icon: 'pi-check-circle'},
};
const TONE_CLASS: Record<Tone, string> = {
  danger: 'border-red-300 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100',
  warn: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100',
  info: 'border-surface-300 bg-surface-100 text-surface-900 dark:border-surface-400 dark:bg-surface-800 dark:text-surface-50',
};

@Component({
  selector: 'app-report-dashboard',
  imports: [DecimalPipe, ButtonModule, MessageModule, TableModule, TagModule, ConfidenceChip, KpiCard, Panel, RiskScale, RouterLink, Segmented,
    ReportRecommendations, ReportExperiments, ReportEnvironment, WaterBalanceChart, SeasonChart, SoilChart, SatelliteChart],
  host: {class: 'block'},
  templateUrl: './report-dashboard.html',
})
export class ReportDashboard {
  readonly report = input.required<Report>();
  private readonly consent = inject(ConsentStore);
  protected readonly modes: SegmentOption<ReportMode>[] = [
    {label: 'Prosty', value: 'simple', icon: 'pi-eye'}, {label: 'Zaawansowany', value: 'advanced', icon: 'pi-chart-bar'}];
  protected readonly mode = signal<ReportMode>(this.loadMode());
  protected readonly advanced = computed(() => this.mode() === 'advanced');
  /** Opis roślin własnymi słowami (tryb prosty) na podstawie ostatniej sceny satelitarnej. */
  protected readonly plantsText = computed(() => {
    const scene = this.satellite()?.scene;
    if (!scene) return null;
    const parts: string[] = [];
    if (scene.ndvi < 0.2) parts.push('Na polu widać niewiele zielonej roślinności. Może to być okres poza sezonem lub świeży siew.');
    else if (scene.ndvi < 0.5) parts.push('Rośliny są umiarkowanie rozwinięte.');
    else parts.push('Rośliny są dobrze rozwinięte i zielone.');
    if (scene.ndvi >= 0.2) parts.push(scene.ndmi < 0 ? 'Mogą mieć mało wody w liściach.' : 'Nie widać oznak suszy w liściach.');
    return parts.join(' ');
  });
  protected readonly sourceRows = computed(() => this.report().sources.map((s) => ({
    ...s, retrieved: formatDateTime(s.retrieved_at), published: s.publication_date ? formatDate(s.publication_date) : 'brak daty',
  })));
  protected readonly risk = computed(() => RISK[this.report().metrics.risk] ?? {tone: 'info' as Tone, icon: 'pi-info-circle'});
  protected readonly riskClass = computed(() => TONE_CLASS[this.risk().tone]);
  protected readonly missing = computed(() => Object.entries(this.report().missing));
  protected readonly satellite = computed(() => this.report().sources.find((source) => source.key === 'satellite'));

  private loadMode(): ReportMode {
    try { return this.consent.read('report-mode') === 'advanced' ? 'advanced' : 'simple'; } catch { return 'simple'; }
  }
  protected setMode(mode: ReportMode) {
    this.mode.set(mode);
    this.consent.write('report-mode', mode);
  }
  protected source(key: string): Source | undefined { return this.report().sources.find((s) => s.key === key); }
  protected print() { window.print(); }
  protected async copyLink() {
    try { await navigator.clipboard.writeText(location.href); } catch { /* brak uprawnień schowka */ }
  }
}
