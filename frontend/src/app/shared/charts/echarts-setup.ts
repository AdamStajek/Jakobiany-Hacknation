// Tree-shaken ECharts: register only what the app uses.
import { BarChart, GaugeChart, LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent, AriaComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, GaugeChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, MarkAreaComponent, MarkLineComponent, AriaComponent, CanvasRenderer]);

export default echarts;
