import { Injectable, signal } from '@angular/core';
import { EvidenceRef } from './models';

/** Globalny stan panelu Evidence Lens: dowolny widok wywołuje open(ref). */
@Injectable({ providedIn: 'root' })
export class EvidenceService {
  readonly current = signal<EvidenceRef | null>(null);
  readonly visible = signal(false);

  open(ref: EvidenceRef) {
    this.current.set(ref);
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
  }
}
