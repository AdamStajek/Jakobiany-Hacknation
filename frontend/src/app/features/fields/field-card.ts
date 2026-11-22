import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Field, STALE_AFTER_DAYS, attentionReasons, isStale } from '../../core/state/fields.store';
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
          <h3 [id]="'field-' + field().id" class="truncate text-base font-semibold">{{field().name}}</h3>
          <p class="text-xs text-muted-color">
            @if (area() !== null) { {{area() | number:'1.0-2'}} ha · }{{field().parcels.length}} dz.@if (cropLabel()) { · {{cropLabel()}} }
          </p>
        </div>
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
