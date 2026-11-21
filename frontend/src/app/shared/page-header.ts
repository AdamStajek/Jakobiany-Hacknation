import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-page-header',
  imports: [TagModule],
  template: `
    <header class="flex flex-col gap-1 mb-6">
      <div class="flex items-center gap-3 flex-wrap">
        <h2 class="m-0 text-2xl font-bold">{{ title() }}</h2>
        @if (priority()) { <p-tag [value]="priority()!" severity="secondary" /> }
      </div>
      @if (subtitle()) { <p class="m-0 text-muted-color">{{ subtitle() }}</p> }
      <div class="brand-bar mt-2 max-w-48"></div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly priority = input<string>();
}
