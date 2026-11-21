import { Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { RulesApi } from '../../core/api/apis';
import { ApiError } from '../../core/api/types';
import { AuthService } from '../../core/auth.service';
import { DataState, PageHeader, StatusBadge } from '../../shared';
import { ChecklistEditor } from './components/checklist-editor';
import { RiskCatalogEditor } from './components/risk-catalog-editor';
import { WeightsEditor } from './components/weights-editor';
import { RulesDraft, SectorRules } from './rules.types';
import { activeRules, cloneDraft, sameDraft, validateDraft } from './rules-draft.util';

type TabId = 'risks' | 'checklists' | 'weights';

@Component({
  selector: 'app-ustawienia-page',
  imports: [ButtonModule, MessageModule, TabsModule, DataState, PageHeader, StatusBadge, RiskCatalogEditor, ChecklistEditor, WeightsEditor],
  template: `
    <app-page-header title="Ustawienia i wiedza ekspercka" subtitle="Katalog ryzyk, checklisty informacji i wagi podobieństwa – bez zmian w kodzie" priority="P0" />

    <app-data-state [loading]="loading()" [error]="error()" [empty]="!draft()" emptyText="Brak zatwierdzonej wiedzy sektorowej." (retry)="load()">
      @if (draft(); as d) {
        <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <span>Sektor: <strong>{{ d.sector_code }}</strong></span>
          @if (active(); as a) {
            <span>Obowiązująca wersja: <strong>{{ a.id }}</strong> (rewizja {{ a.revision }})</span>
            <app-status-badge type="review" [value]="a.review_status" />
          }
        </div>

        @if (!canEdit()) {
          <p-message severity="info" class="block mb-4">Podgląd tylko do odczytu. Zmiany wiedzy sektorowej zgłasza ekspert.</p-message>
        }
        @if (proposals().length) {
          <p-message severity="warn" class="block mb-4">
            Oczekujące propozycje zmian: {{ proposals().length }} ({{ proposalIds() }}). Aktywacja następuje po decyzji eksperta w kolejce zatwierdzeń.
          </p-message>
        }
        @if (conflict()) {
          <p-message severity="error" class="block mb-4">
            <div class="flex flex-col gap-2" role="alert">
              <span>Wersja bazowa została zmieniona przez inną osobę (<code>stale_sector_rules</code>). Możesz zastosować swoje zmiany do aktualnej wersji albo je odrzucić.</span>
              <span class="flex gap-2">
                <p-button label="Zachowaj moje zmiany na nowej wersji" size="small" (onClick)="rebase()" />
                <p-button label="Odrzuć moje zmiany" size="small" severity="secondary" (onClick)="discard()" />
              </span>
            </div>
          </p-message>
        }

        <p-tabs [value]="tab()" (valueChange)="setTab($event)">
          <p-tablist>
            <p-tab value="risks">Katalog ryzyk ({{ d.risk_categories.length }})</p-tab>
            <p-tab value="checklists">Checklisty</p-tab>
            <p-tab value="weights">Wagi podobieństwa</p-tab>
          </p-tablist>
        </p-tabs>

        <div class="mt-4">
          @switch (tab()) {
            @case ('risks') { <app-risk-catalog-editor [categories]="d.risk_categories" (categoriesChange)="patch({ risk_categories: $event })" [readonly]="!canEdit()" /> }
            @case ('checklists') {
              <app-checklist-editor [checklists]="d.checklists" (checklistsChange)="patch({ checklists: $event })" [subsectors]="d.subsectors" [riskCodes]="riskCodes()" [readonly]="!canEdit()" />
            }
            @case ('weights') { <app-weights-editor [weights]="d.comparison_weights" (weightsChange)="patch({ comparison_weights: $event })" [readonly]="!canEdit()" /> }
          }
        </div>

        @if (canEdit()) {
          <div class="mt-6 pt-4 border-t border-surface flex flex-col gap-3">
            @if (errors().length && dirty()) {
              <ul class="m-0 pl-5 text-sm text-red-600" role="alert">@for (e of errors(); track e) { <li>{{ e }}</li> }</ul>
            }
            @if (serverErrors().length) {
              <ul class="m-0 pl-5 text-sm text-red-600" role="alert">@for (e of serverErrors(); track e) { <li>{{ e }}</li> }</ul>
            }
            <div class="flex items-center gap-3 flex-wrap">
              <p-button label="Zgłoś propozycję zmian" icon="pi pi-send" [disabled]="!dirty() || errors().length > 0 || saving() || conflict()" [loading]="saving()" (onClick)="save()" />
              <p-button label="Cofnij zmiany" severity="secondary" [text]="true" [disabled]="!dirty() || saving()" (onClick)="discard()" />
              <small class="text-muted-color">Zmiana nie wchodzi w życie od razu – trafia do kolejki zatwierdzenia przez eksperta.</small>
            </div>
          </div>
        }
      }
    </app-data-state>
  `,
})
export class UstawieniaPage {
  private readonly api = inject(RulesApi);
  private readonly toast = inject(MessageService);
  private readonly auth = inject(AuthService);

  protected readonly tab = signal<TabId>('risks');
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly saving = signal(false);
  protected readonly conflict = signal(false);
  protected readonly serverErrors = signal<string[]>([]);

  protected readonly active = signal<SectorRules | null>(null);
  protected readonly proposals = signal<SectorRules[]>([]);
  protected readonly draft = signal<RulesDraft | null>(null);

  protected readonly canEdit = computed(() => this.auth.can('edit-rules'));
  protected readonly dirty = computed(() => {
    const a = this.active(); const d = this.draft();
    return !!a && !!d && !sameDraft(cloneDraft(a), d);
  });
  protected readonly errors = computed(() => (this.draft() ? validateDraft(this.draft()!) : []));
  protected readonly riskCodes = computed(() => (this.draft()?.risk_categories ?? []).map((c) => c.code.trim()).filter(Boolean));
  protected readonly proposalIds = computed(() => this.proposals().map((p) => p.id).join(', '));

  constructor() { this.load(); }

  protected setTab(v: string | number | undefined) {
    if (v === 'risks' || v === 'checklists' || v === 'weights') this.tab.set(v);
  }

  protected load(keepDraft = false) {
    this.loading.set(true);
    this.error.set(null);
    const prev = this.draft();
    this.api.list({ include_proposals: this.auth.role() === 'expert' }).subscribe({
      next: (items) => {
        const a = activeRules(items);
        this.active.set(a);
        this.proposals.set(items.filter((x) => x.review_status === 'proposed'));
        const fresh = a ? cloneDraft(a) : null;
        this.draft.set(keepDraft && prev && fresh ? { ...prev, based_on_id: fresh.based_on_id } : fresh);
        this.loading.set(false);
      },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  protected patch(p: Partial<RulesDraft>) {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
    this.serverErrors.set([]);
  }

  protected save() {
    const d = this.draft(); const a = this.active();
    if (!d || !a) return;
    this.saving.set(true);
    this.serverErrors.set([]);
    this.api.propose({ ...d, based_on_id: a.id }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: 'Propozycja zgłoszona', detail: `Wersja ${created.id} czeka na zatwierdzenie w kolejce eksperta. Do tego czasu obowiązuje ${a.id}.` });
        this.load();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        if (e.status === 409 && e.code === 'stale_sector_rules') { this.conflict.set(true); return; }
        this.serverErrors.set(e.fieldErrors.length ? e.fieldErrors.map((f) => f.message) : [e.detail]);
      },
    });
  }

  /** Po 409: pobierz aktualną wersję, zachowując wprowadzone zmiany. */
  protected rebase() { this.conflict.set(false); this.load(true); }
  protected discard() { this.conflict.set(false); this.serverErrors.set([]); this.load(); }
}
