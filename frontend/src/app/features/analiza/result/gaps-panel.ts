import { Component, input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InformationCheck } from '../../../core/api/types';
import { INFO_STATE } from '../../../core/labels';
import { DataState, EvidenceLink } from '../../../shared';

/** Luki informacyjne: stan, powód, czego brakuje i dowód. */
@Component({
  selector: 'app-gaps-panel',
  imports: [TableModule, TagModule, DataState, EvidenceLink],
  template: `
    <app-data-state [empty]="!gaps().length" emptyText="Brak pozycji checklisty do wyświetlenia.">
      <p-table [value]="gaps()" [tableStyle]="{ 'min-width': '44rem' }">
        <ng-template #header><tr><th>Wymaganie</th><th>Stan</th><th>Powód</th><th>Czego brakuje</th><th>Dowód</th></tr></ng-template>
        <ng-template #body let-g>
          <tr>
            <td>{{ g.requirement.question }}</td>
            <td><p-tag [value]="state(g).label" [icon]="state(g).icon" [severity]="state(g).tone" /></td>
            <td>{{ g.explanation }}</td>
            <td>
              {{ g.requested_information ?? '—' }}
              @if (g.potential_completeness_gain) { <div class="text-xs text-muted-color">+{{ pct(g.potential_completeness_gain) }} p.p. kompletności</div> }
            </td>
            <td>@if (g.evidence_ids.length) { <app-evidence-link [evidenceId]="g.evidence_ids[0]" /> } @else { — }</td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>
  `,
})
export class GapsPanel {
  readonly gaps = input.required<InformationCheck[]>();
  protected state = (g: InformationCheck) => INFO_STATE[g.state];
  protected pct = (n: number) => Math.round(n * 100);
}
