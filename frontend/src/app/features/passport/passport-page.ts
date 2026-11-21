import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';

const SECTIONS: {icon: string; title: string; text: string}[] = [
  {icon: 'pi-id-card', title: 'Tożsamość', text: 'Identyfikator EGiB, gmina, obręb, powierzchnia i geometria działki.'},
  {icon: 'pi-filter', title: 'Gleba', text: 'Retencja wody, profil warstw, TAW i RAW oraz własne pomiary rolnika.'},
  {icon: 'pi-compass', title: 'Teren i woda', text: 'Wysokość, nachylenie, odległość do wody, rowy melioracyjne i wodowskaz.'},
  {icon: 'pi-sync', title: 'Uprawy i płodozmian', text: 'Historia upraw wpisywana przez rolnika oraz międzyplony.'},
  {icon: 'pi-cloud', title: 'Klimat', text: 'Wieloletni bilans, sezony suche i trend opadów.'},
  {icon: 'pi-globe', title: 'Satelita', text: 'Oś czasu NDVI i NDMI oraz porównania sezonowe.'},
  {icon: 'pi-check-square', title: 'Wdrożone działania', text: 'Rejestr działań retencyjnych z kosztem i szacowanym efektem.'},
  {icon: 'pi-file', title: 'Dokumenty', text: 'Raporty PDF, notatki i zdjęcia z pola.'},
];

/** Szkielet Paszportu działki: układ i sekcje, dane dojdą wraz z endpointami backendu. */
@Component({
  selector: 'app-passport-page',
  imports: [RouterLink, TagModule],
  template: `
    <article class="space-y-4">
      <header>
        <a routerLink="/dzialka/{{id()}}" class="text-sm text-primary underline">← Wróć do analizy</a>
        <h1 class="mt-2 text-2xl font-bold tracking-tight">Paszport działki <span class="break-all text-muted-color">{{id()}}</span></h1>
        <p class="max-w-2xl text-muted-color">Jedna trwała karta z tym, co wiemy o działce. Sekcje poniżej pojawią się po udostępnieniu zapisu danych na serwerze.</p>
      </header>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        @for (item of sections; track item.title) {
          <section class="rounded-xl border border-dashed border-surface bg-surface-0 p-4 dark:bg-surface-900">
            <div class="mb-1 flex items-center gap-2"><i class="pi {{item.icon}} text-primary" aria-hidden="true"></i>
              <h2 class="font-semibold">{{item.title}}</h2></div>
            <p class="mb-2 text-sm text-muted-color">{{item.text}}</p>
            <p-tag value="Wkrótce" severity="secondary" />
          </section>
        }
      </div>
    </article>
  `,
})
export class PassportPage {
  readonly id = input.required<string>();
  protected readonly sections = SECTIONS;
}
