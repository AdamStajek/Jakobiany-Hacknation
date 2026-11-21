import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, defer, expand, timer, switchMap, takeWhile } from 'rxjs';
import { JobsApi } from './api/apis';
import { Job } from './api/types';

export const isFinished = (j: Job) => j.status === 'succeeded' || j.status === 'partial' || j.status === 'failed';

export interface JobSummary { ok: number; problems: number; total: number; }

/** Liczba pozycji raportu bez błędu i z błędem (`error` w wierszu). */
export function summarizeJob(j: Job): JobSummary {
  const problems = j.report.filter((r) => !!r.error).length;
  return { ok: j.report.length - problems, problems, total: j.report.length };
}

/** Odnośnik do zapisanego wyniku zadania (tylko zasoby, które mają widok); pozostałe zwracają null. */
export function jobResultLink(r: Job['results'][number]): string[] | null {
  if (r.resource_type === 'project') return ['/projekty', r.resource_id];
  if (r.resource_type === 'assessment') return ['/analiza', r.resource_id];
  return null;
}

/** Polling zadania z narastającym opóźnieniem; kończy się na stanie końcowym lub przy unsubscribe. */
@Injectable({ providedIn: 'root' })
export class JobsService {
  private readonly api = inject(JobsApi);

  track(location: string, opts: { firstMs?: number; maxMs?: number } = {}): Observable<Job> {
    const first = opts.firstMs ?? 500;
    const max = opts.maxMs ?? 5000;
    return defer(() => this.api.get(location)).pipe(
      expand((job, i) => (isFinished(job) ? EMPTY : timer(Math.min(first * 1.6 ** i, max)).pipe(switchMap(() => this.api.get(location))))),
      takeWhile((j) => !isFinished(j), true),
    );
  }
}
