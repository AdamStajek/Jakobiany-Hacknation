import { Component, computed, effect, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ProjectDetail } from '../../core/api/types';
import { AnalysesList } from './analyses-list';
import { RunPanel } from './run-panel';

type Mode = 'docs' | 'description';

/** Krok 3: wybór wersji dokumentów (domyślnie aktualne, gotowe) albo samego opisu, start analizy i lista zapisanych analiz. */
@Component({
  selector: 'app-run-step',
  imports: [FormsModule, CheckboxModule, RadioButtonModule, RunPanel, AnalysesList],
  template: `
    <div class="flex flex-col gap-4 max-w-3xl">
      <fieldset class="flex flex-col gap-2 border border-surface rounded-lg p-4">
        <legend class="font-semibold px-1">Materiał do analizy</legend>
        <label class="flex items-center gap-2">
          <p-radiobutton name="mode" value="description" [(ngModel)]="mode" /> Tylko opis projektu
        </label>
        <label class="flex items-center gap-2" [class.opacity-60]="!ready().length">
          <p-radiobutton name="mode" value="docs" [(ngModel)]="mode" [disabled]="!ready().length" /> Wybrane wersje dokumentów
        </label>
        @if (mode() === 'docs') {
          <div class="flex flex-col gap-1 pl-6">
            @for (v of ready(); track v.id) {
              <label class="flex items-center gap-2">
                <p-checkbox [binary]="true" [ngModel]="selected().includes(v.id)" (ngModelChange)="toggle(v.id, $event)" [name]="v.id" />
                {{ v.doc }} – wersja {{ v.revision }}@if (v.current) { <span class="text-xs text-muted-color">(aktualna)</span> }
              </label>
            }
          </div>
        }
        @if (!ready().length) { <small class="text-muted-color">Brak dokumentów gotowych do analizy (ekstrakcja musi się zakończyć).</small> }
      </fieldset>
      <app-run-panel [projectId]="project().id" [versionIds]="versionIds()" />

      <section>
        <h3 class="mt-4 mb-2">Zapisane analizy tego projektu</h3>
        <app-analyses-list [projectId]="project().id" />
      </section>
    </div>
  `,
})
export class RunStep {
  readonly project = input.required<ProjectDetail>();
  protected readonly mode = signal<Mode>('description');
  protected readonly selected = signal<string[]>([]);

  protected readonly ready = computed(() =>
    this.project().documents.flatMap((d) => d.versions
      .filter((v) => v.extraction_status === 'ready')
      .map((v) => ({ id: v.id, doc: d.document_type, revision: v.revision, current: v.id === d.current_version_id }))));
  protected readonly versionIds = computed(() => (this.mode() === 'docs' ? this.selected() : []));

  constructor() {
    // Domyślnie: aktualne, gotowe wersje; bez dokumentów – sam opis.
    effect(() => {
      const r = this.ready();
      const current = r.filter((v) => v.current).map((v) => v.id);
      this.selected.set(current);
      this.mode.set(current.length ? 'docs' : 'description');
    });
  }

  protected toggle(id: string, on: boolean) {
    this.selected.update((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }
}
