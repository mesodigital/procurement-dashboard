import { fmtNum, fmtPct } from '../api';

export default function Stat({ label, value, sub, tone = 'default', hint }: { label: any; value: any; sub?: any; tone?: string; hint?: any }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function KPI({ k }) {
  return (
    <div className="kpi-grid">
      <Stat label="Total Spend" value={k.totalSpend != null ? `Rp ${(k.totalSpend / 1e9).toFixed(1)} M` : '-'} sub={`${fmtNum(k.poCount)} PO`} />
      <Stat label="Open PO" value={fmtNum(k.openPO)} sub={`Rp ${(k.openValue / 1e9).toFixed(1)} M`} tone="info" />
      <Stat label="On-Time Delivery" value={fmtPct(k.onTimePct)} tone={k.onTimePct >= 90 ? 'good' : 'warn'} />
      <Stat label="Avg Lead Time" value={`${fmtNum(k.avgLeadTime, 1)} hari`} />
      <Stat label="Negotiated Savings" value={`Rp ${(k.savings / 1e9).toFixed(2)} M`} tone="good" />
      <Stat label="Approval SLA Breach" value={fmtPct(k.approvalBreachPct)} tone={k.approvalBreachPct > 20 ? 'bad' : 'good'} />
      <Stat label="Budget Burn" value={fmtPct(k.budgetBurn)} sub={`Rp ${(k.budget / 1e9).toFixed(0)} M budget`} tone={k.budgetBurn > 85 ? 'bad' : 'info'} />
      <Stat label="Invoice Overdue" value={fmtNum(k.invoiceOverdue)} tone={k.invoiceOverdue > 0 ? 'warn' : 'good'} />
    </div>
  );
}
