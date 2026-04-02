'use client';

import { useEffect, useState } from 'react';

interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  grid: string;
  axis: string;
  legend: string;
  tooltip: string;
}

const FALLBACK: ChartColors = {
  chart1: '#38bdf8',
  chart2: '#34d399',
  chart3: '#fbbf24',
  chart4: '#fb7185',
  chart5: '#a78bfa',
  grid: '#27272a',
  axis: '#71717a',
  legend: '#a1a1aa',
  tooltip: '#18181b',
};

function readColors(): ChartColors {
  if (typeof window === 'undefined') return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    chart1: get('--chart-1', FALLBACK.chart1),
    chart2: get('--chart-2', FALLBACK.chart2),
    chart3: get('--chart-3', FALLBACK.chart3),
    chart4: get('--chart-4', FALLBACK.chart4),
    chart5: get('--chart-5', FALLBACK.chart5),
    grid: get('--chart-grid', FALLBACK.grid),
    axis: get('--chart-axis', FALLBACK.axis),
    legend: get('--chart-legend', FALLBACK.legend),
    tooltip: get('--surface', FALLBACK.tooltip),
  };
}

/**
 * Returns resolved chart colors from CSS custom properties.
 * Re-reads on theme changes (class attribute mutations on <html>).
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    setColors(readColors());

    const observer = new MutationObserver(() => {
      setColors(readColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
