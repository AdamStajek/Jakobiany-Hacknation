import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../../core/api/api.service';
import { authErrorMessage } from '../../core/api/errors';
import { AuthCard } from './auth-card';
import { AuthField } from './auth-field';
import { MIN_PASSWORD, passwordError, repeatError } from './validators';

/** Ustawienie nowego hasła z linku z wiadomości: /reset-hasla?token=… */
@Component({
  selector: 'app-reset-page',
  imports: [RouterLink, ButtonModule, MessageModule, AuthCard, AuthField],
  template: `
    <app-auth-card heading="Nowe hasło" icon="pi-lock">
      @if (done()) {
        <p class="flex items-center gap-2 font-semibold" role="status"><i class="pi pi-check-circle text-primary" aria-hidden="true"></i>Hasło zostało zmienione.</p>
        <a routerLink="/zaloguj" class="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-contrast">Zaloguj się</a>
      } @else if (!token()) {
        <p class="flex items-start gap-2 text-red-700 dark:text-red-400" role="alert"><i class="pi pi-times-circle mt-1" aria-hidden="true"></i>Brakuje tokenu w linku. Otwórz link z wiadomości jeszcze raz albo poproś o nowy.</p>
        <a routerLink="/zapomniane-haslo" class="inline-flex h-11 items-center justify-center rounded-lg border border-surface px-4 font-medium">Poproś o nowy link</a>
      } @else {
        <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()" novalidate>
          <app-auth-field id="reset-password" label="Nowe hasło" type="password" autocomplete="new-password" [(value)]="password"
            [hint]="'Co najmniej ' + min + ' znaków.'" [error]="errors().password" />
          <app-auth-field id="reset-repeat" label="Powtórz nowe hasło" type="password" autocomplete="new-password" [(value)]="repeat" [error]="errors().repeat" />
          @if (error()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{error()}}</p-message> }
          <p-button type="submit" label="Ustaw hasło" icon="pi pi-check" styleClass="w-full" [loading]="busy()" [disabled]="busy()" />
        </form>
      }
    </app-auth-card>
  `,
})
export class ResetPage {
  private readonly api = inject(ApiService);

  readonly token = input<string | undefined>();
  protected readonly min = MIN_PASSWORD;
  protected readonly password = signal('');
  protected readonly repeat = signal('');
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');
  protected readonly errors = computed(() => this.submitted()
    ? {password: passwordError(this.password()), repeat: repeatError(this.password(), this.repeat())}
    : {password: '', repeat: ''});

  protected async submit() {
    this.submitted.set(true);
    const token = this.token();
    if (this.busy() || !token || this.errors().password || this.errors().repeat) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.resetPassword(token, this.password());
      this.done.set(true);
    } catch (error) {
      this.error.set(authErrorMessage(error, 'Nie udało się zmienić hasła. Link mógł wygasnąć.'));
    } finally {
      this.busy.set(false);
    }
  }
}
