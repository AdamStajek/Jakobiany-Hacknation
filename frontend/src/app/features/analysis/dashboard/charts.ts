import { Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { Report, Scene } from '../../../core/api/types';
import { axisStyle, baseOptions, ChartOptions, palette } from '../../../shared/charts/chart-theme';
import { ChartCard } from '../../../shared/ui/chart-card';
import { DataTable } from '../../../shared/ui/data-table';


@Component({
  selector: 'app-water-balance-chart',
  imports: [NgxEchartsDirective, ChartCard, DataTable],
  template: `
    <app-chart-card title="Opad i zapotrzebowanie uprawy" subtitle="Okres bilansu [mm]">
      @if (options(); as o) { <div echarts [options]="o" class="h-64 w-full" role="img" [attr.aria-label]="label()"></div> }
      @else { <p class="text-sm text-muted-color">Brak wystarczających danych pogodowych.</p> }
      @if (table(); as t) { <app-data-table caption="Opad i zapotrzebowanie uprawy, ostatnie 30 dni" [columns]="['Wielkość', 'mm']" [rows]="t" /> }
    </app-chart-card>
  `,
})
export class WaterBalanceChart {
  readonly report = input.required<Report>();
  protected readonly label = computed(() => {
    const r = this.report().metrics.recent;
    return r ? `Opad ${r.rain_mm.toFixed(0)} mm, zapotrzebowanie uprawy ${r.etc_mm.toFixed(0)} mm, ET0 ${r.et0_mm.toFixed(0)} mm` : '';
  });
  protected readonly table = computed(() => {
    const r = this.report().metrics.recent;
    return r ? [['Opad', r.rain_mm.toFixed(1)], ['Uprawa (ETc)', r.etc_mm.toFixed(1)], ['ET₀', r.et0_mm.toFixed(1)]] : null;
  });
  protected readonly options = computed<ChartOptions | null>(() => {
    const r = this.report().metrics.recent;
    if (!r) return null;
    const c = palette();
    return {
      ...baseOptions(), tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}, confine: true},
      xAxis: {type: 'category', data: ['Opad', 'Uprawa (ETc)', 'ET₀'], ...axisStyle(), axisLabel: {color: c.muted, interval: 0, width: 90, overflow: 'break'}},
      yAxis: {type: 'value', name: 'mm', ...axisStyle()},
      series: [{type: 'bar', barMaxWidth: 56, label: {show: true, position: 'top', color: c.text, formatter: '{c} mm'},
        data: [{value: +r.rain_mm.toFixed(1), itemStyle: {color: c.water}}, {value: +r.etc_mm.toFixed(1), itemStyle: {color: c.warn}},
          {value: +r.et0_mm.toFixed(1), itemStyle: {color: c.muted}}]}],
    };
  });
}

@Component({
  selector: 'app-season-chart',
  imports: [NgxEchartsDirective, ChartCard, DataTable],
  template: `
    <app-chart-card title="Bilans pogodowy sezonów" subtitle="Opad − ET₀, kwiecień–wrzesień [mm]. Wartość poniżej zera oznacza przewagę parowania referencyjnego.">
      @if (options(); as o) { <div echarts [options]="o" class="h-64 w-full" role="img" [attr.aria-label]="label()"></div> }
      @else { <p class="text-sm text-muted-color">Brak sezonów z wystarczającymi danymi.</p> }
      @if (report().metrics.history.seasons.length) {
        <app-data-table caption="Bilans pogodowy sezonów" [columns]="['Rok', 'Opad [mm]', 'ET₀ [mm]', 'Bilans [mm]']" [rows]="table()" />
      }
    </app-chart-card>
  `,
})
export class SeasonChart {
  readonly report = input.required<Report>();
  protected readonly label = computed(() => {
    const h = this.report().metrics.history;
    return `Bilans pogodowy w ${h.seasons.length} sezonach, ${h.negative_seasons} z ujemnym bilansem`;
  });
  protected readonly table = computed(() => this.report().metrics.history.seasons
    .map((s) => [s.year, s.rain_mm, s.et0_mm, s.balance_mm]));
  protected readonly options = computed<ChartOptions | null>(() => {
    const seasons = this.report().metrics.history.seasons;
    if (!seasons.length) return null;
    const c = palette();
    return {
      ...baseOptions(), tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}, confine: true, valueFormatter: (v) => `${v} mm`},
      xAxis: {type: 'category', data: seasons.map((s) => String(s.year)), ...axisStyle()},
      yAxis: {type: 'value', name: 'mm', ...axisStyle()},
      series: [{name: 'Bilans', type: 'bar', barMaxWidth: 36, data: seasons.map((s) => ({value: s.balance_mm,
        itemStyle: {color: s.balance_mm < 0 ? c.bad : c.good}}))}],
    };
  });
}

