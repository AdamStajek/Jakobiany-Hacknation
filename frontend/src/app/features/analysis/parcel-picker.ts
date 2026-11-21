import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ParcelStore } from '../../core/state/parcel.store';

@Component({
  selector: 'app-parcel-picker',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, DecimalPipe],
  template: `
    <section class="space-y-3" aria-labelledby="picker-title">
      <h2 id="picker-title" class="text-lg font-semibold">1. Wybierz działkę</h2>
      <p class="text-sm text-muted-color">Wpisz identyfikator (np. 301103_2.0009.549/7), obręb i numer albo kliknij na mapie.</p>
      <form class="flex gap-2" (submit)="$event.preventDefault(); search()">
        <label class="sr-only" for="parcel-id">Identyfikator działki</label>
        <input pInputText id="parcel-id" class="w-full" [formControl]="query" maxlength="90" autocomplete="off"
          placeholder="np. 301103_2.0001.121" />
        <p-button type="submit" icon="pi pi-search" label="Szukaj" [loading]="store.loading()" />
      </form>

      @if (store.choices().length) {
        <div class="space-y-2 rounded-lg border border-surface p-3">
          <p class="text-sm font-medium">Znaleziono kilka działek. Wybierz właściwą:</p>
          @for (item of store.choices(); track item.id) {
            <p-button styleClass="w-full" severity="secondary" [outlined]="true" size="small" (onClick)="store.select(item)"
              [label]="item.id + (item.commune ? ' · ' + item.commune : '')" />
          }
        </div>
      }

      @if (store.parcel(); as parcel) {
        <div class="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950" role="status">
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
        <p-button icon="pi pi-upload" label="Wczytaj granicę z GeoJSON" severity="secondary" [outlined]="true" size="small"
          [disabled]="store.loading()" (onClick)="file.click()" />
      </div>

      @if (store.error()) { <p-message severity="error" role="alert">{{store.error()}}</p-message> }
    </section>
  `,
})
export class ParcelPicker {
  protected readonly store = inject(ParcelStore);
  protected readonly query = new FormControl('', {nonNullable: true});

  protected search() { void this.store.search(this.query.value); }

  protected importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.importFile(file);
  }
}
