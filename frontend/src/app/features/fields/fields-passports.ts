import { Component, input, output } from '@angular/core';
import { Field } from '../../core/state/fields.store';
import { EmptyState } from '../../shared/ui/empty-state';
import { FieldPassport } from './field-passport';

/** Paszport wybranego pola z przełącznikiem między polami. */
@Component({
  selector: 'app-fields-passports',
  imports: [EmptyState, FieldPassport],
  host: {class: 'pw-scroll block min-h-0 flex-1 p-4'},
  template: `
    @if (current(); as current) {
      <div class="mx-auto flex max-w-2xl flex-col gap-3">
        <div role="group" aria-label="Wybierz pole" class="flex flex-wrap gap-2">
          @for (field of fields(); track field.id) {
            <button type="button" (click)="picked.emit(field.id)" [attr.aria-pressed]="current.id === field.id"
              class="min-h-10 rounded-full border border-surface px-4 text-sm"
              [class]="current.id === field.id ? 'bg-primary font-semibold text-primary-contrast' : 'hover:bg-surface-100 dark:hover:bg-surface-800'">{{field.name}}</button>
          }
        </div>
        <app-field-passport [field]="current" />
      </div>
    } @else {
      <app-empty-state icon="pi-id-card" title="Paszporty pojawią się tutaj" text="Dodaj pierwsze pole, a pokażemy jego krótki paszport." />
    }
  `,
})
export class FieldsPassports {
  readonly fields = input.required<Field[]>();
  readonly current = input<Field | null>(null);
  readonly picked = output<string>();
}
