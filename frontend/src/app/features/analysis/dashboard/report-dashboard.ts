import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { Report } from '../../../core/api/types';
import { ConfidenceChip } from '../../../shared/ui/confidence-chip';
import { KpiCard } from '../../../shared/ui/kpi-card';
import { Panel } from '../../../shared/ui/panel';
import { RiskScale } from '../../../shared/ui/risk-scale';
import { RouterLink } from '@angular/router';
import { WaterBalanceChart } from './charts';
import { ReportExperiments } from './report-experiments';
import { ReportRecommendations } from '../../../shared/ui/report-recommendations';

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
  imports: [DecimalPipe, ButtonModule, MessageModule, ConfidenceChip, KpiCard, Panel, RiskScale, RouterLink,
    ReportRecommendations, ReportExperiments, WaterBalanceChart],
  host: {class: 'block'},
  templateUrl: './report-dashboard.html',
})
export class ReportDashboard {
  readonly report = input.required<Report>();
  protected readonly risk = computed(() => RISK[this.report().metrics.risk] ?? {tone: 'info' as Tone, icon: 'pi-info-circle'});
  protected readonly riskClass = computed(() => TONE_CLASS[this.risk().tone]);
  protected readonly missing = computed(() => Object.entries(this.report().missing));
  protected readonly satellite = computed(() => this.report().sources.find((source) => source.key === 'satellite'));

  protected print() { window.print(); }
  protected async copyLink() {
    try { await navigator.clipboard.writeText(location.href); } catch { /* brak uprawnień schowka */ }
  }
}
