import { useState } from 'react';
import Chart, { baseGrid, axisStyle } from '../components/Chart';
import { useApi, fmtIDR, fmtNum } from '../api';

export default function Forecast({ items }) {
  const [mode, setMode] = useState('spend');
  const [item, setItem] = useState('');
  const [horizon, setHorizon] = useState(6);
  const params = { mode, horizon, item: mode === 'demand' ? item : undefined };
  const { data, loading } = useApi('forecast', params);

  const valid = data && !loading;

  const opt = valid && {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Aktual', 'Fitted', 'Forecast'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: baseGrid,
    xAxis: { type: 'category', data: [...data.labels, ...data.forecastLabels], axisLabel: { color: '#94a3b8', rotate: 30, fontSize: 10 }, axisLine: axisStyle.axisLine },
    yAxis: {
      type: 'value',
      axisLabel: { ...axisStyle.axisLabel, formatter: (v) => (mode === 'spend' ? `${(v / 1e9).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`) },
      splitLine: axisStyle.splitLine,
    },
    series: [
      { name: 'Aktual', type: 'line', data: [...data.actual, ...Array(data.forecast.length).fill(null)], lineStyle: { color: '#38bdf8', width: 2 }, itemStyle: { color: '#38bdf8' }, symbol: 'circle', symbolSize: 5 },
      { name: 'Fitted', type: 'line', data: [...data.fitted, ...Array(data.forecast.length).fill(null)], lineStyle: { color: '#64748b', type: 'dashed' }, itemStyle: { color: '#64748b' }, symbol: 'none' },
      { name: 'Forecast', type: 'line', data: [...Array(data.actual.length - 1).fill(null), data.actual[data.actual.length - 1], ...data.forecast], lineStyle: { color: '#f472b6', width: 2 }, itemStyle: { color: '#f472b6' }, symbol: 'diamond', symbolSize: 7 },
    ],
  };

  return (
    <div className="page">
      <div className="toolbar">
        <div className="dim-tabs">
          <button className={mode === 'spend' ? 'active' : ''} onClick={() => setMode('spend')}>Spend Bulanan</button>
          <button className={mode === 'demand' ? 'active' : ''} onClick={() => setMode('demand')}>Demand Item</button>
        </div>
        {mode === 'demand' && (
          <select value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">-- pilih item (auto) --</option>
            {items?.map((it) => (
              <option key={it.id} value={it.id}>{it.name}</option>
            ))}
          </select>
        )}
        <label className="muted">
          Horizon:{' '}
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {[3, 6, 9, 12].map((h) => <option key={h} value={h}>{h} bulan</option>)}
          </select>
        </label>
      </div>

      {loading && <div className="card">Memuat model...</div>}
      {valid && (
        <>
          <div className="grid-4">
            <div className="stat"><div className="stat-label">Metode Terpilih</div><div className="stat-value small">{data.method}</div><div className="stat-hint">Auto-dipilih dari MAPE backtest terendah</div></div>
            <div className="stat"><div className="stat-label">MAPE</div><div className="stat-value">{data.backtest?.mape != null ? `${data.backtest.mape}%` : '-'}</div><div className="stat-hint">Error rata-rata (%)</div></div>
            <div className="stat"><div className="stat-label">MAE</div><div className="stat-value">{data.backtest?.mae != null ? fmtNum(data.backtest.mae, 1) : '-'}</div><div className="stat-hint">Mean Absolute Error</div></div>
            <div className="stat"><div className="stat-label">MASE</div><div className="stat-value">{data.backtest?.mase ?? '-'}</div><div className="stat-hint">&lt; 1 berarti lebih baik dari naive</div></div>
          </div>

          <div className="card">
            <h3>Forecast {mode === 'spend' ? 'Spend' : 'Demand'} — {data.method}</h3>
            <Chart option={opt} height={400} />
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Perbandingan Model (MAPE)</h3>
              <table className="tbl">
                <thead><tr><th>Model</th><th>MAPE</th><th></th></tr></thead>
                <tbody>
                  {data.candidates.map((c) => (
                    <tr key={c.name} className={c.name === data.method.replace(/ .*/, '') || data.method.includes(c.name) ? 'row-active' : ''}>
                      <td>{c.name}</td>
                      <td>{c.mape != null ? `${c.mape.toFixed(2)}%` : '-'}</td>
                      <td>{data.method.includes(c.name) ? <span className="badge good">Terpilih</span> : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.backtest && (
              <div className="card">
                <h3>Backtest (hold-out 20%)</h3>
                <table className="tbl">
                  <thead><tr><th>Periode</th><th>Aktual</th><th>Prediksi</th><th>Error</th></tr></thead>
                  <tbody>
                    {data.backtest.test.map((t, i) => (
                      <tr key={i}>
                        <td>{data.labels[data.labels.length - data.backtest.test.length + i]}</td>
                        <td>{fmtNum(t, 0)}</td>
                        <td>{fmtNum(data.backtest.pred[i], 0)}</td>
                        <td className={Math.abs((t - data.backtest.pred[i]) / (t || 1)) > 0.2 ? 'bad' : ''}>
                          {t ? `${(((data.backtest.pred[i] - t) / t) * 100).toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
