import { Component, input } from '@angular/core';
import { EvidenceLink } from '../../../shared';

/** Lista przycisków „Źródło” dla zbioru dowodów (Evidence Lens). */
@Component({
  selector: 'app-evidence-ids',
  imports: [EvidenceLink],
  template: `
    @for (id of ids(); track id; let i = $index) {
      <app-evidence-link [evidenceId]="id" [label]="ids().length > 1 ? 'Źródło ' + (i + 1) : 'Źródło'" />
    } @empty { <span class="text-muted-color text-sm">brak dowodu</span> }
  `,
})
export class EvidenceIds {
  readonly ids = input<string[]>([]);
}
