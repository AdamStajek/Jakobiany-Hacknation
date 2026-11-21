import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/** Przycisk „Dodaj do moich pól” albo potwierdzenie, że działka już jest w polach. Czysto prezentacyjny. */
@Component({
  selector: 'app-add-field-button',
  imports: [ButtonModule],
  template: `
    @if (added()) {
      <span class="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400" role="status">
        <i class="pi pi-check-circle" aria-hidden="true"></i>W Twoich polach
      </span>
    } @else {
      <p-button label="Dodaj do moich pól" icon="pi pi-plus" size="small" severity="secondary" [outlined]="true"
        [loading]="busy()" [disabled]="busy()" (onClick)="add.emit()" />
    }
  `,
})
export class AddFieldButton {
  readonly added = input(false);
  readonly busy = input(false);
  readonly add = output<void>();
}
