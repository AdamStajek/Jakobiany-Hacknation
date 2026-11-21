import { ModelPage } from './model-page';
import { Component } from '@angular/core';
import { RecommendationMethods } from './recommendation-methods';

type Item = {name: string; what: string; url: string};

@Component({
  selector: 'app-methods-page',
  imports: [ModelPage, RecommendationMethods],
  template: `
    <article class="mx-auto max-w-4xl space-y-5 p-4 lg:p-8">
      <header>
        <h1 class="text-2xl font-bold tracking-tight">Jak to działa?</h1>
        <p class="mt-1 text-muted-color">Porównujemy opad z zapotrzebowaniem uprawy na wodę dla konkretnej działki. Każde zalecenie ma dowód, a brak danych jest pokazany wprost.</p>
      </header>

      <section aria-labelledby="metoda" class="space-y-2 pw-card p-4">
        <h2 id="metoda" class="text-lg font-semibold">Co liczymy</h2>
        <ul class="ml-5 list-disc space-y-1 text-sm">
          <li><strong>ET₀ FAO-56 × Kc:</strong> dobowe zapotrzebowanie uprawy z temperatury, wiatru, promieniowania i fazy rozwoju.</li>
          <li><strong>Bilans 30 dni:</strong> opad minus zapotrzebowanie, porównany z tymi samymi dniami w poprzednich latach.</li>
          <li><strong>Strefa korzeni (TAW/RAW):</strong> pojemność wodna gleby z SoilGrids i dwa warianty stanu początkowego.</li>
          <li><strong>Sentinel-2:</strong> NDVI (zieleń łanu), NDMI (woda w liściach) i NDWI po maskowaniu chmur, z porównaniem sezonowym.</li>
          <li><strong>Teren i otoczenie:</strong> nachylenie, pokrycie terenu, odległość do stałej wody i wodowskaz IMGW.</li>
        </ul>
      </section>

      <section aria-labelledby="zrodla" class="space-y-2">
        <h2 id="zrodla" class="text-lg font-semibold">Źródła danych (bezpłatne)</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          @for (item of sources; track item.name) {
            <a [href]="item.url" target="_blank" rel="noopener" class="pw-card block p-3 hover:border-primary">
              <div class="font-medium text-primary">{{item.name}} <span aria-hidden="true">↗</span></div>
              <div class="text-sm text-muted-color">{{item.what}}</div>
            </a>
          }
        </div>
      </section>

      <section aria-labelledby="limity" class="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-50">
        <h2 id="limity" class="text-lg font-semibold">Jak czytać wynik</h2>
        <ul class="ml-5 list-disc space-y-1 text-sm">
          <li>To ocena przesiewowa: podpowiada, gdzie i kiedy sprawdzić pole. Nie jest dawką nawadniania ani dokumentem urzędowym.</li>
          <li>NDVI i NDMI opisują sygnał z powierzchni. Zbiór lub płodozmian zmienia je podobnie jak niedobór wody.</li>
          <li>Pogoda NASA POWER ma rozdzielczość kilkudziesięciu kilometrów i nie odtwarza lokalnych burz.</li>
          <li>Pokrycie terenu pochodzi z 2021 r. i pomija małe rowy oraz wody okresowe. Odległość do wody nie potwierdza prawa poboru.</li>
          <li>Przed nawadnianiem lub pracami retencyjnymi potwierdź warunki w terenie.</li>
        </ul>
        <p class="text-sm">Pełny opis: <code>docs/DATA_LIMITATIONS.md</code>.</p>
      </section>
      <app-recommendation-methods />

      <details class="pw-card p-4">
        <summary class="cursor-pointer font-semibold">Szczegóły modelu paszportu pola</summary>
        <app-model-page />
      </details>
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
