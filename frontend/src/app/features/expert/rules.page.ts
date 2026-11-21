import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RulesApi } from '../../core/api/apis';
import { ApiError, ReviewItem, SectorRules, SectorRulesInput } from '../../core/api/types';
import { PageHeader, StatusBadge } from '../../shared';
import { ReviewItemPanel } from './review-item';

@Component({
  selector: 'app-rules-page',
  imports: [FormsModule, RouterLink, PageHeader, ReviewItemPanel, StatusBadge],
  template: `
    <app-page-header title="Wiedza sektorowa" subtitle="Zmieniaj opisy, kategorie ryzyka, checklisty i reguły stosowane w kolejnych analizach." />
    <a routerLink="/ekspert">Wróć do weryfikacji eksperckiej</a>
    <form class="panel my-4" (ngSubmit)="load()">
      <label for="sector-code">Kod sektora</label>
      <input id="sector-code" name="sector" [(ngModel)]="sector" required />
      <button class="action" [disabled]="busy() || !sector.trim()">Wczytaj sektor</button>
    </form>
    @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
    <div class="grid gap-4 xl:grid-cols-2">
      @if (draft(); as d) {
        <form class="panel" #rulesForm="ngForm" (ngSubmit)="propose(d)">
          <h2>Nowa wersja · {{ d.sector_code }}</h2>
          <label for="sector-description">Opis sektora</label>
          <textarea id="sector-description" name="description" [(ngModel)]="d.description" rows="3"></textarea>
          <h3 class="font-semibold">Katalog ryzyk</h3>
          @for (category of d.risk_categories; track category; let index = $index) {
            <fieldset class="grid gap-2 border-b border-surface pb-2">
              <legend>Kategoria {{ category.code || '(nowa)' }}</legend>
              <label>Kod <input class="block w-full" [name]="'code' + index" [(ngModel)]="category.code" required /></label>
              <label>Nazwa <input class="block w-full" [name]="'label' + index" [(ngModel)]="category.label" required /></label>
              <label>Opis <textarea class="block w-full" [name]="'description' + index" [(ngModel)]="category.description" rows="2"></textarea></label>
              <button type="button" class="text-sm underline justify-self-start" (click)="d.risk_categories.splice(index, 1)">Usuń kategorię z wersji roboczej</button>
            </fieldset>
          }
          <button type="button" class="action" (click)="d.risk_categories.push({ code: '', label: '', description: '' })">Dodaj kategorię</button>
          @for (entry of fields; track entry.key) {
            <details>
              <summary class="cursor-pointer">{{ entry.label }}</summary>
              <label class="block mt-2">{{ entry.label }} (JSON)
                <textarea class="block w-full font-mono" [name]="entry.key" [(ngModel)]="advanced[entry.key]" rows="9" spellcheck="false"></textarea>
              </label>
            </details>
          }
          <button class="action" [disabled]="busy() || rulesForm.invalid">Zgłoś wersję do zatwierdzenia</button>
          @if (notice()) { <p role="status">{{ notice() }}</p> }
        </form>
      }
      <div class="grid content-start gap-4">
        <section class="panel">
          <h2>Wersje zapisane w bazie</h2>
          @for (v of versions(); track v.id) {
            <button type="button" class="flex flex-wrap gap-2 items-center justify-between border-b border-surface py-2 text-left cursor-pointer"
              [attr.aria-pressed]="selected()?.target_id === v.id" (click)="select(v)">
              <span>{{ v.id }} · rewizja {{ v.revision }}</span><app-status-badge type="review" [value]="v.review_status" />
            </button>
          } @empty { <p>Brak zapisanych wersji dla tego sektora.</p> }
        </section>
        @if (selected(); as r) {
          @for (item of [r]; track item.target_id) { <app-review-item [item]="item" (decided)="selected.set($event.after); load(false)" /> }
        }
      </div>
    </div>
  `,
})
export class RulesPage {
  private readonly api = inject(RulesApi);
  protected readonly fields = [
    { key: 'subsectors', label: 'Typy inwestycji' }, { key: 'checklists', label: 'Checklisty według typu i fazy' },
    { key: 'comparison_weights', label: 'Wagi podobieństwa' }, { key: 'rules', label: 'Reguły i zalecenia' },
  ] as const;
  protected readonly advanced = { subsectors: '', checklists: '', comparison_weights: '', rules: '' };
  protected readonly versions = signal<SectorRules[]>([]);
  protected readonly draft = signal<SectorRulesInput | null>(null);
  protected readonly selected = signal<ReviewItem | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected sector = 'water_and_sewerage';

  constructor() { this.load(); }

  protected load(clear = true) {
    if (clear) { this.selected.set(null); this.notice.set(''); }
    this.error.set('');
    this.busy.set(true);
    const sector = this.sector.trim();
    this.api.list({ sector_code: sector, include_proposals: true }).subscribe({
      next: (versions) => {
        this.versions.set(versions);
        const v = versions.find((s) => s.review_status === 'approved' || s.review_status === 'corrected');
        const draft: SectorRulesInput = {
          sector_code: sector, based_on_id: v?.id, description: v?.description ?? '',
          risk_categories: structuredClone(v?.risk_categories ?? []), subsectors: v?.subsectors ?? [],
          checklists: v?.checklists ?? [], rules: v?.rules ?? [], comparison_weights: v?.comparison_weights ?? { text: 1 },
        };
        this.draft.set(draft);
        for (const { key } of this.fields) this.advanced[key] = JSON.stringify(draft[key], null, 2);
        this.busy.set(false);
      },
      error: (e: ApiError) => this.fail(e.detail),
    });
  }

  protected select(v: SectorRules) {
    this.selected.set({ target_id: v.id, target_type: 'sector_rules', review_status: v.review_status, revision: v.revision, value: v, evidence_ids: [] });
  }

  protected propose(draft: SectorRulesInput) {
    try {
      const data: SectorRulesInput = { ...draft,
        subsectors: JSON.parse(this.advanced.subsectors), checklists: JSON.parse(this.advanced.checklists),
        comparison_weights: JSON.parse(this.advanced.comparison_weights), rules: JSON.parse(this.advanced.rules),
      };
      this.busy.set(true);
      this.error.set('');
      this.notice.set('');
      this.api.propose(data).subscribe({
        next: (v) => { this.select(v); this.notice.set('Zapisano propozycję wersji. Możesz ją zatwierdzić w panelu decyzji.'); this.load(false); },
        error: (e: ApiError) => this.fail(e.detail),
      });
    } catch (e) { this.fail((e as Error).message); }
  }

  private fail(message: string) { this.error.set(message); this.busy.set(false); }
}
