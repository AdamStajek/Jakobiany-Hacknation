import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Report } from '../../../core/api/types';
import { AnalysisStore } from '../../../core/state/analysis.store';

@Component({
  selector: 'app-report-experiments',
  imports: [RouterLink],
  templateUrl: './report-experiments.html',
})
export class ReportExperiments {
  readonly report = input.required<Report>();
  protected readonly feedback = signal<{id: string; message: string; changes: string[]} | null>(null);
  protected readonly analysis = inject(AnalysisStore);

  protected async save(slug: string, title: string, select: HTMLSelectElement) {
    const before = this.report();
    const value = select.value;
    const previous = before.experiment_results?.[slug] ?? '';
    if (previous === value) return;
    this.feedback.set(null);
    const after = await this.analysis.saveExperiment(before, slug, value);
    if (!after) {
      if (this.report() === before) select.value = previous;
      return;
    }

    const message = after.experiment_conclusions?.[slug] ?? 'Usunięto wcześniejszy wynik i jego wniosek z analizy.';
    const oldChecks = before.experiments ?? [];
    const newChecks = after.experiments ?? [];
    const changes = [
      ...newChecks.filter(c => !oldChecks.some(old => old.slug === c.slug)).map(c => 'Dodano próbę: ' + c.title),
      ...oldChecks.filter(c => !newChecks.some(next => next.slug === c.slug)).map(c => 'Usunięto próbę: ' + c.title),
    ];
    this.feedback.set({id: after.analysis_id, message: title + ' — ' + message, changes});
  }
}
