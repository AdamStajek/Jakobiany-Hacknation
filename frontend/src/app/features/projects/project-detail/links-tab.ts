import { Component, input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { RecordLink } from '../../../core/api/types';
import { CONFIDENCE_LEVEL, LINK_METHOD, RESOURCE_TYPE, SIGNAL_DIRECTION } from '../../../core/labels';
import { DataState, StatusBadge } from '../../../shared';
import { EvidenceIds } from './evidence-ids';

@Component({
  selector: 'app-links-tab',
  imports: [TableModule, DataState, StatusBadge, EvidenceIds],
  template: `
    <app-data-state [empty]="!links().length" emptyText="Brak powiązań dla tego projektu.">
      <p-table [value]="links()" dataKey="id" [tableStyle]="{ 'min-width': '55rem' }">
        <ng-template #header><tr><th>Powiązanie</th><th>Metoda</th><th>Pewność</th><th>Status</th><th>Uzasadnienie</th><th>Źródła</th></tr></ng-template>
        <ng-template #body let-l>
          <tr>
            <td>{{ ref(l.from) }} → {{ ref(l.to) }}<div class="text-xs text-muted-color">{{ l.relation }}</div></td>
            <td>{{ method[l.method] }}</td>
            <td><span [title]="l.confidence.rationale">{{ conf[l.confidence.level] }}</span></td>
            <td><app-status-badge type="review" [value]="l.review_status" /></td>
            <td>
              {{ l.rationale }}
              @for (s of l.signals; track $index) {
                <div class="text-xs"><b>{{ s.feature }}</b> ({{ dir[s.direction].label }}): {{ s.explanation }}</div>
              }
            </td>
            <td><app-evidence-ids [ids]="l.evidence_ids" /></td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>
  `,
})
export class LinksTab {
  readonly links = input.required<RecordLink[]>();
  protected readonly method = LINK_METHOD;
  protected readonly conf = CONFIDENCE_LEVEL;
  protected readonly dir = SIGNAL_DIRECTION;
  protected readonly ref = (r: { type: string; id: string }) => `${RESOURCE_TYPE[r.type] ?? r.type} ${r.id}`;
}
