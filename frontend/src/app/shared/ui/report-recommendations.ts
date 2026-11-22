import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { Geometry, Recommendation } from '../../core/api/types';
import { WodoMap } from '../map/wodo-map';

/** Główne zalecenia (do 2) i reszta pod „Pokaż więcej”; karta rozwija uzasadnienie i plan działań, panel boczny pokazuje dowody. */
const TOP_COUNT = 2;

@Component({
  selector: 'app-report-recommendations',
  imports: [ButtonModule, DrawerModule, DecimalPipe, NgTemplateOutlet, WodoMap],
  templateUrl: './report-recommendations.html',
})
export class ReportRecommendations {
  readonly items = input.required<Recommendation[]>();
  readonly geometry = input<Geometry | null>(null);
  protected readonly selected = signal<Recommendation | null>(null);
  protected readonly showAll = signal(false);
  private readonly open = signal<readonly string[]>([]);
  protected readonly top = computed(() => this.items().slice(0, TOP_COUNT));
  protected readonly more = computed(() => this.items().slice(TOP_COUNT));
  protected key(item: Recommendation) { return String(item.id ?? item.title); }
  protected isOpen(item: Recommendation) { return this.open().includes(this.key(item)); }
  protected toggle(item: Recommendation) {
    const key = this.key(item);
    this.open.update((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }
  protected readonly markers = computed(() => this.selected()?.points?.map(point => point.coordinates) ?? []);
}
