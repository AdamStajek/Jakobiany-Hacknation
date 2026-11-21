import { Component, inject, input, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ProjectsApi } from '../../../core/api/apis';
import { Risk } from '../../../core/api/types';
import { CONFIDENCE_LEVEL, EVENT_KIND } from '../../../core/labels';
import { ClaimBadge, DataState, StatusBadge } from '../../../shared';
import { EvidenceIds } from './evidence-ids';
import { pagedLoader } from './paged-loader';

@Component({
  selector: 'app-risks-tab',
  imports: [TableModule, DataState, ClaimBadge, StatusBadge, EvidenceIds],
  template: `
    <app-data-state [loading]="l.loading()" [error]="l.error()" [empty]="!l.items().length" (retry)="l.load()"
                    emptyText="Brak zdarzeń i ryzyk dla tego projektu.">
      <p-table [value]="l.items()" dataKey="id" [tableStyle]="{ 'min-width': '60rem' }">
        <ng-template #header>
          <tr><th>Kod</th><th>Kategoria i zdarzenie</th><th>Rodzaj</th><th>Typ twierdzenia</th><th>Pewność</th><th>Weryfikacja</th><th>Źródła</th></tr>
        </ng-template>
        <ng-template #body let-r>
          <tr>
            <td class="font-semibold">{{ r.risk_code }}</td>
            <td>
              <div class="font-semibold">{{ r.title }}</div>
              <div class="text-sm">{{ r.event }}</div>
              @if (r.occurred_on) { <div class="text-xs text-muted-color">{{ r.occurred_on }}</div> }
              @for (i of r.impacts; track $index) {
                <div class="text-xs text-muted-color">Skutek ({{ i.kind === 'observed' ? 'zaobserwowany' : 'potencjalny' }}): {{ i.description }}@if (i.value) { – {{ i.value }} {{ i.unit }} }</div>
              }
            </td>
            <td><app-claim-badge [kind]="r.kind" /><div class="text-xs text-muted-color mt-1">{{ kind(r.kind) }}</div></td>
            <td><app-claim-badge [kind]="r.claim_type" /></td>
            <td><span [title]="r.confidence.rationale">{{ conf(r.confidence.level) }}</span></td>
            <td><app-status-badge type="review" [value]="r.review_status" /></td>
            <td><app-evidence-ids [ids]="r.evidence_ids" /></td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>
  `,
})
export class RisksTab implements OnInit {
  readonly projectId = input.required<string>();
  private readonly api = inject(ProjectsApi);
  protected readonly l = pagedLoader<Risk>((offset) => this.api.risks(this.projectId(), { limit: 200, offset }));
  protected readonly kind = (k: Risk['kind']) => EVENT_KIND[k].label;
  protected readonly conf = (c: string) => CONFIDENCE_LEVEL[c] ?? c;
  ngOnInit() { this.l.load(); }
}
