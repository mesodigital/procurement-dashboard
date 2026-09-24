import Chart, { PALETTE, baseGrid, axisStyle } from '../components/Chart';
import { KPI } from '../components/Stat';
import { fmtIDR, fmtNum } from '../api';

export default function Overview({ data }) {
  const k = data.kpi;

  const trendOpt = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmtIDR(v) },
    grid: baseGrid,
    xAxis: { type: 'category', data: data.trend.map((t) => t.month), ...axisStyle },
    yAxis: { type: 'value', axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${(v / 1e9).toFixed(0)}M` }, splitLine: axisStyle.splitLine },
    series: [
      {
        type: 'line',
        smooth: true,
        areaStyle: { color: 'rgba(56,189,248,0.15)' },
        lineStyle: { color: '#38bdf8', width: 2 },
        itemStyle: { color: '#38bdf8' },
        data: data.trend.map((t) => t.value),
      },
    ],
  };

  const catOpt = {
    tooltip: { trigger: 'item', formatter: (p) => `${p.name}<br/>${fmtIDR(p.value)} (${p.percent}%)` },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '45%'],
        itemStyle: { borderColor: '#0f172a', borderWidth: 2 },
        label: { color: '#cbd5e1', fontSize: 11, formatter: '{b}' },
        data: data.categorySpend.map((c, i) => ({ name: c.name, value: c.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
    ],
  };

  const funnelOpt = {
    tooltip: { trigger: 'item', formatter: (p) => `${p.name}<br/>${fmtNum(p.value)} PO<br/>${fmtIDR(data.funnel[p.dataIndex].value)}` },
    grid: { left: 90, right: 30, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: axisStyle.splitLine },
    yAxis: { type: 'category', data: data.funnel.map((f) => f.stage), inverse: true, axisLabel: { color: '#cbd5e1' }, axisLine: axisStyle.axisLine },
    series: [
      {
        type: 'bar',
        data: data.funnel.map((f, i) => ({ value: f.count, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
        label: { show: true, position: 'right', color: '#cbd5e1', formatter: (p) => fmtIDR(data.funnel[p.dataIndex].value) },
      },
    ],
  };

  const budgetOpt = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmtIDR(v) },
    grid: baseGrid,
    xAxis: { type: 'category', data: ['Budget', 'Committed', 'Actual'], ...axisStyle },
    yAxis: { type: 'value', axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${(v / 1e9).toFixed(0)}M` }, splitLine: axisStyle.splitLine },
    series: [
      {
        type: 'bar',
        barWidth: '45%',
        data: [
          { value: k.budget, itemStyle: { color: '#64748b' } },
          { value: k.committed, itemStyle: { color: '#f59e0b' } },
          { value: k.actual, itemStyle: { color: '#38bdf8' } },
        ],
      },
    ],
  };

  return (
    <div className="page">
      <KPI k={k} />
      <div className="grid-2">
        <div className="card span-2">
          <h3>Spend Trend Bulanan</h3>
          <Chart option={trendOpt} height={300} />
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Spend per Kategori</h3>
          <Chart option={catOpt} height={340} />
        </div>
        <div className="card">
          <h3>Procurement Funnel</h3>
          <Chart option={funnelOpt} height={340} />
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Budget vs Committed vs Actual</h3>
          <Chart option={budgetOpt} height={320} />
        </div>
        <div className="card">
          <h3>Top Vendors by Spend</h3>
          <VendorBars vendors={data.vendorSpend} />
        </div>
      </div>
    </div>
  );
}

function VendorBars({ vendors }) {
  const top = vendors.slice(0, 10);
  const opt = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmtIDR(v), axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (v) => `${(v / 1e9).toFixed(1)}M` }, splitLine: axisStyle.splitLine },
    yAxis: { type: 'category', data: top.map((v) => v.name).reverse(), axisLabel: { color: '#cbd5e1', fontSize: 11 } },
    series: [{ type: 'bar', data: top.map((v) => v.value).reverse(), itemStyle: { color: '#818cf8', borderRadius: [0, 4, 4, 0] } }],
  };
  return <Chart option={opt} height={320} />;
}
