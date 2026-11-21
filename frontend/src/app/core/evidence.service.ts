import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  readonly current = signal<string | null>(null);

  open(id: string) { this.current.set(id); }

  close() { this.current.set(null); }
}
