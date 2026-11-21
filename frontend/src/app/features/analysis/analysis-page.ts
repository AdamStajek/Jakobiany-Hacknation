import { Component, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { AnalysisStore } from '../../core/state/analysis.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { WodoMap } from '../../shared/map/wodo-map';
import { AnalysisForm } from './analysis-form';
import { ParcelPicker } from './parcel-picker';
import { ReportDashboard } from './dashboard/report-dashboard';

@Component({
  selector: 'app-analysis-page',
  imports: [ParcelPicker, AnalysisForm, WodoMap, ReportDashboard, SkeletonModule],
  template: `
    <h1 class="mb-1 text-2xl font-bold tracking-tight">Zatrzymaj wodę. Chroń plony.</h1>
    <p class="mb-4 max-w-2xl text-muted-color">Sprawdź, jak opady, gleba i ukształtowanie terenu wpływają na zapas wody na Twojej działce.</p>
    <div class="grid gap-4 lg:grid-cols-[380px_1fr]">
      <aside class="print:hidden order-2 space-y-6 rounded-xl border border-surface bg-surface-0 p-4 lg:order-1 dark:bg-surface-900">
        <app-parcel-picker />
        <app-analysis-form />
      </aside>
      <div class="print:hidden order-1 h-[48vh] min-h-[320px] overflow-hidden rounded-xl border border-surface lg:order-2 lg:sticky lg:top-16 lg:h-[calc(100vh-11rem)]">
        <app-wodo-map [geometry]="parcels.parcel()?.geometry ?? null" [waterPoint]="analysis.waterPoint()"
          (pointClicked)="parcels.searchPoint($event.lat, $event.lon)" (polygonDrawn)="parcels.importGeometry($event)" />
      </div>
    </div>
    @if (analysis.running() && !analysis.report()) {
      <div class="mt-6 space-y-3" aria-hidden="true">
        <p-skeleton height="5rem" borderRadius="12px" />
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">@for (n of [1, 2, 3, 4]; track n) { <p-skeleton height="6rem" borderRadius="12px" /> }</div>
        <div class="grid gap-3 lg:grid-cols-2">@for (n of [1, 2]; track n) { <p-skeleton height="18rem" borderRadius="12px" /> }</div>
      </div>
    }
    @if (analysis.report(); as report) {
      <div class="mt-6"><app-report-dashboard [report]="report" /></div>
    }
  `,
})
export class AnalysisPage {
  protected readonly parcels = inject(ParcelStore);
  protected readonly analysis = inject(AnalysisStore);
  private readonly router = inject(Router);

  /** Parametry trasy (withComponentInputBinding). */
  readonly id = input<string>();
  readonly analysisId = input<string>();

  constructor() {
    // Link -> stan: wejście na /dzialka/:id lub /dzialka/:id/analiza/:analysisId odtwarza działkę i raport.
    effect(() => {
      const [id, analysisId] = [this.id(), this.analysisId()];
      untracked(() => {
        if (analysisId) void this.analysis.load(analysisId);
        else if (id) void this.parcels.open(id);
      });
    });

    // Stan -> link: adres zawsze odpowiada wybranej działce i raportowi (bez dokładania wpisów do historii).
    effect(() => {
      const parcel = this.parcels.parcel();
      const report = this.analysis.report();
      const imported = !!this.parcels.importedGeometry();
      untracked(() => {
        const commands = report ? ['/dzialka', report.parcel.id, 'analiza', report.analysis_id]
          : parcel && !imported ? ['/dzialka', parcel.id] : null;
        if (!commands) return;
        const target = this.router.createUrlTree(commands).toString();
        if (this.router.url !== target) void this.router.navigateByUrl(target, {replaceUrl: true});
      });
    });

    effect(() => {
      if (!this.analysis.report()) return;
      setTimeout(() => {
        const heading = document.getElementById('wynik');
        heading?.focus({preventScroll: true});
        heading?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
    });
  }
}
