import Chart, { baseGrid, axisStyle } from '../components/Chart';
import { fmtIDR, fmtNum } from '../api';

export default function Causal({ data }) {
  const sig = (t) => Math.abs(t) > 1.96;

  const coefOpt = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 40, top: 20, bottom: 20, containLabel: true },
    xAxis: { type: 'value', ...axisStyle },
    yAxis: { type: 'category', data: data.coefficients.map((c) => c.name).reverse(), axisLabel: { color: '#cbd5e1', fontSize: 11 } },
    series: [
      {
        type: 'bar',
        data: data.coefficients.map((c) => ({ value: c.beta, itemStyle: { color: sig(c.t) ? (c.beta > 0 ? '#f472b6' : '#38bdf8') : '#64748b', borderRadius: [0, 4, 4, 0] } })).reverse(),
        label: { show: true, position: 'right', color: '#cbd5e1', formatter: (p) => `${p.value} (t=${data.coefficients[data.coefficients.length - 1 - p.dataIndex].t})` },
      },
    ],
  };

  return (
    <div className="page">
      <div className="grid-4">
        <div className="stat"><div className="stat-label">R&#178;</div><div className="stat-value">{data.r2}</div><div className="stat-hint">Proporsi variansi lead time terjelaskan</div></div>
        <div className="stat"><div className="stat-label">Adjusted R&#178;</div><div className="stat-value">{data.adjR2}</div></div>
        <div className="stat"><div className="stat-label">Observasi</div><div className="stat-value">{fmtNum(data.n)}</div></div>
        <div className="stat"><div className="stat-label">Korelasi Volume-Price</div><div className="stat-value">{data.volumePriceCorr}</div><div className="stat-hint">Pearson log(qty) vs log(harga)</div></div>
      </div>

      <div className="card">
        <h3>Regresi Lead Time (OLS)</h3>
        <p className="muted small">Model: lead_time ~ log(Qty) + log(Unit Price) + Amount + dummy kategori. Koefisien signifikan (|t| &gt; 1.96) disorot. Warna merah = efek positif (memperlambat), biru = mempercepat.</p>
        <Chart option={coefOpt} height={340} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Koefisien Detail</h3>
          <table className="tbl">
            <thead><tr><th>Variabel</th><th>Beta</th><th>SE</th><th>t-stat</th><th>Signifikan</th></tr></thead>
            <tbody>
              {data.coefficients.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.beta}</td>
                  <td className="muted">{c.se}</td>
                  <td>{c.t}</td>
                  <td>{sig(c.t) ? <span className="badge good">Ya</span> : <span className="badge">Tidak</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Rata-rata Lead Time per Kategori</h3>
          <LeadBars data={data.leadByCat} />
        </div>
      </div>
    </div>
  );
}

function LeadBars({ data }) {
  const opt = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} hari` },
    grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: axisStyle.splitLine },
    yAxis: { type: 'category', data: data.map((d) => d.name).reverse(), axisLabel: { color: '#cbd5e1', fontSize: 11 } },
    series: [{ type: 'bar', data: data.map((d) => d.avgLead).reverse(), itemStyle: { color: '#fb923c', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#cbd5e1', formatter: (p) => `${p.value} hari` } }],
  };
  return <Chart option={opt} height={340} />;
}
