import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { Geometry, Recommendation } from '../../core/api/types';
import { WodoMap } from '../map/wodo-map';

/** Lista zaleceń z panelem „Dlaczego na tej działce?” (dowody i ograniczenia). */
@Component({
  selector: 'app-report-recommendations',
  imports: [ButtonModule, DrawerModule, DecimalPipe, WodoMap],
  templateUrl: './report-recommendations.html',
})
export class ReportRecommendations {
  readonly items = input.required<Recommendation[]>();
  readonly geometry = input<Geometry | null>(null);
  protected readonly selected = signal<Recommendation | null>(null);
  protected readonly markers = computed(() => this.selected()?.points?.map(point => point.coordinates) ?? []);
}
