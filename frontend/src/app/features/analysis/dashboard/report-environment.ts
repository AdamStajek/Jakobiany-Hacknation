import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Report, Source } from '../../../core/api/types';
import { Panel } from '../../../shared/ui/panel';

/** Teren i otoczenie działki: rzeźba, pokrycie terenu, woda w pobliżu. */
@Component({
  selector: 'app-report-environment',
  imports: [DecimalPipe, Panel],
  template: `
    <app-panel heading="Teren i otoczenie" icon="pi-compass">
      <div class="grid gap-5 text-sm md:grid-cols-3">
        <div class="min-w-0">
          <h4 class="mb-1 font-semibold">Rzeźba terenu</h4>
          @if (source('terrain'); as t) {
            <p>Średnia wysokość <strong>{{t.elevation_m | number:'1.0-1'}} m</strong>.
              @if (t.slope_pct !== null && t.slope_pct !== undefined) { Nachylenie <strong>{{t.slope_pct | number:'1.0-1'}}%</strong>. }</p>
          } @else { <p class="text-muted-color">Brak danych o terenie.</p> }
        </div>
        <div class="min-w-0">
          <h4 class="mb-1 font-semibold">Pokrycie terenu (2021)</h4>
          @if (land(); as land) {
            @for (c of land.classes ?? []; track c.class) {
              <div class="mb-2">
                <div class="flex justify-between"><span>{{c.class}}</span><span class="tabular-nums">{{c.percent | number:'1.0-1'}}%</span></div>
                <div class="mt-1 h-1.5 rounded bg-surface-200 dark:bg-surface-700"><div class="h-1.5 rounded bg-primary" [style.width.%]="c.percent"></div></div>
              </div>
            }
          } @else { <p class="text-muted-color">Brak danych o pokryciu.</p> }
        </div>
        <div class="min-w-0">
          <h4 class="mb-1 font-semibold">Woda w pobliżu</h4>
          @if (land(); as land) {
            @if (land.nearest_water_m !== null && land.nearest_water_m !== undefined) {
              <p>Stała woda około <strong>{{land.nearest_water_m}} m</strong> od granicy (zaznaczona na mapie). To nie potwierdza prawa do poboru.</p>
            } @else { <p>Brak wykrytej stałej wody w odległości do {{land.search_m}} m.</p> }
          }
          @if (gauge(); as g) { <p class="mt-1">Wodowskaz {{g.station}} ({{g.river}}): <strong>{{g.gauge_cm}} cm</strong>, {{g.distance_km}} km od działki.</p> }
        </div>
      </div>
    </app-panel>
  `,
  host: {class: 'block'},
})
export class ReportEnvironment {
  readonly report = input.required<Report>();
  protected readonly land = computed(() => this.source('land'));
  protected readonly gauge = computed(() => this.source('gauge'));
  protected source(key: string): Source | undefined { return this.report().sources.find((s) => s.key === key); }
}
