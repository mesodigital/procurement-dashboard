import Chart, { PALETTE, axisStyle } from '../components/Chart';
import { fmtIDR, fmtNum } from '../api';

export default function Clustering({ data }) {
  const clusters = [...new Set(data.vendors.map((v) => v.cluster))].sort();

  const scatterOpt = {
    tooltip: {
      formatter: (p) => `${p.data.name}<br/>Cluster ${p.data.cluster}<br/>Spend: ${fmtIDR(p.data.spend)}<br/>On-time: ${p.data.onTime}%<br/>Lead: ${p.data.lead} hari`,
    },
    legend: { data: clusters.map((c) => `Cluster ${c}`), textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 60, right: 30, top: 40, bottom: 40, containLabel: true },
    xAxis: { name: 'On-Time %', type: 'value', ...axisStyle },
    yAxis: { name: 'Spend', type: 'value', axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${(v / 1e9).toFixed(1)}M` }, splitLine: axisStyle.splitLine },
    series: clusters.map((c: number) => ({
      name: `Cluster ${c}`,
      type: 'scatter',
      symbolSize: (d: any) => 12 + Math.sqrt(d[0]) / 10,
      data: data.vendors.filter((v) => v.cluster === c).map((v) => ({ value: [v.onTime, v.spend], name: v.name, cluster: c, spend: v.spend, onTime: v.onTime, lead: v.lead, itemStyle: { color: PALETTE[c % PALETTE.length], opacity: 0.85 } })),
    })),
  };

  return (
    <div className="page">
      <div className="grid-4">
        <div className="stat"><div className="stat-label">Jumlah Vendor</div><div className="stat-value">{fmtNum(data.vendors.length)}</div></div>
        <div className="stat"><div className="stat-label">Jumlah Cluster</div><div className="stat-value">{data.clusters.length}</div></div>
        <div className="stat"><div className="stat-label">Silhouette Score</div><div className="stat-value">{data.silhouette}</div><div className="stat-hint">Makin dekat 1 = cluster makin padat &amp; terpisah</div></div>
        <div className="stat"><div className="stat-label">Fitur</div><div className="stat-value">6</div><div className="stat-hint">spend, on-time, defect, response, lead time, dependency</div></div>
      </div>

      <div className="card">
        <h3>Segmentasi Vendor Otomatis (k-means, k=4)</h3>
        <p className="muted small">Vendor dikelompokkan dari 6 dimensi (di-z-score), tanpa threshold manual. Label cluster diturunkan dari profil centroid.</p>
        <Chart option={scatterOpt} height={420} />
      </div>

      <div className="grid-2">
        {data.clusters.map((c) => (
          <div className="card" key={c.cluster} style={{ borderLeft: `3px solid ${PALETTE[c.cluster % PALETTE.length]}` }}>
            <h3 style={{ color: PALETTE[c.cluster % PALETTE.length] }}>
              {clusterName(c)} <span className="muted">({c.count} vendor)</span>
            </h3>
            <div className="mini-metrics">
              <div><span className="muted">Spend</span><b>{fmtIDR(c.spend)}</b></div>
              <div><span className="muted">On-time</span><b>{c.avgOnTime}%</b></div>
              <div><span className="muted">Defect</span><b>{c.avgDefect}%</b></div>
              <div><span className="muted">Lead</span><b>{c.avgLead} hari</b></div>
            </div>
            <p className="muted small">{c.members.join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function clusterName(c) {
  if (c.avgOnTime >= 88 && c.avgDefect < 3) return 'Performer Utama';
  if (c.avgOnTime < 85 || c.avgDefect >= 3) return 'Perlu Perbaikan';
  if (c.avgLead > 18) return 'Lead Time Panjang';
  return 'Menengah / Stabil';
}
