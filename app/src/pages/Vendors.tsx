import { useState } from 'react';
import { fmtIDR, fmtNum } from '../api';

export default function Vendors({ data }) {
  const [sortKey, setSortKey] = useState('spend');
  const [q, setQ] = useState('');
  const rows = [...data]
    .filter((v) => v.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sortKey === 'risk' ? (b.riskScore || 0) - (a.riskScore || 0) : sortKey === 'ontime' ? (a.onTimePct || 0) - (b.onTimePct || 0) : b.spend - a.spend));

  return (
    <div className="page">
      <div className="toolbar">
        <input className="search" placeholder="Cari vendor..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="dim-tabs small">
          <button className={sortKey === 'spend' ? 'active' : ''} onClick={() => setSortKey('spend')}>Spend</button>
          <button className={sortKey === 'risk' ? 'active' : ''} onClick={() => setSortKey('risk')}>Risiko</button>
          <button className={sortKey === 'ontime' ? 'active' : ''} onClick={() => setSortKey('ontime')}>On-Time (terburuk)</button>
        </div>
      </div>
      <div className="card">
        <h3>Vendor Scorecard ({rows.length})</h3>
        <p className="muted small">Skor gabungan performa (on-time, defect, lead time) + risiko (dependency, single-source) + faktor ESG.</p>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Vendor</th><th>Spend</th><th>PO</th><th>On-Time %</th><th>Defect %</th><th>Lead</th><th>Risiko</th><th>Dependency %</th><th>Single-Source</th><th>Kredit</th><th>Lokal</th><th>CO2 (kg)</th></tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{fmtIDR(v.spend)}</td>
                  <td className="muted">{v.orders}</td>
                  <td className={v.onTimePct != null && v.onTimePct < 85 ? 'bad' : v.onTimePct != null && v.onTimePct >= 90 ? 'good' : ''}>{v.onTimePct ?? '-'}</td>
                  <td className={v.rejectPct > 3 ? 'bad' : ''}>{v.rejectPct ?? '-'}</td>
                  <td>{v.avgLead ?? '-'}</td>
                  <td>{v.riskScore != null ? <span className={`badge ${v.riskScore > 60 ? 'bad' : v.riskScore > 40 ? 'warn' : 'good'}`}>{v.riskScore}</span> : '-'}</td>
                  <td>{v.dependency ?? '-'}</td>
                  <td>{v.singleSource ? <span className="badge bad">Ya</span> : <span className="badge good">Tidak</span>}</td>
                  <td>{v.creditRating || '-'}</td>
                  <td>{v.isLocal ? <span className="badge good">Lokal</span> : '-'}</td>
                  <td className="muted">{fmtNum(v.carbon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
