import { Component, inject } from '@angular/core';
import { PwaStore } from '../core/state/pwa.store';

/** Pasek stanu: brak sieci (dane z ostatniej wizyty) i propozycja instalacji aplikacji. */
@Component({
  selector: 'app-pwa-banner',
  template: `
    <div role="status" aria-live="polite">
      @if (!pwa.online()) {
        <p class="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 print:hidden dark:bg-amber-900/40 dark:text-amber-100">
          <i class="pi pi-wifi" aria-hidden="true"></i>Brak połączenia z internetem. Widzisz dane zapisane podczas ostatniej wizyty.
        </p>
      }
    </div>
    @if (pwa.canInstall()) {
      <section aria-label="Instalacja aplikacji" class="pw-card fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2 p-3 text-sm shadow-lg print:hidden lg:bottom-4 lg:left-auto lg:right-4">
        <i class="pi pi-download" aria-hidden="true"></i>
        <span class="flex-1">Dodaj Pole Widzenia do ekranu głównego.</span>
        <button type="button" (click)="pwa.install()" class="min-h-11 rounded-lg bg-primary px-3 font-medium text-primary-contrast">Zainstaluj</button>
        <button type="button" (click)="pwa.dismissInstall()" aria-label="Nie teraz" class="grid h-11 w-11 place-items-center rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </section>
    }
  `,
})
export class PwaBanner {
  protected readonly pwa = inject(PwaStore);
}
