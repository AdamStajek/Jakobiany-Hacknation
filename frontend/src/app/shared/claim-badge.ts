import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ClaimType, EventKind, ExpertStatus } from '../core/models';

type Kind = ClaimType | EventKind | ExpertStatus;

const MAP: Record<Kind, { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' }> = {
  SOURCE_FACT: { label: 'Potwierdzone w źródle', severity: 'success' },
  CALCULATED: { label: 'Obliczone', severity: 'info' },
  MODEL_INFERENCE: { label: 'Wniosek modelu', severity: 'warn' },
  OBSERVED_EVENT: { label: 'Zdarzenie zaobserwowane', severity: 'contrast' },
  POTENTIAL_RISK: { label: 'Ryzyko potencjalne', severity: 'secondary' },
  proposed: { label: 'Do weryfikacji', severity: 'warn' },
  approved: { label: 'Zatwierdzone', severity: 'success' },
  corrected: { label: 'Poprawione', severity: 'info' },
  rejected: { label: 'Odrzucone', severity: 'danger' },
  needs_evidence: { label: 'Wymaga dowodów', severity: 'warn' },
  superseded: { label: 'Zastąpione', severity: 'secondary' },
};

/** Jednolita etykieta typu twierdzenia / statusu eksperckiego (zasada UX: zawsze widoczne). */
@Component({
  selector: 'app-claim-badge',
  imports: [TagModule],
  template: `
    <p-tag [value]="cfg().label" [severity]="cfg().severity" />
    @if (demo()) { <p-tag class="ml-1" value="Dane demonstracyjne" severity="secondary" icon="pi pi-info-circle" /> }
  `,
})
export class ClaimBadge {
  readonly kind = input.required<Kind>();
  /** Dane z dostawcy `mock` – wyraźnie oznaczone. */
  readonly demo = input(false);
  protected readonly cfg = computed(() => MAP[this.kind()]);
}
