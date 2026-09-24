import { useState } from 'react';
import Chart, { axisStyle } from '../components/Chart';
import { fmtIDR, fmtNum } from '../api';

const ABC_COLOR = { A: '#f472b6', B: '#fb923c', C: '#64748b' };
const XYZ_DESC = {
  X: ['X', 'Stabil', 'CV \u2264 0.5', '#34d399'],
  Y: ['Y', 'Fluktuatif', '0.5 < CV \u2264 1', '#facc15'],
  Z: ['Z', 'Tak menentu', 'CV > 1', '#f87171'],
};

export default function AbcXyz({ data }) {
  const [sortKey, setSortKey] = useState('value');
  const matrixMap = Object.fromEntries(data.matrix.map((m) => [m.cell, m]));

  const heat = [];
  ['A', 'B', 'C'].forEach((a, ai) => {
    ['X', 'Y', 'Z'].forEach((x, xi) => {
      const cell = matrixMap[a + x] || { count: 0, spend: 0 };
      heat.push([xi, ai, cell.count, cell.spend]);
    });
  });

  const maxCount = Math.max(1, ...heat.map((h) => h[2]));
  const heatOpt = {
    tooltip: {
      formatter: (p) => `ABC-${['A', 'B', 'C'][p.data[1]]} / XYZ-${['X', 'Y', 'Z'][p.data[0]]}<br/>Items: ${p.data[2]}<br/>Spend: ${fmtIDR(p.data[3])}`,
    },
    grid: { left: 50, right: 30, top: 20, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: ['X (Stabil)', 'Y (Fluktuatif)', 'Z (Tak menentu)'], ...axisStyle, splitArea: { show: true } },
    yAxis: { type: 'category', data: ['A (High value)', 'B (Medium)', 'C (Low)'], ...axisStyle, splitArea: { show: true } },
    visualMap: { min: 0, max: maxCount, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#94a3b8' }, inRange: { color: ['#0f172a', '#1e40af', '#38bdf8'] } },
    series: [
      {
        type: 'heatmap',
        data: heat,
        label: { show: true, color: '#f8fafc', formatter: (p) => `${p.data[2]} item` },
        itemStyle: { borderColor: '#0f172a', borderWidth: 2 },
      },
    ],
  };

  const sorted = [...data.items].sort((a, b) => {
    if (sortKey === 'value') return b.value - a.value;
    if (sortKey === 'cv') return (b.cv ?? 0) - (a.cv ?? 0);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="page">
      <div className="grid-2">
        <div className="card">
          <h3>ABC-XYZ Matrix</h3>
          <p className="muted small">ABC = nilai konsumsi (A: 80% nilai, B: 15%, C: 5%). XYZ = variabilitas demand (CV). Kombinasi AX = prioritas kontrol ketat & kontrak stabil; CZ = kandidat katalog/self-service.</p>
          <Chart option={heatOpt} height={360} />
        </div>
        <div className="card">
          <h3>Legenda &amp; Strategi</h3>
          <div className="legend-grid">
            {['A', 'B', 'C'].map((a) => (
              <div key={a} className="legend-row">
                <span className="dot" style={{ background: ABC_COLOR[a] }} /> <b>ABC-{a}</b>{' '}
                <span className="muted">{a === 'A' ? '80% nilai' : a === 'B' ? '15% nilai' : '5% nilai'}</span>
              </div>
            ))}
            {Object.values(XYZ_DESC).map(([x, name, rule, color]) => (
              <div key={x} className="legend-row">
                <span className="dot" style={{ background: color }} /> <b>XYZ-{x}</b> <span className="muted">{name} ({rule})</span>
              </div>
            ))}
          </div>
          <h4>Rekomendasi</h4>
          <ul className="list">
            <li><b>AX/AY</b> — kontrak jangka panjang, safety stock, monitoring ketat.</li>
            <li><b>AZ/BZ</b> — forecast statistik / buffer, cari alternatif supplier.</li>
            <li><b>BX/BY</b> — kontrak volume, review berkala.</li>
            <li><b>CX/CZ</b> — katalog, self-service, order otomatis (kanban/VMI).</li>
          </ul>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h3>Detail Item ({sorted.length})</h3>
          <div className="dim-tabs small">
            <button className={sortKey === 'value' ? 'active' : ''} onClick={() => setSortKey('value')}>Sort: Spend</button>
            <button className={sortKey === 'cv' ? 'active' : ''} onClick={() => setSortKey('cv')}>Sort: CV</button>
            <button className={sortKey === 'name' ? 'active' : ''} onClick={() => setSortKey('name')}>Sort: Nama</button>
          </div>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Item</th><th>Kategori</th><th>Spend</th><th>Kumulatif</th><th>ABC</th><th>CV</th><th>XYZ</th><th>Kelas</th></tr>
            </thead>
            <tbody>
              {sorted.map((it) => (
                <tr key={it.key}>
                  <td>{it.name}</td>
                  <td className="muted">{it.category}</td>
                  <td>{fmtIDR(it.value)}</td>
                  <td>{it.cumulative != null ? `${(it.cumulative * 100).toFixed(0)}%` : '-'}</td>
                  <td><span className="badge" style={{ background: ABC_COLOR[it.abc] }}>{it.abc}</span></td>
                  <td>{it.cv ?? '-'}</td>
                  <td><span className="badge" style={{ background: XYZ_DESC[it.xyz][3] }}>{it.xyz}</span></td>
                  <td><b>{it.abc}{it.xyz}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
