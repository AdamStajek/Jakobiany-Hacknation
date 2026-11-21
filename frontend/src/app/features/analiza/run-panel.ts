import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AssessmentsApi } from '../../core/api/apis';
import { newIdempotencyKey } from '../../core/api/api-client';
import { ApiError, Job } from '../../core/api/types';
import { JobProgress } from '../../shared';
import { assessmentIdFrom, errorText } from './analiza.util';

/** Uruchamia analizę (POST /assessments), śledzi zadanie i po sukcesie przechodzi do wyniku. */
@Component({
  selector: 'app-run-panel',
  imports: [ButtonModule, JobProgress],
  template: `
    <div class="flex flex-col gap-3">
      <div><p-button [label]="label()" icon="pi pi-play" [severity]="severity()" [loading]="starting()" [disabled]="running()" (onClick)="run()" /></div>
      @if (error(); as e) {
        <div class="flex flex-col gap-2 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950" role="alert">
          <span><i class="pi pi-times-circle"></i> {{ message(e) }}</span>
          @if (e.fieldErrors.length) {
            <ul class="m-0 pl-5">
              @for (f of e.fieldErrors; track $index) { <li>{{ f.field ? f.field + ': ' : '' }}{{ f.message }}</li> }
            </ul>
          }
        </div>
      }
      @if (note(); as n) { <div class="p-3 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950" role="status">{{ n }}</div> }
      <app-job-progress [location]="location()" (finishedJob)="done($event)" />
    </div>
  `,
})
export class RunPanel {
  readonly projectId = input.required<string>();
  /** `undefined` = aktualne wersje dokumentów, `[]` = sam opis. */
  readonly versionIds = input<string[] | undefined>(undefined);
  readonly label = input('Uruchom analizę');
  readonly severity = input<'primary' | 'secondary'>('primary');

  private readonly api = inject(AssessmentsApi);
  private readonly router = inject(Router);
  protected readonly starting = signal(false);
  protected readonly running = signal(false);
  protected readonly location = signal<string | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly note = signal<string | null>(null);
  protected readonly message = errorText;
  private key = newIdempotencyKey();

  protected run() {
    this.starting.set(true);
    this.error.set(null);
    this.note.set(null);
    this.location.set(null);
    this.api.create({ project_id: this.projectId(), document_version_ids: this.versionIds() }, this.key).subscribe({
      next: (r) => { this.starting.set(false); this.running.set(true); this.location.set(r.location); this.key = newIdempotencyKey(); },
      error: (e: ApiError) => { this.starting.set(false); this.error.set(e); if (!e.network) this.key = newIdempotencyKey(); },
    });
  }

  protected done(job: Job) {
    this.running.set(false);
    const id = assessmentIdFrom(job.results);
    if (id) { this.router.navigate(['/analiza', id]); return; }
    this.note.set(job.status === 'failed'
      ? 'Analiza nie powiodła się. Sprawdź raport powyżej i spróbuj ponownie.'
      : 'Zadanie zakończyło się bez wyniku analizy.');
  }
}
