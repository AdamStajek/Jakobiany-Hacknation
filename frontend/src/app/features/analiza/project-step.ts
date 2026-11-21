import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { SubsectorOption, SubsectorsApi } from '../../core/api/analysis-api';
import { ProjectsApi } from '../../core/api/apis';
import { ApiError, Project, ProjectDetail, ProjectInput } from '../../core/api/types';
import { PHASE_LABEL, WORK_TYPE_LABEL } from '../../core/labels';
import { errorText } from './analiza.util';

type WorkType = NonNullable<ProjectInput['work_type']>;
type Phase = NonNullable<ProjectInput['phase']>;
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

/** Krok 1: formularz projektu (POST dla nowego, PUT z expected_revision dla istniejącego). */
@Component({
  selector: 'app-project-step',
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, TextareaModule],
  template: `
    <form class="flex flex-col gap-4 max-w-3xl" (ngSubmit)="save()">
      <div class="flex flex-col gap-1">
        <label for="p-title" class="font-semibold">Nazwa inwestycji *</label>
        <input id="p-title" pInputText name="title" [(ngModel)]="title" required [attr.aria-invalid]="touched() && !title().trim()" />
        @if (touched() && !title().trim()) { <small class="text-red-600" role="alert">Podaj nazwę inwestycji.</small> }
      </div>
      <div class="flex flex-col gap-1">
        <label for="p-desc" class="font-semibold">Opis</label>
        <textarea id="p-desc" pTextarea rows="6" name="description" [(ngModel)]="description"
                  placeholder="Zakres, lokalizacja, odbiorcy, zasilanie, uwarunkowania terenowe i środowiskowe…"></textarea>
        <small class="text-muted-color">Im pełniejszy opis, tym mniej luk w analizie.</small>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="flex flex-col gap-1">
          <label for="p-phase" class="font-semibold">Faza</label>
          <p-select inputId="p-phase" name="phase" [options]="phases" optionLabel="label" optionValue="value" [(ngModel)]="phase" [showClear]="true" placeholder="Wybierz fazę" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="p-sub" class="font-semibold">Podsektor</label>
          <p-select inputId="p-sub" name="subsector" [options]="subsectors()" optionLabel="label" optionValue="code" [(ngModel)]="subsector" [showClear]="true" placeholder="Wybierz podsektor" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="p-work" class="font-semibold">Rodzaj prac</label>
          <p-select inputId="p-work" name="work" [options]="workTypes" optionLabel="label" optionValue="value" [(ngModel)]="workType" [showClear]="true" placeholder="Wybierz rodzaj prac" />
        </div>
      </div>

      @if (error(); as e) {
        <div class="flex flex-col items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950" role="alert">
          <span><i class="pi pi-times-circle"></i> {{ message(e) }}</span>
          @for (f of e.fieldErrors; track $index) { <span class="text-sm">{{ f.field }}: {{ f.message }}</span> }
          @if (e.code === 'stale_revision') {
            <p-button label="Wczytaj aktualną wersję" icon="pi pi-refresh" size="small" severity="secondary" (onClick)="reload.emit()" />
          }
        </div>
      }
      <div><p-button type="submit" [label]="project() ? 'Zapisz i przejdź dalej' : 'Utwórz projekt i przejdź dalej'" icon="pi pi-arrow-right" iconPos="right" [loading]="saving()" /></div>
    </form>
  `,
})
export class ProjectStep {
  readonly project = input<ProjectDetail | null>(null);
  readonly saved = output<Project>();
  readonly reload = output<void>();

  private readonly api = inject(ProjectsApi);
  protected readonly phases = opts(PHASE_LABEL);
  protected readonly workTypes = opts(WORK_TYPE_LABEL);
  protected readonly subsectors = signal<SubsectorOption[]>([]);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly phase = signal<string | null>(null);
  protected readonly subsector = signal<string | null>(null);
  protected readonly workType = signal<string | null>(null);
  protected readonly touched = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly message = errorText;
  private readonly valid = computed(() => !!this.title().trim());

  constructor() {
    inject(SubsectorsApi).list().subscribe({ next: (s) => this.subsectors.set(s), error: () => this.subsectors.set([]) });
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.title.set(p.title);
      this.description.set(p.description ?? '');
      this.phase.set(p.phase ?? null);
      this.subsector.set(p.primary_subsector_codes?.[0] ?? null);
      this.workType.set(p.work_type ?? null);
      this.error.set(null);
    });
  }

  protected save() {
    this.touched.set(true);
    if (!this.valid()) return;
    const body: ProjectInput = {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      phase: (this.phase() as Phase | null) ?? undefined,
      sector_code: this.project()?.sector_code ?? 'water_and_sewerage',
      primary_subsector_codes: this.subsector() ? [this.subsector()!] : undefined,
      work_type: (this.workType() as WorkType | null) ?? undefined,
    };
    const p = this.project();
    this.saving.set(true);
    this.error.set(null);
    (p ? this.api.update(p.id, body, p.revision) : this.api.create(body)).subscribe({
      next: (res) => { this.saving.set(false); this.saved.emit(res); },
      error: (e: ApiError) => { this.saving.set(false); this.error.set(e); },
    });
  }
}
