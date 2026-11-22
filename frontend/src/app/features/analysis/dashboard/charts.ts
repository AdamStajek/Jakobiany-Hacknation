import { Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { Report } from '../../../core/api/types';
import { axisStyle, baseOptions, ChartOptions, palette } from '../../../shared/charts/chart-theme';
import { ChartCard } from '../../../shared/ui/chart-card';
import { DataTable } from '../../../shared/ui/data-table';


@Component({
  selector: 'app-water-balance-chart',
  imports: [NgxEchartsDirective, ChartCard, DataTable],
  template: `
    @let recent = report().metrics.recent;
    <app-chart-card title="Opad i zapotrzebowanie uprawy" [subtitle]="recent ? recent.start + ' – ' + recent.end : ''">
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
