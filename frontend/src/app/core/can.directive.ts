import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from './auth.service';
import { Action } from './permissions';

/** `<button *can="'import'">` – element istnieje tylko, gdy rola ma uprawnienie. */
@Directive({ selector: '[can]' })
export class CanDirective {
  readonly can = input.required<Action>();
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef);
  private readonly vcr = inject(ViewContainerRef);

  constructor() {
    effect(() => {
      this.vcr.clear();
      if (this.auth.can(this.can())) this.vcr.createEmbeddedView(this.tpl);
    });
  }
}
