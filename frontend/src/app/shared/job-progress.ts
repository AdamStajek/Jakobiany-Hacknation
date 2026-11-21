import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { Subscription } from 'rxjs';
import { ApiError, Job } from '../core/api/types';
import { JobsService, isFinished } from '../core/jobs.service';
import { StatusBadge } from './status-badge';

/** Śledzi zadanie po adresie `location` (nagłówek Location z 202) i pokazuje postęp, wynik oraz raport wierszy. */
@Component({
  selector: 'app-job-progress',
  imports: [ProgressBarModule, StatusBadge],
  template: `
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button type="button" class="action" (click)="retry.update((n) => n + 1)">Sprawdź zadanie ponownie</button>
    }
    @if (job(); as j) {
      <div class="flex flex-col gap-2 p-3 rounded-lg border border-surface" aria-live="polite">
        <div class="flex items-center gap-2"><span class="font-semibold">Zadanie {{ j.id }}</span><app-status-badge type="job" [value]="j.status" /></div>
        @if (!finished()) { <p-progressbar mode="indeterminate" [style]="{ height: '6px' }" /> }
        @if (j.report.length) {
          <div class="max-h-96 overflow-auto">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-muted-color"><th>Wiersz</th><th>Etap</th><th>Wynik</th><th>Komunikat</th></tr></thead>
            <tbody>
              @for (r of j.report; track $index) {
                <tr>
                  <td>{{ r.row ?? '–' }}</td><td>{{ stages[r.stage] ?? r.stage }}</td>
                  <td><app-status-badge type="match" [value]="r.status" /></td>
                  <td>{{ r.error?.message ?? r.message }}
                    @if (r.source_id) { <div class="text-xs">Źródło {{ r.source_id }}</div> }
                    @if (r.attempted_url) { <a [href]="r.attempted_url" target="_blank" rel="noopener noreferrer">Zapytanie źródłowe</a> }
                    @if (r.attempted_at) { <div class="text-xs">{{ r.attempted_at }}</div> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          </div>
        }
      </div>
    }
  `,
})
export class JobProgress {
  readonly location = input<string | null>(null);
  readonly finishedJob = output<Job>();
  readonly trackingError = output<string>();
  protected readonly job = signal<Job | null>(null);
  protected readonly error = signal('');
  protected readonly retry = signal(0);
  protected readonly stages: Partial<Record<string, string>> = {
    validation: 'Walidacja', import: 'Import', fetch: 'Pobranie', link: 'Dopasowanie',
    extraction: 'Ekstrakcja', analysis: 'Analiza',
  };
  protected readonly finished = () => !!this.job() && isFinished(this.job()!);
  private readonly jobs = inject(JobsService);
  private sub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
    effect(() => {
      const loc = this.location();
      this.retry();
      this.sub?.unsubscribe();
      this.job.set(null);
      this.error.set('');
      if (!loc) return;
      this.sub = this.jobs.track(loc).subscribe({
        next: (j) => {
          this.job.set(j);
          if (isFinished(j)) this.finishedJob.emit(j);
        },
        error: (e: ApiError) => { this.error.set(e.detail); this.trackingError.emit(e.detail); },
      });
    });
  }
}
