import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { getData } from './data.js';
import * as S from './lib/stats.js';
import { kraljic, kmeans } from './lib/segment.js';
import { autoForecast, holtWinters } from './lib/forecast.js';
import { iqrOutliers, modifiedZ, benford, isolationForest, combine } from './lib/anomaly.js';
import { ols, allocate } from './lib/causal.js';

const app = express();
app.use(cors());

const round = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

function filterPO(po, q) {
  return po.filter((p) => {
    if (q.year && p._year !== Number(q.year)) return false;
    if (q.category && p._category_id !== q.category) return false;
    if (q.vendor && p.vendor_id !== q.vendor) return false;
    if (q.entity && p._entity !== q.entity) return false;
    if (q.status && p.status !== q.status) return false;
    return true;
  });
}

// ---------------- FILTER OPTIONS ----------------
app.get('/api/filters', (req, res) => {
  const { raw, po } = getData();
  res.json({
    years: [...new Set(po.map((p) => p._year).filter(Boolean))].sort(),
    categories: raw.category.map((c) => ({ id: c.category_id, name: c.category_name })),
    vendors: raw.vendor.map((v) => ({ id: v.vendor_id, name: v.vendor_name })),
    entities: [...new Set(po.map((p) => p._entity).filter(Boolean))].sort(),
    statuses: [...new Set(po.map((p) => p.status))],
  });
});

// ---------------- OVERVIEW ----------------
app.get('/api/overview', (req, res) => {
  const { raw, po } = getData();
  const rows = filterPO(po, req.query);
  const valid = rows.filter((p) => p.status !== 'cancelled');
  const totalSpend = S.sum(valid.map((p) => p._total));
  const openPO = rows.filter((p) => p.status === 'open' || p.status === 'partial');
  const onTimeRows = valid.filter((p) => p._on_time !== null);
  const onTime = onTimeRows.filter((p) => p._on_time).length;
  const leads = valid.map((p) => p._lead_time).filter((x) => x != null && x >= 0);
  const prs = raw.pr.filter((p) => !req.query.year || p.pr_date.startsWith(req.query.year));
  const approvals = raw.approval.filter((a) => a.doc_type === 'PR');
  const breaches = approvals.filter((a) => Number(a.actual_hours) > Number(a.sla_hours)).length;

  // monthly spend trend
  const byMonth = {};
  valid.forEach((p) => {
    byMonth[p._month] = (byMonth[p._month] || 0) + p._total;
  });
  const trend = Object.entries(byMonth).sort().map(([m, v]) => ({ month: m, value: round(v) }));

  // spending by category
  const byCat = {};
  valid.forEach((p) => {
    byCat[p._category || 'Unknown'] = (byCat[p._category || 'Unknown'] || 0) + p._total;
  });
  const categorySpend = Object.entries(byCat).map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value);

  // top vendors
  const byVendor = {};
  valid.forEach((p) => {
    byVendor[p._vendor_name || p.vendor_id] = (byVendor[p._vendor_name || p.vendor_id] || 0) + p._total;
  });
  const vendorSpend = Object.entries(byVendor).map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value);

  // funnel
  const prFiltered = raw.pr;
  const funnel = [
    { stage: 'Requisition', count: prFiltered.length, value: round(S.sum(prFiltered.map((p) => Number(p.estimated_total) || 0))) },
    { stage: 'Approved PR', count: prFiltered.filter((p) => p.status === 'approved').length, value: round(S.sum(prFiltered.filter((p) => p.status === 'approved').map((p) => Number(p.estimated_total) || 0))) },
    { stage: 'PO Issued', count: valid.length, value: round(totalSpend) },
    { stage: 'Received', count: valid.filter((p) => p._received_qty > 0).length, value: round(S.sum(valid.filter((p) => p._received_qty > 0).map((p) => p._total))) },
    { stage: 'Invoiced', count: new Set(raw.invoice.map((i) => i.po_id)).size, value: round(S.sum(raw.invoice.map((i) => Number(i.invoice_amount) || 0))) },
    { stage: 'Paid', count: raw.invoice.filter((i) => i.payment_status === 'paid').length, value: round(S.sum(raw.payment.map((p) => Number(p.amount_paid) || 0))) },
  ];

  // budget vs actual
  const budgets = raw.budget.filter((b) => !req.query.year || b.period.startsWith(req.query.year));
  const totalBudget = S.sum(budgets.map((b) => Number(b.budget_amount) || 0));
  const totalActual = S.sum(budgets.map((b) => Number(b.actual_amount) || 0));
  const totalCommitted = S.sum(budgets.map((b) => Number(b.committed_amount) || 0));

  res.json({
    kpi: {
      totalSpend: round(totalSpend),
      poCount: valid.length,
      openPO: openPO.length,
      openValue: round(S.sum(openPO.map((p) => p._total))),
      onTimePct: onTimeRows.length ? round((onTime / onTimeRows.length) * 100) : null,
      avgLeadTime: leads.length ? round(S.mean(leads), 1) : null,
      savings: round(S.sum(raw.contract.map((c) => Number(c.negotiated_savings) || 0))),
      approvalBreachPct: approvals.length ? round((breaches / approvals.length) * 100) : null,
      budget: round(totalBudget),
      actual: round(totalActual),
      committed: round(totalCommitted),
      budgetBurn: totalBudget ? round((totalActual / totalBudget) * 100) : null,
      invoiceOverdue: raw.invoice.filter((i) => i.payment_status === 'overdue').length,
    },
    trend,
    categorySpend,
    vendorSpend,
    funnel,
  });
});

