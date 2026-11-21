import { Component, inject, input, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ProjectsApi } from '../../../core/api/apis';
import { Fact } from '../../../core/api/types';
import { CONFIDENCE_LEVEL } from '../../../core/labels';
import { ClaimBadge, DataState, StatusBadge } from '../../../shared';
import { EvidenceIds } from './evidence-ids';
import { pagedLoader } from './paged-loader';

@Component({
  selector: 'app-facts-tab',
  imports: [TableModule, DataState, ClaimBadge, StatusBadge, EvidenceIds],
  template: `
    <app-data-state [loading]="l.loading()" [error]="l.error()" [empty]="!l.items().length" (retry)="l.load()"
                    emptyText="Brak twierdzeń dla tego projektu.">
      <p-table [value]="l.items()" dataKey="id" [tableStyle]="{ 'min-width': '50rem' }">
        <ng-template #header>
          <tr><th>Klucz</th><th>Wartość</th><th>Typ</th><th>Pewność</th><th>Weryfikacja</th><th>Źródła</th></tr>
        </ng-template>
        <ng-template #body let-f>
          <tr>
            <td class="font-mono text-sm">{{ f.key }}</td>
            <td class="max-w-xl">{{ show(f) }}</td>
            <td><app-claim-badge [kind]="f.claim_type" /></td>
            <td><span [title]="f.confidence.rationale">{{ conf(f.confidence.level) }}</span></td>
            <td><app-status-badge type="review" [value]="f.review_status" /></td>
            <td><app-evidence-ids [ids]="f.evidence_ids" /></td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>
  `,
})
export class FactsTab implements OnInit {
  readonly projectId = input.required<string>();
  private readonly api = inject(ProjectsApi);
  protected readonly l = pagedLoader<Fact>((offset) => this.api.facts(this.projectId(), { limit: 200, offset }));
  protected readonly conf = (c: string) => CONFIDENCE_LEVEL[c] ?? c;
  /** `value` ma typ unknown: liczby i teksty wprost, resztę jako JSON. */
  protected show(f: Fact): string {
    const v = typeof f.value === 'string' || typeof f.value === 'number' ? String(f.value) : JSON.stringify(f.value);
    return f.unit ? `${v} ${f.unit}` : v;
  }
  ngOnInit() { this.l.load(); }
}
