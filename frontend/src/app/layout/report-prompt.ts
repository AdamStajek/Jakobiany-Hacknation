import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalysisStore } from '../core/state/analysis.store';
import { AuthStore } from '../core/state/auth.store';
import { FieldsStore } from '../core/state/fields.store';
import { loginQuery } from '../core/state/return-url';
import { LoginPrompt } from '../shared/ui/login-prompt';

/**
 * Propozycja po raporcie: „Zapisz jako pole”. Gość widzi zaproszenie do zalogowania z wyjściem
 * „Kontynuuj bez konta” (pole zostaje wtedy w przeglądarce); zalogowany tylko skrót do zapisu.
 */
@Component({
  selector: 'app-report-prompt',
  imports: [RouterLink, LoginPrompt],
  template: `
    @if (visible()) {
      <div class="fixed inset-x-3 bottom-20 z-20 print:hidden lg:bottom-4 lg:left-64 lg:right-auto lg:max-w-md">
        @if (auth.loggedIn()) {
          <section class="pw-card flex flex-wrap items-center gap-3 p-3 shadow-lg" aria-label="Zapisz jako pole">
            <span class="min-w-0 flex-1 text-sm">Zapisz działkę jako pole i śledź zmiany.</span>
            <a routerLink="/pola" class="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast">
              <i class="pi pi-bookmark" aria-hidden="true"></i>Zapisz jako pole
            </a>
            <button type="button" (click)="dismiss()" aria-label="Ukryj propozycję" class="grid h-10 w-10 place-items-center rounded-full text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </section>
        } @else {
          <app-login-prompt class="block shadow-lg" icon="pi-bookmark" title="Zapisz jako pole i śledź zmiany"
            text="Po zalogowaniu pola są na Twoim koncie i dostępne na każdym urządzeniu. Bez konta zapiszemy je tylko w tej przeglądarce."
            [query]="query()" (dismissed)="dismiss()">
            <a routerLink="/pola" class="inline-flex h-10 items-center gap-2 rounded-lg border border-surface px-4 text-sm font-medium hover:bg-surface-100 dark:hover:bg-surface-800">
              <i class="pi pi-bookmark" aria-hidden="true"></i>Zapisz w przeglądarce
            </a>
          </app-login-prompt>
        }
      </div>
    }
  `,
})
export class ReportPrompt {
  protected readonly auth = inject(AuthStore);
  private readonly analysis = inject(AnalysisStore);
  private readonly fields = inject(FieldsStore);

  /** Czy jesteśmy na ekranie analizy (tam jest raport). */
  readonly active = input(false);
  readonly url = input('/');
  private readonly dismissedFor = signal('');
  protected readonly query = computed(() => loginQuery(this.url()));
  protected readonly visible = computed(() => {
    const report = this.analysis.report();
    if (!this.active() || !report || this.auth.status() === 'loading' || this.dismissedFor() === report.analysis_id) return false;
    if (this.fields.loading()) return false;
    return !this.fields.fields().some((f) => f.parcels.some((p) => p.id === report.parcel.id));
  });

  protected dismiss() { this.dismissedFor.set(this.analysis.report()?.analysis_id ?? ''); }
}
