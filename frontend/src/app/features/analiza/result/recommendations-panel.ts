import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { Recommendation } from '../../../core/api/types';
import { CONFIDENCE_META, RECOMMENDATION_KIND } from '../../../core/labels';
import { ClaimBadge, DataState, EvidenceLink } from '../../../shared';

/** Rekomendacje z rodzajem, uzasadnieniem, pewnością i dowodami. */
@Component({
  selector: 'app-recommendations-panel',
  imports: [TagModule, ClaimBadge, DataState, EvidenceLink],
  template: `
    <app-data-state [empty]="!items().length" emptyText="Brak rekomendacji.">
      <ul class="m-0 p-0 list-none flex flex-col gap-3">
        @for (r of items(); track r.id) {
          <li class="p-4 rounded-lg border border-surface flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <p-tag [value]="kind(r)" severity="info" />
              <app-claim-badge [kind]="r.claim_type" />
              <p-tag [value]="'Pewność: ' + conf(r).label" [icon]="conf(r).icon" [severity]="conf(r).tone" />
            </div>
            <div class="font-semibold">{{ r.action }}</div>
            <p class="m-0 text-sm">{{ r.rationale }}</p>
            @if (r.proposed_clause) { <blockquote class="m-0 pl-3 border-l-4 border-surface text-sm italic">{{ r.proposed_clause }}</blockquote> }
            @if (r.evidence_ids.length) { <div><app-evidence-link [evidenceId]="r.evidence_ids[0]" /></div> }
          </li>
        }
      </ul>
    </app-data-state>
  `,
})
export class RecommendationsPanel {
  readonly items = input.required<Recommendation[]>();
  protected kind = (r: Recommendation) => RECOMMENDATION_KIND[r.kind] ?? r.kind;
  protected conf = (r: Recommendation) => CONFIDENCE_META[r.confidence.level];
}
