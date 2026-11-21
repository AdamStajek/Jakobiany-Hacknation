import { Component, input, model } from '@angular/core';

export type SegmentOption<T extends string> = {value: T; label: string; icon?: string; disabled?: boolean};

/** Przełącznik widoków (segmenty). Stan przez model(), dostępny jako grupa przycisków z aria-pressed. */
@Component({
  selector: 'app-segmented',
  template: `
    <div class="flex rounded-xl bg-surface-100 p-1 ring-1 ring-inset ring-surface-200 dark:bg-surface-950 dark:ring-surface-600" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button type="button" [disabled]="option.disabled" [attr.aria-pressed]="value() === option.value" (click)="value.set(option.value)"
          class="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40"
          [class]="value() === option.value ? 'bg-surface-0 text-color shadow-sm ring-1 ring-surface-200 dark:bg-surface-700 dark:ring-surface-400' : 'text-muted-color hover:text-color'">
          @if (option.icon) { <i class="pi {{option.icon}}" aria-hidden="true"></i> }{{option.label}}
        </button>
      }
    </div>
  `,
})
export class Segmented<T extends string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly label = input.required<string>();
  readonly value = model.required<T>();
}
