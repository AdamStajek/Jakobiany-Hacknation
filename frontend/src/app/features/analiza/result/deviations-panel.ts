import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { Assessment } from '../../../core/api/types';
import { CONFIDENCE_META, DEVIATION_DIMENSION, DEVIATION_UNIT } from '../../../core/labels';
import { EvidenceLink } from '../../../shared';

type Deviation = Assessment['deviations']['cost'];

/** Przedziały odchyleń kosztu i czasu. `insufficient_evidence` pokazujemy jako komunikat, nie liczbę. */
@Component({
  selector: 'app-deviations-panel',
  imports: [TagModule, EvidenceLink],
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      @for (d of items(); track d.key) {
        <section class="p-4 rounded-lg border border-surface flex flex-col gap-2">
          <h3 class="m-0 text-base">{{ d.label }}</h3>
          @if (d.dev.status === 'estimated' && d.dev.interval; as iv) {
            <div class="text-2xl font-bold">{{ iv.lower }} do {{ iv.upper }} {{ unit(iv.unit) }}</div>
            <p class="m-0 text-sm text-muted-color">{{ iv.methodology }}</p>
          } @else {
            <div class="font-semibold"><i class="pi pi-question-circle"></i> Za mało danych, aby podać przedział</div>
            <p class="m-0 text-sm">{{ d.dev.confidence.rationale }}</p>
          }
          <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt class="text-muted-color">Liczebność próby</dt><dd class="m-0">{{ d.dev.sample_size }}</dd>
            <dt class="text-muted-color">Braki danych</dt>
            <dd class="m-0">{{ d.dev.missing_data_fraction === null ? 'brak kandydatów' : pct(d.dev.missing_data_fraction) + '%' }}</dd>
            <dt class="text-muted-color">Pewność</dt>
            <dd class="m-0"><p-tag [value]="conf(d.dev).label" [icon]="conf(d.dev).icon" [severity]="conf(d.dev).tone" /></dd>
          </dl>
          @if (d.dev.evidence_ids.length) { <div><app-evidence-link [evidenceId]="d.dev.evidence_ids[0]" /></div> }
        </section>
      }
    </div>
  `,
})
export class DeviationsPanel {
  readonly a = input.required<Assessment>();
  protected readonly items = computed(() =>
    (['cost', 'time'] as const).map((key) => ({ key, label: DEVIATION_DIMENSION[key], dev: this.a().deviations[key] })));
  protected conf = (d: Deviation) => CONFIDENCE_META[d.confidence.level];
  protected unit = (u: string) => DEVIATION_UNIT[u] ?? u;
  protected pct = (n: number) => Math.round(n * 100);
}
