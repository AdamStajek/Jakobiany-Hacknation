import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface p-10 text-center">
      <i class="pi {{icon()}} text-3xl text-muted-color" aria-hidden="true"></i>
      <h2 class="text-lg font-semibold">{{title()}}</h2>
      <p class="max-w-md text-sm text-muted-color">{{text()}}</p>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('pi-inbox');
  readonly title = input.required<string>();
  readonly text = input('');
}
