import { Component, input } from '@angular/core';

@Component({
  selector: 'app-chart-card',
  template: `
    <section class="pw-card flex h-full flex-col p-4">
      <h3 class="text-sm font-semibold">{{title()}}</h3>
      @if (subtitle()) { <p class="mb-2 text-xs leading-snug text-muted-color">{{subtitle()}}</p> }
      <div class="min-h-0 flex-1"><ng-content /></div>
    </section>
  `,
  host: {class: 'block'},
})
export class ChartCard {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
