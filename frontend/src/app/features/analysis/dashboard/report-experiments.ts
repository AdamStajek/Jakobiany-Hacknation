import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { ExperimentCheck, Report } from '../../../core/api/types';
import { ExperimentPlanStore } from '../../../core/state/experiment-plan.store';
import { AnalysisStore } from '../../../core/state/analysis.store';
import { FieldsStore } from '../../../core/state/fields.store';
import { ExperimentDiagram } from '../../../shared/ui/experiment-diagram';
import { Panel } from '../../../shared/ui/panel';
import { experimentGuides } from '../../../shared/experiments/experiment-guides';

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-report-experiments',
  imports: [RouterLink, AccordionModule, ButtonModule, Panel, ExperimentDiagram],
  templateUrl: './report-experiments.html',
})
export class ReportExperiments {
  readonly report = input.required<Report>();
  protected readonly analysis = inject(AnalysisStore);
  private readonly plans = inject(ExperimentPlanStore);
  private readonly fields = inject(FieldsStore);

  /** Rozwinięte są tylko próby z zapisanym wynikiem. */
  protected readonly openChecks = computed(() => (this.report().experiments ?? [])
    .filter((check) => !!this.report().experiment_results?.[check.slug]).map((check) => check.slug));
  protected readonly proposed = signal(false);
  protected readonly startDate = signal(today());
  protected readonly planMessage = signal('');

  /** Nazwa pola użytkownika zawierającego działkę raportu; w razie braku — identyfikator działki. */
  private readonly fieldName = computed(() => {
    const id = this.report().parcel.id;
    return this.fields.fields().find((field) => field.parcels.some((parcel) => parcel.id === id))?.name ?? id;
  });

  /** Jeden rekomendowany test (pierwszy z backendu); treść z instrukcji, a bez niej z opisu próby. */
  protected readonly suggestion = computed(() => {
    const check = this.report().experiments?.[0];
    if (!check) return null;
    const guide = experimentGuides.find((item) => item.slug === check.slug);
    const first = guide?.steps[0];
    return {
      check,
      change: first ? `${first.title}. ${first.instruction}` : check.reason,
      observe: guide?.record ?? check.reason,
      compare: guide?.meaning ?? check.impact,
    };
  });

  protected setStart(event: Event) {
    if (event.target instanceof HTMLInputElement) this.startDate.set(event.target.value);
  }

  protected savePlan(check: ExperimentCheck) {
    const name = this.fieldName();
    const result = this.plans.save(check.slug, name, this.startDate());
    const what = `„${check.title}” — ${name}, start ${this.startDate()}`;
    this.planMessage.set(
      result === 'saved' ? `Zapisano zamiar eksperymentu w tej przeglądarce: ${what}.`
        : result === 'session' ? `Zapisano zamiar eksperymentu tylko do zamknięcia karty (brak zgody na zapis w przeglądarce): ${what}.`
          : `Nie udało się zapisać w przeglądarce. Zamiar jest zapamiętany tylko do zamknięcia karty: ${what}.`);
  }
}
