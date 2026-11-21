import { Component, effect, inject, input, output, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExpertApi } from '../../core/api/apis';
import { ApiError, Decision, DecisionInput, ReviewItem } from '../../core/api/types';
import { EvidenceLink, StatusBadge } from '../../shared';

export const TARGET_LABELS = {
  project: 'Projekt', procedure: 'Postępowanie', part: 'Część zamówienia', notice: 'Ogłoszenie',
  contract: 'Umowa', contract_change: 'Zmiana umowy', document: 'Dokument', fact: 'Fakt',
  link: 'Powiązanie', risk: 'Zdarzenie lub ryzyko', recommendation: 'Rekomendacja', sector_rules: 'Wiedza sektorowa',
} as const;

export const ACTION_LABELS: Record<DecisionInput['action'], string> = {
  approve: 'Zatwierdź', correct: 'Zapisz korektę', reject: 'Odrzuć', request_evidence: 'Poproś o dowody',
};

export function parseObject(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Podaj obiekt JSON.');
  return parsed as Record<string, unknown>;
}

@Component({
  selector: 'app-review-item',
  imports: [FormsModule, JsonPipe, RouterLink, EvidenceLink, StatusBadge],
  template: `
    @let r = item();
    <section class="panel">
      <h2>{{ title(r) }}</h2>
      <div class="flex flex-wrap gap-2 items-center">
        <app-status-badge type="review" [value]="r.review_status" />
        <span>Rewizja {{ r.revision }}</span>
        @if (r.project_id; as p) { <a [routerLink]="['/projekty', p]">{{ p }}</a> }
      </div>
      @if (r.value['rationale']; as rationale) { <p>{{ rationale }}</p> }
      @if (r.value['event']; as event) { <p>{{ event }}</p> }
      @if (r.value['confidence']) { <p>Pewność: {{ confidence(r) }}</p> }
      <div>
        @for (e of r.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" [label]="e" /> }
      </div>
      <details>
        <summary class="cursor-pointer">Wszystkie dane rekordu</summary>
        <pre class="text-xs whitespace-pre-wrap break-all">{{ r.value | json }}</pre>
      </details>
      <form class="grid gap-2" (ngSubmit)="submit()">
        <label>Decyzja
          <select aria-label="Decyzja" class="block" name="action" [(ngModel)]="action">
            @for (entry of actions; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }
          </select>
        </label>
        @if (action === 'correct') {
          @if (r.target_type === 'link') {
            <label>Uzasadnienie dopasowania<input class="block w-full" name="rationale" [(ngModel)]="linkRationale" /></label>
            <label>Identyfikator docelowego rekordu<input class="block w-full" name="target" [(ngModel)]="linkTarget" /></label>
          }
          @if (r.target_type === 'document') {
            <label class="flex gap-2 items-center"><input type="checkbox" name="exemplar" [(ngModel)]="exemplar" /> Materiał wzorcowy</label>
          }
          <label>Zmiany pól w formacie JSON
            <textarea class="block w-full font-mono" name="changes" [(ngModel)]="changes" rows="5" spellcheck="false"></textarea>
          </label>
          <p class="text-sm text-muted-color">Wpisz dodatkowe pola do zastąpienia, korzystając z danych rekordu. Tablice są zastępowane w całości.</p>
        }
        <label>Powód decyzji<input class="block w-full" name="reason" required [(ngModel)]="reason" /></label>
        <button class="action" [disabled]="!reason.trim() || busy()">Zapisz decyzję</button>
      </form>
      @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
      @if (saved()) { <p role="status">Zapisano decyzję eksperta.</p> }
      <details (toggle)="loadHistory()">
        <summary class="cursor-pointer">Historia decyzji</summary>
        @for (d of history(); track d.id) {
          <article class="mt-2 border-t border-surface pt-2">
            <p><strong>{{ actionLabel[d.action] }}</strong> · {{ d.actor_id }} · {{ d.created_at }}</p>
            <p>{{ d.reason }}</p>
            <details>
              <summary class="cursor-pointer">Wartości przed i po decyzji</summary>
              <p>Rewizja {{ d.before.revision }}</p><pre class="text-xs whitespace-pre-wrap break-all">{{ d.before.value | json }}</pre>
              <p>Rewizja {{ d.after.revision }}</p><pre class="text-xs whitespace-pre-wrap break-all">{{ d.after.value | json }}</pre>
            </details>
          </article>
        } @empty { <p>Brak zapisanej historii.</p> }
        @if (more()) { <button class="action mt-2" (click)="loadHistory(true)">Pokaż starsze decyzje</button> }
      </details>
    </section>
  `,
})
export class ReviewItemPanel {
  readonly item = input.required<ReviewItem>();
  readonly decided = output<Decision>();
  private readonly api = inject(ExpertApi);
  protected readonly actions = Object.entries(ACTION_LABELS);
  protected readonly actionLabel = ACTION_LABELS;
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly history = signal<Decision[]>([]);
  protected readonly more = signal(false);
  protected action: DecisionInput['action'] = 'approve';
  protected reason = '';
  protected changes = '{}';
  protected linkTarget = '';
  protected linkRationale = '';
  protected exemplar = false;

