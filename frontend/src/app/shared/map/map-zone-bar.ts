import { Component, input, output } from '@angular/core';

/** Pasek trybu „Zaznacz miejsca problemowe” (dół mapy): instrukcja, licznik, Cofnij ostatnie / Usuń wszystkie / Gotowe. */
@Component({
  selector: 'app-map-zone-bar',
  template: `
    <div class="pw-card flex flex-col gap-2 p-3 shadow-lg" role="region" aria-label="Zaznaczanie miejsc problemowych">
      <p class="text-sm font-medium">Dotknij miejsca na działce, które sprawia kłopot. Możesz dodać wiele miejsc.</p>
      <p class="text-sm" role="status">Zaznaczono: <strong>{{count()}}</strong></p>
      <p class="text-xs text-muted-color">Typ, datę i opis każdego miejsca dodasz po kliknięciu „Gotowe”: w panelu „Dodatkowe informacje o polu” → „Miejsca problemowe”.</p>
      @if (notice()) {
        <p class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100" role="alert">{{notice()}}</p>
      }
      <div class="flex gap-2">
        <button type="button" (click)="undo.emit()" [disabled]="count() < 1"
          class="pw-card flex min-h-12 flex-1 items-center justify-center gap-2 px-1 text-sm font-medium disabled:opacity-50">
          <i class="pi pi-undo" aria-hidden="true"></i>Cofnij ostatnie
        </button>
        <button type="button" (click)="clear.emit()" [disabled]="count() < 1"
          class="pw-card flex min-h-12 flex-1 items-center justify-center gap-2 px-1 text-sm font-medium disabled:opacity-50">
          <i class="pi pi-trash" aria-hidden="true"></i>Usuń wszystkie
        </button>
        <button type="button" (click)="done.emit()"
          class="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-1 text-sm font-medium text-primary-contrast">
          <i class="pi pi-check" aria-hidden="true"></i>Gotowe
        </button>
      </div>
    </div>
  `,
})
export class MapZoneBar {
  readonly count = input.required<number>();
  readonly notice = input('');
  readonly undo = output();
  readonly clear = output();
  readonly done = output();
}
