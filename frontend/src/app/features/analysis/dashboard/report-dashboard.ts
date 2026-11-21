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
import { Segmented, SegmentOption } from '../../../shared/ui/segmented';
import { RiskScale } from '../../../shared/ui/risk-scale';
import { RouterLink } from '@angular/router';
import { SatelliteChart, SeasonChart, SoilChart, WaterBalanceChart } from './charts';
import { ReportEnvironment } from './report-environment';
import { ReportRecommendations } from './report-recommendations';

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
  imports: [DecimalPipe, ButtonModule, MessageModule, TableModule, TagModule, ConfidenceChip, KpiCard, Panel, Segmented, RiskScale, RouterLink,
    ReportEnvironment, ReportRecommendations, WaterBalanceChart, SeasonChart, SoilChart, SatelliteChart],
  host: {class: 'block'},
  template: `
    <section aria-labelledby="wynik" class="space-y-5">
      <header class="space-y-3">
        <div>
          <h2 id="wynik" tabindex="-1" class="text-xl font-bold tracking-tight outline-none lg:text-2xl">Stan wody na Twojej działce</h2>
          <p class="text-sm text-muted-color">{{report().parcel.id}} · {{report().metrics.crop.label}} · {{report().metrics.stage}} ·
            {{report().parcel.area_ha | number:'1.0-4'}} ha · {{report().date}}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 print:hidden">
          <a pButton [href]="'/api/analysis/' + report().analysis_id + '/report'" download icon="pi pi-file-pdf">PDF</a>
          <a pButton [routerLink]="['/dzialka', report().parcel.id, 'paszport']" icon="pi pi-id-card" severity="secondary" [outlined]="true">Paszport</a>
          <p-button icon="pi pi-link" ariaLabel="Kopiuj link" severity="secondary" [outlined]="true" (onClick)="copyLink()" />
          <p-button icon="pi pi-print" ariaLabel="Drukuj" severity="secondary" [outlined]="true" (onClick)="print()" />
          <a pButton [href]="'/api/analysis/' + report().analysis_id + '/report?format=json'" download icon="pi pi-download" aria-label="Pobierz JSON"
            severity="secondary" [outlined]="true"></a>
          <div class="ml-auto w-full sm:w-64">
            <app-segmented label="Widok raportu" [options]="modes" [value]="mode()" (valueChange)="setMode($event)" />
          </div>
        </div>
      </header>

      <div class="flex flex-wrap items-center gap-4 rounded-2xl border p-4" [class]="riskClass()">
        <i class="pi {{risk().icon}} text-3xl" aria-hidden="true"></i>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold uppercase tracking-wide opacity-80">Ryzyko niedoboru wody</div>
          <div class="text-2xl font-bold">{{report().metrics.risk}}</div>
          @if (report().metrics.weather_last_day && report().metrics.weather_last_day !== report().date) {
            <div class="text-sm opacity-80">Ostatnia pełna doba danych: {{report().metrics.weather_last_day}}</div>
          }
        </div>
        <app-risk-scale class="w-full sm:w-64" [risk]="report().metrics.risk" />
        <app-confidence-chip [level]="report().confidence" />
      </div>

      @if (!report().agricultural) {
        <p-message severity="warn">Mapa z 2021 r. wskazuje głównie inne użytkowanie. Sprawdź pole. Jeśli prowadzisz tu uprawę, potwierdź ją w dodatkowych informacjach i ponów analizę.</p-message>
      }

      @if (report().metrics.recent; as r) {
        @if (!advanced()) {
          <div class="grid grid-cols-2 gap-3">
            <app-kpi-card label="Deszcz w ostatnich 30 dniach" [value]="(r.rain_mm | number:'1.0-0') ?? ''" unit="mm"
              [hint]="r.rain_anomaly_mm !== undefined ? (r.rain_anomaly_mm < 0 ? 'Mniej niż zwykle' : 'Tyle samo lub więcej niż zwykle') : ''" />
            <app-kpi-card label="Najdłuższa przerwa bez deszczu" [value]="r.dry_spell_days" unit="dni" />
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <app-kpi-card label="Bilans uprawy · 30 dni" [value]="(r.crop_balance_mm | number:'1.0-1') ?? ''" unit="mm"
              [hint]="'Opad minus zapotrzebowanie · ' + r.samples + '/' + r.days + ' dni z danymi'" />
            <app-kpi-card label="Opad · 30 dni" [value]="(r.rain_mm | number:'1.0-1') ?? ''" unit="mm"
              [hint]="r.rain_anomaly_mm !== undefined ? 'Względem mediany z lat: ' + (r.rain_anomaly_mm | number:'1.0-1') + ' mm' : ''" />
            <app-kpi-card label="Najdłuższy okres bez deszczu" [value]="r.dry_spell_days" unit="dni" hint="Dni z opadem poniżej 1 mm" />
            <app-kpi-card label="Współczynnik uprawy Kc" [value]="(report().metrics.kc | number:'1.2-3') ?? ''" [hint]="report().metrics.stage" />
          </div>
        }
      } @else {
        <p-message severity="info">Brak wystarczających danych pogodowych dla ostatnich 30 dni.</p-message>
      }

      <app-report-recommendations [items]="report().recommendations" />

      @if (advanced()) {
        <div class="grid gap-3 lg:grid-cols-2">
          <app-water-balance-chart class="block min-w-0" [report]="report()" />
          <app-season-chart class="block min-w-0" [report]="report()" />
          <app-soil-chart class="block min-w-0" [report]="report()" />
          <div class="min-w-0">
            <app-satellite-chart class="block" [report]="report()" />
            @if (satellite(); as s) {
              @if (s.scene; as scene) {
                <div class="mt-3 grid grid-cols-3 gap-3">
                  <app-kpi-card label="NDVI" [value]="(scene.ndvi | number:'1.2-2') ?? ''" hint="Zieleń łanu" />
                  <app-kpi-card label="NDMI" [value]="(scene.ndmi | number:'1.2-2') ?? ''" hint="Woda w liściach" />
                  <app-kpi-card label="NDWI" [value]="(scene.ndwi | number:'1.2-2') ?? ''" hint="Woda na powierzchni" />
                </div>
                <p class="mt-3 text-sm text-muted-color">Scena {{scene.date}} · {{scene.clear_share * 100 | number:'1.0-0'}}% użytecznej powierzchni.
                  @if (scene.crop_stage) { Faza kalendarzowa: {{scene.crop_stage}}. }
                  @if (report().metrics.satellite_comparison; as cmp) { {{cmp.interpretation}} Odchylenie NDMI od mediany {{cmp.n}} scen sezonowych: {{cmp.ndmi_delta | number:'1.2-2'}}. }
                </p>
              } @else { <p class="mt-2 text-sm text-muted-color">Brak użytecznego obrazu dla tej daty.</p> }
            }
          </div>
        </div>
        <app-report-environment [report]="report()" />
      } @else {
        <div class="grid gap-3 lg:grid-cols-2">
          <app-water-balance-chart class="block min-w-0" [report]="report()" />
          <app-panel heading="Jak wyglądają rośliny?" icon="pi-sun">
            @if (plantsText(); as t) {
              <p class="text-sm">{{t}}</p>
              <p class="mt-2 text-xs text-muted-color">Na podstawie zdjęcia satelitarnego z {{satellite()?.scene?.date}}.</p>
            } @else { <p class="text-sm text-muted-color">Brak użytecznego zdjęcia satelitarnego dla tej daty.</p> }
          </app-panel>
        </div>
      }

      @if (report().scenario; as sc) {
        <app-panel heading="Co jeśli zatrzymasz więcej wody?" icon="pi-cloud">
          <p class="text-sm">Dodatkowe <strong>{{sc.input_mm}} mm</strong> w scenariuszu zmniejsza modelowany ubytek o
            <strong>{{sc.depletion_reduction_mm[0] | number:'1.0-1'}}–{{sc.depletion_reduction_mm[1] | number:'1.0-1'}} mm</strong>. {{sc.note}}</p>
        </app-panel>
      }

      <app-panel [heading]="advanced() ? 'Skąd pochodzą dane?' : 'Na czym opieramy wynik?'" icon="pi-database">
        @if (missing().length) {
          <p-message severity="warn" styleClass="mb-3">
            <div><strong>Braki i ograniczenia dla tej analizy</strong>
              <ul class="ml-5 mt-1 list-disc">@for (m of missing(); track m[0]) { <li><strong>{{m[0]}}.</strong> {{m[1]}}</li> }</ul></div>
          </p-message>
        }
        @if (advanced()) {
          <ul class="space-y-3 md:hidden" aria-label="Źródła danych">
            @for (s of sourceRows(); track s.key) {
              <li class="rounded-lg border border-surface p-3 text-sm">
                <div class="font-semibold">{{s.name}}</div>
                <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt class="text-muted-color">Rodzaj</dt><dd>{{s.kind}}</dd>
                  <dt class="text-muted-color">Rozdzielczość</dt><dd>{{s.resolution}}</dd>
                  <dt class="text-muted-color">Pobrano</dt><dd>{{s.retrieved}} @if (s.cached) { <p-tag value="cache" severity="secondary" /> }</dd>
                  <dt class="text-muted-color">Publikacja</dt><dd>{{s.published}}</dd>
                </dl>
                <a [href]="s.url" target="_blank" rel="noopener" class="mt-2 inline-block text-xs text-primary underline">Otwórz źródło: {{s.name}} ↗</a>
              </li>
            }
          </ul>
          <p-table class="hidden md:block" [value]="sourceRows()" [scrollable]="true" size="small" stripedRows>
            <ng-template #header>
              <tr><th>Źródło</th><th>Rodzaj</th><th>Rozdzielczość</th><th>Pobrano</th><th>Publikacja</th><th><span class="sr-only">Odnośnik</span></th></tr>
            </ng-template>
            <ng-template #body let-s>
              <tr>
                <td class="font-medium">{{s.name}}</td><td>{{s.kind}}</td><td>{{s.resolution}}</td>
                <td class="whitespace-nowrap">{{s.retrieved}} @if (s.cached) { <p-tag value="cache" severity="secondary" /> }</td>
                <td class="whitespace-nowrap">{{s.published}}</td>
                <td><a [href]="s.url" target="_blank" rel="noopener" class="text-primary underline" [attr.aria-label]="'Otwórz źródło: ' + s.name">Otwórz ↗</a></td>
              </tr>
            </ng-template>
          </p-table>
        } @else {
          <p class="text-sm">Korzystamy z danych satelitarnych Sentinel-2, pogody z ostatnich dni i lat oraz map gleby i terenu. Pełną listę źródeł znajdziesz w widoku zaawansowanym.</p>
        }
        <p class="mt-3 text-xs text-muted-color">Czas analizy {{report().elapsed_ms / 1000 | number:'1.1-1'}} s · Geometria: {{report().parcel.source}}.
          Wynik ma charakter przesiewowy i nie zastępuje pomiaru w polu.</p>
      </app-panel>
    </section>
  `,
})
export class ReportDashboard {
  readonly report = input.required<Report>();
    protected readonly modes: SegmentOption<ReportMode>[] = [{label: 'Prosty', value: 'simple'}, {label: 'Zaawansowany', value: 'advanced'}];
  private readonly consent = inject(ConsentStore);
  protected readonly mode = signal<ReportMode>(this.loadMode());
  protected readonly advanced = computed(() => this.mode() === 'advanced');
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
  private loadMode(): ReportMode {
    try { return this.consent.read('report-mode') === 'advanced' ? 'advanced' : 'simple'; } catch { return 'simple'; }
  }
  protected setMode(m: ReportMode) {
    this.mode.set(m);
    this.consent.write('report-mode', m);
  }
  protected readonly risk = computed(() => RISK[this.report().metrics.risk] ?? {tone: 'info' as Tone, icon: 'pi-info-circle'});
  protected readonly riskClass = computed(() => TONE_CLASS[this.risk().tone]);
  protected readonly sourceRows = computed(() => this.report().sources.map((s) => ({
    ...s, retrieved: formatDateTime(s.retrieved_at), published: s.publication_date ? formatDate(s.publication_date) : 'brak daty',
  })));
  protected readonly missing = computed(() => Object.entries(this.report().missing));
  protected readonly satellite = computed(() => this.source('satellite'));

  protected source(key: string): Source | undefined { return this.report().sources.find((s) => s.key === key); }
  protected print() { window.print(); }
  protected async copyLink() {
    try { await navigator.clipboard.writeText(location.href); } catch { /* brak uprawnień schowka */ }
  }
}
