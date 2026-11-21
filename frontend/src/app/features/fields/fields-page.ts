import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import type { Geometry } from '../../core/api/types';
import { AnalysisStore } from '../../core/state/analysis.store';
import { Field, FieldsStore } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { WodoMap } from '../../shared/map/wodo-map';
import { EmptyState } from '../../shared/ui/empty-state';
import { Panel } from '../../shared/ui/panel';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';
import { FieldCard } from './field-card';
import { FieldForm } from './field-form';

type View = 'list' | 'map';

/** Pulpit „Moje pola”: karty pól, lista „wymaga uwagi” i mapa wszystkich pól (pola zapisane w przeglądarce). */
@Component({
  selector: 'app-fields-page',
  imports: [ButtonModule, MessageModule, SkeletonModule, WodoMap, EmptyState, Panel, Segmented, FieldCard, FieldForm],
  host: {class: 'block'},
  template: `
    <div class="flex h-[calc(100dvh-var(--shell-top)-var(--shell-bottom))] flex-col">
      <div class="border-b border-surface bg-surface-0 px-3 py-2 lg:hidden dark:bg-surface-900">
        <app-segmented label="Widok pulpitu" [options]="views" [(value)]="view" />
      </div>

      <div class="grid min-h-0 flex-1 lg:grid-cols-[28rem_minmax(0,1fr)]">
        <section aria-label="Lista pól" class="pw-scroll min-h-0 border-surface bg-surface-0 p-4 lg:block lg:border-r dark:bg-surface-900"
          [class.hidden]="view() !== 'list'">
          <div class="flex flex-col gap-4">
            <header class="flex flex-wrap items-center gap-2">
              <h1 class="mr-auto text-xl font-bold">Moje pola</h1>
              @if (!adding()) { <p-button label="Dodaj pole" icon="pi pi-plus" (onClick)="startAdd(false)" /> }
            </header>
            <p class="text-xs text-muted-color">Pola są zapisane tylko w tej przeglądarce. Nie wymagają konta.</p>

            @if (fields.error()) { <p-message severity="warn" role="alert">{{fields.error()}}</p-message> }
            @if (analysis.error()) {
              <p-message severity="error" role="alert">
                <span>{{analysis.error()}}</span>
                <p-button label="Spróbuj ponownie" size="small" severity="secondary" [text]="true" (onClick)="init()" />
              </p-message>
            }

            @if (canSaveCurrent()) {
              <div class="pw-card flex flex-wrap items-center gap-3 p-3 text-sm">
                <span class="min-w-0 flex-1">Bieżąca działka: <strong class="break-words">{{parcels.parcel()?.id}}</strong></span>
                <p-button label="Zapisz jako pole" icon="pi pi-bookmark" size="small" (onClick)="startAdd(true)" />
              </div>
            }

            @if (!ready()) {
              <div class="space-y-3" role="status" aria-label="Wczytywanie pól">
                <p-skeleton height="7rem" borderRadius="14px" /><p-skeleton height="7rem" borderRadius="14px" />
              </div>
            } @else if (adding()) {
              <app-field-form [initial]="prefill()" (saved)="onSaved($event)" (cancelled)="adding.set(false)" />
            } @else if (!fields.fields().length) {
              <app-empty-state icon="pi-map-marker" title="Nie masz jeszcze pól"
                text="Dodaj pole z listy numerów działek albo zapisz działkę po analizie. Zobaczysz tu status z ostatniego raportu.">
                <p-button label="Dodaj pierwsze pole" icon="pi pi-plus" (onClick)="startAdd(false)" />
              </app-empty-state>
            } @else {
              @if (fields.attention().length) {
                <app-panel heading="Wymaga uwagi" icon="pi-exclamation-triangle">
                  <ul class="flex flex-col gap-2 text-sm">
                    @for (item of fields.attention(); track item.field.id) {
                      <li><button type="button" class="w-full rounded-lg px-2 py-1 text-left hover:bg-surface-100 dark:hover:bg-surface-800" (click)="analyze(item.field.parcels[0].id)">
                        <span class="font-semibold">{{item.field.name}}</span>
                        <span class="block text-xs text-muted-color">{{item.reasons.join(' · ')}}</span>
                      </button></li>
                    }
                  </ul>
                </app-panel>
              }
              <ul class="flex flex-col gap-3" aria-label="Pola">
                @for (field of fields.fields(); track field.id) {
                  <li><app-field-card [field]="field" [cropLabel]="cropLabel(field)"
                    (analyze)="analyze($event)" (located)="locate(field.id)" (removed)="remove($event)" /></li>
                }
              </ul>
            }
          </div>
        </section>

        <section aria-label="Mapa pól" class="relative min-h-0 min-w-0 lg:block" [class.hidden]="view() !== 'map'">
          <app-wodo-map [geometry]="mapGeometry()" />
          @if (selected(); as field) {
            <div class="pw-card absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 p-3 shadow-lg lg:right-auto lg:max-w-sm" role="status">
              <span class="min-w-0 flex-1 truncate text-sm">Na mapie: <strong>{{field.name}}</strong></span>
              <p-button label="Wszystkie pola" size="small" severity="secondary" [outlined]="true" (onClick)="selectedId.set(null)" />
            </div>
          } @else if (!fields.fields().length) {
            <p class="pw-card absolute inset-x-3 bottom-3 z-10 p-3 text-center text-sm text-muted-color lg:right-auto lg:max-w-sm">Tu pojawią się granice Twoich pól.</p>
          }
        </section>
      </div>
    </div>
  `,
})
export class FieldsPage {
  protected readonly fields = inject(FieldsStore);
  protected readonly parcels = inject(ParcelStore);
  protected readonly analysis = inject(AnalysisStore);
  private readonly router = inject(Router);

