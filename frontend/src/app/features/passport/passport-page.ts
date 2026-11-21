import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api/api.service';
import { errorMessage } from '../../core/api/errors';
import type { Passport } from '../../core/api/types';
import { AnalysisStore } from '../../core/state/analysis.store';
import { Field, FieldsStore } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { AddFieldButton } from '../../shared/ui/add-field-button';
import { EmptyState } from '../../shared/ui/empty-state';
import { PassportSummary } from './passport-summary';

const DEFAULT_CROP = 'wheat';

/**
 * Paszporty pól: krótka informacja o wybranym polu z listy „Moje pola”.
 * Trasa `/dzialka/:id/paszport` pokazuje ten sam skrót dla jednej działki (np. prosto z raportu).
 */
@Component({
  selector: 'app-passport-page',
  imports: [RouterLink, ButtonModule, MessageModule, SkeletonModule, EmptyState, AddFieldButton, PassportSummary],
  host: {class: 'block'},
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header>
        <h1 class="text-2xl font-extrabold tracking-tight">Paszporty pól</h1>
        <p class="text-sm text-muted-color">Krótka informacja o polu: powierzchnia, woda i sytuacja na dziś.</p>
      </header>

      @if (id(); as parcelId) {
        @if (parcels.parcel(); as parcel) {
          <div class="flex flex-wrap items-center gap-3">
            <app-add-field-button [added]="fields.parcelIds().has(parcel.id)" [busy]="fields.adding()" (add)="fields.quickAdd(parcel)" />
            <a routerLink="/paszporty" class="text-sm text-primary underline">Wszystkie moje pola</a>
          </div>
        }
      } @else if (!fields.fields().length) {
        <app-empty-state icon="pi-id-card" title="Nie masz jeszcze pól"
          text="Wybierz działkę na mapie i dodaj ją do swoich pól jednym kliknięciem. Paszport pojawi się tutaj.">
          <a routerLink="/" class="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast">
            <i class="pi pi-map" aria-hidden="true"></i>Wybierz działkę na mapie
          </a>
        </app-empty-state>
      } @else if (selected(); as current) {
        <div role="group" aria-label="Wybierz pole" class="flex flex-wrap gap-2">
          @for (field of fields.fields(); track field.id) {
            <button type="button" (click)="selectedId.set(field.id)" [attr.aria-pressed]="current.id === field.id"
              class="min-h-10 rounded-full border border-surface px-4 text-sm"
              [class]="current.id === field.id ? 'bg-primary font-semibold text-primary-contrast' : 'hover:bg-surface-100 dark:hover:bg-surface-800'">
              {{field.name}}
            </button>
          }
        </div>
        @if (current.parcels.length > 1) {
          <label class="flex flex-col gap-1 text-sm font-medium">Działka w polu
            <select class="p-inputtext p-component h-11" (change)="parcelIndex.set(+valueOf($event))">
              @for (parcel of current.parcels; track parcel.id; let i = $index) {
                <option [value]="i" [selected]="i === parcelIndex()">{{parcel.id}}</option>
              }
            </select>
          </label>
        }
      }

      @if (loading()) {
        <div role="status" aria-label="Pobieramy paszport"><p-skeleton height="12rem" borderRadius="14px" /></div>
      } @else if (error()) {
        <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">
          <span>{{error()}}</span>
          <p-button label="Spróbuj ponownie" size="small" severity="secondary" [text]="true" (onClick)="reload()" />
        </p-message>
      } @else if (passport(); as data) {
        <app-passport-summary [data]="data" [title]="title()" [subtitle]="subtitle()" />
      }
    </div>
  `,
})
export class PassportPage implements OnInit {
  protected readonly fields = inject(FieldsStore);
  protected readonly parcels = inject(ParcelStore);
  private readonly analysis = inject(AnalysisStore);
  private readonly api = inject(ApiService);

  /** Parametr trasy (withComponentInputBinding). */
  readonly id = input<string>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly parcelIndex = signal(0);
  protected readonly passport = signal<Passport | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private readonly attempt = signal(0);

  protected readonly selected = computed<Field | null>(() => {
    const list = this.fields.fields();
    return list.find((f) => f.id === this.selectedId()) ?? list[0] ?? null;
  });
  /** Działka i uprawa, dla których liczymy paszport: z linku albo z wybranego pola. */
  private readonly target = computed(() => {
    if (this.id()) return this.parcels.parcel()?.id === this.id() ? {parcelId: this.id() as string, crop: DEFAULT_CROP} : null;
    const field = this.selected();
    const parcel = field?.parcels[Math.min(this.parcelIndex(), (field?.parcels.length ?? 1) - 1)];
    return field && parcel ? {parcelId: parcel.id, crop: field.crop ?? DEFAULT_CROP} : null;
  });
  protected readonly title = computed(() => (this.id() ? this.parcels.parcel()?.id ?? '' : this.selected()?.name ?? ''));
  protected readonly subtitle = computed(() => {
    if (this.id()) {
      const parcel = this.parcels.parcel();
      return parcel?.commune ? `gmina ${parcel.commune}` : '';
    }
    const field = this.selected();
    const crop = this.analysis.crops().find((c) => c.id === field?.crop)?.label;
    return [crop, field && field.parcels.length > 1 ? `działek: ${field.parcels.length}` : ''].filter(Boolean).join(' · ');
  });

  constructor() {
    effect(() => {
      this.selected();
      untracked(() => this.parcelIndex.set(0));
    });
    effect(() => {
      const target = this.target();
      const max = this.analysis.range().max;
      this.attempt();
      untracked(() => void this.fetch(target, max));
    });
  }

  ngOnInit() {
    void this.analysis.init();
    const id = this.id();
    if (id) void this.parcels.open(id);
  }

  protected valueOf(event: Event): string { return (event.target as HTMLSelectElement).value; }

  protected reload() { this.attempt.update((n) => n + 1); }

  private async fetch(target: {parcelId: string; crop: string} | null, asOf: string) {
    this.passport.set(null);
    this.error.set('');
    if (!target || !asOf) return;
    this.loading.set(true);
    try {
      const data = await this.api.passport(target.parcelId, asOf, target.crop);
      if (this.target()?.parcelId === target.parcelId) this.passport.set(data);
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się pobrać paszportu pola. Spróbuj ponownie.'));
    } finally {
      this.loading.set(false);
    }
  }
}
