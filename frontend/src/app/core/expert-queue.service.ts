import { Injectable, effect, inject, signal } from '@angular/core';
import { ExpertApi } from './api/apis';
import { AuthService } from './auth.service';

/** Licznik oczekujących pozycji kolejki eksperckiej (domyślnie: propozycje i „wymaga dowodów”). */
@Injectable({ providedIn: 'root' })
export class ExpertQueueService {
  private readonly api = inject(ExpertApi);
  private readonly auth = inject(AuthService);
  /** `null` = nieznany (rola bez dostępu albo błąd). */
  readonly pending = signal<number | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.can('decide')) this.refresh(); else this.pending.set(null);
    });
  }

  refresh() {
    if (!this.auth.can('decide')) return;
    this.api.reviews({ limit: 1 }).subscribe({
      next: (p) => this.pending.set(p.total),
      error: () => this.pending.set(null),
    });
  }
}
