import { Component, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { Recommendation } from '../../../core/api/types';

/** Lista zaleceń z panelem „Dlaczego na tej działce?” (dowody i ograniczenia). */
@Component({
  selector: 'app-report-recommendations',
  imports: [ButtonModule, DrawerModule],
  template: `
    <section aria-labelledby="zalecenia" class="space-y-3">
      <h3 id="zalecenia" class="text-lg font-semibold">Co możesz zrobić?</h3>
      <div class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        @for (item of items(); track item.title; let n = $index) {
          <article class="pw-card flex flex-col gap-2 p-4">
            <div class="flex items-center gap-2 text-xs text-muted-color">
              <span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-100 font-bold text-primary dark:bg-primary-950">{{n + 1}}</span>
              <span class="min-w-0 truncate">{{item.group}}</span><span class="ml-auto shrink-0">Pewność: {{item.confidence}}</span>
            </div>
            <h4 class="text-base font-semibold leading-snug">{{item.title}}</h4>
            <p class="text-sm">{{item.action}}</p>
            <p class="text-sm"><strong>Kiedy?</strong> {{item.when}}</p>
            <p-button class="mt-auto" label="Dlaczego na tej działce?" icon="pi pi-info-circle" [text]="true" size="small" (onClick)="selected.set(item)" />
          </article>
        } @empty {
          <p class="text-muted-color">Brak wystarczających podstaw do zaleceń dla wybranej działki i daty.</p>
        }
      </div>
    </section>

    <p-drawer [visible]="!!selected()" (visibleChange)="!$event && selected.set(null)" position="right" styleClass="!w-full md:!w-[28rem]"
      [header]="selected()?.title ?? ''">
      @if (selected(); as rec) {
        <div class="space-y-4 text-sm">
          <p class="text-muted-color">{{rec.group}} · Pewność: {{rec.confidence}}</p>
          <div><h4 class="font-semibold">Dlaczego na tej działce</h4><p>{{rec.why}}</p></div>
          <div><h4 class="font-semibold">Dowody</h4><p>{{rec.evidence}}</p></div>
          <div><h4 class="font-semibold">Ograniczenia</h4><p>{{rec.limits}}</p></div>
        </div>
      }
    </p-drawer>
  `,
})
export class ReportRecommendations {
  readonly items = input.required<Recommendation[]>();
  protected readonly selected = signal<Recommendation | null>(null);
}
