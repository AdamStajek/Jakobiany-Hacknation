import { Component, input } from '@angular/core';

/** Karta z opcjonalnym nagłówkiem (ikona + tytuł). Treść wstawiana przez ng-content. */
@Component({
  selector: 'app-panel',
  template: `
    <section class="pw-card h-full">
      @if (heading()) {
        <header class="flex items-center gap-2 px-4 pt-4">
          @if (icon()) { <i class="pi {{icon()}} text-primary" aria-hidden="true"></i> }
          <h3 class="text-sm font-semibold">{{heading()}}</h3>
        </header>
      }
      <div class="p-4" [class.pt-2]="heading()"><ng-content /></div>
    </section>
  `,
  host: {class: 'block'},
})
export class Panel {
  readonly heading = input('');
  readonly icon = input('');
}
