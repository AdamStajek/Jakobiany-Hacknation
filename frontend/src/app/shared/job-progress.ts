import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { Subscription } from 'rxjs';
import { Job } from '../core/api/types';
import { JobsService, isFinished } from '../core/jobs.service';
import { StatusBadge } from './status-badge';

/** Śledzi zadanie po adresie `location` (nagłówek Location z 202) i pokazuje postęp, wynik oraz raport wierszy. */
@Component({
  selector: 'app-job-progress',
  imports: [ProgressBarModule, StatusBadge],
  template: `
    @if (job(); as j) {
      <div class="flex flex-col gap-2 p-3 rounded-lg border border-surface" aria-live="polite">
        <div class="flex items-center gap-2"><span class="font-semibold">Zadanie {{ j.id }}</span><app-status-badge type="job" [value]="j.status" /></div>
        @if (!finished()) { <p-progressbar mode="indeterminate" [style]="{ height: '6px' }" /> }
        @if (j.report.length) {
          <table class="w-full text-sm">
            <thead><tr class="text-left text-muted-color"><th>Wiersz</th><th>Etap</th><th>Wynik</th><th>Komunikat</th></tr></thead>
            <tbody>
              @for (r of j.report; track $index) {
                <tr><td>{{ r.row ?? '–' }}</td><td>{{ r.stage }}</td><td><app-status-badge type="match" [value]="r.status" /></td><td>{{ r.error?.message }}</td></tr>
              }
            </tbody>
          </table>
        }
      </div>
    }
  `,
})
export class JobProgress {
  readonly location = input<string | null>(null);
  readonly finishedJob = output<Job>();
  protected readonly job = signal<Job | null>(null);
  protected readonly finished = () => !!this.job() && isFinished(this.job()!);
  private readonly jobs = inject(JobsService);
  private sub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
    effect(() => {
      const loc = this.location();
      this.sub?.unsubscribe();
      this.job.set(null);
      if (!loc) return;
      this.sub = this.jobs.track(loc).subscribe((j) => {
        this.job.set(j);
        if (isFinished(j)) this.finishedJob.emit(j);
      });
    });
  }
}