  protected readonly views: SegmentOption<View>[] = [
    {value: 'list', label: 'Pola', icon: 'pi-list'},
    {value: 'map', label: 'Mapa', icon: 'pi-map'},
  ];
  protected readonly view = signal<View>('list');
  protected readonly ready = signal(false);
  protected readonly adding = signal(false);
  protected readonly prefillCurrent = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly prefill = computed(() => (this.prefillCurrent() ? this.parcels.parcel() : null));
  protected readonly selected = computed(() => this.fields.fields().find((f) => f.id === this.selectedId()) ?? null);
  /** Bieżąca działka, która nie należy jeszcze do żadnego pola. */
  protected readonly canSaveCurrent = computed(() => {
    const current = this.parcels.parcel();
    return !!current && !this.adding() && !this.fields.fields().some((f) => f.parcels.some((p) => p.id === current.id));
  });
  /** Jedna geometria dla mapy: wybrane pole albo wszystkie pola razem (MultiPolygon). */
  protected readonly mapGeometry = computed<Geometry | null>(() => {
    const list = this.selected() ? [this.selected() as Field] : this.fields.fields();
    const polygons = list.flatMap((f) => f.parcels).flatMap(({geometry}) =>
      geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]);
    return polygons.length ? {type: 'MultiPolygon', coordinates: polygons} : null;
  });

  constructor() { void this.init(); }

  protected async init() {
    this.ready.set(false);
    await this.analysis.init();
    this.ready.set(true);
  }

  protected startAdd(current: boolean) {
    this.prefillCurrent.set(current);
    this.adding.set(true);
  }

  protected onSaved(field: Field) {
    this.adding.set(false);
    this.selectedId.set(field.id);
  }

  protected cropLabel(field: Field): string {
    return this.analysis.crops().find((c) => c.id === field.crop)?.label ?? '';
  }

  protected locate(id: string) {
    this.selectedId.set(id);
    this.view.set('map');
  }

  protected remove(id: string) {
    if (this.selectedId() === id) this.selectedId.set(null);
    this.fields.remove(id);
  }

  protected analyze(parcelId: string) {
    void this.router.navigate(['/dzialka', parcelId]);
  }
}
