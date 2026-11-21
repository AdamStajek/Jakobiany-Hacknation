import { DecimalPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ParcelStore } from '../../core/state/parcel.store';

/**
 * Wybór działki. `full` — pełny krok w panelu (opis, wybrana działka, import),
 * `search` — samo pole wyszukiwania do nałożenia na mapę (telefon).
 */
@Component({
  selector: 'app-parcel-picker',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, DecimalPipe],
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

      @if (variant() === 'full') {
        @if (store.parcel(); as parcel) {
          <div class="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-500 dark:bg-primary-900" role="status">
            <i class="pi pi-check-circle mt-0.5 text-primary" aria-hidden="true"></i>
            <div class="min-w-0 flex-1 text-sm">
              <div class="break-all font-semibold">{{parcel.id}}</div>
              <div class="text-muted-color">{{parcel.area_ha | number:'1.0-4'}} ha
                @if (parcel.commune) { · gmina {{parcel.commune}} } @if (parcel.region) { · obręb {{parcel.region}} }</div>
            </div>
            <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="secondary" size="small"
              ariaLabel="Odznacz działkę" (onClick)="store.clear()" />
          </div>
          @if (parcel.warning) { <p-message severity="warn" role="status">{{parcel.warning}}</p-message> }
        }
        <div>
          <input #file type="file" class="hidden" accept=".geojson,.json,application/geo+json,application/json"
            (change)="importFile($event)" />
          <p-button icon="pi pi-upload" label="Wczytaj granicę z GeoJSON" severity="secondary" [text]="true" size="small"
            [disabled]="store.loading()" (onClick)="file.click()" />
        </div>
      }

      @if (store.error()) { <p-message severity="error" role="alert">{{store.error()}}</p-message> }
    </section>
  `,
})
export class ParcelPicker {
  readonly variant = input<'full' | 'search'>('full');
  protected readonly store = inject(ParcelStore);
  protected readonly query = new FormControl('', {nonNullable: true});
  protected readonly inputId = () => (this.variant() === 'full' ? 'parcel-id' : 'parcel-id-map');

  protected search() { void this.store.search(this.query.value); }

  protected importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.importFile(file);
  }
}
