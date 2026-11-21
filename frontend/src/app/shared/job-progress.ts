import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError, Job } from '../core/api/types';
import { JobsService, isFinished, jobResultLink, summarizeJob } from '../core/jobs.service';
import { StatusBadge } from './status-badge';

/** Śledzi zadanie po adresie `location` (nagłówek Location z 202) i pokazuje postęp, wynik oraz raport wierszy. */
@Component({
  selector: 'app-job-progress',
  imports: [ProgressBarModule, RouterLink, StatusBadge],
  template: `
    @if (error()) {
      <div class="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950" role="alert">
        <span>Nie udało się odczytać stanu zadania: {{ error() }}</span>
        <button type="button" class="underline" (click)="retry.update((n) => n + 1)">Sprawdź ponownie</button>
      </div>
    }
    @if (job(); as j) {
      <div class="flex flex-col gap-2 p-3 rounded-lg border border-surface" aria-live="polite">
        <div class="flex items-center gap-2"><span class="font-semibold">Zadanie {{ j.id }}</span><app-status-badge type="job" [value]="j.status" /></div>
        @if (!finished()) { <p-progressbar mode="indeterminate" [style]="{ height: '6px' }" /> }
        @if (j.status === 'partial' || j.status === 'failed') {
          <div [attr.role]="j.status === 'failed' ? 'alert' : 'status'" class="text-sm">
            @if (j.status === 'partial') {
              Zadanie zakończyło się częściowo: {{ summary().ok }} z {{ summary().total }} pozycji bez błędu, {{ summary().problems }} z problemem.
              Dostępne wyniki są poniżej.
            } @else {
              Zadanie nie powiodło się.@if (links().length) { Część wyników zdążyła się zapisać. }
            }
          </div>
        }
        @if (links().length) {
          <ul class="m-0 pl-5 list-disc text-sm">
            @for (l of links(); track l.id) { <li><a [routerLink]="l.path">{{ l.label }} {{ l.id }}</a></li> }
          </ul>
        }
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
  protected readonly error = signal('');
  protected readonly retry = signal(0);
  protected readonly finished = () => !!this.job() && isFinished(this.job()!);
  protected readonly summary = computed(() => (this.job() ? summarizeJob(this.job()!) : { ok: 0, problems: 0, total: 0 }));
  /** Zapisane wyniki dostępne mimo `partial`/`failed` – zachowujemy przejścia do nich. */
  protected readonly links = computed(() =>
    (this.job()?.results ?? []).flatMap((r) => {
      const path = jobResultLink(r);
      return path ? [{ id: r.resource_id, path, label: r.resource_type === 'project' ? 'Projekt' : 'Analiza' }] : [];
    }));
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
        error: (e: ApiError) => this.error.set(e.detail),
      });
    });
  }
}
