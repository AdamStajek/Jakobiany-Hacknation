import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import type { Geometry } from '../../core/api/types';
import bbox from '@turf/bbox';
import { AnalysisStore } from '../../core/state/analysis.store';
import { AuthStore } from '../../core/state/auth.store';
import { ConsentStore } from '../../core/state/consent.store';
import { toServerColor } from '../../core/state/fields.model';
import { Field, FieldsStore, fieldsGeometry } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { loginQuery } from '../../core/state/return-url';
import { FieldPin, WodoMap } from '../../shared/map/wodo-map';
import { EmptyState } from '../../shared/ui/empty-state';
import { LoginPrompt } from '../../shared/ui/login-prompt';
import { Panel } from '../../shared/ui/panel';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';
import { FieldCard } from './field-card';
import { FieldForm } from './field-form';
import { FieldPassport } from './field-passport';

type View = 'list' | 'map' | 'passports';
type Pane = 'map' | 'passports';

/** Pulpit „Moje pola”: karty pól, lista „wymaga uwagi” i mapa wszystkich pól (mapa i paszporty pól). */
@Component({
  selector: 'app-fields-page',
  imports: [ButtonModule, MessageModule, SkeletonModule, WodoMap, EmptyState, LoginPrompt, Panel, Segmented, FieldCard, FieldForm, FieldPassport],
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
            @if (auth.loggedIn()) {
              <p class="text-xs text-muted-color">Pola są zapisane na Twoim koncie.</p>
            } @else if (consent.storageAllowed()) {
              <p class="text-xs text-muted-color">Pola są zapisane tylko w tej przeglądarce. Nie wymagają konta.
                <button type="button" class="text-primary underline" (click)="consent.reopen()">Zmień zgodę</button></p>
            } @else {
              <p class="text-xs text-muted-color">Bez zgody na zapis pola są tylko w pamięci tej karty i znikną po odświeżeniu.
                <button type="button" class="text-primary underline" (click)="consent.reopen()">Pozwól zapisywać w przeglądarce</button></p>
            }

            @if (offerMigration()) {
              <section class="pw-card flex flex-col gap-3 p-3 text-sm" aria-label="Przenieś pola na konto">
                <p class="flex items-start gap-2">
                  <i class="pi pi-cloud-upload mt-0.5 text-primary" aria-hidden="true"></i>
                  <span>W tej przeglądarce masz {{fields.localFields().length}} zapisanych pól. Przenieś je na konto, aby były dostępne wszędzie.</span>
                </p>
                <div class="flex flex-wrap gap-2">
                  <p-button label="Przenieś pola na konto" icon="pi pi-cloud-upload" size="small" [loading]="fields.migrating()" [disabled]="fields.migrating()" (onClick)="migrate()" />
                  <p-button label="Nie teraz" size="small" severity="secondary" [text]="true" [disabled]="fields.migrating()" (onClick)="migrationDismissed.set(true)" />
                </div>
              </section>
            }

            @if (fields.error()) {
              <p-message severity="warn" role="alert">
                <span>{{fields.error()}}</span>
                @if (auth.loggedIn()) { <p-button label="Odśwież" size="small" severity="secondary" [text]="true" (onClick)="fields.load()" /> }
              </p-message>
            }
            @if (analysis.error()) {
              <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">
                <span>{{analysis.error()}}</span>
                <p-button label="Spróbuj ponownie" size="small" severity="secondary" [text]="true" (onClick)="init()" />
              </p-message>
            }

            @if (canSaveCurrent()) {
              <div class="pw-card flex flex-wrap items-center gap-3 p-3 text-sm">
                <span class="min-w-0 flex-1">Bieżąca działka: <strong class="break-words">{{parcels.parcel()?.id}}</strong></span>
                <p-button label="Dodaj do pól" icon="pi pi-plus" size="small" [loading]="fields.adding()" (onClick)="saveCurrent()" />
              </div>
            }

            @if (!ready() || fields.loading()) {
              <div class="space-y-3" role="status" aria-label="Wczytywanie pól">
                <p-skeleton height="7rem" borderRadius="14px" /><p-skeleton height="7rem" borderRadius="14px" />
              </div>
            } @else if (adding()) {
              <app-field-form [initial]="prefill()" (saved)="onSaved($event)" (cancelled)="adding.set(false)" />
            } @else if (!fields.fields().length) {
              <app-empty-state icon="pi-map-marker" title="Nie masz jeszcze pól"
                text="Wybierz działkę na mapie i dodaj ją jednym kliknięciem, albo wklej listę numerów działek. Zobaczysz tu status z ostatniego raportu.">
                <p-button label="Dodaj pierwsze pole" icon="pi pi-plus" (onClick)="startAdd(false)" />
              </app-empty-state>
              @if (!auth.loggedIn() && auth.status() === 'guest' && !inviteDismissed()) {
                <app-login-prompt title="Miej pola pod ręką na każdym urządzeniu"
                  text="Z kontem pola są na każdym urządzeniu. To tylko dodatek: bez konta wszystko działa tak samo."
                  [query]="loginQuery()" (dismissed)="inviteDismissed.set(true)" />
              }
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
                    (analyze)="analyze($event)" (located)="locate(field.id)" (passport)="showPassport(field.id)" (removed)="remove($event)" /></li>
                }
              </ul>
            }
          </div>
        </section>

        <section aria-label="Mapa i paszporty pól" class="flex min-h-0 min-w-0 flex-col lg:flex" [class.hidden]="view() === 'list'">
          <div class="hidden items-center border-b border-surface bg-surface-0 px-4 py-2 lg:flex dark:bg-surface-900">
            <div class="w-64"><app-segmented label="Mapa lub paszporty" [options]="paneOptions" [value]="pane()" (valueChange)="view.set($event)" /></div>
          </div>

          <div class="relative min-h-0 flex-1" [class.hidden]="pane() !== 'map'">
            <app-wodo-map [geometry]="mapGeometry()" [pins]="pins()" (pinClicked)="selectedId.set($event)" />
            @if (selected(); as field) {
              <div class="pw-card absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 p-3 shadow-lg lg:right-auto lg:max-w-sm" role="status">
                <span class="min-w-0 flex-1 truncate text-sm">Na mapie: <strong>{{field.name}}</strong></span>
                <p-button label="Wszystkie pola" size="small" severity="secondary" [outlined]="true" (onClick)="selectedId.set(null)" />
              </div>
            } @else if (!fields.fields().length) {
              <p class="pw-card absolute inset-x-3 bottom-3 z-10 p-3 text-center text-sm text-muted-color lg:right-auto lg:max-w-sm">Tu pojawią się granice Twoich pól.</p>
            }
          </div>

          <div class="pw-scroll min-h-0 flex-1 p-4" [class.hidden]="pane() !== 'passports'">
            @if (passportField(); as current) {
              <div class="mx-auto flex max-w-2xl flex-col gap-3">
                <div role="group" aria-label="Wybierz pole" class="flex flex-wrap gap-2">
                  @for (field of fields.fields(); track field.id) {
                    <button type="button" (click)="selectedId.set(field.id)" [attr.aria-pressed]="current.id === field.id"
                      class="min-h-10 rounded-full border border-surface px-4 text-sm"
                      [class]="current.id === field.id ? 'bg-primary font-semibold text-primary-contrast' : 'hover:bg-surface-100 dark:hover:bg-surface-800'">{{field.name}}</button>
                  }
                </div>
                <app-field-passport [field]="current" />
              </div>
            } @else {
              <app-empty-state icon="pi-id-card" title="Paszporty pojawią się tutaj" text="Dodaj pierwsze pole, a pokażemy jego krótki paszport." />
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class FieldsPage {
  protected readonly fields = inject(FieldsStore);
  protected readonly parcels = inject(ParcelStore);
  protected readonly analysis = inject(AnalysisStore);
  protected readonly auth = inject(AuthStore);
  protected readonly consent = inject(ConsentStore);
  private readonly router = inject(Router);

  protected readonly views: SegmentOption<View>[] = [
    {value: 'list', label: 'Pola', icon: 'pi-list'},
    {value: 'map', label: 'Mapa', icon: 'pi-map'},
    {value: 'passports', label: 'Paszporty', icon: 'pi-id-card'},
  ];
  protected readonly paneOptions: SegmentOption<View>[] = [
    {value: 'map', label: 'Mapa', icon: 'pi-map'},
    {value: 'passports', label: 'Paszporty', icon: 'pi-id-card'},
  ];
  /** Parametr zapytania `widok=paszporty` (stary adres /paszporty) otwiera od razu widok paszportów. */
  readonly widok = input<string>();
  /** Parametr zapytania `pole`: pole wybrane od razu po wejściu (np. z linku do paszportu działki). */
  readonly pole = input<string>();
  protected readonly view = signal<View>('list');
  /** Prawa strona na desktopie: widok „Pola” (tylko telefon) pokazuje tam mapę. */
  protected readonly pane = computed<Pane>(() => (this.view() === 'passports' ? 'passports' : 'map'));
  protected readonly ready = signal(false);
  protected readonly adding = signal(false);
  protected readonly prefillCurrent = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly inviteDismissed = signal(false);
  protected readonly migrationDismissed = signal(false);
  protected readonly loginQuery = () => loginQuery('/pola');
  /** Po zalogowaniu proponujemy przeniesienie pól zapisanych w przeglądarce. */
  protected readonly offerMigration = computed(() =>
    this.auth.loggedIn() && this.fields.localFields().length > 0 && !this.migrationDismissed());

  protected readonly passportField = computed(() => this.selected() ?? this.fields.fields()[0] ?? null);
  protected readonly prefill = computed(() => (this.prefillCurrent() ? this.parcels.parcel() : null));
  protected readonly selected = computed(() => this.fields.fields().find((f) => f.id === this.selectedId()) ?? null);
  /** Bieżąca działka, która nie należy jeszcze do żadnego pola. */
  protected readonly canSaveCurrent = computed(() => {
    const current = this.parcels.parcel();
    return !!current && !this.adding() && !this.fields.fields().some((f) => f.parcels.some((p) => p.id === current.id));
  });
  /** Jedna geometria dla mapy: wybrane pole albo wszystkie pola razem (MultiPolygon). */
  protected readonly mapGeometry = computed<Geometry | null>(() => fieldsGeometry(this.selected() ? [this.selected() as Field] : this.fields.fields()));

  /** Jedna pinezka na pole (środek jego działek), widoczna po oddaleniu mapy. */
  protected readonly pins = computed<FieldPin[]>(() => this.fields.fields().flatMap((field) => {
    const polygons = field.parcels.flatMap(({geometry}) =>
      geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]);
    if (!polygons.length) return [];
    const [w, s, e, n] = bbox({type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon', coordinates: polygons}} as never);
    return [{id: field.id, name: field.name, color: toServerColor(field.color), coordinates: [(w + e) / 2, (s + n) / 2] as [number, number]}];
  }));

  constructor() {
    void this.init();
    void this.auth.init();
    effect(() => { if (this.widok() === 'paszporty') untracked(() => this.view.set('passports')); });
    effect(() => {
      const id = this.pole();
      if (id && this.fields.fields().some((f) => f.id === id)) untracked(() => this.selectedId.set(id));
    });
  }

  protected async init() {
    this.ready.set(false);
    await this.analysis.init();
    this.ready.set(true);
  }

  protected async migrate() {
    await this.fields.migrateLocal();
  }

  protected startAdd(current: boolean) {
    this.prefillCurrent.set(current);
    this.adding.set(true);
  }

  /** Dodaje bieżącą działkę jednym kliknięciem, bez formularza. */
  protected async saveCurrent() {
    const parcel = this.parcels.parcel();
    const field = parcel ? await this.fields.quickAdd(parcel) : null;
    if (field) this.selectedId.set(field.id);
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

  protected showPassport(id: string) {
    this.selectedId.set(id);
    this.view.set('passports');
  }

  protected remove(id: string) {
    if (this.selectedId() === id) this.selectedId.set(null);
    this.fields.remove(id);
  }

  protected analyze(parcelId: string) {
    void this.router.navigate(['/dzialka', parcelId]);
  }
}
