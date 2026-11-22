import { ModelPage } from './model-page';
import { Component } from '@angular/core';
import { RecommendationMethods } from './recommendation-methods';

type Item = {name: string; what: string; url: string};

@Component({
  selector: 'app-methods-page',
  imports: [ModelPage, RecommendationMethods],
  template: `
    <article class="max-w-4xl space-y-5">
      <header>
        <h1 class="text-2xl font-bold tracking-tight">Jak to działa?</h1>
      </header>

      <app-recommendation-methods class="block" />

      <details class="pw-card p-4">
        <summary class="cursor-pointer font-semibold">Szczegóły modelu danych działki</summary>
        <app-model-page />
      </details>

      <section aria-labelledby="zrodla" class="space-y-2">
        <h2 id="zrodla" class="text-lg font-semibold">Źródła danych</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          @for (item of sources; track item.name) {
            <a [href]="item.url" target="_blank" rel="noopener" class="pw-card block p-3 hover:border-primary">
              <div class="font-medium text-primary">{{item.name}} <span aria-hidden="true">↗</span></div>
              <div class="text-sm text-muted-color">{{item.what}}</div>
            </a>
          }
        </div>
      </section>
    </article>
  `,
})
export class MethodsPage {
  protected readonly sources: Item[] = [
    {name: 'GUGiK / EGiB', what: 'Granice działek ewidencyjnych (krajowy zbiór GeoParquet, odświeżany codziennie)', url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza'},
    {name: 'NASA POWER', what: 'Opad, temperatura, wiatr i promieniowanie', url: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/'},
    {name: 'Open-Meteo', what: 'Prognozowany opad, ET₀, temperatura i wiatr dla najbliższych dni', url: 'https://open-meteo.com/en/docs'},
    {name: 'IMGW-PIB', what: 'Stacje meteorologiczne i wodowskazy', url: 'https://danepubliczne.imgw.pl/pl/apiinfo'},
    {name: 'Sentinel-2 L2A', what: 'Obrazy satelitarne 20 m (Planetary Computer, Earth Search)', url: 'https://planetarycomputer.microsoft.com/docs/'},
    {name: 'ISRIC SoilGrids', what: 'Retencja wody w glebie, 250 m', url: 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_access.html'},
    {name: 'ESA WorldCover 2021', what: 'Pokrycie terenu i wody stałe, 10 m', url: 'https://worldcover2021.esa.int/'},
    {name: 'EU-DEM / Copernicus DEM', what: 'Wysokość i nachylenie terenu', url: 'https://www.opentopodata.org/datasets/eudem/'},
    {name: 'OpenStreetMap i GUGiK', what: 'Podkłady mapy, ortofotomapa, granice działek', url: 'https://www.geoportal.gov.pl'},
  ];
}
