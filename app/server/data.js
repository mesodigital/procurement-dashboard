import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const DATA_DIR = process.env.DATA_DIR || path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'data');

const num = (v) => (v === '' || v == null ? null : Number(v));
const bool = (v) => v === 'true' || v === 'TRUE';

let cache = null;

function load(name) {
  const file = path.join(DATA_DIR, name + '.csv');
  const csv = fs.readFileSync(file, 'utf8');
  return Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
}

export function getData() {
  if (cache) return cache;

  const vendor = load('vendor');
  const item = load('item');
  const category = load('category');
  const cost_center = load('cost_center');
  const employee = load('employee');
  const entity = load('entity');
  const warehouse = load('warehouse');
  const pr = load('purchase_requisition');
  const po = load('purchase_order');
  const gr = load('goods_receipt');
  const invoice = load('invoice');
  const payment = load('payment');
  const approval = load('approval_log');
  const budget = load('budget');
  const contract = load('contract');
  const priceHistory = load('price_history');
  const marketIndex = load('market_index');
  const inventory = load('inventory');
  const demand = load('demand_history');
  const driver = load('driver_data');
  const vendorPerf = load('vendor_performance');
  const vendorRisk = load('vendor_risk');
  const esg = load('esg_vendor');

  const vById = Object.fromEntries(vendor.map((v) => [v.vendor_id, v]));
  const iById = Object.fromEntries(item.map((i) => [i.item_id, i]));
  const cById = Object.fromEntries(category.map((c) => [c.category_id, c]));
  const ccById = Object.fromEntries(cost_center.map((c) => [c.cost_center_id, c]));
  const eById = Object.fromEntries(employee.map((e) => [e.employee_id, e]));
  const prById = Object.fromEntries(pr.map((p) => [p.pr_id, p]));
  const poById = Object.fromEntries(po.map((p) => [p.po_id, p]));

  // ---- enrich PO (fact table, line-level) ----
  const poEnriched = po.map((p) => {
    const it = iById[p.item_id] || {};
    const v = vById[p.vendor_id] || {};
    const cat = it.category_id ? cById[it.category_id] : {};
    const prRow = prById[p.pr_id] || {};
    const cc = prRow.cost_center_id ? ccById[prRow.cost_center_id] : {};
    const total = num(p.total_amount) || 0;
    const grs = gr.filter((g) => g.po_id === p.po_id);
    const receivedQty = grs.reduce((s, g) => s + (num(g.received_qty) || 0), 0);
    const rejectedQty = grs.reduce((s, g) => s + (num(g.rejected_qty) || 0), 0);
    const promised = p.delivery_date_promised ? new Date(p.delivery_date_promised) : null;
    const actual = p.delivery_date_actual ? new Date(p.delivery_date_actual) : null;
    let leadTime = null;
    if (p.po_date && actual) leadTime = (actual - new Date(p.po_date)) / 86400000;
    const onTime = promised && actual ? actual <= promised : null;
    const stdPrice = num(it.standard_price);
    const unit = num(p.unit_price);
    const priceVar = stdPrice && unit ? (unit - stdPrice) / stdPrice : null;
    return {
      ...p,
      _total: total,
      _qty: num(p.quantity),
      _unit: unit,
      _category_id: it.category_id,
      _category: cat.category_name,
      _item_name: it.item_name,
      _vendor_name: v.vendor_name,
      _vendor_code: v.vendor_code,
      _cc_id: prRow.cost_center_id,
      _cost_center: cc.cost_center_name,
      _entity: cc.entity_name,
      _department: cc.department_name,
      _year: p.po_date ? Number(p.po_date.slice(0, 4)) : null,
      _month: p.po_date ? p.po_date.slice(0, 7) : null,
      _received_qty: receivedQty,
      _rejected_qty: rejectedQty,
      _reject_rate: receivedQty + rejectedQty > 0 ? rejectedQty / (receivedQty + rejectedQty) : null,
      _lead_time: leadTime,
      _on_time: onTime,
      _price_var: priceVar,
      _market: marketIndex,
    };
  });

  cache = {
    raw: { vendor, item, category, cost_center, employee, entity, warehouse, pr, po, gr, invoice, payment, approval, budget, contract, priceHistory, marketIndex, inventory, demand, driver, vendorPerf, vendorRisk, esg },
    idx: { vById, iById, cById, ccById, eById, prById, poById },
    po: poEnriched,
  };
  return cache;
}