// ---------------- CONCENTRATION ----------------
app.get('/api/concentration', (req, res) => {
  const { po } = getData();
  const rows = filterPO(po, req.query).filter((p) => p.status !== 'cancelled');

  const group = (keyFn, nameFn) => {
    const m = {};
    rows.forEach((p) => {
      const k = keyFn(p);
      if (k == null) return;
      if (!m[k]) m[k] = { key: k, name: nameFn(p), value: 0 };
      m[k].value += p._total;
    });
    return Object.values(m);
  };

  const makeStats = (entries) => {
    const values = entries.map((e) => e.value);
    const par = S.pareto(entries, 0.8);
    return {
      hhi: round(S.hhi(values), 4),
      hhiNorm: round(S.hhiNormalized(values), 4),
      gini: round(S.gini(values), 4),
      n: entries.length,
      total: round(S.sum(values)),
      lorenz: S.lorenz(values).filter((_, i, a) => i === 0 || i === a.length - 1 || i % Math.ceil(a.length / 40) === 0),
      pareto: { headCount: par.headCount, headShare: round(par.headShare, 3), top: par.rows.slice(0, 15).map((r) => ({ name: r.name, value: round(r.value), share: round(r.share, 4), cumulative: round(r.cumulative, 4) })) },
    };
  };

  const vendors = group((p) => p.vendor_id, (p) => p._vendor_name);
  const items = group((p) => p.item_id, (p) => p._item_name);
  const categories = group((p) => p._category_id, (p) => p._category);
  const ccs = group((p) => p._cc_id, (p) => p._cost_center);

  res.json({
    vendor: makeStats(vendors),
    item: makeStats(items),
    category: makeStats(categories),
    costCenter: makeStats(ccs),
  });
});

// ---------------- KRALJIC ----------------
app.get('/api/kraljic', (req, res) => {
  const { po, raw } = getData();
  const rows = filterPO(po, req.query).filter((p) => p.status !== 'cancelled');
  // impact = spend per category; risk = composite proxy
  const catSpend = {};
  const catRiskVals = {};
  rows.forEach((p) => {
    const c = p._category_id;
    if (!c) return;
    catSpend[c] = (catSpend[c] || 0) + p._total;
    (catRiskVals[c] = catRiskVals[c] || []).push(p);
  });
  const riskByCat = {};
  Object.entries(catRiskVals).forEach(([c, arr]) => {
    // risk = lead time variability + reject rate + single-source share + price variance |abs|
    const leads = arr.map((p) => p._lead_time).filter((x) => x != null && x >= 0);
    const rejects = arr.map((p) => p._reject_rate).filter((x) => x != null);
    const vendors = new Set(arr.map((p) => p.vendor_id));
    const singleSource = vendors.size <= 1 ? 1 : 0;
    const leadCV = leads.length > 3 ? S.cv(leads) : 0.5;
    const risk = 0.4 * Math.min(leadCV, 2) / 2 + 0.3 * (S.mean(rejects) || 0) + 0.3 * singleSource;
    riskByCat[c] = risk;
  });
  const entries = Object.entries(catSpend).map(([c, value]) => ({
    key: c,
    name: (raw.category.find((x) => x.category_id === c) || {}).category_name || c,
    value,
    risk: riskByCat[c] || 0,
  }));
  res.json({ points: kraljic(entries).map((e) => ({ ...e, value: round(e.value), risk: round(e.risk, 3) })) });
});

