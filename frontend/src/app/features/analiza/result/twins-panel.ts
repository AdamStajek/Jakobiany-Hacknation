import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { Twin } from '../../../core/api/types';
import { TWIN_DIRECTION } from '../../../core/labels';
import { DataState, EvidenceLink } from '../../../shared';

/** Bliźniaki projektu: podobieństwo, uzasadnienie, cechy porównane i nieporównane. */
@Component({
  selector: 'app-twins-panel',
  imports: [RouterLink, TagModule, DataState, EvidenceLink],
  template: `
    <app-data-state [empty]="!twins().length" emptyText="Nie znaleziono porównywalnych projektów historycznych.">
      <div class="flex flex-col gap-4">
        @for (t of twins(); track t.project_id) {
          <article class="p-4 rounded-lg border border-surface flex flex-col gap-2">
            <header class="flex flex-wrap items-center justify-between gap-2">
              <a [routerLink]="['/projekty', t.project_id]" class="font-semibold">{{ t.project_id }}</a>
              <span class="font-bold">Podobieństwo: {{ pct(t.score) }}%</span>
            </header>
            <p class="m-0">{{ t.explanation }}</p>
            @if (t.compared_features.length) {
              <ul class="m-0 p-0 list-none flex flex-col gap-1">
                @for (f of t.compared_features; track $index) {
                  <li class="flex flex-wrap items-center gap-2 text-sm">
                    <p-tag [value]="dir(f.direction).label" [icon]="dir(f.direction).icon" [severity]="dir(f.direction).tone" />
                    <b>{{ f.feature }}</b> {{ f.explanation }}
                    @for (e of f.evidence_ids.slice(0, 1); track e) { <app-evidence-link [evidenceId]="e" /> }
                  </li>
                }
              </ul>
            }
            @if (t.missing_features.length) {
              <p class="m-0 text-sm text-muted-color">Nieporównane cechy (brak danych): {{ t.missing_features.join(', ') }}</p>
            }
            @if (t.evidence_ids.length) { <div><app-evidence-link [evidenceId]="t.evidence_ids[0]" label="Źródło bliźniaka" /></div> }
          </article>
        }
      </div>
    </app-data-state>
  `,
})
export class TwinsPanel {
  readonly twins = input.required<Twin[]>();
  protected pct = (n: number) => Math.round(n * 100);
  protected dir = (d: string) => TWIN_DIRECTION[d];
}
