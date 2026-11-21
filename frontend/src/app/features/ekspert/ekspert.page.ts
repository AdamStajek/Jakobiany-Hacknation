import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CanDirective } from '../../core/can.directive';
import { ReviewItem, ReviewStatus, ReviewTargetType } from '../../core/api/types';
import { DataState, PageHeader } from '../../shared';
import { ConflictDiff } from './components/conflict-diff';
import { DecisionForm } from './components/decision-form';
import { DecisionHistory } from './components/decision-history';
import { EvidenceInline } from './components/evidence-inline';
import { ProposalView } from './components/proposal-view';
import { QueueList } from './components/queue-list';
import { RecordDialog } from './components/record-dialog';
import { EkspertFacade, PAGE_SIZE } from './ekspert.facade';

/** Expert Studio: kolejka po lewej, po prawej propozycja obok dowodów, formularz decyzji i historia. Stan w URL. */
@Component({
  selector: 'app-ekspert-page',
  imports: [
    CanDirective, DataState, PageHeader, ConflictDiff, DecisionForm, DecisionHistory, EvidenceInline,
    ProposalView, QueueList, RecordDialog,
  ],
  providers: [EkspertFacade],
  template: `
    <app-page-header title="Expert Studio" subtitle="Weryfikacja połączeń, zdarzeń i wzorców – dowód obok wniosku" priority="P0" />
    <div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
      <app-queue-list [items]="f.items()" [total]="f.total()" [loading]="f.loading()" [error]="f.error()" [offset]="f.offset()"
                      [status]="f.status()" [type]="f.type()" [selectedKey]="f.currentKey()"
                      (select)="open($event)" (filters)="setFilters($event.status, $event.type)" (pageChange)="go({ strona: $event / pageSize || null })"
                      (retry)="f.loadQueue()" (add)="dialog.set(true)" />

      <div class="flex flex-col gap-6 min-w-0">
        <app-data-state [loading]="f.selecting()" [error]="f.selectError()" [empty]="!f.current()" emptyText="Wybierz pozycję z kolejki, aby zobaczyć dowód i podjąć decyzję.">
          @if (f.current(); as it) {
            <div class="grid gap-6 xl:grid-cols-2 items-start">
              <app-proposal-view [item]="it" />
              <app-evidence-inline [ids]="it.evidence_ids" />
            </div>

            <ng-container *can="'decide'">
              @if (f.conflict(); as c) {
                <app-conflict-diff [conflict]="c" (rebase)="f.rebase()" (discard)="f.discard()" (reload)="f.reloadConflict()" />
              }
              <app-decision-form [item]="it" [submitting]="f.submitting()" [serverError]="f.submitError()" [resetToken]="f.resetToken()" (decide)="f.submit($event)" />
            </ng-container>

            <app-decision-history [decisions]="f.history()" [loading]="f.historyLoading()" [error]="f.historyError()" (retry)="f.loadHistory(it)" />
          }
        </app-data-state>
      </div>
    </div>
    <app-record-dialog [(visible)]="dialog" [defaultProject]="f.current()?.project_id ?? ''" />
  `,
})
export class EkspertPage {
  protected readonly f = inject(EkspertFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly dialog = signal(false);
  protected readonly pageSize = PAGE_SIZE;
  private started = false;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => this.fromUrl(q.get('status'), q.get('typ'), q.get('strona'), q.get('poz')));
    effect(() => {
      const key = this.f.currentKey();
      if (key !== (this.route.snapshot.queryParamMap.get('poz') ?? null)) this.go({ poz: key });
    });
  }

  /** URL jest źródłem prawdy dla filtrów, strony i wybranej pozycji (`poz=typ:id`), więc widok można udostępnić linkiem. */
  private fromUrl(status: string | null, type: string | null, page: string | null, sel: string | null) {
    const s = (status ?? '') as ReviewStatus | '';
    const t = (type ?? '') as ReviewTargetType | '';
    const offset = Math.max(0, Number(page ?? 0) || 0) * PAGE_SIZE;
    if (!this.started || s !== this.f.status() || t !== this.f.type() || offset !== this.f.offset()) {
      this.started = true;
      this.f.status.set(s);
      this.f.type.set(t);
      this.f.offset.set(offset);
      this.f.loadQueue();
    }
    const i = sel?.indexOf(':') ?? -1;
    if (sel && i > 0) this.f.selectByKey(sel.slice(0, i) as ReviewTargetType, sel.slice(i + 1));
    else if (this.f.current()) this.f.clearSelection();
  }

  protected open(item: ReviewItem) { this.f.select(item); }

  protected setFilters(status: ReviewStatus | '', type: ReviewTargetType | '') {
    this.go({ status: status || null, typ: type || null, strona: null });
  }

  protected go(params: Record<string, string | number | null>) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
