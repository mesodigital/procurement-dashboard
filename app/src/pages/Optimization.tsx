import { useState } from 'react';
import Chart, { PALETTE, axisStyle } from '../components/Chart';
import { useApi, fmtIDR, fmtNum } from '../api';

export default function Optimization({ categories }) {
  const [category, setCategory] = useState('');
  const { data, loading } = useApi('optimization', { category });

  const opt = data && {
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmtIDR(v) },
    legend: { data: ['Harga Efektif/Unit', 'Nilai Alokasi'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 10, right: 50, top: 40, bottom: 10, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: (v) => `${(v / 1e3).toFixed(0)}k` }, splitLine: axisStyle.splitLine },
    yAxis: { type: 'category', data: data.suppliers.map((s) => s.name).reverse(), axisLabel: { color: '#cbd5e1', fontSize: 11 } },
    series: [
      { name: 'Harga Efektif/Unit', type: 'bar', data: data.suppliers.map((s) => ({ value: s.cost, itemStyle: { color: '#38bdf8', borderRadius: [0, 4, 4, 0] } })).reverse() },
    ],
  };

  return (
    <div className="page">
      <div className="toolbar">
        <label className="muted">
          Kategori:{' '}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {loading && <div className="card">Menghitung alokasi optimal...</div>}
      {data && (
        <>
          <div className="grid-4">
            <div className="stat"><div className="stat-label">Demand</div><div className="stat-value">{fmtNum(data.demand)} unit</div></div>
            <div className="stat"><div className="stat-label">Biaya Optimal</div><div className="stat-value">{fmtIDR(data.totalCost)}</div></div>
            <div className="stat"><div className="stat-label">Biaya Baseline</div><div className="stat-value">{fmtIDR(data.baselineCost)}</div></div>
            <div className="stat good"><div className="stat-label">Potensi Penghematan</div><div className="stat-value">{fmtIDR(Math.max(0, data.baselineCost - data.totalCost))}</div><div className="stat-hint">{data.baselineCost ? `${(((data.baselineCost - data.totalCost) / data.baselineCost) * 100).toFixed(1)}%` : '-'}</div></div>
          </div>

          <div className="card">
            <h3>Harga Efektif per Unit</h3>
            <p className="muted small">Cost efektif = harga &times; (1 + reject rate) + penalti keterlambatan. Alokasi LP meminimalkan total biaya dengan batas kapasitas tiap vendor.</p>
            <Chart option={opt} height={Math.max(240, data.suppliers.length * 40)} />
          </div>

          <div className="card">
            <h3>Alokasi Optimal</h3>
            <table className="tbl">
              <thead><tr><th>Vendor</th><th>Harga</th><th>Reject %</th><th>On-Time %</th><th>Cost Efektif</th><th>Kapasitas</th><th>Dialokasikan</th><th>Nilai</th><th>Share</th></tr></thead>
              <tbody>
                {data.suppliers.map((s, i) => (
                  <tr key={s.id} className={s.allocated > 0 ? 'row-active' : ''}>
                    <td>{s.name}</td>
                    <td>{fmtIDR(s.price)}</td>
                    <td className={s.reject > 3 ? 'bad' : ''}>{s.reject}</td>
                    <td>{s.onTime}</td>
                    <td>{fmtIDR(s.cost)}</td>
                    <td className="muted">{fmtNum(s.capacity)}</td>
                    <td><b>{fmtNum(s.allocated)}</b></td>
                    <td>{fmtIDR(s.allocatedValue)}</td>
                    <td style={{ color: PALETTE[i % PALETTE.length] }}>{data.demand ? `${((s.allocated / data.demand) * 100).toFixed(1)}%` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.feasible && <p className="warn small">Catatan: demand {fmtNum(data.unmet)} unit belum terpenuhi (kapasitas vendor kurang).</p>}
          </div>
        </>
      )}
    </div>
  );
}
