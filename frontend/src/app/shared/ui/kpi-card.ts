import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  template: `
    <div class="pw-card h-full p-3 sm:p-4">
      <div class="pw-eyebrow">{{label()}}</div>
      <div class="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{{value()}}@if (unit()) { <span class="ml-1 text-sm font-medium text-muted-color">{{unit()}}</span> }</div>
      @if (hint()) { <div class="mt-1 text-xs leading-snug text-muted-color">{{hint()}}</div> }
    </div>
  `,
  host: {class: 'block'},
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input('');
  readonly hint = input('');
}
