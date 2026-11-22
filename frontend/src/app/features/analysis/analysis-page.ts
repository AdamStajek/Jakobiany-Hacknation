import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { AnalysisStore } from '../../core/state/analysis.store';
import { ConsentStore } from '../../core/state/consent.store';
import { MapPrefsStore } from '../../core/state/map-prefs.store';
import { toneColor } from '../../core/state/fields.model';
import { FieldsStore, fieldsGeometry } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { ZonesStore } from '../../core/state/zones.store';
import type { FieldShape } from '../../shared/map/map-fields';
import { AddFieldButton } from '../../shared/ui/add-field-button';
import { WodoMap } from '../../shared/map/wodo-map';
import { EmptyState } from '../../shared/ui/empty-state';
import { ProgressOverlay } from '../../shared/ui/progress-overlay';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';
import { AnalysisForm } from './analysis-form';
import { ParcelPicker } from './parcel-picker';
import { ReportDashboard } from './dashboard/report-dashboard';

const HINT_KEY = 'pw.map-hint.analysis.v1';
const SHOW_FIELDS_KEY = 'pw.analysis.show-fields.v1';

type View = 'map' | 'form' | 'report';
type Pane = 'map' | 'report';

/**
 * Przestrzeń robocza: panel danych (zawsze obok na desktopie) i prawa strona z mapą lub raportem.
 * Na telefonie to trzy pełnoekranowe widoki przełączane u góry.
 */
