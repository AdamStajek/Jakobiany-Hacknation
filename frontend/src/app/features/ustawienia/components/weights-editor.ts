import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SliderModule } from 'primeng/slider';
import { WEIGHT_LABEL } from '../../../core/labels';
import { weightShares, weightSum } from '../rules-draft.util';

/** Wagi podobieństwa: suwaki 0–10, udział procentowy liczony z sumy; suma musi być dodatnia. */
@Component({
  selector: 'app-weights-editor',
  imports: [FormsModule, SliderModule, InputNumberModule],
  template: `
    <div class="flex flex-col gap-4 max-w-2xl">
      @for (r of rows(); track r.key) {
        <div class="grid grid-cols-[10rem_1fr_6rem_4rem] items-center gap-3">
          <label [for]="'w-' + r.key" class="text-sm">{{ r.label }}</label>
          <p-slider [ngModel]="r.value" (ngModelChange)="set(r.key, $event)" [min]="0" [max]="10" [step]="0.5" [disabled]="readonly()" [attr.aria-label]="'Waga: ' + r.label" />
          <p-inputnumber [inputId]="'w-' + r.key" [ngModel]="r.value" (ngModelChange)="set(r.key, $event ?? 0)" [min]="0" [max]="100" [maxFractionDigits]="2" [disabled]="readonly()" inputStyleClass="w-full" />
          <span class="text-sm text-muted-color text-right">{{ r.share.toFixed(0) }}%</span>
        </div>
      }
      <div class="text-sm" [class.text-red-600]="sum() <= 0" [attr.role]="sum() <= 0 ? 'alert' : null">
        Suma wag: <strong>{{ sum() }}</strong>
        @if (sum() <= 0) { – co najmniej jedna waga musi być dodatnia. } @else { – udziały są liczone względem sumy, więc nie musi ona wynosić 100. }
      </div>
    </div>
  `,
})
export class WeightsEditor {
  readonly weights = model.required<Record<string, number>>();
  readonly readonly = input(false);

  protected readonly sum = computed(() => weightSum(this.weights()));
  protected readonly rows = computed(() => {
    const w = this.weights();
    const shares = weightShares(w);
    return Object.keys(w).map((key) => ({ key, label: WEIGHT_LABEL[key] ?? key, value: w[key], share: shares[key] }));
  });

  protected set(key: string, value: number) {
    this.weights.update((w) => ({ ...w, [key]: value ?? 0 }));
  }
}
