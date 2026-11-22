import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Report } from '../../../core/api/types';
import { AnalysisStore } from '../../../core/state/analysis.store';

@Component({
  selector: 'app-report-experiments',
  imports: [RouterLink, ButtonModule],
  templateUrl: './report-experiments.html',
})
export class ReportExperiments {
  readonly report = input.required<Report>();
  protected readonly analysis = inject(AnalysisStore);
}
