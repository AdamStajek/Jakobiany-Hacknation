import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AssessmentsApi, ProjectsApi, RulesApi } from '../../core/api/apis';
import { ApiError, Assessment, Job, ProjectDetail, ProjectInput, SectorRules, asSource } from '../../core/api/types';
import { DocumentUpload } from '../../shared/document-upload';
import { JobProgress, PageHeader } from '../../shared';
import { EXTRACTION_STATUS, PHASE_LABEL, WORK_TYPE_LABEL } from '../../core/labels';

const PILOT_SECTOR = 'water_and_sewerage';

@Component({
  selector: 'app-analysis-page',
  imports: [FormsModule, RouterLink, PageHeader, DocumentUpload, JobProgress],
  template: `
    <app-page-header title="Nowa inwestycja" subtitle="Porównaj plan z zakończonymi inwestycjami na podstawie opisu, dokumentów lub obu." />
    <div class="grid gap-4 xl:grid-cols-2">
      <form class="panel" (ngSubmit)="save()">
        <h2>Opis inwestycji</h2>
        <label for="title">Nazwa inwestycji</label>
        <input id="title" name="title" required [(ngModel)]="form.title" />
        <label for="description">Opis (opcjonalny przy analizie dokumentu)</label>
        <textarea id="description" name="description" rows="5" [(ngModel)]="form.description"
          placeholder="Opisz zakres robót, miejsce, parametry sieci, budżet i planowany termin."></textarea>
        <label for="phase">Faza</label>
        <select id="phase" name="phase" [(ngModel)]="form.phase">
          @for (entry of phases; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }
        </select>
        <label for="subsector">Główny podsektor (opcjonalny)</label>
        <select id="subsector" name="subsector" [(ngModel)]="subsector">
          <option value="">Rozpoznaj na podstawie materiałów</option>
          @for (item of subsectors(); track item.code) { <option [value]="item.code">{{ item.label }}</option> }
        </select>
        <label for="work-type">Rodzaj robót (opcjonalny)</label>
        <select id="work-type" name="workType" [(ngModel)]="form.work_type">
          <option [ngValue]="undefined">Nie określono</option>
          @for (entry of workTypes; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }
        </select>
        <button class="action" [disabled]="!form.title.trim() || busy()">Zapisz projekt</button>
      </form>
      @if (project(); as p) {
        <div class="grid gap-4 content-start">
          <app-document-upload [projectId]="p.id" [documents]="p.documents" (changed)="load(p.id, false)" (processing)="uploading.set($event)" />
          <section class="panel">
            <h2>Materiały do analizy</h2>
            <p>Analiza wykorzysta zapisany opis i zaznaczone wersje dokumentów.</p>
            @for (d of p.documents; track d.id) {
              @for (v of d.versions; track v.id) {
                <label class="flex items-center gap-2">
                  <input type="checkbox" [checked]="selected.has(v.id)" [disabled]="v.extraction_status !== 'ready' || busy()"
                    (change)="choose(d, v.id)" />
                  {{ fileName(v) }} · wersja {{ v.revision }} @if (v.extraction_status !== 'ready') { · {{ extraction[v.extraction_status].label }} }
                </label>
              }
            }
            <button type="button" class="action" [disabled]="busy() || uploading() || (!p.description?.trim() && !selected.size)" (click)="analyse(p.id)">Uruchom analizę</button>
            <a [routerLink]="['/projekty', p.id]">Karta projektu</a>
            <app-job-progress [location]="location()" (finishedJob)="complete($event)" (trackingError)="fail($event)" />
          </section>
          @if (history().length) {
            <section class="panel">
              <h2>Poprzednie analizy</h2>
              @for (a of history(); track a.id) {
                <a [routerLink]="['/analiza/wynik', a.id]">{{ a.created_at }} · rewizja projektu {{ a.snapshot.project_revision }}</a>
              }
            </section>
          }
        </div>
      }
    </div>
    @if (error()) { <p class="mt-4 text-red-600" role="alert">{{ error() }}</p> }
  `,
})
export class AnalysisPage {
  readonly projekt = input<string>();
  private readonly projects = inject(ProjectsApi);
  private readonly assessments = inject(AssessmentsApi);
  private readonly rules = inject(RulesApi);
  private readonly router = inject(Router);

