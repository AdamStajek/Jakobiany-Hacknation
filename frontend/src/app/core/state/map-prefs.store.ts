import { Injectable, effect, inject, signal } from '@angular/core';
import { ConsentStore } from './consent.store';

export type BasemapChoice = 'osm' | 'orto';

export const MAP_PREFS_KEY = 'pw.map-basemap.v1';

/** Wybrana mapa podkładowa, wspólna dla wszystkich widoków mapy (przeżywa zmianę trasy; zapis tylko za zgodą). */
@Injectable({providedIn: 'root'})
export class MapPrefsStore {
  private readonly consent = inject(ConsentStore);
  readonly basemap = signal<BasemapChoice>(this.load());

  constructor() {
    effect(() => { this.consent.write(MAP_PREFS_KEY, this.basemap()); });
  }

  private load(): BasemapChoice {
    return this.consent.read(MAP_PREFS_KEY) === 'orto' ? 'orto' : 'osm';
  }
}