@Component({
  selector: 'app-analysis-page',
  imports: [DecimalPipe, ButtonModule, MessageModule, SkeletonModule, ParcelPicker, AnalysisForm, WodoMap, ReportDashboard, ProgressOverlay,
    EmptyState, Segmented, AddFieldButton],
  host: {class: 'block'},
  template: `
    <div class="flex h-[calc(100dvh-var(--shell-top)-var(--shell-bottom))] flex-col print:block print:h-auto">
      <p class="sr-only" role="status" aria-live="polite">Widok: {{viewLabel()}}</p>
      <div class="border-b border-surface bg-surface-0 px-3 py-2 print:hidden lg:hidden dark:bg-surface-900">
        <app-segmented label="Widok" [options]="mobileViews()" [(value)]="view" />
      </div>

      <div class="grid min-h-0 flex-1 lg:grid-cols-[24rem_minmax(0,1fr)] print:block">
        <section aria-label="Dane analizy" [attr.inert]="analysis.analyzing() ? '' : null"
          class="pw-scroll min-h-0 border-surface bg-surface-0 p-4 print:hidden lg:block lg:border-r dark:bg-surface-900"
          [class.hidden]="view() !== 'form'">
          <div class="flex min-h-full flex-col gap-6">
            <app-parcel-picker />
            <app-analysis-form />
          </div>
        </section>

        <section aria-label="Mapa i raport" class="min-h-0 min-w-0 flex-col print:block lg:flex" [class]="view() === 'form' ? 'hidden' : 'flex'">
          <div class="hidden items-center justify-between gap-3 border-b border-surface bg-surface-0 px-4 py-2 print:hidden lg:flex dark:bg-surface-900">
            <div class="w-64"><app-segmented label="Mapa lub raport" [options]="paneOptions()" [value]="pane()" (valueChange)="view.set($event)" /></div>
            @if (parcels.parcel(); as parcel) {
              <p class="min-w-0 truncate text-sm text-muted-color"><span class="font-medium text-color">{{parcel.id}}</span> · {{parcel.area_ha | number:'1.0-4'}} ha</p>
            }
          </div>

          @if (analysis.report() && pane() === 'map' && !analysis.surfacePoints()?.features?.length) {
            <p class="border-b border-surface px-4 py-2 text-sm print:hidden" role="status">
              @if (analysis.surfacePoints()) {
                W próbkach terenu nie wyznaczono kierunku spływu ani lokalnych obniżeń.
              } @else { Brak danych o kierunkach spływu i lokalnych obniżeniach w tym raporcie. }
            </p>
          }
          <div class="relative min-h-0 flex-1 print:hidden" [class.hidden]="pane() !== 'map'">
            <app-wodo-map [(basemap)]="prefs.basemap" [locateUser]="true" [geometry]="parcels.parcel()?.geometry ?? null" [waterPoint]="analysis.waterPoint()" [surface]="analysis.surfacePoints()"
              [fields]="visibleShapes()" [fieldsMuted]="true" [selectedFieldId]="currentField()?.id ?? null" [fieldsToggleVisible]="shapes().length > 0" [fieldsShown]="showFields()"
              [markers]="zones.markers()" [numberedMarkers]="true" [markMode]="zones.marking()" [markAvailable]="!!parcels.parcel()" [markNotice]="zones.notice()"
              [hintSeen]="hintSeen() || !!parcels.parcel()" (hintDismissed)="dismissHint()"
              (pointClicked)="onPoint($event)" (polygonDrawn)="parcels.importGeometry($event)" (fieldClicked)="openField($event)" (fieldsToggle)="toggleFields()"
              (markToggle)="toggleMarking()" (markUndo)="zones.undo()" (markClear)="zones.clear()" (markDone)="finishMarking()" />
            <div class="absolute inset-x-3 top-3 z-10 lg:hidden"><app-parcel-picker variant="search" /></div>
            @if (analysis.surfacePoints()?.features?.length) {
              <div class="group absolute left-3 top-17 z-10 lg:top-3">
                <details class="peer">
                  <summary aria-describedby="runoff-legend-description"
                    class="pw-card flex min-h-11 cursor-pointer list-none items-center px-3 text-sm shadow-md">
                    <span aria-hidden="true">↑&nbsp;–&nbsp;</span>Kierunek spływu wody
                  </summary>
                </details>
                <p id="runoff-legend-description"
                  class="pw-card invisible absolute w-64 p-3 text-sm shadow-md group-hover:visible group-focus-within:visible peer-open:visible">
                  ≈ Możliwe zatrzymanie wody w lokalnym obniżeniu. Wskazania z próbek wysokości terenu.
                </p>
              </div>
            }
            @if (parcels.parcel(); as parcel) {
              @if (!zones.marking()) {
              <div class="pw-card absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 p-3 shadow-lg lg:hidden" role="status">
                <div class="flex items-center gap-3">
                  <div class="min-w-0 flex-1 text-sm">
                    <div class="truncate font-semibold">{{parcel.id}}</div>
                    <div class="text-xs text-muted-color">{{parcel.area_ha | number:'1.0-4'}} ha@if (parcel.commune) { · gmina {{parcel.commune}} }</div>
                    @if (currentField(); as field) { <div class="truncate text-xs font-medium text-green-700 dark:text-green-400">Pole: {{field.name}}</div> }
                  </div>
                  <p-button label="Dalej" icon="pi pi-arrow-right" iconPos="right" (onClick)="view.set('form')" />
                </div>
                <app-add-field-button [added]="fields.parcelIds().has(parcel.id)" [busy]="fields.adding()" (add)="fields.quickAdd(parcel)" />
              </div>
              }
            }
            @if (analysis.analyzing()) {
              <app-progress-overlay [message]="analysis.progress()" [percent]="analysis.percent()" (cancelled)="analysis.cancel()" />
            }
          </div>

          <div class="relative min-h-0 flex-1" [class.hidden]="pane() !== 'report'">
            <div #reportPane class="pw-scroll h-full print:overflow-visible">
              <div class="mx-auto w-full max-w-5xl p-4 lg:p-6">
                @if (analysis.report(); as report) {
                  <app-report-dashboard [report]="report" />
                } @else if (analysis.running()) {
                  <div class="space-y-3" role="status" aria-label="Trwa analiza">
                    <p-skeleton height="5rem" borderRadius="14px" />
                    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">@for (n of [1, 2, 3, 4]; track n) { <p-skeleton height="6rem" borderRadius="14px" /> }</div>
                    <p-skeleton height="14rem" borderRadius="14px" />
                  </div>
                } @else {
                  @if (analysis.error()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{analysis.error()}}</p-message> }
                  <app-empty-state icon="pi-chart-line" title="Raport pojawi się tutaj"
                    text="Wybierz działkę na mapie, podaj uprawę i datę, a potem uruchom analizę.">
                    <p-button label="Wybierz działkę" icon="pi pi-map" severity="secondary" [outlined]="true" (onClick)="view.set('map')" />
                  </app-empty-state>
                }
              </div>
            </div>
            @if (analysis.analyzing()) {
              <app-progress-overlay class="print:hidden" [message]="analysis.progress()" [percent]="analysis.percent()" (cancelled)="analysis.cancel()" />
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AnalysisPage {
  protected readonly prefs = inject(MapPrefsStore);
  protected readonly parcels = inject(ParcelStore);
  protected readonly analysis = inject(AnalysisStore);
  protected readonly fields = inject(FieldsStore);
  protected readonly zones = inject(ZonesStore);
  private readonly consent = inject(ConsentStore);
  private readonly router = inject(Router);
  private readonly reportPane = viewChild<ElementRef<HTMLElement>>('reportPane');

  /** Parametry trasy (withComponentInputBinding). */
  readonly id = input<string>();
  readonly analysisId = input<string>();

  /** Moje pola na mapie, kolorowane statusem z ostatniego raportu (ta sama geometria co w „Moich polach”). */
  protected readonly shapes = computed<FieldShape[]>(() => this.fields.fields().flatMap((field) => {
    const geometry = fieldsGeometry([field]);
    return geometry ? [{id: field.id, name: field.name, color: toneColor(field.status), geometry}] : [];
  }));
  /** Wybór użytkownika (zapisany tylko za zgodą); bez wyboru warstwa jest włączona, gdy są pola. */
  private readonly showFieldsChoice = signal<boolean | null>(this.readShowFields());
  protected readonly showFields = computed(() => this.showFieldsChoice() ?? true);
  /** Pole zawierające wybraną działkę (wyróżnione na mapie). */
  protected readonly currentField = computed(() => {
    const id = this.parcels.parcel()?.id;
    return id ? this.fields.fields().find((f) => f.parcels.some((p) => p.id === id)) ?? null : null;
  });
  protected readonly visibleShapes = computed(() => (this.showFields() ? this.shapes() : []));
  protected readonly hintSeen = signal(this.consent.read(HINT_KEY) === '1');

  protected readonly view = signal<View>('map');
  /** Prawa strona na desktopie: widok „Dane” (tylko telefon) pokazuje tam mapę. */
  protected readonly pane = computed<Pane>(() => (this.view() === 'report' ? 'report' : 'map'));
  private readonly hasReport = computed(() => !!this.analysis.report() || this.analysis.running());
  protected readonly paneOptions = computed<SegmentOption<View>[]>(() => [
    {value: 'map', label: 'Mapa', icon: 'pi-map'},
    {value: 'report', label: 'Raport', icon: 'pi-chart-bar', disabled: !this.hasReport()},
  ]);
  protected readonly viewLabel = computed(() => ({map: 'Mapa', form: 'Dane analizy', report: 'Raport'})[this.view()]);
  protected readonly mobileViews = computed<SegmentOption<View>[]>(() => [
    {value: 'map', label: 'Mapa', icon: 'pi-map'},
    {value: 'form', label: 'Dane', icon: 'pi-sliders-h'},
    {value: 'report', label: 'Raport', icon: 'pi-chart-bar', disabled: !this.hasReport()},
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.zones.stopMarking());
    // Tryb zaznaczania miejsc zawsze pokazuje mapę (także z widoku „Dane” lub raportu).
    effect(() => { if (this.zones.marking()) untracked(() => this.view.set('map')); });
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

    // Start analizy i pojawienie się raportu przenoszą na widok raportu.
    effect(() => {
      if (!this.analysis.analyzing() && !this.analysis.report()) return;
      untracked(() => this.view.set('report'));
    });

    const reportMetrics = computed(() => this.analysis.report()?.metrics);
    effect(() => {
      if (!reportMetrics()) return;
      setTimeout(() => {
        this.reportPane()?.nativeElement.scrollTo({top: 0});
        document.getElementById('wynik')?.focus({preventScroll: true});
      });
    });

    // Raport zniknął (np. zmiana pola): nie zostawiaj pustego widoku raportu, wróć do mapy.
    effect(() => {
      if (!this.hasReport() && this.view() === 'report') untracked(() => this.view.set('map'));
    });

    // Odznaczenie działki lub błąd bez raportu: wróć do widoku z danymi.
    effect(() => {
      if (this.analysis.error() && !this.analysis.report()) untracked(() => this.view.set('form'));
    });
  }

  private readShowFields(): boolean | null {
    const value = this.consent.read(SHOW_FIELDS_KEY);
    return value === '1' ? true : value === '0' ? false : null;
  }

  protected toggleFields() {
    const next = !this.showFields();
    this.showFieldsChoice.set(next);
    this.consent.write(SHOW_FIELDS_KEY, next ? '1' : '0');
  }

  protected dismissHint() {
    this.hintSeen.set(true);
    this.consent.write(HINT_KEY, '1');
  }

  /** Klik w moje pole = wybór jego (pierwszej) działki, jak „Analizuj” w Moich polach. */
  protected openField(fieldId: string) {
    const parcelId = this.fields.fields().find((f) => f.id === fieldId)?.parcels[0]?.id;
    if (parcelId) void this.router.navigate(['/dzialka', parcelId]);
  }

  /** Klik w mapę: w trybie zaznaczania dodaje miejsce problemowe, inaczej wskazuje działkę. */
  protected onPoint({lat, lon}: {lat: number; lon: number}) {
    if (this.zones.marking()) this.zones.add([lon, lat], this.parcels.parcel()?.geometry ?? null);
    else this.parcels.searchPoint(lat, lon);
  }

  protected toggleMarking() {
    if (this.zones.marking()) this.zones.stopMarking();
    else this.zones.startMarking();
  }

  protected finishMarking() {
    this.zones.stopMarking();
    this.view.set('form');
  }
}
