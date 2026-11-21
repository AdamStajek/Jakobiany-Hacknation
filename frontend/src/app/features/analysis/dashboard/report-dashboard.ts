import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Recommendation, Report, Source } from '../../../core/api/types';
import { ConfidenceChip } from '../../../shared/ui/confidence-chip';
import { KpiCard } from '../../../shared/ui/kpi-card';
import { SatelliteChart, SeasonChart, SoilChart, WaterBalanceChart } from './charts';

type Tone = 'danger' | 'warn' | 'success' | 'info';
const RISK: Record<string, {tone: Tone; icon: string}> = {
  'Podwyższone': {tone: 'danger', icon: 'pi-exclamation-triangle'},
  'Sygnał niedoboru': {tone: 'danger', icon: 'pi-exclamation-triangle'},
  'Niepewne': {tone: 'warn', icon: 'pi-question-circle'},
  'Niskie w modelu': {tone: 'success', icon: 'pi-check-circle'},
  'Brak sygnału z opadu i ET': {tone: 'success', icon: 'pi-check-circle'},
};
const TONE_CLASS: Record<Tone, string> = {
  danger: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  warn: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  info: 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
};

@Component({
  selector: 'app-report-dashboard',
  imports: [DecimalPipe, ButtonModule, DrawerModule, MessageModule, TableModule, TagModule, ConfidenceChip, KpiCard,
    WaterBalanceChart, SeasonChart, SoilChart, SatelliteChart],
  template: `
    <section aria-labelledby="wynik" class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wynik" tabindex="-1" class="text-2xl font-bold tracking-tight outline-none">Stan wody na Twojej działce</h2>
          <p class="text-sm text-muted-color">{{report().parcel.id}} · {{report().metrics.crop.label}} · {{report().metrics.stage}} ·
            {{report().parcel.area_ha | number:'1.0-4'}} ha · {{report().date}}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a pButton [href]="'/api/analysis/' + report().analysis_id + '/report'" download icon="pi pi-file-pdf" label="Pobierz PDF"></a>
          <p-button icon="pi pi-print" label="Drukuj" severity="secondary" [outlined]="true" (onClick)="print()" />
          <a pButton [href]="'/api/analysis/' + report().analysis_id + '/report?format=json'" download icon="pi pi-download" label="JSON"
            severity="secondary" [outlined]="true"></a>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 rounded-xl border p-4" [class]="riskClass()">
        <i class="pi {{risk().icon}} text-3xl" aria-hidden="true"></i>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold uppercase tracking-wide opacity-80">Ryzyko niedoboru wody</div>
          <div class="text-2xl font-bold">{{report().metrics.risk}}</div>
          @if (report().metrics.weather_last_day && report().metrics.weather_last_day !== report().date) {
            <div class="text-sm opacity-80">Ostatnia pełna doba danych: {{report().metrics.weather_last_day}}</div>
          }
        </div>
        <app-confidence-chip [level]="report().confidence" />
      </div>

      @if (!report().agricultural) {
        <p-message severity="warn">Mapa z 2021 r. wskazuje głównie inne użytkowanie. Sprawdź pole. Jeśli prowadzisz tu uprawę, potwierdź ją w dodatkowych informacjach i ponów analizę.</p-message>
      }

      @if (report().metrics.recent; as r) {
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <app-kpi-card label="Bilans uprawy · 30 dni" [value]="(r.crop_balance_mm | number:'1.0-1') ?? ''" unit="mm"
            [hint]="'Opad minus zapotrzebowanie · ' + r.samples + '/' + r.days + ' dni z danymi'" />
          <app-kpi-card label="Opad · 30 dni" [value]="(r.rain_mm | number:'1.0-1') ?? ''" unit="mm"
            [hint]="r.rain_anomaly_mm !== undefined ? 'Względem mediany z lat: ' + (r.rain_anomaly_mm | number:'1.0-1') + ' mm' : ''" />
          <app-kpi-card label="Najdłuższy okres bez deszczu" [value]="r.dry_spell_days" unit="dni" hint="Dni z opadem poniżej 1 mm" />
          <app-kpi-card label="Współczynnik uprawy Kc" [value]="(report().metrics.kc | number:'1.2-3') ?? ''" [hint]="report().metrics.stage" />
        </div>
      } @else {
        <p-message severity="info">Brak wystarczających danych pogodowych dla ostatnich 30 dni.</p-message>
      }

      <section aria-labelledby="zalecenia" class="space-y-3">
        <h3 id="zalecenia" class="text-xl font-semibold">Co możesz zrobić?</h3>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          @for (item of report().recommendations; track item.title; let n = $index) {
            <article class="flex flex-col gap-2 rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900">
              <div class="flex items-center gap-2 text-xs text-muted-color">
                <span class="grid h-6 w-6 place-items-center rounded-md bg-primary-100 font-bold text-primary dark:bg-primary-950">{{n + 1}}</span>
                <span>{{item.group}}</span><span class="ml-auto">Pewność: {{item.confidence}}</span>
              </div>
              <h4 class="text-base font-semibold">{{item.title}}</h4>
              <p class="text-sm">{{item.action}}</p>
              <p class="text-sm"><strong>Kiedy?</strong> {{item.when}}</p>
              <p-button class="mt-auto" label="Dlaczego na tej działce?" icon="pi pi-info-circle" [text]="true" size="small" (onClick)="selected.set(item)" />
            </article>
          } @empty {
            <p class="text-muted-color">Brak wystarczających podstaw do zaleceń dla wybranej działki i daty.</p>
          }
        </div>
      </section>

      <div class="grid gap-3 lg:grid-cols-2">
        <app-water-balance-chart [report]="report()" />
        <app-season-chart [report]="report()" />
        <app-soil-chart [report]="report()" />
        <div>
          <app-satellite-chart [report]="report()" />
          @if (satellite(); as s) {
            @if (s.scene; as scene) {
              <div class="mt-3 grid grid-cols-3 gap-3">
                <app-kpi-card label="NDVI" [value]="(scene.ndvi | number:'1.2-2') ?? ''" hint="Zieleń łanu" />
                <app-kpi-card label="NDMI" [value]="(scene.ndmi | number:'1.2-2') ?? ''" hint="Woda w liściach" />
                <app-kpi-card label="NDWI" [value]="(scene.ndwi | number:'1.2-2') ?? ''" hint="Woda na powierzchni" />
              </div>
              <p class="mt-2 text-sm text-muted-color">Scena {{scene.date}} · {{scene.clear_share * 100 | number:'1.0-0'}}% użytecznej powierzchni.
                @if (scene.crop_stage) { Faza kalendarzowa: {{scene.crop_stage}}. }
                @if (report().metrics.satellite_comparison; as cmp) { {{cmp.interpretation}} Odchylenie NDMI od mediany {{cmp.n}} scen sezonowych: {{cmp.ndmi_delta | number:'1.2-2'}}. }
              </p>
            } @else { <p class="mt-2 text-sm text-muted-color">Brak użytecznego obrazu dla tej daty.</p> }
          }
        </div>
      </div>

      <section class="rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900" aria-labelledby="otoczenie">
        <h3 id="otoczenie" class="mb-2 text-xl font-semibold">Teren i otoczenie</h3>
        <div class="grid gap-4 md:grid-cols-3">
          <div class="text-sm">
            <h4 class="mb-1 font-semibold">Rzeźba terenu</h4>
            @if (source('terrain'); as t) {
              <p>Średnia wysokość <strong>{{t.elevation_m | number:'1.0-1'}} m</strong>.
                @if (t.slope_pct !== null && t.slope_pct !== undefined) { Nachylenie <strong>{{t.slope_pct | number:'1.0-1'}}%</strong>. }</p>
            } @else { <p class="text-muted-color">Brak danych o terenie.</p> }
          </div>
          <div class="text-sm">
            <h4 class="mb-1 font-semibold">Pokrycie terenu (2021)</h4>
            @if (source('land'); as land) {
              @for (c of land.classes ?? []; track c.class) {
                <div class="mb-1"><div class="flex justify-between"><span>{{c.class}}</span><span>{{c.percent | number:'1.0-1'}}%</span></div>
                  <div class="h-1.5 rounded bg-surface-200 dark:bg-surface-700"><div class="h-1.5 rounded bg-primary" [style.width.%]="c.percent"></div></div></div>
              }
            } @else { <p class="text-muted-color">Brak danych o pokryciu.</p> }
          </div>
          <div class="text-sm">
            <h4 class="mb-1 font-semibold">Woda w pobliżu</h4>
            @if (source('land'); as land) {
              @if (land.nearest_water_m !== null && land.nearest_water_m !== undefined) {
                <p>Stała woda około <strong>{{land.nearest_water_m}} m</strong> od granicy (zaznaczona na mapie). To nie potwierdza prawa do poboru.</p>
              } @else { <p>Brak wykrytej stałej wody w odległości do {{land.search_m}} m.</p> }
            }
            @if (source('gauge'); as g) { <p class="mt-1">Wodowskaz {{g.station}} ({{g.river}}): <strong>{{g.gauge_cm}} cm</strong>, {{g.distance_km}} km od działki.</p> }
          </div>
        </div>
      </section>

      @if (report().scenario; as sc) {
        <section class="rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900">
          <h3 class="mb-1 text-xl font-semibold">Co jeśli zatrzymasz więcej wody?</h3>
          <p class="text-sm">Dodatkowe <strong>{{sc.input_mm}} mm</strong> w scenariuszu zmniejsza modelowany ubytek o
            <strong>{{sc.depletion_reduction_mm[0] | number:'1.0-1'}}–{{sc.depletion_reduction_mm[1] | number:'1.0-1'}} mm</strong>. {{sc.note}}</p>
        </section>
      }

      <section class="rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900" aria-labelledby="zrodla">
        <h3 id="zrodla" class="mb-2 text-xl font-semibold">Skąd pochodzą dane?</h3>
        @if (missing().length) {
          <p-message severity="warn" styleClass="mb-3">
            <div><strong>Braki i ograniczenia dla tej analizy</strong>
              <ul class="ml-5 mt-1 list-disc">@for (m of missing(); track m[0]) { <li><strong>{{m[0]}}.</strong> {{m[1]}}</li> }</ul></div>
          </p-message>
        }
        <p-table [value]="report().sources" [scrollable]="true" size="small" stripedRows>
          <ng-template #header>
            <tr><th>Źródło</th><th>Rodzaj</th><th>Rozdzielczość</th><th>Pobrano</th><th>Publikacja</th><th></th></tr>
          </ng-template>
          <ng-template #body let-s>
            <tr>
              <td class="font-medium">{{s.name}}</td><td>{{s.kind}}</td><td>{{s.resolution}}</td>
              <td>{{s.retrieved_at}} @if (s.cached) { <p-tag value="cache" severity="secondary" /> }</td>
              <td>{{s.publication_date ?? 'brak daty'}}</td>
              <td><a [href]="s.url" target="_blank" rel="noopener" class="text-primary underline">Otwórz ↗</a></td>
            </tr>
          </ng-template>
        </p-table>
        <p class="mt-2 text-xs text-muted-color">Czas analizy {{report().elapsed_ms / 1000 | number:'1.1-1'}} s · Geometria: {{report().parcel.source}}.
          Wynik ma charakter przesiewowy i nie zastępuje pomiaru w polu.</p>
      </section>
    </section>

    <p-drawer [visible]="!!selected()" (visibleChange)="!$event && selected.set(null)" position="right" styleClass="!w-full md:!w-[28rem]"
      [header]="selected()?.title ?? ''">
      @if (selected(); as rec) {
        <div class="space-y-3 text-sm">
          <p class="text-muted-color">{{rec.group}} · Pewność: {{rec.confidence}}</p>
          <div><h4 class="font-semibold">Dlaczego na tej działce</h4><p>{{rec.why}}</p></div>
          <div><h4 class="font-semibold">Dowody</h4><p>{{rec.evidence}}</p></div>
          <div><h4 class="font-semibold">Ograniczenia</h4><p>{{rec.limits}}</p></div>
        </div>
      }
    </p-drawer>
  `,
})
export class ReportDashboard {
  readonly report = input.required<Report>();
  protected readonly selected = signal<Recommendation | null>(null);
  protected readonly risk = computed(() => RISK[this.report().metrics.risk] ?? {tone: 'info' as Tone, icon: 'pi-info-circle'});
  protected readonly riskClass = computed(() => TONE_CLASS[this.risk().tone]);
  protected readonly missing = computed(() => Object.entries(this.report().missing));
  protected readonly satellite = computed(() => this.source('satellite'));

  protected source(key: string): Source | undefined { return this.report().sources.find((s) => s.key === key); }
  protected print() { window.print(); }
}