  protected form: ProjectInput = { title: '', phase: 'planning', sector_code: PILOT_SECTOR };
  protected subsector = '';
  protected readonly selected = new Set<string>();
  protected readonly phases = Object.entries(PHASE_LABEL);
  protected readonly workTypes = Object.entries(WORK_TYPE_LABEL);
  protected readonly extraction = EXTRACTION_STATUS;
  protected readonly subsectors = signal<SectorRules['subsectors']>([]);
  protected readonly history = signal<Assessment[]>([]);
  protected readonly project = signal<ProjectDetail | null>(null);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal('');
  protected readonly location = signal<string | null>(null);
  protected readonly fileName = (v: ProjectDetail['documents'][number]['versions'][number]) => asSource(v.source).name ?? v.document_id;

  constructor() {
    this.rules.list().subscribe({ next: (s) => this.subsectors.set(s.at(-1)?.subsectors ?? []), error: (e: ApiError) => this.fail(e.detail) });
    effect(() => {
      const id = this.projekt();
      this.location.set(null);
      if (id) this.load(id, true);
      else {
        this.project.set(null);
        this.form = { title: '', phase: 'planning', sector_code: PILOT_SECTOR };
        this.subsector = '';
        this.history.set([]);
      }
    });
  }

  protected load(id: string, reset: boolean) {
    this.projects.get(id).subscribe({
      next: (p) => {
        if (p.kind !== 'planned') { this.fail('Wybierz projekt planowany.'); return; }
        this.project.set(p);
        if (reset) {
          this.form = { title: p.title, description: p.description, phase: p.phase ?? 'planning',
            work_type: p.work_type, sector_code: p.sector_code ?? PILOT_SECTOR };
          this.subsector = p.primary_subsector_codes?.[0] ?? '';
        }
        this.selected.clear();
        for (const d of p.documents) {
          const v = d.versions.find((version) => version.id === d.current_version_id);
          if (v?.extraction_status === 'ready') this.selected.add(v.id);
        }
      },
      error: (e: ApiError) => this.fail(e.detail),
    });
    if (reset) this.assessments.list({ project_id: id }).subscribe({
      next: (p) => this.history.set(p.items), error: (e: ApiError) => this.fail(e.detail),
    });
  }

  protected save() {
    const p = this.project();
    const body: ProjectInput = {
      ...this.form, title: this.form.title.trim(),
      primary_subsector_codes: this.subsector
        ? [this.subsector, ...(p?.primary_subsector_codes ?? []).slice(1).filter((code) => code !== this.subsector)] : [],
      secondary_subsector_codes: p?.secondary_subsector_codes,
    };
    this.busy.set(true);
    this.error.set('');
    const request = p ? this.projects.update(p.id, body, p.revision) : this.projects.create(body);
    request.subscribe({
      next: (saved) => {
        this.busy.set(false);
        if (p) this.load(p.id, true);
        else void this.router.navigate(['/analiza'], { queryParams: { projekt: saved.id } });
      },
      error: (e: ApiError) => this.fail(e.detail),
    });
  }

  protected choose(d: ProjectDetail['documents'][number], id: string) {
    if (this.selected.delete(id)) return;
    d.versions.forEach((v) => this.selected.delete(v.id));
    this.selected.add(id);
  }

  protected analyse(id: string) {
    this.busy.set(true);
    this.error.set('');
    this.location.set(null);
    this.assessments.create({ project_id: id, document_version_ids: [...this.selected] }).subscribe({
      next: (a) => this.location.set(a.location), error: (e: ApiError) => this.fail(e.detail),
    });
  }

  protected complete(job: Job) {
    this.busy.set(false);
    const result = job.results.find((r) => r.resource_type === 'assessment');
    if (result) void this.router.navigate(['/analiza/wynik', result.resource_id]);
  }

  protected fail(message: string) { this.error.set(message); this.busy.set(false); }
}
