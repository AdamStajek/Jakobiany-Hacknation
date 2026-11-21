import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { authErrorMessage } from '../../core/api/errors';
import { AuthStore } from '../../core/state/auth.store';
import { loginQuery, safeReturnUrl } from '../../core/state/return-url';
import { AuthCard } from './auth-card';
import { AuthField } from './auth-field';

/** Logowanie e-mailem albo nazwą użytkownika. Po sukcesie wraca na `returnUrl`. */
@Component({
  selector: 'app-login-page',
  imports: [RouterLink, ButtonModule, MessageModule, AuthCard, AuthField],
  template: `
    <app-auth-card heading="Zaloguj się" lead="Pola zapisane na koncie są dostępne na każdym urządzeniu." icon="pi-sign-in">
      <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()">
        <app-auth-field id="login-identifier" label="E-mail lub nazwa użytkownika" autocomplete="username" [(value)]="identifier" />
        <app-auth-field id="login-password" label="Hasło" type="password" autocomplete="current-password" [(value)]="password" />
        @if (error()) { <p-message severity="error" role="alert">{{error()}}</p-message> }
        <p-button type="submit" label="Zaloguj się" icon="pi pi-sign-in" styleClass="w-full" [loading]="busy()" [disabled]="busy() || !identifier() || !password()" />
        <a routerLink="/zapomniane-haslo" class="text-sm text-primary underline">Nie pamiętam hasła</a>
      </form>
      <div footer class="flex flex-col gap-2 text-center text-sm">
        <p>Nie masz konta? <a routerLink="/rejestracja" [queryParams]="query()" class="font-semibold text-primary underline">Załóż konto</a></p>
        <a [routerLink]="target()" class="text-muted-color underline">Kontynuuj bez konta</a>
      </div>
    </app-auth-card>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** Z parametru zapytania `?returnUrl=` (withComponentInputBinding). */
  readonly returnUrl = input<string | undefined>();
  protected readonly target = computed(() => safeReturnUrl(this.returnUrl()));
  protected readonly query = computed(() => loginQuery(this.target()));
  protected readonly identifier = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    void this.auth.init();
    // Zalogowany użytkownik nie potrzebuje tego ekranu.
    effect(() => { if (this.auth.loggedIn()) void this.router.navigateByUrl(this.target()); });
  }

  protected async submit() {
    if (this.busy() || !this.identifier() || !this.password()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login({identifier: this.identifier().trim(), password: this.password()});
    } catch (error) {
      this.error.set(authErrorMessage(error, 'Nie udało się zalogować. Spróbuj ponownie.'));
      this.password.set('');
    } finally {
      this.busy.set(false);
    }
  }
}