  constructor() {
    effect(() => {
      const r = this.item();
      this.linkRationale = String(r.value['rationale'] ?? '');
      this.linkTarget = (r.value['to'] as { id: string } | undefined)?.id ?? '';
      this.exemplar = r.value['exemplar'] === true;
      this.reason = '';
      this.changes = '{}';
      this.error.set('');
    });
  }

  protected title(r: ReviewItem) {
    const label = TARGET_LABELS[r.target_type as keyof typeof TARGET_LABELS] ?? r.target_type;
    return `${label} · ${r.value['title'] ?? r.value['action'] ?? r.value['key'] ?? r.target_id}`;
  }

  protected confidence(r: ReviewItem) {
    const c = r.value['confidence'] as { level?: string; rationale?: string };
    return c.rationale ?? c.level ?? '';
  }

  protected submit() {
    const r = this.item();
    const decision: DecisionInput = {
      target_type: r.target_type, target_id: r.target_id, expected_revision: r.revision,
      action: this.action, reason: this.reason.trim(),
    };
    if (!decision.reason || this.busy()) return;
    try {
      if (this.action === 'correct') {
        const changes = parseObject(this.changes);
        if (r.target_type === 'document' && !('exemplar' in changes)) changes['exemplar'] = this.exemplar;
        if (r.target_type === 'link') {
          if (this.linkRationale !== r.value['rationale'] && !('rationale' in changes)) changes['rationale'] = this.linkRationale;
          const to = r.value['to'] as { type: string; id: string };
          if (this.linkTarget !== to.id && !('to' in changes)) changes['to'] = { ...to, id: this.linkTarget.trim() };
        }
        if (!Object.keys(changes).length) throw new Error('Wprowadź co najmniej jedną zmianę.');
        decision.changes = changes;
      }
    } catch (e) { this.error.set((e as Error).message); return; }
    this.error.set('');
    this.busy.set(true);
    this.api.decide(decision).subscribe({
      next: (d) => { this.busy.set(false); this.saved.set(true); this.decided.emit(d); this.loadHistory(); },
      error: (e: ApiError) => { this.busy.set(false); this.error.set(e.detail); },
    });
  }

  protected loadHistory(append = false) {
    const r = this.item();
    this.api.decisions({ target_type: r.target_type, target_id: r.target_id, limit: 20, offset: append ? this.history().length : 0 }).subscribe({
      next: (p) => {
        this.history.set(append ? [...this.history(), ...p.items] : p.items);
        this.more.set(this.history().length < p.total);
      },
      error: (e: ApiError) => this.error.set(e.detail),
    });
  }
}
