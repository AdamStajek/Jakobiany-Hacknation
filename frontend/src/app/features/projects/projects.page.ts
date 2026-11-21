import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { Subject, debounceTime } from 'rxjs';
import { ImportsApi, ProjectsApi } from '../../core/api/apis';
import { newIdempotencyKey } from '../../core/api/api-client';
import { ApiError, Job, Project } from '../../core/api/types';
import { CanDirective } from '../../core/can.directive';
import { AuthService } from '../../core/auth.service';
import { MATCH_STATUS, PROJECT_STATUS } from '../../core/labels';
import { DataState, JobProgress, PageHeader, StatusBadge } from '../../shared';
import { ID_SCHEMES, IdScheme, validateIdentifier } from './identifier';

const LIMIT = 10;
const opts = (m: Record<string, { label: string }>) => Object.entries(m).map(([value, v]) => ({ value, label: v.label }));

/** Repozytorium projektów: wyszukiwanie po BZP/KPO, filtry w URL, import i ponowne wzbogacanie. */
@Component({
  selector: 'app-projects-page',
  imports: [PageHeader, DataState, TableModule, StatusBadge, RouterLink, FormsModule, ButtonModule, DialogModule,
    InputTextModule, SelectModule, SelectButtonModule, JobProgress, CanDirective],
  template: `
    <app-page-header title="Projekty" subtitle="Repozytorium historycznych inwestycji" />

    <form class="flex flex-wrap items-end gap-3 p-4 mb-4 rounded-lg border border-surface bg-surface-0 dark:bg-surface-900" (ngSubmit)="lookup()">
      <div class="flex flex-col gap-1">
        <label class="text-sm font-semibold" id="id-scheme-label">Znajdź po identyfikatorze</label>
        <p-selectbutton [options]="schemes" optionLabel="label" optionValue="value" [allowEmpty]="false"
                        [(ngModel)]="scheme" name="scheme" ariaLabelledBy="id-scheme-label" />
      </div>
      <div class="flex flex-col gap-1 grow min-w-64">
        <input pInputText name="identifier" [(ngModel)]="identifier" [placeholder]="hint()" aria-label="Numer identyfikatora"
               [attr.aria-invalid]="!!idError()" />
        @if (idError(); as e) { <small class="text-red-600" role="alert">{{ e }}</small> }
      </div>
      <p-button type="submit" label="Pokaż projekt" icon="pi pi-search" />
    </form>

    @if (notFoundId(); as nf) {
      <div class="flex flex-wrap items-center gap-3 p-4 mb-4 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950" role="status">
        <i class="pi pi-info-circle"></i>
        <span>Nie ma w bazie projektu o identyfikatorze <b>{{ nf }}</b>.</span>
        <p-button *can="'import'" label="Importuj dane" icon="pi pi-upload" size="small" severity="secondary" (onClick)="openImport()" />
      </div>
    }

    <div class="flex flex-wrap items-end gap-3 mb-4">
      <span class="flex flex-col gap-1">
        <label class="text-sm" for="q">Szukaj</label>
        <input id="q" pInputText [ngModel]="q()" (ngModelChange)="onSearch($event)" placeholder="Tytuł lub identyfikator" />
      </span>
      <span class="flex flex-col gap-1">
        <label class="text-sm" id="status-l">Status projektu</label>
        <p-select [options]="statusOptions" optionLabel="label" optionValue="value" [showClear]="true" placeholder="Wszystkie"
                  [ngModel]="status()" (ngModelChange)="setFilter('status', $event)" ariaLabelledBy="status-l" />
      </span>
      <span class="flex flex-col gap-1">
        <label class="text-sm" id="enr-l">Wzbogacenie</label>
        <p-select [options]="enrichOptions" optionLabel="label" optionValue="value" [showClear]="true" placeholder="Wszystkie"
                  [ngModel]="enrichment()" (ngModelChange)="setFilter('enrichment_status', $event)" ariaLabelledBy="enr-l" />
      </span>
      <span class="grow"></span>
      <p-button *can="'import'" label="Importuj" icon="pi pi-upload" (onClick)="openImport()" />
    </div>

    <app-data-state [loading]="loading() && !projects().length" [error]="error()" [empty]="!loading() && !projects().length"
                    emptyText="Brak projektów dla wybranych filtrów." (retry)="load()">
      <p-table [value]="projects()" [lazy]="true" [paginator]="true" [rows]="limit" [totalRecords]="total()" [first]="offset()"
               [loading]="loading()" (onLazyLoad)="onPage($event)" [tableStyle]="{ 'min-width': '52rem' }">
        <ng-template #header>
          <tr><th>Projekt</th><th>Status</th><th>Wzbogacenie</th><th>Postępowania</th><th>Powiązania</th><th>Ryzyka</th><th></th></tr>
        </ng-template>
        <ng-template #body let-p>
          <tr>
            <td>
              <a [routerLink]="['/projekty', p.id]" class="font-semibold">{{ p.title }}</a>
              <div class="text-xs text-muted-color">
                {{ p.id }}@for (e of p.external_ids; track e.value) { · {{ e.scheme.toUpperCase() }} {{ e.value }} }
              </div>
            </td>
            <td><app-status-badge type="project" [value]="p.status" /></td>
            <td>@if (p.enrichment_status) { <app-status-badge type="match" [value]="p.enrichment_status" /> }</td>
            <td>{{ p.counts.procedures }}</td><td>{{ p.counts.links }}</td><td>{{ p.counts.risks }}</td>
            <td><p-button *can="'enrich'" icon="pi pi-refresh" size="small" [text]="true" severity="secondary"
                          [ariaLabel]="'Wzbogać ponownie: ' + p.title" (onClick)="enrich(p)" /></td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>

    <p-dialog [(visible)]="importOpen" [modal]="true" header="Import projektów" [style]="{ width: '40rem' }" [draggable]="false">
      <div class="flex flex-col gap-3">
        <p class="m-0 text-sm text-muted-color">Plik XLSX lub CSV UTF-8 z nagłówkami arkusza „Projekty”. Import uruchamia wzbogacanie (BZP + drugie źródło).</p>
        <input type="file" accept=".xlsx,.csv" (change)="file.set($any($event.target).files?.[0] ?? null)" aria-label="Plik importu" />
        @if (uploadError(); as e) { <small class="text-red-600" role="alert">{{ e }}</small> }
        <app-job-progress [location]="jobLocation()" (finishedJob)="onJobDone($event)" />
      </div>
      <ng-template #footer>
        <p-button label="Zamknij" severity="secondary" [text]="true" (onClick)="importOpen.set(false)" />
        <p-button label="Wyślij" icon="pi pi-upload" [disabled]="!file() || uploading()" [loading]="uploading()" (onClick)="upload()" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="enrichOpen" [modal]="true" [header]="'Wzbogacanie: ' + (enrichTitle() ?? '')" [style]="{ width: '40rem' }" [draggable]="false">
      <app-job-progress [location]="jobLocation()" (finishedJob)="onJobDone($event)" />
    </p-dialog>
  `,
})
export class ProjectsPage {
  private readonly api = inject(ProjectsApi);
  private readonly imports = inject(ImportsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  protected readonly auth = inject(AuthService);
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  protected readonly limit = LIMIT;
  protected readonly schemes = ID_SCHEMES;
  protected readonly statusOptions = opts(PROJECT_STATUS);
  protected readonly enrichOptions = opts(MATCH_STATUS);

  // Filtry żyją w URL.
  protected readonly q = computed(() => this.params().get('q') ?? '');
  protected readonly status = computed(() => this.params().get('status'));
  protected readonly enrichment = computed(() => this.params().get('enrichment_status'));
  protected readonly offset = computed(() => Number(this.params().get('offset') ?? 0));
  protected readonly notFoundId = computed(() => this.params().get('nf'));

  protected readonly projects = signal<Project[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  // Wyszukiwanie po identyfikatorze.
  protected scheme: IdScheme = 'bzp';
  protected identifier = '';
  protected readonly idError = signal<string | null>(null);
  protected readonly hint = () => ID_SCHEMES.find((s) => s.value === this.scheme)!.hint;

  // Import / wzbogacanie.
  protected readonly importOpen = signal(false);
  protected readonly enrichOpen = signal(false);
  protected readonly enrichTitle = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly jobLocation = signal<string | null>(null);
  private importKey: string | null = null;

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(debounceTime(300)).subscribe((v) => this.nav({ q: v || null, offset: null, nf: null }));
    effect(() => { this.q(); this.status(); this.enrichment(); this.offset(); this.load(); });
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({
      limit: LIMIT, offset: this.offset(), q: this.q(), status: this.status(), enrichment_status: this.enrichment(),
    }).subscribe({
      next: (p) => { this.projects.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  private nav(queryParams: Record<string, string | number | null>) {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }
  onSearch(v: string) { this.search$.next(v); }
  /** Zmiana filtra resetuje offset. */
  setFilter(key: string, v: string | null) { this.nav({ [key]: v, offset: null, nf: null }); }
  onPage(e: TableLazyLoadEvent) {
    const first = e.first ?? 0;
    if (first !== this.offset()) this.nav({ offset: first || null });
  }

  lookup() {
    const err = validateIdentifier(this.scheme, this.identifier);
    this.idError.set(err);
    if (err) return;
    const value = this.identifier.trim();
    this.api.list({ q: value, limit: 25 }).subscribe({
      next: (r) => {
        const flat = (v: string) => v.replace(/\s+/g, '').toLowerCase();
        const hits = r.items.filter((p) => p.external_ids.some((e) => e.scheme === this.scheme &&
          [e.value, e.normalized ?? ''].some((v) => flat(v) === flat(value))));
        if (hits.length === 1) void this.router.navigate(['/projekty', hits[0].id]);
        else if (hits.length > 1) this.nav({ q: value, offset: null, nf: null });
        else this.nav({ q: null, offset: null, nf: `${this.scheme.toUpperCase()} ${value}` });
      },
      error: (e: ApiError) => this.toast.add({ severity: 'error', summary: 'Błąd wyszukiwania', detail: e.detail }),
    });
  }

  openImport() {
    this.file.set(null); this.uploadError.set(null); this.jobLocation.set(null); this.importKey = null;
    this.importOpen.set(true);
  }

  upload() {
    const f = this.file();
    if (!f) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    this.importKey ??= newIdempotencyKey(); // ten sam klucz przy powtórzeniu przerwanego żądania
    this.imports.create(f, this.importKey).subscribe({
      next: (a) => { this.uploading.set(false); this.jobLocation.set(a.location); },
      error: (e: ApiError) => {
        this.uploading.set(false);
        this.uploadError.set(e.status === 413 ? 'Plik jest za duży.' : e.status === 415 ? 'Nieobsługiwany typ pliku (użyj XLSX lub CSV).' : e.detail);
      },
    });
  }

  enrich(p: Project) {
    this.enrichTitle.set(p.title);
    this.jobLocation.set(null);
    this.enrichOpen.set(true);
    this.api.enrich(p.id, newIdempotencyKey()).subscribe({
      next: (a) => this.jobLocation.set(a.location),
      error: (e: ApiError) => { this.enrichOpen.set(false); this.toast.add({ severity: 'error', summary: 'Nie uruchomiono wzbogacania', detail: e.detail }); },
    });
  }

  onJobDone(_j: Job) { this.load(); }
}
