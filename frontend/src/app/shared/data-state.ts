import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiError } from '../core/api/types';

/** Cztery stany widoku: ładowanie, pusto, błąd (z ponowieniem), dane (projekcja treści). */
@Component({
  selector: 'app-data-state',
  imports: [ButtonModule, SkeletonModule],
  template: `
    @if (loading()) {
      <div class="flex flex-col gap-2" role="status" aria-label="Ładowanie">
        @for (i of [1, 2, 3]; track i) { <p-skeleton height="2.5rem" /> }
      </div>
    } @else if (error(); as e) {
      <div class="flex flex-col items-start gap-2 p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950" role="alert">
        <div class="flex items-center gap-2 font-semibold"><i class="pi pi-times-circle"></i>{{ e.network ? 'Brak połączenia' : 'Nie udało się pobrać danych' }}</div>
        <div class="text-sm">{{ e.detail }}</div>
        <p-button label="Ponów" icon="pi pi-refresh" size="small" severity="secondary" (onClick)="retry.emit()" />
      </div>
    } @else if (empty()) {
      <div class="p-6 text-center text-muted-color border border-dashed border-surface rounded-lg">
        <i class="pi pi-inbox text-2xl"></i>
        <p class="m-0 mt-2">{{ emptyText() }}</p>
      </div>
    } @else {
      <ng-content />
    }
  `,
})
export class DataState {
  readonly loading = input(false);
  readonly error = input<ApiError | null>(null);
  readonly empty = input(false);
  readonly emptyText = input('Brak danych do wyświetlenia.');
  readonly retry = output<void>();
}
