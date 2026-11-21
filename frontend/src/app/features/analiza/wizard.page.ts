import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProjectsApi } from '../../core/api/apis';
import { ApiError, Project, ProjectDetail } from '../../core/api/types';
import { DataState, PageHeader } from '../../shared';
import { DocumentsStep } from './documents-step';
import { ProjectStep } from './project-step';
import { RunStep } from './run-step';

const STEPS = ['Projekt', 'Dokumenty', 'Analiza'] as const;

/** Kreator „Nowa inwestycja”: projekt → dokumenty → analiza. Stan (projekt i krok) w adresie URL. */
@Component({
  selector: 'app-wizard-page',
  imports: [PageHeader, DataState, ButtonModule, RouterLink, ProjectStep, DocumentsStep, RunStep],
  template: `
    <app-page-header title="Nowa inwestycja" subtitle="Opisz planowane przedsięwzięcie, dodaj dokumenty i uruchom analizę" priority="P0" />

    <nav aria-label="Kroki" class="mb-6">
      <ol class="flex flex-wrap gap-2 m-0 p-0 list-none">
        @for (s of steps; track s; let i = $index) {
          <li>
            <button type="button" class="px-3 py-1.5 rounded-full border text-sm cursor-pointer"
                    [class.font-bold]="step() === i + 1" [class.border-primary]="step() === i + 1"
                    [disabled]="i > 0 && !project()" [attr.aria-current]="step() === i + 1 ? 'step' : null" (click)="go(i + 1)">
              {{ i + 1 }}. {{ s }}
            </button>
          </li>
        }
      </ol>
    </nav>

    <app-data-state [loading]="loading()" [error]="error()" (retry)="load()">
      @switch (step()) {
        @case (1) { <app-project-step [project]="project()" (saved)="saved($event)" (reload)="load()" /> }
        @case (2) {
          @if (project(); as p) {
            <app-documents-step [project]="p" (changed)="load()" />
            <div class="flex gap-2 mt-4">
              <p-button label="Wstecz" icon="pi pi-arrow-left" severity="secondary" (onClick)="go(1)" />
              <p-button label="Dalej" icon="pi pi-arrow-right" iconPos="right" (onClick)="go(3)" />
            </div>
          }
        }
        @case (3) {
          @if (project(); as p) {
            <app-run-step [project]="p" />
            <div class="mt-4"><p-button label="Wstecz" icon="pi pi-arrow-left" severity="secondary" (onClick)="go(2)" /></div>
          }
        }
      }
    </app-data-state>
    @if (project(); as p) {
      <p class="mt-6 text-sm text-muted-color">Projekt: <a [routerLink]="['/projekty', p.id]">{{ p.title }}</a> · rewizja {{ p.revision }}</p>
    }
  `,
})
export class WizardPage {
  /** Parametry zapytania (withComponentInputBinding). */
  readonly projekt = input<string | undefined>();
  readonly krok = input<string | undefined>();

  private readonly api = inject(ProjectsApi);
  private readonly router = inject(Router);
  protected readonly steps = STEPS;
  protected readonly project = signal<ProjectDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly step = computed(() => {
    if (!this.projekt()) return 1;
    const n = Number(this.krok());
    return n >= 1 && n <= 3 ? n : 2;
  });

  constructor() {
    effect(() => { this.projekt(); this.load(); });
  }

  protected load() {
    const id = this.projekt();
    if (!id) { this.project.set(null); return; }
    this.loading.set(!this.project());
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (p) => { this.project.set(p); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  protected go(step: number) {
    this.router.navigate([], { queryParams: { projekt: this.projekt() ?? null, krok: step }, queryParamsHandling: 'merge' });
  }

  protected saved(p: Project) {
    this.router.navigate([], { queryParams: { projekt: p.id, krok: 2 } });
    if (this.projekt() === p.id) this.load();
  }
}
