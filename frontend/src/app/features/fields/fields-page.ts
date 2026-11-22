import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AnalysisStore } from '../../core/state/analysis.store';
import { AuthStore } from '../../core/state/auth.store';
import { ConsentStore } from '../../core/state/consent.store';
import { Field, FieldsStore } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { loginQuery } from '../../core/state/return-url';
import { EmptyState } from '../../shared/ui/empty-state';
import { LoginPrompt } from '../../shared/ui/login-prompt';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';
import { FieldForm } from './field-form';
import { FieldsList } from './fields-list';
import { FieldsMapPanel } from './fields-map-panel';
import { FieldsNotices } from './fields-notices';
import { FieldsPassports } from './fields-passports';
import { FarmReport } from './farm-report';
import { farmStats } from './farm-stats';

/** Zapamiętanie zamkniętej wskazówki mapy (tylko za zgodą, przez ConsentStore). */
const HINT_KEY = 'pw.map-hint.fields.v1';

type View = 'list' | 'map' | 'passports';
type Pane = 'map' | 'passports';

/** Pulpit „Moje pola”: karty pól, lista „wymaga uwagi” i mapa wszystkich pól (mapa i paszporty pól). */
@Component({
  selector: 'app-fields-page',
  imports: [ButtonModule, SkeletonModule, EmptyState, LoginPrompt, Segmented, FieldForm, FarmReport, FieldsList, FieldsMapPanel, FieldsNotices, FieldsPassports, RouterLink],
  host: {class: 'block'},
  templateUrl: './fields-page.html',
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

  /** Podsumowanie gospodarstwa: tylko sumowanie i grupowanie, status i powody pochodzą ze sklepu. */
  protected readonly stats = computed(() => farmStats(this.fields.fields(), (id) => this.analysis.crops().find((c) => c.id === id)?.label ?? ''));
  protected readonly generatedAt = signal(new Date());

  protected readonly passportField = computed(() => this.selected() ?? this.fields.fields()[0] ?? null);
  protected readonly prefill = computed(() => (this.prefillCurrent() ? this.parcels.parcel() : null));
  protected readonly selected = computed(() => this.fields.fields().find((f) => f.id === this.selectedId()) ?? null);
  /** Bieżąca działka, która nie należy jeszcze do żadnego pola. */
  protected readonly canSaveCurrent = computed(() => {
    const current = this.parcels.parcel();
    return !!current && !this.adding() && !this.fields.fields().some((f) => f.parcels.some((p) => p.id === current.id));
  });
  protected readonly hintSeen = signal(this.consent.read(HINT_KEY) === '1');

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

  protected readonly cropLabel = (field: Field): string =>
    this.analysis.crops().find((c) => c.id === field.crop)?.label ?? '';

  protected locate(id: string) {
    this.selectedId.set(id);
    this.view.set('map');
  }

  protected showPassport(id: string) {
    this.selectedId.set(id);
    this.view.set('passports');
  }

  protected dismissHint() {
    this.hintSeen.set(true);
    this.consent.write(HINT_KEY, '1');
  }

  protected remove(id: string) {
    if (this.selectedId() === id) this.selectedId.set(null);
    this.fields.remove(id);
  }

  /** Odświeża datę raportu i otwiera okno drukowania (zapis do PDF); ekran wraca do normy po zamknięciu okna. */
  protected print() {
    this.generatedAt.set(new Date());
    window.print();
  }

  protected analyze(parcelId: string) {
    void this.router.navigate(['/dzialka', parcelId]);
  }
}
