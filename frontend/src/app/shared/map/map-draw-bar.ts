import { Component, input, output } from '@angular/core';

/** Pasek trybu rysowania (dół mapy): instrukcja, licznik punktów, Cofnij punkt / Zakończ / Anuluj. */
@Component({
  selector: 'app-map-draw-bar',
  template: `
    <div class="pw-card flex flex-col gap-2 p-3 shadow-lg" role="region" aria-label="Rysowanie działki">
      <p class="text-sm font-medium" role="status">
        Dotykaj kolejnych rogów działki. <span class="whitespace-nowrap">Dodano punktów: {{points()}}</span>
        @if (points() < 3) { <span class="block text-muted-color">Potrzebujesz co najmniej 3 punktów.</span> }
      </p>
      <div class="flex gap-2">
        <button type="button" (click)="undo.emit()" [disabled]="points() < 1"
          class="pw-card flex min-h-12 flex-1 items-center justify-center gap-2 text-sm font-medium disabled:opacity-50">
          <i class="pi pi-undo" aria-hidden="true"></i>Cofnij punkt
        </button>
        <button type="button" (click)="finish.emit()" [disabled]="points() < 3"
          class="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-contrast disabled:opacity-50">
          <i class="pi pi-check" aria-hidden="true"></i>Zakończ
        </button>
        <button type="button" (click)="discard.emit()"
          class="pw-card flex min-h-12 flex-1 items-center justify-center gap-2 text-sm font-medium">
          <i class="pi pi-times" aria-hidden="true"></i>Anuluj
        </button>
      </div>
    </div>
  `,
})
export class MapDrawBar {
  readonly points = input.required<number>();
  readonly undo = output();
  readonly finish = output();
  readonly discard = output();
}
