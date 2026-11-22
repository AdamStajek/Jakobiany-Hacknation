import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { clearPrivateCache } from '../pwa/service-worker';
import type { LoginRequest, RegisterRequest, User } from '../api/types';

/** loading = sesja jeszcze nie sprawdzona; guest = brak sesji (401); user = zalogowany. */
type AuthStatus = 'loading' | 'guest' | 'user';

/** Sesja użytkownika z GET /api/me. Gość to pełnoprawny stan: rdzeń aplikacji działa bez konta. */
@Injectable({providedIn: 'root'})
export class AuthStore {
  private readonly api = inject(ApiService);

  readonly user = signal<User | null>(null);
  readonly status = signal<AuthStatus>('loading');
  /** Błąd sprawdzania sesji inny niż 401 (np. serwer niedostępny); aplikacja działa wtedy jak dla gościa. */
  readonly error = signal('');
  readonly loggedIn = computed(() => this.user() !== null);
  private pending: Promise<void> | null = null;

  /** Sprawdza sesję raz; kolejne wywołania dostają ten sam wynik (użyj `refresh`, by wymusić odczyt). */
  init(): Promise<void> {
    this.pending ??= this.refresh();
    return this.pending;
  }

  async refresh(): Promise<void> {
    try {
      this.user.set(await this.api.me());
      this.error.set('');
      this.status.set('user');
    } catch (error) {
      this.user.set(null);
      this.status.set('guest');
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? '' : errorMessage(error, 'Nie udało się sprawdzić sesji. Działasz jako gość.'));
    }
  }

  /** Wywoływane przez interceptor, gdy serwer odpowie 401 na żądanie wymagające sesji. */
  expire() {
    void clearPrivateCache();
    this.user.set(null);
    this.status.set('guest');
  }

  async login(body: LoginRequest) {
    await this.api.login(body);
    await this.refresh();
  }

  register(body: RegisterRequest) { return this.api.register(body); }

  async logout() {
    try { await this.api.logout(); } finally { this.expire(); }
  }

  async deleteAccount() {
    await this.api.deleteAccount();
    this.expire();
  }

  /** Ponownie wysyła wiadomość z potwierdzeniem adresu. */
  resendVerification() { return this.api.resendVerification(); }

  async verifyEmail(token: string) {
    await this.api.verifyEmail(token);
    if (this.loggedIn()) await this.refresh();
  }
}
