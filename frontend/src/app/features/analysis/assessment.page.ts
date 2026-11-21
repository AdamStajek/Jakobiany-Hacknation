import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AssessmentsApi, ProjectsApi } from '../../core/api/apis';
import { ApiError, Assessment, InformationCheck, ProjectDetail, Twin } from '../../core/api/types';
import { CONFIDENCE_LEVEL, MILESTONE_KIND } from '../../core/labels';
import { saveBlob } from '../../core/download';
import { ClaimBadge, EvidenceLink, MoneyAmount, PageHeader, StatusBadge } from '../../shared';

@Component({
  selector: 'app-assessment-page',
  imports: [RouterLink, PageHeader, StatusBadge, EvidenceLink, ClaimBadge, MoneyAmount],
  template: `
    @if (error()) { <p role="alert" class="text-red-600">{{ error() }}</p> }
    @if (loading()) { <p role="status">Wczytywanie analizy…</p> }
    @if (result(); as a) {
      <app-page-header title="Wynik analizy" [subtitle]="project()?.title ?? a.project_id" />
      <a class="block mb-3" [routerLink]="['/analiza']" [queryParams]="{ projekt: a.project_id }">Opis, dokumenty i historia</a>
      <div class="flex flex-wrap gap-3 mb-4">
        <button class="action" (click)="download(a.id, 'json')">Eksport JSON</button>
        <button class="action" (click)="download(a.id, 'csv')">Eksport CSV</button>
      </div>
      <section class="panel mb-4">
        <h2>Podsumowanie</h2>
        <p><strong>Zagrożenie:</strong> {{ threat[a.threat.level] }} · {{ a.threat.rationale }}</p>
        <p><strong>Kompletność:</strong> {{ a.completeness.score === null ? 'Brak właściwej checklisty' : percent(a.completeness.score) }}
            ({{ a.completeness.applicable_count }} pozycji)</p>
        <p class="text-muted-color text-sm">Rewizja projektu {{ a.snapshot.project_revision }} · wersja reguł {{ a.snapshot.sector_rules_revision }} · {{ a.created_at }}</p>
        <ul class="list-disc pl-5">@for (limit of a.limitations; track limit) { <li>{{ limit }}</li> }</ul>
      </section>
      <div class="grid gap-4 lg:grid-cols-2 mb-4">
        @for (dimension of dimensions; track dimension.key) {
          @let d = a.deviations[dimension.key];
          <section class="panel">
            <h2>{{ dimension.label }}</h2>
            <app-claim-badge kind="CALCULATED" />
            @if (d.interval; as interval) {
              <p>{{ interval.lower }} – {{ interval.upper }} {{ units[interval.unit] ?? interval.unit }}</p>
              <p>{{ interval.methodology }}</p>
            } @else {
              <p>Za mało porównywalnych danych, aby wyznaczyć przedział.</p>
            }
            <p>Próba: {{ d.sample_size }} · Braki: {{ d.missing_data_fraction === null ? 'brak próby' : percent(d.missing_data_fraction) }}</p>
            <p>Pewność {{ confidence[d.confidence.level] }} · {{ d.confidence.rationale }}</p>
            <div>@for (e of d.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }</div>
          </section>
        }
      </div>
      <section class="panel mb-4">
        <h2>Podobne zakończone inwestycje</h2>
        @for (t of twins(); track t.project_id) {
          <details class="border-b border-surface py-2">
            <summary class="cursor-pointer font-semibold">{{ t.project_id }} · podobieństwo {{ percent(t.score) }}</summary>
            <p>{{ t.explanation }} <a [routerLink]="['/projekty', t.project_id]">Karta przypadku</a></p>
            @for (f of t.compared_features; track f.feature) {
              <p>{{ f.direction === 'similar' ? 'Podobieństwo' : 'Różnica' }} · {{ f.explanation }}
                @for (e of f.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }
              </p>
            }
            @if (t.missing_features.length) { <p>Brak porównywalnych cech: {{ features(t.missing_features) }}.</p> }
            @for (m of t.comparable_amounts ?? []; track $index) {
              <app-money-amount [amount]="m" />
              @for (e of m.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }
            }
            @for (m of t.comparable_milestones ?? []; track $index) {
              <p>{{ milestone[m.kind] }} · {{ m.date }} @for (e of m.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }</p>
            }
            @if (t.related_event_ids.length) {
              <p><a [routerLink]="['/projekty', t.project_id]" [queryParams]="{ tab: 'risks' }">Zatwierdzone zdarzenia z przypadku ({{ t.related_event_ids.length }})</a></p>
            }
            <div>@for (e of t.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }</div>
          </details>
        } @empty { <p>Brak zakończonych przypadków z porównywalnymi cechami.</p> }
      </section>
      <section class="panel mb-4">
        <h2>Flagi ryzyka</h2>
        @for (r of a.risks; track r.id) {
          <article class="border-b border-surface py-2">
            <h3 class="font-semibold">{{ r.risk_code }} · {{ r.title }}</h3>
            <app-claim-badge [kind]="r.claim_type" /> <app-status-badge type="review" [value]="r.review_status" />
            <p>{{ r.event }}</p>
            @if (r.confidence; as c) { <p>Pewność {{ confidence[c.level] }} · {{ c.rationale }}</p> }
            @for (e of r.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }
          </article>
        } @empty { <p>W materiałach nie wykryto udokumentowanych sygnałów.</p> }
      </section>
      <section class="panel mb-4">
        <h2>Zagadnienia do sprawdzenia</h2>
        @for (g of gaps(); track g.id) {
          <article class="border-b border-surface py-2">
            <h3 class="font-semibold">{{ g.requirement.question }}</h3>
            <app-status-badge type="info" [value]="g.state" />
            <p>{{ g.explanation }}</p>
            @if (g.requested_information) { <p>Do uzupełnienia: {{ g.requested_information }}</p> }
            @for (e of g.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }
          </article>
        } @empty { <p>Brak checklisty dla tej fazy i podsektora.</p> }
      </section>
      <section class="panel">
        <h2>Działania i propozycje zapisów</h2>
        @for (r of a.recommendations; track r.id) {
          <article class="border-b border-surface py-2">
            <h3 class="font-semibold">{{ r.action }}</h3>
            <app-claim-badge [kind]="r.claim_type" /> <app-status-badge type="review" [value]="r.review_status" />
            <p>{{ r.rationale }}</p>
            @if (r.proposed_clause) { <blockquote class="pl-3 border-l">{{ r.proposed_clause }}</blockquote> }
            @if (r.confidence; as c) { <p>Pewność {{ confidence[c.level] }} · {{ c.rationale }}</p> }
            @for (e of r.evidence_ids; track e) { <app-evidence-link [evidenceId]="e" /> }
          </article>
        } @empty { <p>Dostępne dowody nie dają podstawy do rekomendacji.</p> }
      </section>
    }
  `,
})
export class AssessmentPage {
  readonly id = input.required<string>();
  private readonly api = inject(AssessmentsApi);
  private readonly projects = inject(ProjectsApi);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<Assessment | null>(null);
  protected readonly project = signal<ProjectDetail | null>(null);
  protected readonly twins = signal<Twin[]>([]);
  protected readonly gaps = signal<InformationCheck[]>([]);
  protected readonly percent = (n: number) => `${Math.round(n * 100)}%`;
  protected readonly confidence = CONFIDENCE_LEVEL;
  protected readonly milestone = MILESTONE_KIND;
  protected readonly threat = { low: 'Niskie', moderate: 'Umiarkowane', high: 'Wysokie', critical: 'Krytyczne', insufficient_evidence: 'Brak podstaw do oceny' };
  protected readonly units: Partial<Record<string, string>> = { days: 'dni', percent: '%' };
  protected readonly dimensions = [{ key: 'cost', label: 'Odchylenie kosztu' }, { key: 'time', label: 'Odchylenie terminu' }] as const;

