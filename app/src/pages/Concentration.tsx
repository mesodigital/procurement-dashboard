import { useState } from 'react';
import Chart, { baseGrid, axisStyle } from '../components/Chart';
import { fmtIDR, fmtNum, fmtPct } from '../api';

const dims = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'item', label: 'Item' },
  { key: 'category', label: 'Kategori' },
  { key: 'costCenter', label: 'Cost Center' },
];

export default function Concentration({ data }) {
  const [dim, setDim] = useState('vendor');
  const d = data[dim];

  const lorenzOpt = {
    tooltip: { trigger: 'axis' },
    grid: baseGrid,
    xAxis: { name: 'Kumulatif aktor', type: 'value', max: 1, ...axisStyle },
    yAxis: { name: 'Kumulatif spend', type: 'value', max: 1, ...axisStyle },
    series: [
      {
        type: 'line',
        data: d.lorenz.map((p) => [p.x, p.y]),
        showSymbol: false,
        lineStyle: { color: '#f472b6', width: 2 },
        areaStyle: { color: 'rgba(244,114,182,0.1)' },
      },
      {
        type: 'line',
        data: [[0, 0], [1, 1]],
        showSymbol: false,
        lineStyle: { color: '#475569', type: 'dashed' },
      },
    ],
  };

  const paretoOpt = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Spend', 'Kumulatif %'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: baseGrid,
    xAxis: { type: 'category', data: d.pareto.top.map((r) => r.name), axisLabel: { color: '#94a3b8', rotate: 30, fontSize: 10 }, axisLine: axisStyle.axisLine },
    yAxis: [
      { type: 'value', name: 'Spend', axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${(v / 1e9).toFixed(1)}M` }, splitLine: axisStyle.splitLine },
      { type: 'value', name: 'Kumulatif', max: 1, axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${(v * 100).toFixed(0)}%` }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Spend', type: 'bar', data: d.pareto.top.map((r) => r.value), itemStyle: { color: '#38bdf8', borderRadius: [4, 4, 0, 0] } },
      { name: 'Kumulatif %', type: 'line', yAxisIndex: 1, data: d.pareto.top.map((r) => r.cumulative), smooth: true, lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
    ],
  };

  return (
    <div className="page">
      <div className="dim-tabs">
        {dims.map((x) => (
          <button key={x.key} className={dim === x.key ? 'active' : ''} onClick={() => setDim(x.key)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid-4">
        <Metric label="HHI (0-1)" value={d.hhi.toFixed(4)} hint="Makin tinggi = makin terkonsentrasi" />
        <Metric label="HHI Ternormalisasi" value={d.hhiNorm.toFixed(4)} hint="0 = merata, 1 = monopoli" />
        <Metric label="Gini" value={d.gini.toFixed(4)} hint="Ketimpangan distribusi spend" />
        <Metric label="Entitas" value={fmtNum(d.n)} hint={`Total ${fmtIDR(d.total)}`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Lorenz Curve — {dims.find((x) => x.key === dim).label}</h3>
          <Chart option={lorenzOpt} height={340} />
        </div>
        <div className="card">
          <h3>Pareto 80/20</h3>
          <Chart option={paretoOpt} height={340} />
        </div>
      </div>

      <div className="card">
        <h3>
          Konsentrasi — <span className="accent">
            {d.pareto.headCount} dari {d.n} {dims.find((x) => x.key === dim).label.toLowerCase()} ({fmtPct(d.pareto.headShare * 100, 0)})
          </span>{' '}
          pegang 80% spend
        </h3>
        <table className="tbl">
          <thead>
            <tr><th>#</th><th>Nama</th><th>Spend</th><th>Share</th><th>Kumulatif</th></tr>
          </thead>
          <tbody>
            {d.pareto.top.map((r) => (
              <tr key={r.rank}>
                <td>{r.rank}</td>
                <td>{r.name}</td>
                <td>{fmtIDR(r.value)}</td>
                <td>{fmtPct(r.share * 100)}</td>
                <td>{fmtPct(r.cumulative * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
