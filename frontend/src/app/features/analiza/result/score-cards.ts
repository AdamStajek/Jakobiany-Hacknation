import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { Assessment } from '../../../core/api/types';
import { CONFIDENCE_META, THREAT_LEVEL } from '../../../core/labels';
import { overallConfidence } from '../analiza.util';

/** Trzy osobne wskaźniki: zagrożenie, kompletność i pewność – nigdy łączone w jedną liczbę. */
@Component({
  selector: 'app-score-cards',
  imports: [TagModule],
  template: `
    <div class="grid gap-4 md:grid-cols-3">
      <section class="p-4 rounded-lg border border-surface flex flex-col gap-2" aria-labelledby="sc-threat">
        <h3 id="sc-threat" class="m-0 text-base">Zagrożenie</h3>
        <div><p-tag [value]="threat().label" [icon]="threat().icon" [severity]="threat().tone" /></div>
        <p class="m-0 text-sm">{{ a().threat.rationale }}</p>
        @if (a().threat.likelihood || a().threat.severity) {
          <p class="m-0 text-xs text-muted-color">
            Prawdopodobieństwo: {{ level(a().threat.likelihood) }} · Dotkliwość: {{ level(a().threat.severity) }}
          </p>
        }
      </section>

      <section class="p-4 rounded-lg border border-surface flex flex-col gap-2" aria-labelledby="sc-comp">
        <h3 id="sc-comp" class="m-0 text-base">Kompletność</h3>
        @if (a().completeness.score === null) {
          <div class="text-lg font-semibold">Brak podstaw do wyliczenia</div>
          <p class="m-0 text-sm text-muted-color">Żadna pozycja checklisty nie ma zastosowania do tego projektu.</p>
        } @else {
          <div class="text-3xl font-bold">{{ percent() }}%</div>
          <div class="h-2 rounded bg-surface-200 dark:bg-surface-700" role="img" [attr.aria-label]="'Kompletność ' + percent() + '%'">
            <div class="h-2 rounded bg-primary" [style.width.%]="percent()"></div>
          </div>
          <p class="m-0 text-sm text-muted-color">Pozycji branych pod uwagę: {{ a().completeness.applicable_count }}</p>
        }
      </section>

      <section class="p-4 rounded-lg border border-surface flex flex-col gap-2" aria-labelledby="sc-conf">
        <h3 id="sc-conf" class="m-0 text-base">Pewność</h3>
        <div><p-tag [value]="confidenceMeta().label" [icon]="confidenceMeta().icon" [severity]="confidenceMeta().tone" /></div>
        <p class="m-0 text-sm">{{ confidence().rationale }}</p>
      </section>
    </div>
  `,
})
export class ScoreCards {
  readonly a = input.required<Assessment>();
  protected readonly threat = computed(() => THREAT_LEVEL[this.a().threat.level]);
  protected readonly confidence = computed(() => overallConfidence(this.a()));
  protected readonly confidenceMeta = computed(() => CONFIDENCE_META[this.confidence().level]);
  protected readonly percent = computed(() => Math.round((this.a().completeness.score ?? 0) * 100));
  protected level(l: string | undefined) { return l ? (THREAT_LEVEL[l]?.label ?? l).toLowerCase() : '—'; }
}
