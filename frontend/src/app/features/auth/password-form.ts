import { Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../../core/api/api.service';
import { authErrorMessage } from '../../core/api/errors';
import { AuthField } from './auth-field';
import { MIN_PASSWORD, passwordError, repeatError } from './validators';

/** Zmiana hasła zalogowanego użytkownika (POST /api/me/password). */
@Component({
  selector: 'app-password-form',
  imports: [ButtonModule, MessageModule, AuthField],
  template: `
    <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()" novalidate>
      <app-auth-field id="pw-current" label="Obecne hasło" type="password" autocomplete="current-password" [(value)]="current" [error]="errors().current" />
      <app-auth-field id="pw-new" label="Nowe hasło" type="password" autocomplete="new-password" [(value)]="next"
        [hint]="'Co najmniej ' + min + ' znaków.'" [error]="errors().next" />
      <app-auth-field id="pw-repeat" label="Powtórz nowe hasło" type="password" autocomplete="new-password" [(value)]="repeat" [error]="errors().repeat" />
      @if (error()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{error()}}</p-message> }
      @if (done()) { <p-message severity="success" role="status">Hasło zostało zmienione.</p-message> }
      <div><p-button type="submit" label="Zmień hasło" icon="pi pi-key" [loading]="busy()" [disabled]="busy()" /></div>
    </form>
  `,
})
export class PasswordForm {
  private readonly api = inject(ApiService);

  protected readonly min = MIN_PASSWORD;
  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly repeat = signal('');
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');
  protected readonly errors = computed(() => this.submitted()
    ? {current: this.current() ? '' : 'Wpisz obecne hasło.', next: passwordError(this.next()), repeat: repeatError(this.next(), this.repeat())}
    : {current: '', next: '', repeat: ''});

  protected async submit() {
    this.submitted.set(true);
    this.done.set(false);
    const e = this.errors();
    if (this.busy() || e.current || e.next || e.repeat) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.changePassword({current: this.current(), new: this.next()});
      this.done.set(true);
      this.current.set(''); this.next.set(''); this.repeat.set('');
      this.submitted.set(false);
    } catch (error) {
      this.error.set(authErrorMessage(error, 'Nie udało się zmienić hasła. Spróbuj ponownie.'));
    } finally {
      this.busy.set(false);
    }
  }
}
