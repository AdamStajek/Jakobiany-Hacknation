import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, defer, expand, timer, switchMap, takeWhile } from 'rxjs';
import { JobsApi } from './api/apis';
import { Job } from './api/types';

export const isFinished = (j: Job) => j.status === 'succeeded' || j.status === 'partial' || j.status === 'failed';

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