// ---------------- ABC-XYZ ----------------
app.get('/api/abcxyz', (req, res) => {
  const { po, raw } = getData();
  const rows = filterPO(po, req.query).filter((p) => p.status !== 'cancelled');
  const itemSpend = {};
  rows.forEach((p) => {
    if (!p.item_id) return;
    if (!itemSpend[p.item_id]) itemSpend[p.item_id] = { key: p.item_id, name: p._item_name, value: 0, cat: p._category };
    itemSpend[p.item_id].value += p._total;
  });
  // demand variability per item from demand_history
  const demandByItem = {};
  raw.demand.forEach((d) => {
    (demandByItem[d.item_id] = demandByItem[d.item_id] || []).push(Number(d.quantity_used));
  });
  const entries = Object.values(itemSpend);
  const abc = S.abcClassify(entries);
  const withXyz = abc.map((e) => {
    const series = demandByItem[e.key] || [];
    const c = series.length > 2 ? S.cv(series) : null;
    const xyz = c == null ? 'X' : S.xyzClassify(e, c);
    return { name: e.name, key: e.key, category: e.cat, value: round(e.value), abc: e.abc, cv: round(c, 3), xyz, cumulative: round(e.cumulative, 3) };
  });
  // matrix counts + spend
  const matrix = {};
  withXyz.forEach((e) => {
    const k = e.abc + e.xyz;
    if (!matrix[k]) matrix[k] = { cell: k, count: 0, spend: 0 };
    matrix[k].count++;
    matrix[k].spend += e.value;
  });
  res.json({ items: withXyz.sort((a, b) => b.value - a.value), matrix: Object.values(matrix).map((m) => ({ ...m, spend: round(m.spend) })) });
});

