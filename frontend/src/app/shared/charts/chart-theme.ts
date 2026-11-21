import type { EChartsOption } from 'echarts';
import { darkMode } from '../../core/theme/theme';

export type ChartOptions = EChartsOption;

export function palette() {
  const dark = darkMode();
  return {
    text: dark ? '#EEF1E8' : '#0D2A00', muted: dark ? '#BCC6B0' : '#506047', grid: dark ? '#3B4A33' : '#D8DFCF',
    good: '#385A15', bad: '#dc2626', water: '#0284c7', warn: '#EE8106', green: '#778C12', violet: '#7c3aed',
  };
}

/** Wspólne ustawienia osi, siatki i tooltipu dla wszystkich wykresów. */
export function baseOptions(): ChartOptions {
  const c = palette();
  return {
    textStyle: {color: c.text, fontFamily: 'system-ui, sans-serif'},
    grid: {left: 8, right: 16, top: 36, bottom: 8, containLabel: true},
    tooltip: {trigger: 'axis', confine: true},
    aria: {enabled: true},
    animationDuration: matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
  };
}

export function axisStyle() {
  const c = palette();
  return {
    axisLine: {lineStyle: {color: c.grid}}, axisLabel: {color: c.muted},
    splitLine: {lineStyle: {color: c.grid}}, nameTextStyle: {color: c.muted},
  };
}
