import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { authErrorMessage } from '../../core/api/errors';
import { AuthStore } from '../../core/state/auth.store';
import { loginQuery, safeReturnUrl } from '../../core/state/return-url';
import { AuthCard } from './auth-card';
import { AuthField } from './auth-field';
import { MIN_PASSWORD, emailError, passwordError, repeatError, usernameError } from './validators';

/** Samodzielna rejestracja: e-mail (do powiadomień i odzyskiwania hasła), nazwa i hasło min. 10 znaków. */
@Component({
  selector: 'app-register-page',
  imports: [RouterLink, ButtonModule, MessageModule, AuthCard, AuthField],
  template: `
    <app-auth-card heading="Załóż konto" lead="Zapisuj pola na koncie i miej je pod ręką na każdym urządzeniu." icon="pi-user-plus">
      @if (done()) {
        <div class="flex flex-col gap-3" role="status">
          <p class="flex items-center gap-2 font-semibold"><i class="pi pi-check-circle text-primary" aria-hidden="true"></i>Konto zostało utworzone</p>
          <p class="text-sm">Wysłaliśmy wiadomość z linkiem potwierdzającym na adres <strong class="break-all">{{email()}}</strong>. Kliknij link, aby potwierdzić adres e-mail.</p>
          @if (auth.loggedIn()) {
            <a [routerLink]="target()" class="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-contrast">Przejdź dalej</a>
          } @else {
            <a routerLink="/zaloguj" [queryParams]="query()" class="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-contrast">Zaloguj się</a>
          }
        </div>
      } @else {
        <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()" novalidate>
          <app-auth-field id="reg-email" label="Adres e-mail" type="email" autocomplete="email" [(value)]="email"
            hint="Użyjemy go do potwierdzenia konta, powiadomień i odzyskiwania hasła." [error]="errors().email" />
          <app-auth-field id="reg-username" label="Nazwa użytkownika" autocomplete="username" [(value)]="username"
            hint="3–32 znaków, bez spacji. Możesz się nią logować zamiast e-mailem." [error]="errors().username" />
          <app-auth-field id="reg-password" label="Hasło" type="password" autocomplete="new-password" [(value)]="password"
            [hint]="'Co najmniej ' + min + ' znaków.'" [error]="errors().password" />
          <app-auth-field id="reg-repeat" label="Powtórz hasło" type="password" autocomplete="new-password" [(value)]="repeat" [error]="errors().repeat" />
          <div class="flex flex-col gap-1">
            <label class="flex items-start gap-2 text-sm">
              <input id="reg-privacy" type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-[var(--p-primary-color)]" [checked]="accepted()"
                (change)="accepted.set(checked($event))" [attr.aria-invalid]="errors().privacy ? 'true' : null"
                [attr.aria-describedby]="errors().privacy ? 'reg-privacy-error' : null" required>
              <span>Zapoznałem(-am) się z <a routerLink="/prywatnosc" target="_blank" class="font-semibold text-primary underline">polityką prywatności</a> i akceptuję przetwarzanie danych konta.</span>
            </label>
            @if (errors().privacy) { <p id="reg-privacy-error" class="flex items-center gap-1 text-xs text-red-700 dark:text-red-400" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i>{{errors().privacy}}</p> }
          </div>
          @if (error()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{error()}}</p-message> }
          <p-button type="submit" label="Załóż konto" icon="pi pi-user-plus" styleClass="w-full" [loading]="busy()" [disabled]="busy()" />
        </form>
      }
      <div footer class="flex flex-col gap-2 text-center text-sm">
        <p>Masz już konto? <a routerLink="/zaloguj" [queryParams]="query()" class="font-semibold text-primary underline">Zaloguj się</a></p>
        <a [routerLink]="target()" class="text-muted-color underline">Kontynuuj bez konta</a>
      </div>
    </app-auth-card>
  `,
})
export class RegisterPage {
  protected readonly auth = inject(AuthStore);

  readonly returnUrl = input<string | undefined>();
  protected readonly target = computed(() => safeReturnUrl(this.returnUrl()));
  protected readonly query = computed(() => loginQuery(this.target()));
  protected readonly min = MIN_PASSWORD;
  protected readonly email = signal('');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly repeat = signal('');
  protected readonly accepted = signal(false);
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');

  /** Błędy pól pokazujemy dopiero po pierwszej próbie wysłania. */
  protected readonly errors = computed(() => this.submitted()
    ? {email: emailError(this.email()), username: usernameError(this.username()), password: passwordError(this.password()),
      repeat: repeatError(this.password(), this.repeat()),
      privacy: this.accepted() ? '' : 'Aby założyć konto, potwierdź zapoznanie się z polityką prywatności.'}
    : {email: '', username: '', password: '', repeat: '', privacy: ''});

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected async submit() {
    this.submitted.set(true);
    const e = this.errors();
    if (this.busy() || e.email || e.username || e.password || e.repeat || e.privacy) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.register({email: this.email().trim(), username: this.username().trim(), password: this.password()});
      // Serwer może od razu założyć sesję; jeśli nie, użytkownik zaloguje się ręcznie.
      await this.auth.refresh();
      this.done.set(true);
    } catch (error) {
      this.error.set(authErrorMessage(error, 'Nie udało się założyć konta. Spróbuj ponownie.'));
    } finally {
      this.busy.set(false);
    }
  }
}
