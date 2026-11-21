import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../../core/api/api.service';
import { authErrorMessage } from '../../core/api/errors';
import { AuthCard } from './auth-card';
import { AuthField } from './auth-field';
import { emailError } from './validators';

/** Prośba o link do ustawienia nowego hasła. Odpowiedź jest taka sama niezależnie od tego, czy konto istnieje. */
@Component({
  selector: 'app-forgot-page',
  imports: [RouterLink, ButtonModule, MessageModule, AuthCard, AuthField],
  template: `
    <app-auth-card heading="Nie pamiętam hasła" lead="Wyślemy link do ustawienia nowego hasła na Twój adres e-mail." icon="pi-key">
      @if (sent()) {
        <p class="flex items-start gap-2 text-sm" role="status">
          <i class="pi pi-check-circle mt-0.5 text-primary" aria-hidden="true"></i>
          Jeśli konto z adresem <strong class="break-all">{{email()}}</strong> istnieje, wysłaliśmy na nie wiadomość z linkiem. Sprawdź też folder ze spamem.
        </p>
      } @else {
        <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()" novalidate>
          <app-auth-field id="forgot-email" label="Adres e-mail konta" type="email" autocomplete="email" [(value)]="email" [error]="fieldError()" />
          @if (error()) { <p-message severity="error" role="alert">{{error()}}</p-message> }
          <p-button type="submit" label="Wyślij link" icon="pi pi-send" styleClass="w-full" [loading]="busy()" [disabled]="busy()" />
        </form>
      }
      <div footer class="text-center text-sm"><a routerLink="/zaloguj" class="font-semibold text-primary underline">Wróć do logowania</a></div>
    </app-auth-card>
  `,
})
export class ForgotPage {
  private readonly api = inject(ApiService);

  protected readonly email = signal('');
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected fieldError() { return this.submitted() ? emailError(this.email()) : ''; }

  protected async submit() {
    this.submitted.set(true);
    if (this.busy() || emailError(this.email())) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.forgotPassword(this.email().trim());
      this.sent.set(true);
    } catch (error) {
      this.error.set(authErrorMessage(error, 'Nie udało się wysłać wiadomości. Spróbuj ponownie.'));
    } finally {
      this.busy.set(false);
    }
  }
}