@Component({
  selector: 'app-soil-chart',
  imports: [NgxEchartsDirective, ChartCard, DataTable],
  template: `
    <app-chart-card title="Woda w profilu gleby" subtitle="Model SoilGrids 250 m [mm/m]. Różnica słupków = woda dostępna dla roślin.">
      @if (options(); as o) { <div echarts [options]="o" class="h-64 w-full" role="img" aria-label="Zawartość wody w warstwach gleby przy 33 i 1500 kPa"></div> }
      @else { <p class="text-sm text-muted-color">Brak wiarygodnych danych o retencji gleby.</p> }
      @if (table(); as t) { <app-data-table caption="Retencja wody w warstwach gleby" [columns]="['Warstwa', '33 kPa [mm/m]', '1500 kPa [mm/m]']" [rows]="t" /> }
    </app-chart-card>
  `,
})
export class SoilChart {
  readonly report = input.required<Report>();
  protected readonly table = computed(() => {
    const soil = this.report().sources.find((s) => s.key === 'soil');
    if (!soil?.layers?.some(Boolean)) return null;
    const depths = soil.layer_depths ?? soil.layers.map((_, i) => String(i));
    return soil.layers.map((l, i) => [depths[i], l ? l[0] : '–', l ? l[1] : '–']);
  });
  protected readonly options = computed<ChartOptions | null>(() => {
    const soil = this.report().sources.find((s) => s.key === 'soil');
    if (!soil?.layers?.some(Boolean)) return null;
    const depths = soil.layer_depths ?? soil.layers.map((_, i) => String(i));
    const c = palette();
    const pick = (i: number) => soil.layers!.map((l) => (l ? l[i] : null));
    return {
      ...baseOptions(), legend: {bottom: 0, textStyle: {color: c.text}}, grid: {left: 8, right: 16, top: 24, bottom: 36, containLabel: true},
      tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}, confine: true},
      xAxis: {type: 'category', data: depths.map((d) => (d.includes('cm') ? d : d + ' cm')), ...axisStyle()},
      yAxis: {type: 'value', name: 'mm/m', ...axisStyle()},
      series: [{name: 'Pojemność polowa (33 kPa)', type: 'bar', data: pick(0), itemStyle: {color: c.water}},
        {name: 'Punkt więdnięcia (1500 kPa)', type: 'bar', data: pick(1), itemStyle: {color: c.warn}}],
    };
  });
}

@Component({
  selector: 'app-satellite-chart',
  imports: [NgxEchartsDirective, ChartCard, DataTable],
  template: `
    <app-chart-card title="Stan roślinności (Sentinel-2)" subtitle="NDVI opisuje zieleń łanu, NDMI — sygnał uwilgotnienia roślin. Punkty oznaczają dostępne zdjęcia.">
      @if (options(); as o) { <div echarts [options]="o" class="h-64 w-full" role="img" aria-label="Wskaźniki NDVI i NDMI w czasie"></div> }
      @else { <p class="text-sm text-muted-color">Za mało użytecznych obrazów, aby narysować przebieg w czasie.</p> }
      @if (scenes().length) { <app-data-table caption="Wskaźniki satelitarne w czasie" [columns]="['Data', 'NDVI', 'NDMI']" [rows]="table()" /> }
    </app-chart-card>
  `,
})
export class SatelliteChart {
  readonly report = input.required<Report>();
  protected readonly scenes = computed(() => {
    const sat = this.report().sources.find((s) => s.key === 'satellite');
    const scenes: (Scene & {current?: boolean})[] = [...(sat?.history ?? []), ...(sat?.scene ? [{...sat.scene, current: true}] : [])]
      .sort((a, b) => a.date.localeCompare(b.date));
    return scenes;
  });
  protected readonly table = computed(() => this.scenes().map((s) => [s.date, s.ndvi.toFixed(2), s.ndmi.toFixed(2)]));
  protected readonly options = computed<ChartOptions | null>(() => {
    const scenes = this.scenes();
    if (scenes.length < 2) return null;
    const c = palette();
    const series = (name: string, key: 'ndvi' | 'ndmi', color: string) => ({
      name, type: 'line' as const, smooth: false, symbolSize: 8, lineStyle: {color, width: 2}, itemStyle: {color},
      data: scenes.map((s) => ({value: [s.date, +s[key].toFixed(3)], symbolSize: s.current ? 14 : 7})),
    });
    return {
      ...baseOptions(), legend: {bottom: 0, textStyle: {color: c.text}}, grid: {left: 8, right: 16, top: 24, bottom: 36, containLabel: true},
      xAxis: {type: 'time', ...axisStyle()}, yAxis: {type: 'value', name: 'indeks', ...axisStyle()},
      series: [series('NDVI', 'ndvi', c.green), series('NDMI', 'ndmi', c.water)],
    };
  });
}
