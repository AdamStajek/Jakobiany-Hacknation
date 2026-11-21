import { Component } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'app-analysis-page',
  imports: [EmptyState],
  template: `
    <h1 class="mb-1 text-2xl font-bold tracking-tight">Zatrzymaj wodę. Chroń plony.</h1>
    <p class="mb-4 max-w-2xl text-muted-color">Wybierz działkę, uprawę i datę, aby zobaczyć stan wody i zalecenia.</p>
    <app-empty-state icon="pi-map" title="Mapa i formularz — etap 2"
      text="Tu pojawi się mapa z wyborem działki oraz dashboard analizy." />
  `,
})
export class AnalysisPage {}
