import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span class="grid h-14 w-14 place-items-center rounded-full bg-primary-50 dark:bg-primary-900">
        <i class="pi {{icon()}} text-2xl text-primary" aria-hidden="true"></i>
      </span>
      <h2 class="mt-2 text-base font-semibold">{{title()}}</h2>
      <p class="max-w-sm text-sm text-muted-color">{{text()}}</p>
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('pi-inbox');
  readonly title = input.required<string>();
  readonly text = input('');
}
