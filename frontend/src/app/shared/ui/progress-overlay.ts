import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';

/** Nakładka „trwa proces” na kontenerze o `position: relative`: blokuje klikanie pod spodem i pokazuje postęp. */
@Component({
  selector: 'app-progress-overlay',
  imports: [ButtonModule, ProgressBarModule],
  template: `
    <div class="absolute inset-0 z-10 flex items-center justify-center bg-surface-0/70 p-4 backdrop-blur-sm dark:bg-surface-900/70"
      role="alertdialog" aria-modal="false" [attr.aria-label]="title()" aria-live="polite">
      <div class="w-full max-w-sm space-y-3 rounded-xl border border-surface bg-surface-0 p-5 shadow-lg dark:bg-surface-900">
        <h2 class="flex items-center gap-2 text-base font-semibold"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i>{{title()}}</h2>
        @if (percent() === null) { <p-progressbar mode="indeterminate" [style]="{height: '8px'}" /> }
        @else { <p-progressbar [value]="percent()" [showValue]="false" [style]="{height: '8px'}" /> }
        <p class="text-sm text-muted-color">{{message()}}</p>
        <p class="text-xs text-muted-color">{{hint()}}</p>
        <p-button label="Anuluj" severity="secondary" [outlined]="true" size="small" styleClass="w-full" (onClick)="cancelled.emit()" />
      </div>
    </div>
  `,
})
export class ProgressOverlay {
  readonly title = input('Trwa analiza działki');
  readonly message = input('');
  readonly percent = input<number | null>(null);
  readonly hint = input('Zmiana działki będzie możliwa po zakończeniu lub anulowaniu.');
  readonly cancelled = output();
}
