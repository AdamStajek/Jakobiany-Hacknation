import { Component, input } from '@angular/core';

/** Rama ekranów logowania/rejestracji: wyśrodkowana karta z nagłówkiem i miejscem na treść. */
@Component({
  selector: 'app-auth-card',
  host: {class: 'block'},
  template: `
    <div class="mx-auto flex min-h-[calc(100dvh-var(--shell-top)-var(--shell-bottom))] max-w-md flex-col justify-center gap-4 px-4 py-8">
      <header class="flex items-center gap-3">
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-50 dark:bg-primary-950">
          <i class="pi {{icon()}} text-xl text-primary" aria-hidden="true"></i>
        </span>
        <div>
          <h1 class="text-xl font-bold">{{heading()}}</h1>
          @if (lead()) { <p class="text-sm text-muted-color">{{lead()}}</p> }
        </div>
      </header>
      <div class="pw-card flex flex-col gap-4 p-4 sm:p-6"><ng-content /></div>
      <ng-content select="[footer]" />
    </div>
  `,
})
export class AuthCard {
  readonly heading = input.required<string>();
  readonly lead = input('');
  readonly icon = input('pi-user');
}