// ---------------- CLUSTERING ----------------
app.get('/api/clustering', (req, res) => {
  const { po, raw } = getData();
  const rows = po.filter((p) => p.status !== 'cancelled');
  // features per vendor: total spend, on-time, defect, response, price competitiveness, lead time, dependency
  const byVendor = {};
  rows.forEach((p) => {
    if (!p.vendor_id) return;
    const v = (byVendor[p.vendor_id] = byVendor[p.vendor_id] || { id: p.vendor_id, name: p._vendor_name, spend: 0, leads: [], onTime: [], reject: [] });
    v.spend += p._total;
    if (p._lead_time != null && p._lead_time >= 0) v.leads.push(p._lead_time);
    if (p._on_time !== null) v.onTime.push(p._on_time ? 1 : 0);
    if (p._reject_rate != null) v.reject.push(p._reject_rate);
  });
  const perf = {};
  raw.vendorPerf.forEach((vp) => {
    (perf[vp.vendor_id] = perf[vp.vendor_id] || []).push(vp);
  });
  const risk = Object.fromEntries(raw.vendorRisk.map((r) => [r.vendor_id, Number(r.dependency_pct) || 0]));
  const entries = Object.values(byVendor).map((v) => {
    const pfs = perf[v.id] || [];
    const onTime = v.onTime.length ? S.mean(v.onTime) : (pfs.length ? S.mean(pfs.map((x) => Number(x.on_time_delivery_pct))) / 100 : 0);
    const defect = v.reject.length ? S.mean(v.reject) : (pfs.length ? S.mean(pfs.map((x) => Number(x.defect_rate))) / 100 : 0);
    const resp = pfs.length ? S.mean(pfs.map((x) => Number(x.avg_response_hours))) : 24;
    const priceComp = pfs.length ? S.mean(pfs.map((x) => Number(x.price_competitiveness))) : 1;
    const lead = v.leads.length ? S.mean(v.leads) : 14;
    const dep = risk[v.id] || (v.spend / S.sum(Object.values(byVendor).map((x) => x.spend))) * 100;
    return { id: v.id, name: v.name, spend: v.spend, onTime, defect, resp, priceComp, lead, dep, metrics: { spend: round(v.spend), onTime: round(onTime * 100, 1), defect: round(defect * 100, 2), resp: round(resp, 1), lead: round(lead, 1), dep: round(dep, 1) } };
  });
  const feats = entries.map((e) => [e.spend, e.onTime * 100, e.defect * 100, e.resp, e.lead, e.dep]);
  const result = kmeans(feats, 4);
  const clustered = entries.map((e, i) => ({ ...e, cluster: result.assign[i] }));
  // name clusters by centroid profile
  const clusterSummary = {};
  clustered.forEach((e) => {
    const c = e.cluster;
    (clusterSummary[c] = clusterSummary[c] || { cluster: c, count: 0, spend: 0, onTime: 0, defect: 0, lead: 0, members: [] }).count++;
    clusterSummary[c].spend += e.spend;
    clusterSummary[c].onTime += e.onTime;
    clusterSummary[c].defect += e.defect;
    clusterSummary[c].lead += e.lead;
    clusterSummary[c].members.push(e.name);
  });
  const clusters = Object.values(clusterSummary).map((c) => ({
    cluster: c.cluster,
    count: c.count,
    spend: round(c.spend),
    avgOnTime: round((c.onTime / c.count) * 100, 1),
    avgDefect: round((c.defect / c.count) * 100, 2),
    avgLead: round(c.lead / c.count, 1),
    members: c.members.slice(0, 6),
  }));
  res.json({ vendors: clustered.map((e) => ({ ...e, spend: round(e.spend), onTime: round(e.onTime * 100, 1), defect: round(e.defect * 100, 2), resp: round(e.resp, 1), lead: round(e.lead, 1), dep: round(e.dep, 1) })), clusters, silhouette: round(result.silhouette, 3) });
});

// ---------------- FORECAST ----------------
app.get('/api/forecast', (req, res) => {
  const { raw, po } = getData();
  const mode = req.query.mode || 'spend'; // spend | demand
  const horizon = Number(req.query.horizon) || 6;

  let series = [];
  let labels = [];
  if (mode === 'demand') {
    const itemId = req.query.item || raw.demand[0].item_id;
    const d = raw.demand.filter((x) => x.item_id === itemId).sort((a, b) => a.period.localeCompare(b.period));
    series = d.map((x) => Number(x.quantity_used));
    labels = d.map((x) => x.period);
  } else {
    const rows = po.filter((p) => p.status !== 'cancelled');
    const byMonth = {};
    rows.forEach((p) => {
      byMonth[p._month] = (byMonth[p._month] || 0) + p._total;
    });
    const sorted = Object.entries(byMonth).sort();
    series = sorted.map(([, v]) => v);
    labels = sorted.map(([k]) => k);
  }

  const result = autoForecast(series, horizon);
  const future = labels.slice(-1)[0] || '';
  const futureLabels = [];
  for (let h = 1; h <= horizon; h++) {
    const base = mode === 'demand' ? future : future;
    const [y, m] = base.split('-').map(Number);
    const nm = ((m - 1 + h) % 12) + 1;
    const ny = y + Math.floor((m - 1 + h) / 12);
    futureLabels.push(mode === 'demand' ? `${ny}-${String(nm).padStart(2, '0')}` : `${ny}-${String(nm).padStart(2, '0')}`);
  }

  res.json({
    mode,
    labels,
    actual: series.map((v) => round(v)),
    fitted: result.fitted.map((v) => round(v)),
    forecastLabels: futureLabels,
    forecast: result.forecast.map((v) => round(v)),
    method: result.name || result.method,
    candidates: result.candidates,
    backtest: result.backtest ? { mape: round(result.backtest.mape), mae: round(result.backtest.mae), rmse: round(result.backtest.rmse), mase: round(result.backtest.mase, 3), test: result.backtest.test.map((v) => round(v)), pred: result.backtest.pred.map((v) => round(v)) } : null,
  });
});

