import Chart, { baseGrid, axisStyle } from '../components/Chart';
import { fmtIDR } from '../api';

const QUAD = {
  strategic: { color: '#f472b6', label: 'Strategic', desc: 'High impact / High risk — partnership jangka panjang, kolaborasi, kontrak jangka panjang.' },
  leverage: { color: '#38bdf8', label: 'Leverage', desc: 'High impact / Low risk — banyak alternatif, fokus negosiasi harga & tender kompetitif.' },
  bottleneck: { color: '#fb923c', label: 'Bottleneck', desc: 'Low impact / High risk — sedikit sumber, jaga supply, cari alternatif & buffer stok.' },
  'non-critical': { color: '#94a3b8', label: 'Non-Critical', desc: 'Low impact / Low risk — efisiensikan proses, katalog & self-service.' },
};

export default function Kraljic({ data }) {
  const grouped = {};
  data.points.forEach((p) => {
    (grouped[p.quadrant] = grouped[p.quadrant] || []).push(p);
  });

  const maxVal = Math.max(...data.points.map((p) => p.value));
  const maxRisk = Math.max(...data.points.map((p) => p.risk));

  const scatterOpt = {
    tooltip: {
      formatter: (p) => `${p.data.name}<br/>Spend: ${fmtIDR(p.data.value)}<br/>Risk score: ${p.data.risk}<br/>Kuadran: <b>${QUAD[p.data.quadrant].label}</b>`,
    },
    grid: { left: 60, right: 30, top: 30, bottom: 50, containLabel: true },
    xAxis: { name: 'Supply Risk \u2192', nameLocation: 'middle', nameGap: 30, type: 'value', max: Math.ceil(maxRisk * 100) / 100 + 0.05, ...axisStyle },
    yAxis: { name: 'Profit Impact (Spend) \u2192', nameLocation: 'middle', nameGap: 50, type: 'value', axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${(v / 1e9).toFixed(1)}M` }, splitLine: axisStyle.splitLine },
    series: [
      {
        type: 'scatter',
        symbolSize: (d: any) => 14 + Math.sqrt(d[0]) / 100,
        data: data.points.map((p) => ({ value: [p.risk, p.value], name: p.name, ...p, itemStyle: { color: QUAD[p.quadrant].color, opacity: 0.85 } })),
        label: { show: true, formatter: (p) => p.data.name, position: 'top', color: '#cbd5e1', fontSize: 10 },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#475569', type: 'dashed' },
          data: [{ xAxis: maxRisk / 2 }, { yAxis: maxVal / 2 }],
        },
      },
    ],
  };

  return (
    <div className="page">
      <div className="grid-2">
        <div className="card span-2">
          <h3>Kraljic Matrix — Kategori Pengadaan</h3>
          <p className="muted">Sumbu Y: nilai spend (profit impact). Sumbu X: skor risiko supply (lead-time variability, reject rate, ketergantungan single-source). Kuadran menentukan strategi sourcing.</p>
          <Chart option={scatterOpt} height={460} />
        </div>
      </div>
      <div className="grid-4">
        {Object.entries(QUAD).map(([key, q]) => (
          <div className="card" key={key} style={{ borderTop: `3px solid ${q.color}` }}>
            <h3 style={{ color: q.color }}>{q.label}</h3>
            <p className="muted small">{q.desc}</p>
            <ul className="list">
              {(grouped[key] || []).map((p) => (
                <li key={p.key}>
                  <span>{p.name}</span>
                  <span className="muted">{fmtIDR(p.value)}</span>
                </li>
              ))}
              {!grouped[key] && <li className="muted">Tidak ada kategori</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
