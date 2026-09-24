import Chart, { baseGrid, axisStyle } from '../components/Chart';
import { fmtIDR } from '../api';

export default function Contracts({ data }) {
  const gaugeOpt = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        progress: { show: true, width: 18, itemStyle: { color: '#38bdf8' } },
        axisLine: { lineStyle: { width: 18, color: [[1, '#1e293b']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#64748b', distance: 22, fontSize: 10 },
        pointer: { show: false },
        detail: { valueAnimation: true, formatter: '{value}%', color: '#f8fafc', fontSize: 30, offsetCenter: [0, '5%'] },
        title: { color: '#94a3b8', offsetCenter: [0, '35%'] },
        data: [{ value: data.compliancePct, name: 'Contract Compliance' }],
      },
    ],
  };

  const expiring = data.contracts.filter((c) => c.daysToExpiry >= 0 && c.daysToExpiry <= 180);

  return (
    <div className="page">
      <div className="grid-2">
        <div className="card">
          <h3>Contract Compliance</h3>
          <Chart option={gaugeOpt} height={280} />
          <div className="mini-metrics">
            <div><span className="muted">On-Contract</span><b>{fmtIDR(data.onContractValue)}</b></div>
            <div><span className="muted">Off-Contract (maverick)</span><b className="warn">{fmtIDR(data.offContractValue)}</b></div>
          </div>
        </div>
        <div className="card">
          <h3>Kontrak Akan Expired (&le; 180 hari)</h3>
          {expiring.length ? (
            <ul className="list">
              {expiring.map((c) => (
                <li key={c.id}>
                  <span>{c.number} — {c.vendor} <span className="muted">({c.category})</span></span>
                  <span className={c.daysToExpiry < 60 ? 'bad' : 'warn'}>{c.daysToExpiry} hari {c.autoRenew ? '(auto-renew)' : ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Tidak ada kontrak yang akan expired.</p>
          )}
          <h4>Ringkasan</h4>
          <div className="mini-metrics">
            <div><span className="muted">Total Nilai Kontrak</span><b>{fmtIDR(data.contracts.reduce((s, c) => s + c.value, 0))}</b></div>
            <div><span className="muted">Total Savings</span><b className="good">{fmtIDR(data.contracts.reduce((s, c) => s + c.savings, 0))}</b></div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Daftar Kontrak</h3>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>No. Kontrak</th><th>Vendor</th><th>Kategori</th><th>Mulai</th><th>Berakhir</th><th>Nilai</th><th>Savings</th><th>Status</th><th>Auto-Renew</th></tr></thead>
            <tbody>
              {data.contracts.map((c) => (
                <tr key={c.id}>
                  <td>{c.number}</td>
                  <td>{c.vendor}</td>
                  <td className="muted">{c.category}</td>
                  <td className="muted">{c.start}</td>
                  <td className={c.daysToExpiry < 0 ? 'bad' : c.daysToExpiry < 90 ? 'warn' : ''}>{c.end}</td>
                  <td>{fmtIDR(c.value)}</td>
                  <td className="good">{fmtIDR(c.savings)}</td>
                  <td><span className={`badge ${c.status === 'active' ? 'good' : 'warn'}`}>{c.status}</span></td>
                  <td>{c.autoRenew ? 'Ya' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
