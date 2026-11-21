import { Component, input } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';
import { ExperimentGuide, experimentGuides } from './experiment-guides';

@Component({
  selector: 'app-experiments-page',
  imports: [RouterLink],
  templateUrl: './experiments-page.html',
})
export class ExperimentsPage {
  readonly guide = input<ExperimentGuide>();
  protected readonly guides = experimentGuides;
}

export const experimentRoutes: Routes = [
  {path: '', pathMatch: 'full', title: 'Pole Widzenia · Eksperymenty na polu', component: ExperimentsPage},
  ...experimentGuides.map((guide) => ({
    path: guide.slug,
    title: 'Pole Widzenia · ' + guide.title,
    component: ExperimentsPage,
    data: {guide},
  })),
  {path: '**', redirectTo: ''},
];
