import Chart, { baseGrid, axisStyle } from '../components/Chart';
import { fmtIDR, fmtNum } from '../api';

export default function Anomaly({ data }) {
  const b = data.benford;
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const totalObs = b.observed.reduce((s, v) => s + v, 0);
  const totalExp = b.expected.reduce((s, v) => s + v, 0);

  const benfordOpt = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Observasi', 'Benford Expected'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: baseGrid,
    xAxis: { type: 'category', data: digits, ...axisStyle },
    yAxis: { type: 'value', axisLabel: { ...axisStyle.axisLabel, formatter: (v) => `${((v / totalObs) * 100).toFixed(0)}%` }, splitLine: axisStyle.splitLine },
    series: [
      { name: 'Observasi', type: 'bar', data: b.observed, itemStyle: { color: '#38bdf8', borderRadius: [4, 4, 0, 0] } },
      { name: 'Benford Expected', type: 'line', data: b.expected, smooth: true, lineStyle: { color: '#f59e0b', width: 2 }, itemStyle: { color: '#f59e0b' } },
    ],
  };

  const chiSignificant = b.chi2 > b.critical95;

  return (
    <div className="page">
      <div className="grid-4">
        <div className="stat"><div className="stat-label">Total Anomali</div><div className="stat-value">{fmtNum(data.summary.total)}</div></div>
        <div className="stat bad"><div className="stat-label">Severity High</div><div className="stat-value">{fmtNum(data.summary.high)}</div></div>
        <div className="stat warn"><div className="stat-label">Indikasi Split PO</div><div className="stat-value">{fmtNum(data.summary.splitPO)}</div></div>
        <div className="stat warn"><div className="stat-label">Price Outlier</div><div className="stat-value">{fmtNum(data.summary.priceOutlier)}</div></div>
      </div>

      <div className="card">
        <h3>Deteksi Anomali Transaksi</h3>
        <p className="muted small">Kombinasi Modified Z-score (harga per item), Isolation Forest (multi-dimensi: harga, qty, lead time, variance), deteksi split PO (vendor+item sama, &le;3 hari, PR berbeda), dan deteksi duplikasi rekening bank vendor.</p>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>PO</th><th>Tanggal</th><th>Vendor</th><th>Item</th><th>Amount</th><th>Qty</th><th>Price Var</th><th>Flags</th><th>Skor</th></tr>
            </thead>
            <tbody>
              {data.anomalies.slice(0, 40).map((a) => (
                <tr key={a.po_id}>
                  <td>{a.po_number}</td>
                  <td className="muted">{a.po_date}</td>
                  <td>{a.vendor}</td>
                  <td className="muted">{a.item}</td>
                  <td>{fmtIDR(a.amount)}</td>
                  <td>{fmtNum(a.qty)}</td>
                  <td className={a.priceVar > 0 ? 'bad' : 'good'}>{a.priceVar}%</td>
                  <td>
                    {a.priceZ ? <span className="badge warn">Z</span> : null}
                    {a.splitPO ? <span className="badge bad">Split</span> : null}
                    {a.isolationScore >= 0.6 ? <span className="badge info">IF</span> : null}
                  </td>
                  <td><span className={`badge ${a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : ''}`}>{a.severity} ({a.score})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Benford's Law — Nominal Invoice</h3>
          <p className="muted small">
            Distribusi digit pertama. Chi-square = <b className={chiSignificant ? 'bad' : 'good'}>{b.chi2}</b> (df {b.df}, kritis 95% = {b.critical95}).
            {' '}{chiSignificant ? 'Signifikan — perlu investigasi.' : 'Tidak signifikan — distribusi wajar.'}
          </p>
          <Chart option={benfordOpt} height={330} />
        </div>
        <div className="card">
          <h3>Fraud Checks</h3>
          <h4>Duplikasi Rekening Bank</h4>
          {data.duplicateBanks.length ? (
            <table className="tbl">
              <thead><tr><th>No. Rekening</th><th>Vendor</th></tr></thead>
              <tbody>
                {data.duplicateBanks.map((d) => (
                  <tr key={d.account}><td>{d.account}</td><td className="bad">{d.vendors.join(', ')}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="good">Tidak ada rekening duplikat.</p>
          )}
          <h4>Catatan Metode</h4>
          <ul className="list">
            <li><b>Modified Z-score (MAD)</b> — robust terhadap outlier ekstrem, threshold 3.5.</li>
            <li><b>Isolation Forest</b> — 100 trees, sampel 64, skor &gt; persentil 97.</li>
            <li><b>Benford</b> — uji chi-square digit pertama.</li>
            <li><b>Split PO</b> — hindari ambang batas approval.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
