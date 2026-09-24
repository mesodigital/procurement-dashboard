import { useState } from 'react';
import { useApi } from './api';
import Overview from './pages/Overview';
import Concentration from './pages/Concentration';
import Kraljic from './pages/Kraljic';
import AbcXyz from './pages/AbcXyz';
import Clustering from './pages/Clustering';
import Forecast from './pages/Forecast';
import Anomaly from './pages/Anomaly';
import Causal from './pages/Causal';
import Optimization from './pages/Optimization';
import Vendors from './pages/Vendors';
import Contracts from './pages/Contracts';
import './App.css';

const NAV = [
  { key: 'overview', label: 'Overview', group: 'Ringkasan' },
  { key: 'vendors', label: 'Vendor Scorecard', group: 'Ringkasan' },
  { key: 'contracts', label: 'Contract Compliance', group: 'Ringkasan' },
  { key: 'concentration', label: 'Konsentrasi (HHI/Gini/Lorenz)', group: 'Segmentasi' },
  { key: 'kraljic', label: 'Kraljic Matrix', group: 'Segmentasi' },
  { key: 'abcxyz', label: 'ABC-XYZ', group: 'Segmentasi' },
  { key: 'clustering', label: 'Clustering Vendor', group: 'Segmentasi' },
  { key: 'forecast', label: 'Forecasting', group: 'Prediktif' },
  { key: 'anomaly', label: 'Deteksi Anomali', group: 'Prediktif' },
  { key: 'causal', label: 'Regresi / Kausal', group: 'Preskriptif' },
  { key: 'optimization', label: 'Optimasi Alokasi (LP)', group: 'Preskriptif' },
];

const PAGE_API = {
  overview: 'overview',
  concentration: 'concentration',
  kraljic: 'kraljic',
  abcxyz: 'abcxyz',
  clustering: 'clustering',
  anomaly: 'anomaly',
  causal: 'causal',
  vendors: 'vendors',
  contracts: 'contracts',
};

export default function App() {
  const [page, setPage] = useState('overview');
  const [filters, setFilters] = useState({ year: '', category: '', vendor: '', entity: '', status: '' });
  const { data: options } = useApi('filters');
  const mainApi = useApi(PAGE_API[page] || 'overview', filters);
  const items = useApi('forecast/items');
  const cats = useApi('optimization/categories');

  const render = () => {
    if (page === 'forecast') return <Forecast items={items.data} />;
    if (page === 'optimization') return <Optimization categories={cats.data} />;
    if (mainApi.loading || !mainApi.data) return <div className="card">Memuat data...</div>;
    const d = mainApi.data;
    switch (page) {
      case 'overview': return <Overview data={d} />;
      case 'concentration': return <Concentration data={d} />;
      case 'kraljic': return <Kraljic data={d} />;
      case 'abcxyz': return <AbcXyz data={d} />;
      case 'clustering': return <Clustering data={d} />;
      case 'anomaly': return <Anomaly data={d} />;
      case 'causal': return <Causal data={d} />;
      case 'vendors': return <Vendors data={d} />;
      case 'contracts': return <Contracts data={d} />;
      default: return null;
    }
  };

  const groups = [...new Set(NAV.map((n) => n.group))];
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">P</div>
          <div>
            <div className="brand-title">Procurement</div>
            <div className="brand-sub">Analytics Portal</div>
          </div>
        </div>
        {groups.map((g) => (
          <div key={g} className="nav-group">
            <div className="nav-group-title">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => (
              <button key={n.key} className={`nav-item ${page === n.key ? 'active' : ''}`} onClick={() => setPage(n.key)}>
                {n.label}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-foot muted">Data: 940+ PO &middot; 30 vendor &middot; 40 item<br />2024–2025</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h2>{NAV.find((n) => n.key === page)?.label}</h2>
          <div className="filters">
            <select value={filters.year} onChange={set('year')}>
              <option value="">Semua Tahun</option>
              {options?.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filters.category} onChange={set('category')}>
              <option value="">Semua Kategori</option>
              {options?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filters.entity} onChange={set('entity')}>
              <option value="">Semua Entitas</option>
              {options?.entities.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filters.status} onChange={set('status')}>
              <option value="">Semua Status</option>
              {options?.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </header>
        <div className="content">{render()}</div>
      </main>
    </div>
  );
}
