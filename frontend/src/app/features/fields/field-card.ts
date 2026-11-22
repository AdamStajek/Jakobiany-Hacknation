import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { FIELD_NAME_MAX, Field, STALE_AFTER_DAYS, attentionReasons, isStale } from '../../core/state/fields.store';
import { colorStyle } from './field-colors';

/** Karta pola: nazwa, uprawa, status z ostatniego zapisanego raportu i akcje. */
@Component({
  selector: 'app-field-card',
  imports: [DatePipe, DecimalPipe, ButtonModule],
  template: `
    <article class="pw-card flex flex-col gap-3 p-4" [attr.aria-labelledby]="'field-' + field().id">
      <header class="flex items-start gap-3">
        <span class="mt-1 h-3 w-3 shrink-0 rounded-full {{dot()}}" aria-hidden="true"></span>
        <div class="min-w-0 flex-1">
          @if (editing()) {
            <form class="flex items-center gap-2" (submit)="$event.preventDefault(); save()">
              <label [for]="'rename-' + field().id" class="sr-only">Nowa nazwa pola</label>
              <input [id]="'rename-' + field().id" type="text" [attr.maxlength]="nameMax" autocomplete="off"
                class="p-inputtext p-component h-10 min-w-0 flex-1" [value]="draft()" (input)="draft.set(valueOf($event))"
                (keydown.escape)="cancel()" [attr.aria-invalid]="!valid()" />
              <button type="submit" [disabled]="!valid() || saving()" aria-label="Zapisz nazwę"
                class="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-100 disabled:opacity-50 dark:hover:bg-surface-800">
                <i class="pi pi-check" aria-hidden="true"></i>
              </button>
              <button type="button" (click)="cancel()" aria-label="Anuluj zmianę nazwy"
                class="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-100 dark:hover:bg-surface-800">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </form>
          } @else {
            <h3 [id]="'field-' + field().id" class="truncate text-base font-semibold">{{field().name}}</h3>
          }
          <p class="text-xs text-muted-color">
            @if (area() !== null) { {{area() | number:'1.0-2'}} ha · }{{field().parcels.length}} dz.@if (cropLabel()) { · {{cropLabel()}} }
          </p>
        </div>
        @if (!editing()) {
          <button type="button" (click)="startEdit()" [attr.aria-label]="'Zmień nazwę pola ' + field().name"
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800">
            <i class="pi pi-pencil" aria-hidden="true"></i>
          </button>
        }
        <button type="button" (click)="removed.emit(field().id)" [attr.aria-label]="'Usuń pole ' + field().name"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800">
          <i class="pi pi-trash" aria-hidden="true"></i>
        </button>
      </header>

      @if (field().status; as status) {
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="inline-flex items-center gap-1 rounded-full bg-surface-100 px-3 py-1 font-medium dark:bg-surface-800">
            <i class="pi pi-chart-line" aria-hidden="true"></i>{{status.risk}}
          </span>
          <span class="text-xs text-muted-color">raport z {{status.date | date:'d MMM yyyy'}}</span>
          @if (stale()) {
            <span class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <i class="pi pi-history" aria-hidden="true"></i>Nieaktualny (starszy niż {{staleDays}} dni)
            </span>
          }
        </div>
        @if (reasons().length) {
          <ul class="flex flex-col gap-1 text-sm text-amber-700 dark:text-amber-400" aria-label="Powody uwagi">
            @for (reason of reasons(); track reason) {
              <li class="flex items-center gap-2"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i>{{reason}}</li>
            }
          </ul>
        }
      } @else {
        <p class="text-sm text-muted-color">Brak raportu. Uruchom analizę, aby zobaczyć status pola.</p>
      }

      <div class="flex flex-wrap gap-2">
        @for (parcel of field().parcels; track parcel.id) {
          <p-button [label]="field().parcels.length > 1 ? 'Analizuj ' + parcel.id : 'Analizuj'" icon="pi pi-play" size="small"
            (onClick)="analyze.emit(parcel.id)" />
        }
<p-button label="Dane działki" icon="pi pi-id-card" size="small" severity="secondary" [outlined]="true" (onClick)="passport.emit(field().id)" />
        <p-button label="Na mapie" icon="pi pi-map" size="small" severity="secondary" [outlined]="true" (onClick)="located.emit(field().id)" />
      </div>
    </article>
  `,
})
export class FieldCard {
  readonly field = input.required<Field>();
  /** Etykieta uprawy (id → nazwa), jeśli znana. */
  readonly cropLabel = input('');
  readonly analyze = output<string>();
  readonly located = output<string>();
  readonly passport = output<string>();
  readonly removed = output<string>();
  /** Zmiana nazwy: `{id, name}`; rodzic zapisuje i zwraca true, gdy się udało. */
  readonly renamed = output<{id: string; name: string; done: (ok: boolean) => void}>();

  protected readonly nameMax = FIELD_NAME_MAX;
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly draft = signal('');
  protected readonly valid = computed(() => {
    const value = this.draft().trim();
    return value.length > 0 && value.length <= FIELD_NAME_MAX;
  });

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected startEdit() {
    this.draft.set(this.field().name);
    this.editing.set(true);
  }

  protected cancel() {
    this.editing.set(false);
  }

  protected save() {
    if (!this.valid() || this.saving()) return;
    if (this.draft().trim() === this.field().name) return this.cancel();
    this.saving.set(true);
    this.renamed.emit({id: this.field().id, name: this.draft(), done: (ok) => {
      this.saving.set(false);
      if (ok) this.editing.set(false);
    }});
  }

  protected readonly staleDays = STALE_AFTER_DAYS;
  protected readonly dot = computed(() => colorStyle(this.field().color).dot);
  /** Powierzchnia znana tylko, gdy każda część ma `area_ha` (pola z serwera jej nie zwracają). */
  protected readonly area = computed(() => {
    const parcels = this.field().parcels;
    return parcels.every((p) => p.area_ha != null) ? parcels.reduce((sum, p) => sum + (p.area_ha ?? 0), 0) : null;
  });
  protected readonly stale = computed(() => {
    const status = this.field().status;
    return !!status && isStale(status);
  });
  protected readonly reasons = computed(() => attentionReasons(this.field().status));
}
