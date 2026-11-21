import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  template: `
    <div class="rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900">
      <div class="text-xs font-semibold uppercase tracking-wide text-muted-color">{{label()}}</div>
      <div class="mt-1 text-3xl font-bold tabular-nums">{{value()}}@if (unit()) { <span class="ml-1 text-base font-medium text-muted-color">{{unit()}}</span> }</div>
      @if (hint()) { <div class="mt-1 text-xs text-muted-color">{{hint()}}</div> }
    </div>
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input('');
  readonly hint = input('');
}
