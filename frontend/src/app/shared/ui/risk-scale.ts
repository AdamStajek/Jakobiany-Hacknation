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
          <div class="h-2 rounded-full" [class]="i === active() ? bar[i] : 'bg-black/10 dark:bg-white/15'"></div>
          <div class="mt-1 text-center text-[11px]" [class.font-bold]="i === active()" [class.opacity-60]="i !== active()">{{level}}</div>
        </div>
      }
    </div>
  `,
})
export class RiskScale {
  readonly risk = input.required<string>();
  protected readonly levels = LEVELS;
  protected readonly bar = ['bg-[#385A15]', 'bg-[#778C12]', 'bg-[#EE8106]'];
  protected readonly active = computed(() => INDEX[this.risk()] ?? 1);
}
