import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { FieldsStore, riskTone } from '../../core/state/fields.store';
import { ParcelStore } from '../../core/state/parcel.store';
import { AddFieldButton } from '../../shared/ui/add-field-button';

/**
 * Wybór działki. `full` — pełny krok w panelu (opis, wybrana działka, import),
 * `search` — samo pole wyszukiwania do nałożenia na mapę (telefon).
 */
@Component({
  selector: 'app-parcel-picker',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, DecimalPipe, AddFieldButton],
  template: `
    <section class="space-y-3" [attr.aria-labelledby]="variant() === 'full' ? 'picker-title' : null" [attr.aria-label]="variant() === 'search' ? 'Wyszukiwanie działki' : null">
      @if (variant() === 'full') {
        <header>
          <h2 id="picker-title" class="text-base font-semibold">Działka</h2>
          <p class="text-sm text-muted-color">Wpisz identyfikator (np. 301103_2.0009.549/7), obręb i numer albo kliknij na mapie.</p>
        </header>
      }
      <form class="flex gap-2" (submit)="$event.preventDefault(); search()">
        <label class="sr-only" [for]="inputId()">Identyfikator działki</label>
        <div class="relative min-w-0 flex-1">
          <i class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-color" aria-hidden="true"></i>
          <input pInputText [id]="inputId()" class="h-11 w-full pl-9 shadow-sm" [formControl]="query" maxlength="90" autocomplete="off"
            enterkeyhint="search" placeholder="Numer działki, np. 301103_2.0001.121" />
        </div>
        <p-button type="submit" icon="pi pi-arrow-right" ariaLabel="Szukaj działki" styleClass="h-11 w-11" [loading]="store.loading()" />
      </form>

      @if (store.choices().length) {
        <div class="pw-card space-y-1 p-2 shadow-sm">
          <p class="px-2 pt-1 text-sm font-medium">Znaleziono kilka działek. Wybierz właściwą:</p>
          @for (item of store.choices(); track item.id) {
            <button type="button" (click)="store.select(item)"
              class="flex min-h-11 w-full flex-col items-start justify-center rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800">
              <span class="break-all font-medium">{{item.id}}</span>
              <span class="text-xs text-muted-color">{{item.area_ha | number:'1.0-4'}} ha@if (item.commune) { · gmina {{item.commune}} }</span>
            </button>
          }
        </div>
      }

      @if (variant() === 'full' && fields.fields().length) {
        <nav aria-label="Moje pola" class="flex flex-col gap-1">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-color">Moje pola</h3>
          <ul class="flex flex-wrap gap-2">
            @for (field of fields.fields(); track field.id) {
              <li><button type="button" (click)="open(field.parcels[0]?.id)" [attr.aria-current]="field.id === currentField()?.id ? 'true' : null"
                class="inline-flex min-h-9 items-center gap-2 rounded-full border border-surface px-3 text-sm hover:bg-surface-100 dark:hover:bg-surface-800"
                [class.border-primary]="field.id === currentField()?.id">
                <span class="h-2.5 w-2.5 rounded-full" [class]="dot[tone(field.status)]" aria-hidden="true"></span>{{field.name}}</button></li>
            }
          </ul>
        </nav>
      }

      @if (variant() === 'full') {
        @if (store.parcel(); as parcel) {
          <div class="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-500 dark:bg-primary-900" role="status">
            <i class="pi pi-check-circle mt-0.5 text-primary" aria-hidden="true"></i>
            <div class="min-w-0 flex-1 text-sm">
              <div class="break-all font-semibold">{{parcel.id}}</div>
              <div class="text-muted-color">{{parcel.area_ha | number:'1.0-4'}} ha
                @if (parcel.commune) { · gmina {{parcel.commune}} } @if (parcel.region) { · obręb {{parcel.region}} }</div>
              @if (currentField(); as field) {
                <div class="mt-1 font-medium text-green-700 dark:text-green-400">Ta działka należy do pola „{{field.name}}”.</div>
              }
              <div class="mt-2">
                <app-add-field-button [added]="fields.parcelIds().has(parcel.id)" [busy]="fields.adding()" (add)="fields.quickAdd(parcel)" />
              </div>
            </div>
            <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="secondary" size="small"
              ariaLabel="Odznacz działkę" (onClick)="store.clear()" />
          </div>
          @if (parcel.warning) { <p-message severity="warn" role="status">{{parcel.warning}}</p-message> }
        }
      }

      @if (store.error()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{store.error()}}</p-message> }
    </section>
  `,
})
export class ParcelPicker {
  readonly variant = input<'full' | 'search'>('full');
  protected readonly store = inject(ParcelStore);
  protected readonly fields = inject(FieldsStore);
  private readonly router = inject(Router);
  /** Pole, do którego należy wybrana działka. */
  protected readonly currentField = computed(() => {
    const id = this.store.parcel()?.id;
    return id ? this.fields.fields().find((f) => f.parcels.some((p) => p.id === id)) ?? null : null;
  });
  protected readonly tone = riskTone;
  protected readonly dot = {high: 'bg-red-600', unsure: 'bg-amber-500', low: 'bg-green-600', none: 'bg-gray-500'};
  protected readonly query = new FormControl('', {nonNullable: true});
  protected readonly inputId = () => (this.variant() === 'full' ? 'parcel-id' : 'parcel-id-map');

  protected open(parcelId: string | undefined) {
    if (parcelId) void this.router.navigate(['/dzialka', parcelId]);
  }

  protected search() { void this.store.search(this.query.value); }
}
