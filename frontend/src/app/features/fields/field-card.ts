import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { FIELD_NAME_MAX, Field, RiskTone, STALE_AFTER_DAYS, attentionReasons, isStale, riskTone } from '../../core/state/fields.store';
import { FieldThumb } from './field-thumb';

type ToneStyle = {border: string; text: string; pill: string; icon: string};
const TONES: Record<RiskTone, ToneStyle> = {
  high: {border: 'border-l-red-600', text: 'text-red-600', pill: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', icon: 'pi-exclamation-triangle'},
  unsure: {border: 'border-l-amber-500', text: 'text-amber-500', pill: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', icon: 'pi-question-circle'},
  low: {border: 'border-l-green-600', text: 'text-green-600', pill: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200', icon: 'pi-check-circle'},
  none: {border: 'border-l-gray-400', text: 'text-gray-500', pill: 'bg-surface-100 dark:bg-surface-800', icon: 'pi-minus-circle'},
};

/** Karta pola: nazwa, uprawa, status z ostatniego zapisanego raportu i akcje. */
@Component({
  selector: 'app-field-card',
  imports: [DatePipe, DecimalPipe, ButtonModule, FieldThumb],
  template: `
    <article class="pw-card flex flex-col gap-3 border-l-4 p-4 {{toneStyle().border}}" [attr.aria-labelledby]="'field-' + field().id">
      <header class="flex items-start gap-3">
        <app-field-thumb class="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface-100 {{toneStyle().text}} dark:bg-surface-800" [parcels]="field().parcels" />
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
          <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium {{toneStyle().pill}}">
            <i class="pi {{toneStyle().icon}}" aria-hidden="true"></i>{{status.risk}}
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
        <p class="inline-flex items-center gap-2 text-sm text-muted-color"><i class="pi pi-info-circle" aria-hidden="true"></i>Brak raportu. Uruchom analizę, aby zobaczyć status pola.</p>
      }

      <div class="flex flex-wrap gap-2">
        @for (parcel of field().parcels; track parcel.id) {
          <p-button [label]="field().parcels.length > 1 ? 'Analizuj ' + parcel.id : 'Analizuj'" icon="pi pi-play" size="small"
            (onClick)="analyze.emit(parcel.id)" />
        }
<p-button label="Dane działki" icon="pi pi-id-card" size="small" severity="secondary" [text]="true" (onClick)="passport.emit(field().id)" />
        <p-button label="Na mapie" icon="pi pi-map" size="small" severity="secondary" [text]="true" (onClick)="located.emit(field().id)" />
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
  /** Styl wg statusu raportu (nie wg koloru wybranego przez użytkownika, ten jest tylko na mapie pól). */
  protected readonly toneStyle = computed(() => TONES[riskTone(this.field().status)]);
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