app.get('/api/forecast/items', (req, res) => {
  const { raw } = getData();
  const items = [...new Set(raw.demand.map((d) => d.item_id))];
  const nameById = Object.fromEntries(raw.item.map((i) => [i.item_id, i.item_name]));
  res.json(items.map((id) => ({ id, name: nameById[id] || id })));
});

// ---------------- ANOMALY ----------------
app.get('/api/anomaly', (req, res) => {
  const { po, raw } = getData();
  const rows = po.filter((p) => p.status !== 'cancelled' && p._unit != null);

  // price anomaly per item (modified Z within item history)
  const byItem = {};
  rows.forEach((p) => {
    (byItem[p.item_id] = byItem[p.item_id] || []).push(p);
  });
  const priceFlags = {};
  Object.entries(byItem).forEach(([item, arr]) => {
    const prices = arr.map((p) => p._unit);
    const z = modifiedZ(prices);
    arr.forEach((p, i) => {
      priceFlags[p.po_id] = z[i];
    });
  });

  // split PO: same vendor+item within 3 days, each below threshold
  const sorted = [...rows].sort((a, b) => a.po_date.localeCompare(b.po_date));
  const split = new Set();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const dt = (new Date(sorted[j].po_date) - new Date(sorted[i].po_date)) / 86400000;
      if (dt > 3) break;
      if (sorted[i].vendor_id === sorted[j].vendor_id && sorted[i].item_id === sorted[j].item_id && sorted[i].pr_id !== sorted[j].pr_id) {
        if (sorted[i]._qty < 1000 && sorted[j]._qty < 1000) {
          split.add(sorted[i].po_id);
          split.add(sorted[j].po_id);
        }
      }
    }
  }

  // isolation forest on [unit_price_ratio, qty_ratio, lead_time, price_var]
  const feats = rows.map((p) => [p._unit || 0, p._qty || 0, p._lead_time || 0, (p._price_var || 0) * 100]);
  const ifScores = isolationForest(feats, 100, 64);
  const ifThresh = S.quantile([...ifScores].sort((a, b) => a - b), 0.97);

  const anomalies = rows
    .map((p, i) => {
      const zFlag = priceFlags[p.po_id];
      const ifScore = ifScores[i];
      const ifFlag = ifScore >= ifThresh;
      const splitFlag = split.has(p.po_id);
      const score = combine({ zFlag, iqrFlag: ifFlag, ifScore }) + (splitFlag ? 1.5 : 0);
      return {
        po_id: p.po_id,
        po_number: p.po_number,
        po_date: p.po_date,
        vendor: p._vendor_name,
        item: p._item_name,
        amount: round(p._total),
        unitPrice: round(p._unit),
        qty: p._qty,
        priceVar: round((p._price_var || 0) * 100, 1),
        priceZ: zFlag ? 1 : 0,
        isolationScore: round(ifScore, 4),
        splitPO: splitFlag,
        score: round(score, 3),
        severity: score >= 2 ? 'high' : score >= 1 ? 'medium' : 'low',
      };
    })
    .filter((a) => a.priceZ || a.isolationScore >= ifThresh || a.splitPO)
    .sort((a, b) => b.score - a.score);

  // Benford on invoice amounts
  const invAmounts = raw.invoice.map((i) => Number(i.invoice_amount) || 0);
  const bf = benford(invAmounts);

  // duplicate bank accounts (fraud)
  const bankMap = {};
  raw.vendor.forEach((v) => {
    const k = v.bank_account_no;
    if (!k) return;
    (bankMap[k] = bankMap[k] || []).push(v.vendor_name);
  });
  const dupBanks = Object.entries(bankMap).filter(([, names]) => names.length > 1).map(([acc, names]) => ({ account: acc, vendors: names }));

  res.json({
    anomalies: anomalies.slice(0, 100),
    summary: {
      total: anomalies.length,
      high: anomalies.filter((a) => a.severity === 'high').length,
      medium: anomalies.filter((a) => a.severity === 'medium').length,
      splitPO: split.size,
      priceOutlier: anomalies.filter((a) => a.priceZ).length,
    },
    benford: { observed: bf.observed, expected: bf.expected.map((v) => round(v)), chi2: round(bf.chi2), n: bf.n, df: 8, critical95: 15.507 },
    duplicateBanks: dupBanks,
  });
});

