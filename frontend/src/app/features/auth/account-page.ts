import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api/api.service';
import { authErrorMessage, errorMessage } from '../../core/api/errors';
import { AuthStore } from '../../core/state/auth.store';
import { Panel } from '../../shared/ui/panel';
import { PasswordForm } from './password-form';

type PrefsState = 'loading' | 'ready' | 'error';

/** Ekran /konto: profil, potwierdzenie e-maila, powiadomienia e-mail, zmiana hasła, wylogowanie i usunięcie konta. */
@Component({
  selector: 'app-account-page',
  imports: [ButtonModule, MessageModule, SkeletonModule, Panel, PasswordForm],
  host: {class: 'block'},
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-8">
      <h1 class="text-xl font-bold">Konto</h1>

      @if (auth.user(); as user) {
        <app-panel heading="Profil" icon="pi-user">
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-color">Nazwa użytkownika</dt><dd class="break-all font-medium">{{user.username}}</dd>
            <dt class="text-muted-color">E-mail</dt><dd class="break-all font-medium">{{user.email}}</dd>
            <dt class="text-muted-color">Potwierdzenie e-maila</dt>
            <dd>
              @if (user.email_verified) {
                <span class="inline-flex items-center gap-1 font-medium text-primary"><i class="pi pi-check-circle" aria-hidden="true"></i>Potwierdzony</span>
              } @else {
                <span class="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i>Niepotwierdzony</span>
              }
            </dd>
          </dl>
          @if (!user.email_verified) {
            <div class="mt-3 flex flex-col items-start gap-2">
              <p class="text-sm text-muted-color">Bez potwierdzenia nie wyślemy powiadomień na ten adres.</p>
              <p-button label="Wyślij potwierdzenie ponownie" icon="pi pi-send" size="small" severity="secondary" [outlined]="true"
                [loading]="resending()" [disabled]="resending()" (onClick)="resend()" />
              @if (resendInfo()) { <p class="text-sm" role="status">{{resendInfo()}}</p> }
              @if (resendError()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{resendError()}}</p-message> }
            </div>
          }
          <div class="mt-4">
            <p-button label="Wyloguj się" icon="pi pi-sign-out" severity="secondary" [outlined]="true" [loading]="loggingOut()" (onClick)="logout()" />
          </div>
        </app-panel>

        <app-panel heading="Powiadomienia" icon="pi-bell">
          @switch (prefsState()) {
            @case ('loading') { <div role="status" aria-label="Wczytywanie ustawień"><p-skeleton height="2.5rem" borderRadius="10px" /></div> }
            @case ('error') {
              <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">
                <span>{{prefsError()}}</span>
                <p-button label="Spróbuj ponownie" size="small" severity="secondary" [text]="true" (onClick)="loadPrefs()" />
              </p-message>
            }
            @default {
              <label class="flex cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" role="switch" class="h-5 w-5 accent-primary" [checked]="emailEnabled()" [disabled]="savingPrefs()"
                  (change)="setEmail(checked($event))" />
                <span class="flex-1"><strong class="block font-medium">Powiadomienia e-mail</strong>
                  <span class="text-muted-color">Wiadomość, gdy na Twoim polu trzeba coś sprawdzić.</span></span>
                @if (savingPrefs()) { <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> }
              </label>
              @if (prefsError()) { <p-message class="mt-2 block" severity="error" icon="pi pi-exclamation-circle" role="alert">{{prefsError()}}</p-message> }
            }
          }
        </app-panel>

        <app-panel heading="Zmiana hasła" icon="pi-key"><app-password-form /></app-panel>

        <app-panel heading="Usunięcie konta" icon="pi-trash">
          <p class="text-sm text-muted-color">Usunięcie konta kasuje na stałe Twoje pola, zapisane raporty i ustawienia powiadomień. Tej operacji nie można cofnąć.</p>
          @if (!confirming()) {
            <p-button class="mt-3 block" label="Usuń konto" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="confirming.set(true)" />
          } @else {
            <div class="mt-3 flex flex-col gap-3" role="group" aria-label="Potwierdzenie usunięcia konta">
              <label for="delete-confirm" class="text-sm font-medium">Aby potwierdzić, wpisz swoją nazwę użytkownika: <strong>{{user.username}}</strong></label>
              <input id="delete-confirm" type="text" autocomplete="off" class="p-inputtext p-component h-11 w-full"
                [value]="confirmText()" (input)="confirmText.set(read($event))" />
              @if (deleteError()) { <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">{{deleteError()}}</p-message> }
              <div class="flex flex-wrap gap-2">
                <p-button label="Usuń konto na stałe" icon="pi pi-trash" severity="danger" [loading]="deleting()"
                  [disabled]="deleting() || confirmText().trim() !== user.username" (onClick)="deleteAccount()" />
                <p-button label="Anuluj" severity="secondary" [outlined]="true" [disabled]="deleting()" (onClick)="cancelDelete()" />
              </div>
            </div>
          }
        </app-panel>
      } @else {
        <div class="space-y-3" role="status" aria-label="Wczytywanie konta"><p-skeleton height="8rem" borderRadius="14px" /><p-skeleton height="5rem" borderRadius="14px" /></div>
      }
    </div>
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly resending = signal(false);
  protected readonly resendInfo = signal('');
  protected readonly resendError = signal('');
  protected readonly loggingOut = signal(false);
  protected readonly prefsState = signal<PrefsState>('loading');
  protected readonly prefsError = signal('');
  protected readonly emailEnabled = signal(false);
  protected readonly savingPrefs = signal(false);
  protected readonly confirming = signal(false);
  protected readonly confirmText = signal('');
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');
  /** Użytkownik sam kończy sesję (wylogowanie/usunięcie): nie odsyłamy go wtedy do logowania. */
  private leaving = false;
  protected readonly isGuest = computed(() => this.auth.status() === 'guest');

  constructor() {
    void this.loadPrefs();
    // Sesja wygasła (401) albo konto usunięte: wracamy do logowania.
    effect(() => { if (this.isGuest() && !this.leaving) void this.router.navigate(['/zaloguj'], {queryParams: {returnUrl: '/konto'}}); });
  }

  protected read(event: Event): string { return (event.target as HTMLInputElement).value; }
  protected checked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }

  protected async loadPrefs() {
    this.prefsState.set('loading');
    try {
      this.emailEnabled.set((await this.api.notificationPrefs()).email_enabled);
      this.prefsError.set('');
      this.prefsState.set('ready');
    } catch (error) {
      this.prefsError.set(errorMessage(error, 'Nie udało się pobrać ustawień powiadomień.'));
      this.prefsState.set('error');
    }
  }

  protected async setEmail(enabled: boolean) {
    this.savingPrefs.set(true);
    this.prefsError.set('');
    try {
      this.emailEnabled.set((await this.api.setNotificationPrefs({email_enabled: enabled})).email_enabled);
    } catch (error) {
      this.emailEnabled.set(!enabled);
      this.prefsError.set(errorMessage(error, 'Nie udało się zapisać ustawienia. Spróbuj ponownie.'));
    } finally {
      this.savingPrefs.set(false);
    }
  }

  protected async resend() {
    this.resending.set(true);
    this.resendInfo.set('');
    this.resendError.set('');
    try {
      await this.auth.resendVerification();
      this.resendInfo.set('Wysłaliśmy nową wiadomość z linkiem. Sprawdź skrzynkę.');
    } catch (error) {
      this.resendError.set(authErrorMessage(error, 'Nie udało się wysłać wiadomości. Spróbuj ponownie.'));
    } finally {
      this.resending.set(false);
    }
  }

  protected async logout() {
    this.loggingOut.set(true);
    this.leaving = true;
    try { await this.auth.logout(); } catch { /* sesja i tak została zamknięta po stronie aplikacji */ }
    this.loggingOut.set(false);
    await this.router.navigateByUrl('/');
  }

  protected cancelDelete() {
    this.confirming.set(false);
    this.confirmText.set('');
    this.deleteError.set('');
  }

  protected async deleteAccount() {
    this.deleting.set(true);
    this.deleteError.set('');
    this.leaving = true;
    try {
      await this.auth.deleteAccount();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.leaving = false;
      this.deleteError.set(authErrorMessage(error, 'Nie udało się usunąć konta. Spróbuj ponownie.'));
    } finally {
      this.deleting.set(false);
    }
  }
}
