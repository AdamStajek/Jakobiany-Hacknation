import { Injectable, computed, signal } from '@angular/core';

type ConsentChoice = 'granted' | 'denied';
type WriteResult = 'saved' | 'skipped' | 'failed';

export const CONSENT_KEY = 'pw.consent.v1';
export const EXPERIMENT_RESULTS_KEY = 'pw.experiment-results.v1';
/** Wszystko, co aplikacja zapisuje w przeglądarce za zgodą użytkownika (kasowane przy cofnięciu zgody). */
const MANAGED_KEYS = ['pw.fields.v1', 'wodo-theme', 'report-mode', 'pw.map-hint.fields.v1', 'pw.notify.v1',
  'pw.map-hint.analysis.v1', 'pw.analysis.show-fields.v1', 'pw.map-basemap.v1', EXPERIMENT_RESULTS_KEY];

/**
 * Zgoda na zapis danych w tej przeglądarce (localStorage). Bez zgody nic poza samą decyzją nie jest zapisywane:
 * `read` zwraca null, `write` nic nie robi. Cofnięcie zgody usuwa zapisane dane.
 */
@Injectable({providedIn: 'root'})
export class ConsentStore {
  readonly choice = signal<ConsentChoice | null>(this.load());
  private readonly reopened = signal(false);
  readonly storageAllowed = computed(() => this.choice() === 'granted');
  /** Baner jest widoczny, dopóki nie ma decyzji, albo gdy użytkownik chce ją zmienić. */
  readonly bannerOpen = computed(() => this.choice() === null || this.reopened());

  grant() { this.decide('granted'); }

  deny() {
    this.decide('denied');
    for (const key of MANAGED_KEYS) this.remove(key);
  }

  reopen() { this.reopened.set(true); }

  read(key: string): string | null {
    if (!this.storageAllowed()) return null;
    return localStorage.getItem(key);
  }

  write(key: string, value: string): WriteResult {
    if (!this.storageAllowed()) return 'skipped';
    try {
      localStorage.setItem(key, value);
      return 'saved';
    } catch {
      return 'failed';
    }
  }

  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* zablokowany zapis: nie ma czego kasować */ }
  }

  private decide(choice: ConsentChoice) {
    this.choice.set(choice);
    this.reopened.set(false);
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* decyzja obowiązuje do odświeżenia */ }
  }

  private load(): ConsentChoice | null {
    try {
      const value = localStorage.getItem(CONSENT_KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch { return null; }
  }
}