// ---------------- CAUSAL ----------------
app.get('/api/causal', (req, res) => {
  const { po } = getData();
  const rows = po.filter((p) => p.status !== 'cancelled' && p._lead_time != null && p._lead_time >= 0 && p._qty && p._unit);
  // lead_time ~ qty + unit_price + category dummies (a few) + on_time
  const cats = [...new Set(rows.map((p) => p._category_id).filter(Boolean))];
  const topCats = cats.slice(0, 5);
  const X = rows.map((p) => {
    const row = [1, Math.log(p._qty || 1), Math.log(p._unit || 1), (p._total || 0) / 1e6];
    topCats.forEach((c) => row.push(p._category_id === c ? 1 : 0));
    return row;
  });
  const y = rows.map((p) => p._lead_time);
  const reg = ols(X, y);
  const names = ['Intercept', 'log(Qty)', 'log(Unit Price)', 'Amount (jt)', ...topCats.map((c) => `Cat ${c}`)];
  const coefficients = names.map((n, i) => ({ name: n, beta: round(reg.beta[i], 4), se: round(reg.se[i], 4), t: round(reg.tStat[i], 2) }));

  // volume-price correlation
  const logQ = rows.map((p) => Math.log(p._qty || 1));
  const logP = rows.map((p) => Math.log(p._unit || 1));
  const corr = pearson(logQ, logP);

  // average lead time by category (impact)
  const byCat = {};
  rows.forEach((p) => {
    (byCat[p._category] = byCat[p._category] || []).push(p._lead_time);
  });
  const leadByCat = Object.entries(byCat).map(([name, arr]) => ({ name, avgLead: round(S.mean(arr), 1), n: arr.length })).sort((a, b) => b.avgLead - a.avgLead);

  res.json({ coefficients, r2: round(reg.r2, 3), adjR2: round(reg.adjR2, 3), n: reg.n, volumePriceCorr: round(corr, 3), leadByCat });
});

function pearson(a, b) {
  const ma = S.mean(a);
  const mb = S.mean(b);
  const num = S.sum(a.map((x, i) => (x - ma) * (b[i] - mb)));
  const den = Math.sqrt(S.sum(a.map((x) => (x - ma) ** 2)) * S.sum(b.map((x) => (x - mb) ** 2)));
  return den ? num / den : 0;
}

// ---------------- OPTIMIZATION ----------------
app.get('/api/optimization', (req, res) => {
  const { po, raw } = getData();
  const categoryId = req.query.category;
  const rows = po.filter((p) => p.status !== 'cancelled' && (!categoryId || p._category_id === categoryId));
  // group by vendor: avg unit price, capacity (historic qty * 1.5), quality
  const byVendor = {};
  rows.forEach((p) => {
    const v = (byVendor[p.vendor_id] = byVendor[p.vendor_id] || { id: p.vendor_id, name: p._vendor_name, prices: [], qty: 0, rejects: [], leads: [] });
    if (p._unit) v.prices.push(p._unit);
    v.qty += p._qty || 0;
    if (p._reject_rate != null) v.rejects.push(p._reject_rate);
    if (p._lead_time != null) v.leads.push(p._lead_time);
  });
  const perf = {};
  raw.vendorPerf.forEach((vp) => {
    (perf[vp.vendor_id] = perf[vp.vendor_id] || []).push(Number(vp.on_time_delivery_pct));
  });
  const suppliers = Object.values(byVendor).map((v) => {
    const avgPrice = S.mean(v.prices);
    const reject = S.mean(v.rejects) || 0;
    const onTime = perf[v.id] ? S.mean(perf[v.id]) : 85;
    // effective cost = price * (1 + reject) + penalty for lateness
    const cost = avgPrice * (1 + reject) + avgPrice * 0.05 * (1 - onTime / 100);
    return { id: v.id, name: v.name, price: round(avgPrice), reject: round(reject * 100, 2), onTime: round(onTime, 1), capacity: Math.round(v.qty * 1.5) || 1000, cost: round(cost) };
  });
  const demand = Math.round(S.sum(rows.map((p) => p._qty)) || 0);
  const result = allocate(suppliers, demand);
  res.json({
    suppliers: suppliers.map((s) => ({ ...s, allocated: Math.round(result.alloc[s.id] || 0), allocatedValue: round((result.alloc[s.id] || 0) * s.price) })),
    demand: Math.round(demand),
    totalCost: round(result.totalCost),
    feasible: result.feasible,
    unmet: Math.round(result.unmet),
    baselineCost: round(S.sum(rows.map((p) => p._total))),
  });
});

