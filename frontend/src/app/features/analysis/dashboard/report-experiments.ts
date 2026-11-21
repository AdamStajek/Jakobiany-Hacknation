import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Report } from '../../../core/api/types';
import { AnalysisStore } from '../../../core/state/analysis.store';
import { Panel } from '../../../shared/ui/panel';

@Component({
  selector: 'app-report-experiments',
  imports: [RouterLink, ButtonModule, Panel],
  template: `
    @if (report().experiments?.length) {
      <app-panel heading="Eksperymenty, które mogą doprecyzować diagnozę" icon="pi-list-check">
        <p class="mb-4 text-sm text-muted-color">Porównaj warunki podczas próby z warunkami w dniu analizy ({{report().date}}).
          Późniejszy pomiar opisuje stan pola w dniu próby.</p>
        @if (analysis.experimentError()) {
          <p role="alert" class="mb-3 text-sm">{{analysis.experimentError()}}</p>
        }
        <div class="space-y-4">
          @for (check of report().experiments; track check.slug) {
            <article class="space-y-2 rounded-xl border border-surface p-3 text-sm">
              <h4 class="font-semibold">{{check.title}}</h4>
              <p>{{check.reason}}</p>
              <p><strong>Jak zmieni diagnozę?</strong> {{check.impact}}</p>
              <a class="inline-block py-2 text-primary underline print:hidden"
                [routerLink]="['/eksperymenty', check.slug]" target="_blank" rel="noopener">
                Instrukcja — {{check.title}} (nowa karta)
              </a>
              <div class="flex flex-wrap items-end gap-2 print:hidden">
                <label class="flex min-w-0 flex-1 flex-col gap-1 font-medium">
                  Wynik — {{check.title}}
                  <select #result class="w-full rounded-lg border border-surface bg-surface-0 p-2 text-color dark:bg-surface-900"
                    [disabled]="analysis.savingExperiment()">
                    <option value="" [selected]="!report().experiment_results?.[check.slug]">Brak wyniku lub próba niejednoznaczna</option>
                    @for (option of check.options; track option.value) {
                      <option [value]="option.value" [selected]="report().experiment_results?.[check.slug] === option.value">{{option.label}}</option>
                    }
                  </select>
                </label>
                <p-button label="Zapisz wynik" [disabled]="analysis.savingExperiment()"
                  [ariaLabel]="'Zapisz wynik — ' + check.title"
                  (onClick)="analysis.saveExperiment(report(), check.slug, result.value)" />
              </div>
              <div aria-live="polite">
                @if (report().experiment_conclusions?.[check.slug]; as conclusion) {
                  <p><strong>Wniosek z próby.</strong> {{conclusion}}</p>
                }
              </div>
            </article>
          }
        </div>
      </app-panel>
    }
  `,
})
export class ReportExperiments {
  readonly report = input.required<Report>();
  protected readonly analysis = inject(AnalysisStore);
}
