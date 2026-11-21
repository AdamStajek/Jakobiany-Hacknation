import { Component, inject, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { EvidenceService } from '../core/evidence.service';

/** Przycisk otwierający Evidence Lens dla wskazanego dowodu. */
@Component({
  selector: 'app-evidence-link',
  imports: [ButtonModule],
  template: `
    <p-button icon="pi pi-book" [label]="label()" size="small" [text]="true" severity="secondary"
              [disabled]="!evidenceId()" [ariaLabel]="'Pokaż źródło ' + (evidenceId() ?? '')" (onClick)="open()" />
  `,
})
export class EvidenceLink {
  readonly evidenceId = input<string | undefined>();
  readonly label = input('Źródło');
  private readonly ev = inject(EvidenceService);
  open() {
    const id = this.evidenceId();
    if (id) this.ev.open({ sourceId: id, title: `Dowód ${id}` });
  }
}