  constructor() {
    effect((cleanup) => {
      const id = this.id();
      this.loading.set(true);
      this.error.set('');
      const request = forkJoin({ assessment: this.api.get(id), twins: this.api.twins(id), gaps: this.api.gaps(id) })
        .subscribe({
          next: ({ assessment, twins, gaps }) => {
            this.result.set(assessment);
            this.twins.set(twins);
            this.gaps.set(gaps);
            this.loading.set(false);
            request.add(this.projects.get(assessment.project_id).subscribe({
              next: (p) => this.project.set(p), error: (e: ApiError) => this.fail(e),
            }));
          },
          error: (e: ApiError) => this.fail(e),
        });
      cleanup(() => request.unsubscribe());
    });
  }

  protected features(values: string[]) {
    const labels: Record<string, string> = { subsector: 'podsektor', work_type: 'rodzaj robót', function: 'funkcja', technical: 'parametry techniczne',
      organization: 'organizacja', cost: 'koszt', schedule: 'harmonogram', location: 'lokalizacja', text: 'opis' };
    return values.map((v) => labels[v] ?? v).join(', ');
  }

  protected download(id: string, format: 'csv' | 'json') {
    this.api.export(id, format).subscribe({
      next: (r) => saveBlob(r, `analiza-${id}.${format}`), error: (e: ApiError) => this.fail(e),
    });
  }

  private fail(e: ApiError) { this.error.set(e.detail); this.loading.set(false); }
}
