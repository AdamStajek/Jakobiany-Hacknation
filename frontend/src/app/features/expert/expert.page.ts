import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExpertApi } from '../../core/api/apis';
import { ApiError, Decision, ReviewItem } from '../../core/api/types';
import { REVIEW_STATUS } from '../../core/labels';
import { PageHeader, StatusBadge } from '../../shared';
import { ReviewItemPanel, TARGET_LABELS, parseObject } from './review-item';

@Component({
  selector: 'app-expert-page',
  imports: [FormsModule, RouterLink, PageHeader, StatusBadge, ReviewItemPanel],
  template: `
    <app-page-header title="Weryfikacja ekspercka" subtitle="Sprawdź dowody, oceń dopasowania i zatwierdź lub popraw ustalenia." />
    <a [routerLink]="['/ustawienia']">Katalog ryzyk i wiedza sektorowa</a>
    <form class="panel my-4" (ngSubmit)="load(0)">
      <div class="flex flex-wrap items-end gap-3">
        <label>Projekt <input class="block" name="project" [(ngModel)]="projectId" placeholder="Identyfikator (opcjonalny)" /></label>
        <label>Typ rekordu <select aria-label="Typ rekordu" class="block" name="kind" [(ngModel)]="kind">
          <option value="">Wszystkie typy</option>
          @for (entry of targetTypes; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }
        </select></label>
        <label>Stan <select aria-label="Stan" class="block" name="state" [(ngModel)]="state">
          <option value="">Do weryfikacji</option><option value="all">Wszystkie rekordy</option>
          @for (entry of states; track entry[0]) { <option [value]="entry[0]">{{ entry[1].label }}</option> }
        </select></label>
        <button class="action" style="align-self: end" [disabled]="loading()">Filtruj rekordy</button>
      </div>
    </form>
    @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
    <div class="grid gap-4 xl:grid-cols-2">
      <section class="panel">
        <h2>Rekordy ({{ total() }})</h2>
        @if (loading()) { <p role="status">Wczytywanie rekordów…</p> }
        @for (r of records(); track r.target_id) {
          <button type="button" class="flex flex-wrap items-center justify-between gap-2 text-left border-b border-surface py-2 cursor-pointer"
            [attr.aria-pressed]="selected()?.target_id === r.target_id" (click)="selected.set(r)">
            <span>{{ label(r) }}<small class="block text-muted-color">{{ r.project_id ?? r.target_id }}</small></span>
            <app-status-badge type="review" [value]="r.review_status" />
          </button>
        } @empty { @if (!loading()) { <p>Brak rekordów dla wybranych filtrów.</p> } }
        <div class="flex gap-2">
          <button class="action" [disabled]="offset() === 0 || loading()" (click)="load(offset() - limit)">Poprzednia</button>
          <button class="action" [disabled]="offset() + limit >= total() || loading()" (click)="load(offset() + limit)">Następna</button>
        </div>
      </section>
      @if (selected(); as r) {
        @for (item of [r]; track item.target_id) { <app-review-item [item]="item" (decided)="decided($event)" /> }
      }
    </div>
    <details class="panel mt-4">
      <summary class="cursor-pointer font-semibold">Dodaj fakt, powiązanie, zdarzenie lub rekomendację</summary>
      <form class="grid gap-2 mt-2" (ngSubmit)="create()">
        <label>Projekt <input class="block" name="newProject" [(ngModel)]="projectId" required /></label>
        <label>Typ nowego rekordu <select aria-label="Typ nowego rekordu" class="block" name="newKind" [(ngModel)]="newKind" (ngModelChange)="example()">
          <option value="fact">Fakt</option><option value="risk">Zdarzenie lub ryzyko</option>
          <option value="link">Powiązanie</option><option value="recommendation">Rekomendacja</option>
        </select></label>
        <label>Pola rekordu i identyfikatory dowodów
          <textarea class="block w-full font-mono" name="newValue" rows="9" [(ngModel)]="newValue"></textarea>
        </label>
        <button class="action" [disabled]="!projectId.trim() || creating()">Dodaj propozycję</button>
        @if (createError()) { <p class="text-red-600" role="alert">{{ createError() }}</p> }
      </form>
    </details>
  `,
})
export class ExpertPage {
  readonly projekt = input<string>();
  private readonly api = inject(ExpertApi);
  private request?: ReturnType<ReturnType<ExpertApi['reviews']>['subscribe']>;
  protected readonly states = Object.entries(REVIEW_STATUS);
  protected readonly targetTypes = Object.entries(TARGET_LABELS);
  protected readonly records = signal<ReviewItem[]>([]);
  protected readonly selected = signal<ReviewItem | null>(null);
  protected readonly loading = signal(false);
  protected readonly creating = signal(false);
  protected readonly error = signal('');
  protected readonly createError = signal('');
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 15;
  protected projectId = '';
  protected kind = '';
  protected state = '';
  protected newKind: 'fact' | 'risk' | 'link' | 'recommendation' = 'fact';
  protected newValue = '';

  constructor() {
    effect(() => {
      const id = this.projekt();
      this.projectId = id ?? '';
      this.state = id ? 'all' : '';
      this.example();
      this.load(0, true);
    });
  }

  protected label(r: ReviewItem) {
    return r.value['title'] ?? r.value['action'] ?? r.value['key'] ?? TARGET_LABELS[r.target_type as keyof typeof TARGET_LABELS];
  }

  protected load(offset: number, clear = true) {
    this.request?.unsubscribe();
    if (clear) this.selected.set(null);
    this.error.set('');
    this.offset.set(offset);
    this.loading.set(true);
    this.request = this.api.reviews({
      project_id: this.projectId.trim(), target_type: this.kind, review_status: this.state === 'all' ? '' : this.state,
      include_all: this.state === 'all', limit: this.limit, offset,
    }).subscribe({
      next: (p) => { this.records.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: (e: ApiError) => { this.loading.set(false); this.error.set(e.detail); },
    });
  }

  protected decided(d: Decision) {
    this.selected.set(d.after);
    this.load(this.offset(), false);
  }

  protected example() {
    const project = { type: 'project', id: this.projectId || 'ID projektu' };
    const set = {
      fact: { key: 'nazwa_pola', subject: project, value: 'wartość', claim_type: 'SOURCE_FACT' },
      risk: { risk_code: 'R03', title: '', event: '', kind: 'OBSERVED_EVENT', causes: [], impacts: [], measures: [], claim_type: 'MODEL_INFERENCE' },
      link: { from: project, to: { type: 'procedure', id: 'ID postępowania' }, relation: 'project_has_procedure',
        method: 'expert', rationale: '', signals: [] },
      recommendation: { kind: 'proposed_clause', action: '', proposed_clause: '', rationale: '', related_to: [project], claim_type: 'MODEL_INFERENCE' },
    };
    this.newValue = JSON.stringify({
      ...set[this.newKind], confidence: { level: 'moderate', rationale: 'Opisz podstawę oceny.' },
      evidence_ids: ['ID dowodu'],
    }, null, 2);
  }

  protected create() {
    this.createError.set('');
    try {
      const value = parseObject(this.newValue);
      this.creating.set(true);
      this.api.createRecord({ target_type: this.newKind, project_id: this.projectId.trim(), value }).subscribe({
        next: (r) => { this.creating.set(false); this.selected.set(r); this.load(0, false); },
        error: (e: ApiError) => { this.creating.set(false); this.createError.set(e.detail); },
      });
    } catch (e) { this.createError.set((e as Error).message); }
  }
}
