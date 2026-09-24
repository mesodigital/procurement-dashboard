import ReactECharts from 'echarts-for-react';

export default function Chart({ option, height = 360, style }: { option: any; height?: number; style?: any }) {
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%', ...style }}
      notMerge
      lazyUpdate
      opts={{ renderer: 'canvas' }}
    />
  );
}

export const PALETTE = ['#38bdf8', '#818cf8', '#f472b6', '#fb923c', '#34d399', '#facc15', '#a78bfa', '#22d3ee', '#f87171', '#4ade80', '#e879f9', '#fdba74'];

export const baseGrid = { left: 50, right: 20, top: 40, bottom: 40, containLabel: true };

export const axisStyle = {
  axisLine: { lineStyle: { color: '#334155' } },
  axisLabel: { color: '#94a3b8', fontSize: 11 },
  splitLine: { lineStyle: { color: '#1e293b' } },
};
