import { Injectable, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { ExpertApi } from '../../core/api/apis';
import { newIdempotencyKey } from '../../core/api/api-client';
import { ApiError, Decision, DecisionInput, ReviewItem, ReviewStatus, ReviewTargetType } from '../../core/api/types';
import { ExpertQueueService } from '../../core/expert-queue.service';
import { Obj } from './review.util';

export const PAGE_SIZE = 15;
export const ALL_STATUSES: ReviewStatus[] = ['proposed', 'needs_evidence', 'approved', 'corrected', 'rejected', 'superseded'];

/** Zapisana próba decyzji, którą odrzucił konflikt rewizji (409). */
export interface Attempt { action: DecisionInput['action']; reason: string; changes?: Obj; }
export interface Conflict { base: ReviewItem; theirs: ReviewItem | null; attempt: Attempt; }

const asApiError = (e: unknown): ApiError =>
  (e as ApiError)?.code !== undefined ? (e as ApiError) : { status: 0, code: 'unknown', detail: 'Nieoczekiwany błąd.', fieldErrors: [] };

/** Stan i orkiestracja Expert Studio: kolejka, wybrany rekord, decyzje, konflikt i historia. */
@Injectable()
export class EkspertFacade {
  private readonly api = inject(ExpertApi);
  private readonly queueCount = inject(ExpertQueueService);
  private readonly toast = inject(MessageService);

  /** Filtry; pusty status = domyślna kolejka backendu (propozycje i „wymaga dowodów”). */
  readonly status = signal<ReviewStatus | ''>('');
  readonly type = signal<ReviewTargetType | ''>('');
  readonly offset = signal(0);

  readonly items = signal<ReviewItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly current = signal<ReviewItem | null>(null);
  readonly selecting = signal(false);
  readonly selectError = signal<ApiError | null>(null);
  readonly currentKey = computed(() => { const c = this.current(); return c ? `${c.target_type}:${c.target_id}` : null; });

  readonly history = signal<Decision[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal<ApiError | null>(null);

  readonly submitting = signal(false);
  readonly submitError = signal<ApiError | null>(null);
  readonly conflict = signal<Conflict | null>(null);
  /** Rośnie po zapisanej decyzji i po odrzuceniu korekty – formularz wraca wtedy do stanu początkowego. */
  readonly resetToken = signal(0);
  private pendingKey?: { key: string; body: string };

  loadQueue() {
    this.loading.set(true);
    this.error.set(null);
    this.api.reviews({
      review_status: this.status() || undefined, target_type: this.type() || undefined,
      limit: PAGE_SIZE, offset: this.offset(),
    }).subscribe({
      next: (p) => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: (e: unknown) => { this.error.set(asApiError(e)); this.loading.set(false); },
    });
  }

  select(item: ReviewItem) {
    this.resetDecisionState();
    this.selectError.set(null);
    this.current.set(item);
    this.loadHistory(item);
  }

  /** Wybór z adresu URL: rekord może nie być na bieżącej stronie kolejki. */
  selectByKey(type: ReviewTargetType, id: string) {
    if (this.currentKey() === `${type}:${id}`) return;
    const inList = this.items().find((i) => i.target_type === type && i.target_id === id);
    if (inList) { this.select(inList); return; }
    this.selecting.set(true);
    this.selectError.set(null);
    this.lookup(type, id).subscribe((item) => {
      this.selecting.set(false);
      if (item) this.select(item);
      else this.selectError.set({ status: 404, code: 'not_found', detail: 'Nie znaleziono pozycji do weryfikacji.', fieldErrors: [] });
    });
  }

  clearSelection() {
    this.resetDecisionState();
    this.current.set(null);
    this.history.set([]);
  }

  /** Brak endpointu GET dla pojedynczej pozycji, więc szukamy jej w kolejce po wszystkich statusach. */
  private lookup(type: ReviewTargetType, id: string, projectId?: string): Observable<ReviewItem | null> {
    return forkJoin(ALL_STATUSES.map((s) =>
      this.api.reviews({ review_status: s, target_type: type, project_id: projectId, limit: 200 })
        .pipe(catchError(() => of({ items: [] as ReviewItem[] }))))).pipe(
      map((pages) => pages.flatMap((p) => p.items).find((i) => i.target_id === id) ?? null));
  }

  loadHistory(item: ReviewItem) {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.api.decisions({ target_type: item.target_type, target_id: item.target_id, limit: 50 }).subscribe({
      next: (p) => { this.history.set(p.items); this.historyLoading.set(false); },
      error: (e: unknown) => { this.historyError.set(asApiError(e)); this.historyLoading.set(false); },
    });
  }

  submit(attempt: Attempt) {
    const cur = this.current();
    if (!cur || this.submitting()) return;
    const body: DecisionInput = {
      target_type: cur.target_type, target_id: cur.target_id, expected_revision: cur.revision,
      action: attempt.action, reason: attempt.reason.trim(),
      // schema.d.ts typuje `changes` jako Record<string, never> (artefakt generatora).
      ...(attempt.action === 'correct' ? { changes: attempt.changes as DecisionInput['changes'] } : {}),
    };
    // Ten sam klucz tylko przy powtórzeniu identycznego żądania (np. po błędzie sieci).
    const json = JSON.stringify(body);
    if (this.pendingKey?.body !== json) this.pendingKey = { key: newIdempotencyKey(), body: json };
    this.submitting.set(true);
    this.submitError.set(null);
    this.api.decide(body, this.pendingKey.key).subscribe({
      next: (d) => {
        this.pendingKey = undefined;
        this.submitting.set(false);
        this.conflict.set(null);
        this.current.set(d.after);
        this.resetToken.update((n) => n + 1);
        this.history.update((h) => [d, ...h]);
        this.toast.add({ severity: 'success', summary: 'Decyzja zapisana', detail: `Rewizja ${d.after.revision}.` });
        this.loadQueue();
        this.queueCount.refresh();
      },
      error: (e: unknown) => this.onSubmitError(asApiError(e), cur, attempt),
    });
  }

  private onSubmitError(err: ApiError, base: ReviewItem, attempt: Attempt) {
    this.submitting.set(false);
    if (err.status === 409 && err.code === 'stale_revision') {
      this.pendingKey = undefined;
      this.lookup(base.target_type, base.target_id, base.project_id).subscribe((theirs) =>
        this.conflict.set({ base, theirs, attempt }));
      return;
    }
    this.submitError.set(err);
  }

  /** Przyjmuje bieżącą rewizję z serwera; wpisana korekta zostaje w formularzu do ponowienia. */
  rebase() {
    const c = this.conflict();
    if (c?.theirs) { this.current.set(c.theirs); this.loadHistory(c.theirs); }
    this.conflict.set(null);
    this.submitError.set(null);
  }

  /** Przyjmuje bieżącą rewizję i zeruje formularz (korekta odrzucona). */
  discard() {
    this.rebase();
    this.resetToken.update((n) => n + 1);
  }

  /** Ponawia pobranie bieżącego rekordu, gdy porównanie nie było możliwe. */
  reloadConflict() {
    const c = this.conflict();
    if (!c) return;
    this.lookup(c.base.target_type, c.base.target_id, c.base.project_id).subscribe((theirs) => this.conflict.set({ ...c, theirs }));
  }

  createRecord(type: ReviewTargetType, projectId: string, value: Obj): Observable<ReviewItem> {
    return this.api.createRecord({ target_type: type, project_id: projectId, value }).pipe(
      tap((item) => {
        this.toast.add({ severity: 'success', summary: 'Wpis dodany', detail: 'Propozycja czeka na decyzję w kolejce.' });
        this.loadQueue();
        this.queueCount.refresh();
        this.select(item);
      }));
  }

  private resetDecisionState() {
    this.conflict.set(null);
    this.submitError.set(null);
    this.pendingKey = undefined;
  }
}
