import { Component, computed, ElementRef, input, linkedSignal, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Report } from '../../../core/api/types';
import { formatDate } from '../../../shared/format';
import { ReportRecommendations } from '../../../shared/ui/report-recommendations';
import { ReportAnalysis } from './report-analysis';
import { ReportExperiments } from './report-experiments';

@Component({
  selector: 'app-report-dashboard',
  imports: [ButtonModule, RouterLink, ReportAnalysis, ReportExperiments, ReportRecommendations],
  host: {class: 'block'},
  templateUrl: './report-dashboard.html',
})
export class ReportDashboard {
  readonly report = input.required<Report>();
  protected readonly day = computed(() => formatDate(this.report().date));
  protected readonly steps = ['Analiza', 'Eksperymenty', 'Co możesz zrobić'];
  protected readonly step = linkedSignal({source: computed(() => this.report().metrics), computation: () => 1});
  private readonly stepButtons = viewChildren<ElementRef<HTMLButtonElement>>('stepButton');

  protected openExperiments() {
    this.step.set(2);
    this.stepButtons()[1].nativeElement.focus();
  }
  protected print() { window.print(); }
  protected async copyLink() {
    try { await navigator.clipboard.writeText(location.href); } catch { /* brak uprawnień schowka */ }
  }
}
