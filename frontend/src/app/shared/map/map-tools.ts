import { Component, input, output, signal } from '@angular/core';
import type { Basemap } from './map-style';

const BTN = 'pw-card flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium leading-tight shadow-md disabled:opacity-50';
const OFF = 'hover:bg-surface-100 dark:hover:bg-surface-800';
const ON = 'bg-primary text-primary-contrast hover:brightness-95';

/** Poniżej tej szerokości (breakpoint `lg`) panel narzędzi jest domyślnie zwinięty. */
const COMPACT_QUERY = '(max-width: 1023.98px)';
const isCompact = () => typeof matchMedia === 'function' && matchMedia(COMPACT_QUERY).matches;

/** Panel narzędzi mapy: przyciski z podpisem tekstowym oraz zbliżanie +/−. Na telefonie zwijany przyciskiem „Narzędzia”. */
@Component({
  selector: 'app-map-tools',
  template: `
    <div class="flex w-44 flex-col gap-3" role="group" aria-label="Narzędzia mapy">
      <button type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="map-tools-list" [class]="btn + ' lg:hidden'">
        <i class="pi pi-sliders-h" aria-hidden="true"></i>
        <span class="flex-1">Narzędzia</span>
        <i class="pi" [class.pi-chevron-up]="open()" [class.pi-chevron-down]="!open()" aria-hidden="true"></i>
      </button>
      <div id="map-tools-list" class="flex flex-col gap-3" [class.max-lg:hidden]="!open()">
      <button type="button" (click)="basemapToggle.emit()" [attr.aria-pressed]="basemap() === 'orto'" [class]="btn + ' ' + (basemap() === 'orto' ? on : off)">
        <i class="pi pi-images" aria-hidden="true"></i>
        <span>{{basemap() === 'orto' ? 'Mapa' : 'Satelita'}}</span>
      </button>
      <button type="button" (click)="parcelToggle.emit()" [attr.aria-pressed]="parcelLayer()" [class]="btn + ' ' + (parcelLayer() ? on : off)">
        <i class="pi pi-table" aria-hidden="true"></i>
        <span>Działki<span class="block text-xs font-normal">{{parcelLayer() ? 'włączone' : 'wyłączone'}}</span></span>
      </button>
      <button type="button" (click)="locate.emit(); collapseOnPhone()" [disabled]="!ready()" [class]="btn + ' ' + off">
        <i class="pi pi-compass" aria-hidden="true"></i><span>Moja lokalizacja</span>
      </button>
      @if (fieldsAvailable()) {
        <button type="button" (click)="fieldsToggle.emit()" [attr.aria-pressed]="fieldsShown()" [class]="btn + ' ' + (fieldsShown() ? on : off)">
          <i class="pi pi-th-large" aria-hidden="true"></i>
          <span>Moje pola<span class="block text-xs font-normal">{{fieldsShown() ? 'włączone' : 'wyłączone'}}</span></span>
        </button>
      }
      @if (markAvailable()) {
        <button type="button" (click)="markToggle.emit(); collapseOnPhone()" [disabled]="!ready() || drawing()" [attr.aria-pressed]="marking()" [class]="btn + ' ' + (marking() ? on : off)">
          <i class="pi pi-map-marker" aria-hidden="true"></i>
          <span>Problemy<span class="block text-xs font-normal">{{marking() ? 'włączone' : 'wyłączone'}}</span></span>
        </button>
      }
      @if (drawEnabled()) {
        <button type="button" (click)="drawToggle.emit(); collapseOnPhone()" [disabled]="!ready() || marking()" [attr.aria-pressed]="drawing()" [class]="btn + ' ' + (drawing() ? on : off)">
          <i class="pi pi-pencil" aria-hidden="true"></i>
          <span>Rysuj działkę<span class="block text-xs font-normal">{{drawing() ? 'włączone' : 'wyłączone'}}</span></span>
        </button>
      }
      </div>
      <div class="flex gap-3">
        <button type="button" (click)="zoom.emit(1)" [disabled]="!ready()" aria-label="Przybliż mapę" [class]="btn + ' ' + off + ' justify-center'">
          <i class="pi pi-plus" aria-hidden="true"></i>
        </button>
        <button type="button" (click)="zoom.emit(-1)" [disabled]="!ready()" aria-label="Oddal mapę" [class]="btn + ' ' + off + ' justify-center'">
          <i class="pi pi-minus" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
})
export class MapTools {
  readonly basemap = input.required<Basemap>();
  readonly parcelLayer = input.required<boolean>();
  readonly drawEnabled = input.required<boolean>();
  readonly drawing = input.required<boolean>();
  readonly ready = input.required<boolean>();
  /** „Pokaż moje pola”: przycisk widoczny tylko, gdy są pola do pokazania. */
  readonly fieldsAvailable = input(false);
  readonly fieldsShown = input(false);
  /** „Zaznacz miejsca problemowe”: przycisk widoczny, gdy jest wybrana działka. */
  readonly markAvailable = input(false);
  readonly marking = input(false);
  readonly basemapToggle = output();
  readonly parcelToggle = output();
  readonly locate = output();
  readonly drawToggle = output();
  readonly fieldsToggle = output();
  readonly markToggle = output();
  /** +1 przybliża, -1 oddala. */
  readonly zoom = output<number>();
  /** Na telefonie lista narzędzi startuje zwinięta; na komputerze jest zawsze widoczna. */
  protected readonly open = signal(!isCompact());
  protected readonly btn = BTN;
  protected readonly on = ON;
  protected readonly off = OFF;

  /** Po wybraniu trybu (lokalizacja, rysowanie, strefy) zwijamy listę, żeby nie zasłaniała mapy. */
  protected collapseOnPhone() {
    if (isCompact()) this.open.set(false);
  }
}
