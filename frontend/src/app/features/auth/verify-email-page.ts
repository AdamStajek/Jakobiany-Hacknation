import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { authErrorMessage } from '../../core/api/errors';
import { AuthStore } from '../../core/state/auth.store';
import { AuthCard } from './auth-card';

type State = 'loading' | 'ok' | 'error';

/** Potwierdzenie adresu e-mail z linku z wiadomości: /potwierdz-email?token=… */
@Component({
  selector: 'app-verify-email-page',
  imports: [RouterLink, SkeletonModule, AuthCard],
  template: `
    <app-auth-card heading="Potwierdzenie adresu e-mail" icon="pi-envelope">
      @switch (state()) {
        @case ('loading') { <div role="status" aria-label="Potwierdzamy adres e-mail"><p-skeleton height="3rem" borderRadius="12px" /></div> }
        @case ('ok') {
          <p class="flex items-center gap-2 font-semibold" role="status"><i class="pi pi-check-circle text-primary" aria-hidden="true"></i>Adres e-mail został potwierdzony.</p>
          <a routerLink="/konto" class="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-contrast">Przejdź do konta</a>
        }
        @case ('error') {
          <p class="flex items-start gap-2 text-red-700 dark:text-red-400" role="alert"><i class="pi pi-times-circle mt-1" aria-hidden="true"></i>{{error()}}</p>
          <p class="text-sm text-muted-color">Zaloguj się i na ekranie konta poproś o ponowne wysłanie wiadomości.</p>
          <a routerLink="/konto" class="inline-flex h-11 items-center justify-center rounded-lg border border-surface px-4 font-medium">Przejdź do konta</a>
        }
      }
    </app-auth-card>
  `,
})
export class VerifyEmailPage {
  private readonly auth = inject(AuthStore);

  /** Z parametru zapytania `?token=`. */
  readonly token = input<string | undefined>();
  protected readonly state = signal<State>('loading');
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => void this.verify(token));
    });
  }

  private async verify(token: string | undefined) {
    if (!token) {
      this.error.set('Brakuje tokenu w linku. Otwórz link z wiadomości jeszcze raz.');
      this.state.set('error');
      return;
    }
    try {
      await this.auth.init();
      await this.auth.verifyEmail(token);
      this.state.set('ok');
    } catch (error) {
      this.error.set(authErrorMessage(error, 'Nie udało się potwierdzić adresu. Link mógł wygasnąć.'));
      this.state.set('error');
    }
  }
}
