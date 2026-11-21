import { Component, computed, input } from '@angular/core';

const LEVELS = ['Niskie', 'Niepewne', 'Podwyższone'] as const;
const INDEX: Record<string, number> = {
  'Niskie w modelu': 0, 'Brak sygnału z opadu i ET': 0, 'Niepewne': 1, 'Podwyższone': 2, 'Sygnał niedoboru': 2,
};

/** Trzystopniowa skala ryzyka: kolor, położenie i etykieta (bez zmyślonej liczby). */
@Component({
  selector: 'app-risk-scale',
  template: `
    <div class="flex gap-1" role="img" [attr.aria-label]="'Ryzyko: ' + risk() + '. Skala: niskie, niepewne, podwyższone.'">
      @for (level of levels; track level; let i = $index) {
        <div class="flex-1">
          <div class="h-2 rounded-full" [class]="i === active() ? bar[i] : 'bg-black/15 dark:bg-white/25'"></div>
          <div class="mt-1 text-center text-[11px]" [class.font-bold]="i === active()" [class.opacity-90]="i !== active()">{{level}}</div>
        </div>
      }
    </div>
  `,
})
export class RiskScale {
  readonly risk = input.required<string>();
  protected readonly levels = LEVELS;
  protected readonly bar = ['bg-primary-700 dark:bg-primary-300', 'bg-primary-500 dark:bg-primary-400', 'bg-(--pw-orange)'];
  protected readonly active = computed(() => INDEX[this.risk()] ?? 1);
}
