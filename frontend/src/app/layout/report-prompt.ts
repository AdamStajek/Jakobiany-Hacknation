import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AnalysisStore } from '../core/state/analysis.store';
import { AuthStore } from '../core/state/auth.store';
import { ConsentStore } from '../core/state/consent.store';
import { FieldsStore } from '../core/state/fields.store';
import { loginQuery } from '../core/state/return-url';

/**
 * Propozycja po raporcie: „Dodaj do moich pól” jednym kliknięciem (bez konta, bez formularza).
 * Logowanie to tylko dodatek: dyskretny link pod przyciskiem, bez blokowania.
 */
@Component({
  selector: 'app-report-prompt',
  imports: [RouterLink, ButtonModule],
  template: `
    @if (visible()) {
      <section class="pw-card fixed inset-x-3 bottom-20 z-20 flex flex-col gap-3 rounded-2xl p-3 shadow-lg print:hidden lg:bottom-4 lg:left-64 lg:right-auto lg:w-[28rem]"
        aria-label="Dodaj do moich pól">
        <div class="flex items-center gap-3">
          @if (added()) {
            <span class="min-w-0 flex-1 text-sm" role="status"><i class="pi pi-check-circle mr-1 text-green-700 dark:text-green-400" aria-hidden="true"></i>Dodano do Twoich pól.</span>
            <a routerLink="/pola" class="inline-flex h-10 items-center rounded-lg border border-surface px-4 text-sm font-medium hover:bg-surface-100 dark:hover:bg-surface-800">Zobacz pola</a>
          } @else {
            <i class="pi pi-map-marker text-lg text-primary" aria-hidden="true"></i>
            <span class="min-w-0 flex-1 text-sm leading-snug">Śledź tę działkę: dodaj ją do swoich pól.</span>
            <p-button label="Dodaj" icon="pi pi-plus" size="small" [loading]="fields.adding()" [disabled]="fields.adding()" (onClick)="add()" />
          }
          <button type="button" (click)="dismiss()" aria-label="Ukryj propozycję" class="grid h-10 w-10 place-items-center rounded-full text-muted-color hover:bg-surface-100 dark:hover:bg-surface-800">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
        @if (fields.error()) {
          <p class="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
            <i class="pi pi-exclamation-circle mt-0.5" aria-hidden="true"></i><span>{{fields.error()}}</span>
          </p>
        }
        @if (!auth.loggedIn() && !added()) {
          <p class="text-xs text-muted-color">Pola trzymamy w tej przeglądarce.
            <a routerLink="/zaloguj" [queryParams]="query()" class="text-primary underline">Zaloguj się</a>, jeśli chcesz mieć je na każdym urządzeniu.</p>
        }
      </section>
    }
  `,
})
export class ReportPrompt {
  protected readonly auth = inject(AuthStore);
  protected readonly fields = inject(FieldsStore);
  private readonly analysis = inject(AnalysisStore);
  private readonly consent = inject(ConsentStore);

  /** Czy jesteśmy na ekranie analizy (tam jest raport). */
  readonly active = input(false);
  readonly url = input('/');
  private readonly dismissedFor = signal('');
  private readonly addedFor = signal('');
  protected readonly query = computed(() => loginQuery(this.url()));
  protected readonly added = computed(() => this.addedFor() !== '' && this.addedFor() === this.analysis.report()?.parcel.id);
  protected readonly visible = computed(() => {
    const report = this.analysis.report();
    if (!this.active() || !report || this.auth.status() === 'loading' || this.dismissedFor() === report.analysis_id) return false;
    if (this.fields.loading() || this.consent.bannerOpen()) return false;
    return this.added() || !this.fields.parcelIds().has(report.parcel.id);
  });

  protected async add() {
    const parcel = this.analysis.report()?.parcel;
    if (!parcel) return;
    const field = await this.fields.quickAdd(parcel);
    if (field) this.addedFor.set(parcel.id);
  }

  protected dismiss() { this.dismissedFor.set(this.analysis.report()?.analysis_id ?? ''); }
}