app.get('/api/optimization/categories', (req, res) => {
  const { raw } = getData();
  res.json(raw.category.map((c) => ({ id: c.category_id, name: c.category_name })));
});

// ---------------- VENDOR SCORECARD ----------------
app.get('/api/vendors', (req, res) => {
  const { raw, po } = getData();
  const rows = po.filter((p) => p.status !== 'cancelled');
  const byVendor = {};
  rows.forEach((p) => {
    const v = (byVendor[p.vendor_id] = byVendor[p.vendor_id] || { id: p.vendor_id, name: p._vendor_name, spend: 0, orders: 0, onTime: [], reject: [], leads: [] });
    v.spend += p._total;
    v.orders++;
    if (p._on_time !== null) v.onTime.push(p._on_time ? 1 : 0);
    if (p._reject_rate != null) v.reject.push(p._reject_rate);
    if (p._lead_time != null && p._lead_time >= 0) v.leads.push(p._lead_time);
  });
  const risk = Object.fromEntries(raw.vendorRisk.map((r) => [r.vendor_id, r]));
  const esg = Object.fromEntries(raw.esg.map((e) => [e.vendor_id, e]));
  const meta = Object.fromEntries(raw.vendor.map((v) => [v.vendor_id, v]));
  const list = Object.values(byVendor).map((v) => ({
    ...v,
    spend: round(v.spend),
    onTimePct: v.onTime.length ? round((S.mean(v.onTime)) * 100, 1) : null,
    rejectPct: v.reject.length ? round(S.mean(v.reject) * 100, 2) : null,
    avgLead: v.leads.length ? round(S.mean(v.leads), 1) : null,
    riskScore: risk[v.id] ? round(Number(risk[v.id].composite_score), 2) : null,
    dependency: risk[v.id] ? round(Number(risk[v.id].dependency_pct), 1) : null,
    singleSource: risk[v.id] ? risk[v.id].single_source_flag === 'true' : null,
    creditRating: meta[v.id] ? meta[v.id].credit_rating : null,
    isLocal: meta[v.id] ? meta[v.id].is_local === 'true' : null,
    carbon: esg[v.id] ? round(Number(esg[v.id].carbon_kg)) : null,
  })).sort((a, b) => b.spend - a.spend);
  res.json(list);
});

// ---------------- CONTRACT COMPLIANCE ----------------
app.get('/api/contracts', (req, res) => {
  const { raw, po } = getData();
  const now = new Date('2025-12-31');
  const rows = po.filter((p) => p.status !== 'cancelled');
  const total = S.sum(rows.map((p) => p._total));
  const onContract = S.sum(rows.filter((p) => p.contract_id).map((p) => p._total));
  const contracts = raw.contract.map((c) => {
    const end = new Date(c.end_date);
    const days = Math.round((end - now) / 86400000);
    return {
      id: c.contract_id,
      number: c.contract_number,
      vendor: (raw.vendor.find((v) => v.vendor_id === c.vendor_id) || {}).vendor_name || c.vendor_id,
      category: (raw.category.find((x) => x.category_id === c.category_id) || {}).category_name || c.category_id,
      start: c.start_date,
      end: c.end_date,
      value: round(Number(c.contract_value)),
      status: c.status,
      autoRenew: c.auto_renew === 'true',
      savings: round(Number(c.negotiated_savings)),
      daysToExpiry: days,
    };
  });
  res.json({
    compliancePct: total ? round((onContract / total) * 100, 1) : 0,
    offContractValue: round(total - onContract),
    onContractValue: round(onContract),
    contracts: contracts.sort((a, b) => a.daysToExpiry - b.daysToExpiry),
  });
});

const dist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 5177;
app.listen(PORT, () => console.log(`API server http://localhost:${PORT}`));
