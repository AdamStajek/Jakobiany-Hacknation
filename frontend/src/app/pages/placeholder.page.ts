import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { PageHeader } from '../shared/page-header';

export interface PlaceholderData {
  title: string;
  subtitle: string;
  priority: string;
  /** Zakres widoku wg planu – wyświetlany do czasu implementacji. */
  scope: string[];
}

/** Tymczasowy widok bez danych; zastępowany właściwymi stronami w trakcie implementacji. */
@Component({
  selector: 'app-placeholder-page',
  imports: [CardModule, PageHeader],
  template: `
    <app-page-header [title]="d.title" [subtitle]="d.subtitle" [priority]="d.priority" />
    <p-card header="Planowany zakres widoku">
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1">
        @for (s of d.scope; track s) { <li>{{ s }}</li> }
      </ul>
    </p-card>
  `,
})
export class PlaceholderPage {
  protected readonly d = inject(ActivatedRoute).snapshot.data as PlaceholderData;
}
