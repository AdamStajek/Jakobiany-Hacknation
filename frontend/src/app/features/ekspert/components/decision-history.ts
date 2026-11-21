import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { ApiError, Decision } from '../../../core/api/types';
import { REVIEW_ACTION } from '../../../core/labels';
import { DataState, StatusBadge } from '../../../shared';
import { Obj, diffValues, display } from '../review.util';

/** Historia decyzji: kto, co, kiedy, stara i nowa wartość, powód. */
@Component({
  selector: 'app-decision-history',
  imports: [DatePipe, DataState, StatusBadge],
  template: `
    <section aria-label="Historia decyzji" class="flex flex-col gap-3">
      <h4 class="m-0 text-base font-semibold">Historia decyzji</h4>
      <app-data-state [loading]="loading()" [error]="error()" [empty]="!rows().length" emptyText="Ta pozycja nie ma jeszcze decyzji." (retry)="retry.emit()">
        <ol class="list-none m-0 p-0 flex flex-col gap-3">
          @for (d of rows(); track d.id) {
            <li class="p-3 rounded-lg border border-surface flex flex-col gap-2 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <strong>{{ d.action }}</strong>
                <app-status-badge type="review" [value]="d.status" />
                <span class="text-xs text-muted-color">{{ d.actor }} · {{ d.at | date: 'dd.MM.yyyy HH:mm' }} · rewizja {{ d.from }} → {{ d.to }}</span>
              </div>
              <p class="m-0">{{ d.reason }}</p>
              @if (d.diffs.length) {
                <ul class="m-0 pl-4 flex flex-col gap-1">
                  @for (f of d.diffs; track f.key) {
                    <li><span class="text-muted-color">{{ f.key }}:</span> <del class="text-red-700 dark:text-red-400">{{ f.before }}</del> → <ins class="text-green-700 dark:text-green-400 no-underline font-medium">{{ f.after }}</ins></li>
                  }
                </ul>
              }
            </li>
          }
        </ol>
      </app-data-state>
    </section>
  `,
})
export class DecisionHistory {
  readonly decisions = input.required<Decision[]>();
  readonly loading = input(false);
  readonly error = input<ApiError | null>(null);
  readonly retry = output<void>();

  protected readonly rows = computed(() => this.decisions().map((d) => ({
    id: d.id, action: REVIEW_ACTION[d.action]?.label ?? d.action, status: d.after.review_status, actor: d.actor_id,
    at: d.created_at, from: d.before.revision, to: d.after.revision, reason: d.reason,
    diffs: diffValues(d.before.value as Obj, d.after.value as Obj).map((x) => ({ key: x.key, before: display(x.before), after: display(x.after) })),
  })));
}
