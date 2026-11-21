import { Component, effect, inject } from '@angular/core';
import { AnalysisStore } from '../../core/state/analysis.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { WodoMap } from '../../shared/map/wodo-map';
import { AnalysisForm } from './analysis-form';
import { ParcelPicker } from './parcel-picker';
import { ReportDashboard } from './dashboard/report-dashboard';

@Component({
  selector: 'app-analysis-page',
  imports: [ParcelPicker, AnalysisForm, WodoMap, ReportDashboard],
  template: `
    <h1 class="mb-1 text-2xl font-bold tracking-tight">Zatrzymaj wodę. Chroń plony.</h1>
    <p class="mb-4 max-w-2xl text-muted-color">Sprawdź, jak opady, gleba i ukształtowanie terenu wpływają na zapas wody na Twojej działce.</p>
    <div class="grid gap-4 lg:grid-cols-[380px_1fr]">
      <aside class="print:hidden space-y-6 rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900">
        <app-parcel-picker />
        <app-analysis-form />
      </aside>
      <div class="print:hidden h-[60vh] min-h-[360px] overflow-hidden rounded-xl border border-surface lg:sticky lg:top-16 lg:h-[calc(100vh-11rem)]">
        <app-wodo-map [geometry]="parcels.parcel()?.geometry ?? null" [waterPoint]="analysis.waterPoint()"
          (pointClicked)="onMapClick($event)" />
      </div>
    </div>
    @if (analysis.report(); as report) {
      <div class="mt-6"><app-report-dashboard [report]="report" /></div>
    }
  `,
})
export class AnalysisPage {
  protected readonly parcels = inject(ParcelStore);
  protected readonly analysis = inject(AnalysisStore);

  constructor() {
    effect(() => {
      if (!this.analysis.report()) return;
      setTimeout(() => {
        const heading = document.getElementById('wynik');
        heading?.focus({preventScroll: true});
        heading?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
    });
  }

  protected onMapClick(point: {lat: number; lon: number}) { void this.parcels.searchPoint(point.lat, point.lon); }
}
