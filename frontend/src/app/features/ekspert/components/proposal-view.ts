import { Component, computed, input } from '@angular/core';
import { ReviewItem } from '../../../core/api/types';
import { CONFIDENCE_LEVEL, TARGET_TYPE_LABEL } from '../../../core/labels';
import { ClaimType, EventKind } from '../../../core/models';
import { ClaimBadge, StatusBadge } from '../../../shared';
import { fieldsFor } from '../target-fields';
import { Obj, display, visibleFields } from '../review.util';

/** Bieżąca propozycja: typ, status, rewizja i pola rekordu. */
@Component({
  selector: 'app-proposal-view',
  imports: [StatusBadge, ClaimBadge],
  template: `
    @if (item(); as it) {
      <section aria-label="Propozycja" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="m-0 text-lg font-semibold">{{ typeLabel() }}</h3>
          <app-status-badge type="review" [value]="it.review_status" />
          @if (claimType(); as c) { <app-claim-badge [kind]="c" /> }
          @if (eventKind(); as k) { <app-claim-badge [kind]="k" /> }
        </div>
        <p class="m-0 text-xs text-muted-color">
          <code>{{ it.target_id }}</code> · rewizja {{ it.revision }}@if (it.project_id) { · projekt <code>{{ it.project_id }}</code> }
        </p>
        <dl class="grid grid-cols-1 sm:grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 m-0 text-sm">
          @for (f of fields(); track f.key) {
            <dt class="text-muted-color">{{ f.label }}</dt>
            <dd class="m-0 break-words whitespace-pre-wrap">{{ f.text }}</dd>
          }
        </dl>
      </section>
    }
  `,
})
export class ProposalView {
  readonly item = input.required<ReviewItem>();

  private readonly value = computed(() => this.item().value as Obj);
  protected readonly typeLabel = computed(() => TARGET_TYPE_LABEL[this.item().target_type] ?? this.item().target_type);
  protected readonly claimType = computed((): ClaimType | null => {
    const c = this.value()['claim_type'];
    return c === 'SOURCE_FACT' || c === 'CALCULATED' || c === 'MODEL_INFERENCE' ? c : null;
  });
  protected readonly eventKind = computed((): EventKind | null => {
    const k = this.value()['kind'];
    return k === 'OBSERVED_EVENT' || k === 'POTENTIAL_RISK' ? k : null;
  });

  protected readonly fields = computed(() => {
    const labels = new Map(fieldsFor(this.item().target_type).map((f) => [f.key, f.label]));
    return visibleFields(this.value()).filter(([k]) => k !== 'claim_type' && k !== 'evidence_ids').map(([key, v]) => ({
      key, label: labels.get(key) ?? key,
      text: key === 'confidence' ? confidenceText(v) : display(v),
    }));
  });
}

function confidenceText(v: unknown): string {
  const c = v as { level?: string; rationale?: string } | undefined;
  return c?.level ? `${CONFIDENCE_LEVEL[c.level] ?? c.level}${c.rationale ? ` – ${c.rationale}` : ''}` : display(v);
}
