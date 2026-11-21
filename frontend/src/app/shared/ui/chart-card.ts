import { Component, input } from '@angular/core';

@Component({
  selector: 'app-chart-card',
  template: `
    <section class="flex h-full flex-col rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900">
      <h3 class="text-base font-semibold">{{title()}}</h3>
      @if (subtitle()) { <p class="mb-2 text-xs text-muted-color">{{subtitle()}}</p> }
      <div class="min-h-0 flex-1"><ng-content /></div>
    </section>
  `,
})
export class ChartCard {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
