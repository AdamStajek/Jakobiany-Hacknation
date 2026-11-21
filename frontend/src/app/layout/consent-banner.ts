import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ConsentStore } from '../core/state/consent.store';

/** Niewielki, nieblokujący komunikat o zapisie danych w przeglądarce. Bez zgody niczego nie zapisujemy. */
@Component({
  selector: 'app-consent-banner',
  imports: [ButtonModule],
  template: `
    @if (consent.bannerOpen()) {
      <section class="pw-card fixed inset-x-3 bottom-20 z-40 flex flex-col gap-3 p-4 shadow-lg print:hidden lg:inset-x-auto lg:bottom-4 lg:right-4 lg:max-w-md"
        aria-labelledby="consent-title">
        <div class="flex items-start gap-3">
          <i class="pi pi-database mt-0.5 text-primary" aria-hidden="true"></i>
          <div class="min-w-0 text-sm">
            <h2 id="consent-title" class="font-semibold">Zapisywać Twoje pola w tej przeglądarce?</h2>
            <p class="mt-1 text-muted-color">
              Za Twoją zgodą zapamiętamy w pamięci przeglądarki (localStorage) dodane pola, wybrany motyw i tryb raportu.
              Dane zostają tylko na tym urządzeniu i nie trafiają na serwer. Bez zgody nic nie zapisujemy,
              a pola znikną po odświeżeniu strony. Zgodę możesz zmienić w dowolnej chwili.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <p-button label="Zgadzam się" icon="pi pi-check" (onClick)="consent.grant()" />
          <p-button label="Nie zapisuj" severity="secondary" [outlined]="true" (onClick)="consent.deny()" />
        </div>
      </section>
    }
  `,
})
export class ConsentBanner {
  protected readonly consent = inject(ConsentStore);
}
