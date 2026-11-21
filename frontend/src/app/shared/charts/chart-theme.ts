import type { EChartsOption } from 'echarts';

export type ChartOptions = EChartsOption;

export function palette() {
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    text: dark ? '#e2e8f0' : '#334155', muted: dark ? '#94a3b8' : '#64748b', grid: dark ? '#334155' : '#e2e8f0',
    good: '#10b981', bad: '#dc2626', water: '#0284c7', warn: '#d97706', green: '#16a34a', violet: '#7c3aed',
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
