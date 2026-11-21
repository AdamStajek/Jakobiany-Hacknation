import { Component, inject } from '@angular/core';
import { ParcelStore } from '../../core/state/parcel.store';
import { WodoMap } from '../../shared/map/wodo-map';
import { ParcelPicker } from './parcel-picker';

@Component({
  selector: 'app-analysis-page',
  imports: [ParcelPicker, WodoMap],
  template: `
    <h1 class="mb-1 text-2xl font-bold tracking-tight">Zatrzymaj wodę. Chroń plony.</h1>
    <p class="mb-4 max-w-2xl text-muted-color">Sprawdź, jak opady, gleba i ukształtowanie terenu wpływają na zapas wody na Twojej działce.</p>
    <div class="grid gap-4 lg:grid-cols-[380px_1fr]">
      <aside class="space-y-6 rounded-xl border border-surface bg-surface-0 p-4 dark:bg-surface-900">
        <app-parcel-picker />
      </aside>
      <div class="h-[60vh] min-h-[360px] overflow-hidden rounded-xl border border-surface lg:h-[calc(100vh-11rem)]">
        <app-wodo-map [geometry]="store.parcel()?.geometry ?? null" (pointClicked)="onMapClick($event)" />
      </div>
    </div>
  `,
})
export class AnalysisPage {
  protected readonly store = inject(ParcelStore);
  protected onMapClick(point: {lat: number; lon: number}) { void this.store.searchPoint(point.lat, point.lon); }
}
