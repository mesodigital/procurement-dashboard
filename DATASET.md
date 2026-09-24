# Dataset Procurement — Daftar Data Spesifik

## 1. Master Data

### Master Vendor (`vendor`)
| Field | Tipe | Ket |
|---|---|---|
| vendor_id | PK | |
| vendor_name | string | |
| vendor_code | string | |
| npwp | string | deteksi vendor duplikat |
| bank_account_name | string | fraud check |
| bank_account_no | string | fraud check |
| bank_name | string | |
| address, city, country | string | ESG lokal, risiko |
| category_type | enum | supplier/manufacturer/distributor |
| is_local | bool | ESG |
| ownership_type | enum | minority/women-owned |
| status | enum | active/blacklist/suspended |
| registration_date | date | |
| credit_rating | string | risk score eksternal |

### Master Item / Material (`item`)
| Field | Tipe | Ket |
|---|---|---|
| item_id | PK | |
| item_code, item_name | string | |
| description | text | NLP auto-classify |
| category_id | FK | |
| subcategory_id | FK | |
| uom | string | satuan |
| standard_price | decimal | baseline harga |
| min_order_qty | decimal | |
| is_catalogued | bool | deteksi maverick buying |
| hs_code | string | |

### Master Kategori (`category`)
category_id, category_name, parent_category_id, kraljic_quadrant (strategic/leverage/bottleneck/non-critical), abc_class (A/B/C), xyz_class (X/Y/Z)

### Master Cost Center / Department (`cost_center`)
cost_center_id, cost_center_name, department_id, department_name, entity_id, entity_name, manager_id

### Master Karyawan (`employee`)
employee_id, name, role, department_id, approval_limit, position_level

## 2. Data Transaksi Inti (Purchase Lifecycle)

### Purchase Requisition (`purchase_requisition` / PR)
| Field | Tipe | Ket |
|---|---|---|
| pr_id | PK | |
| pr_number | string | |
| pr_date | date | |
| requester_id | FK employee | |
| cost_center_id | FK | |
| department_id | FK | |
| item_id | FK | |
| description | text | NLP |
| quantity | decimal | |
| estimated_unit_price | decimal | |
| estimated_total | decimal | |
| currency | string | |
| required_date | date | |
| priority | enum | |
| status | enum | draft/pending/approved/rejected |
| budget_id | FK | |
| attachment_url | string | |

### Purchase Order (`purchase_order` / PO)
| Field | Tipe | Ket |
|---|---|---|
| po_id | PK | |
| po_number | string | |
| po_date | date | |
| pr_id | FK | link ke PR |
| vendor_id | FK | |
| item_id | FK | |
| quantity | decimal | |
| unit_price | decimal | deteksi outlier |
| total_amount | decimal | |
| discount | decimal | |
| tax_amount | decimal | |
| freight_cost | decimal | TCO |
| currency, exchange_rate | | |
| payment_terms | string | |
| delivery_date_promised | date | on-time calc |
| delivery_date_actual | date | on-time calc |
| incoterms | string | |
| contract_id | FK | contract compliance |
| status | enum | open/partial/closed/cancelled |
| is_split_po | bool | deteksi split PO |
| parent_po_id | FK | split PO |

### Goods Receipt (`goods_receipt` / GR)
| Field | Tipe | Ket |
|---|---|---|
| gr_id | PK | |
| gr_number | string | |
| gr_date | date | |
| po_id | FK | |
| received_qty | decimal | |
| rejected_qty | decimal | quality/defect rate |
| reject_reason | string | |
| inspection_result | enum | pass/fail/partial |
| warehouse_id | FK | |
| received_by | FK employee | |

### Invoice (`invoice`)
| Field | Tipe | Ket |
|---|---|---|
| invoice_id | PK | |
| invoice_number | string | Benford check |
| invoice_date | date | |
| po_id | FK | |
| gr_id | FK | 3-way match |
| vendor_id | FK | |
| invoice_amount | decimal | |
| tax_amount | decimal | |
| due_date | date | |
| payment_date | date | aging/DPO |
| payment_status | enum | unpaid/paid/overdue |
| variance_amount | decimal | price variance (PPV) |

### Payment (`payment`)
payment_id, invoice_id, payment_date, payment_method, amount_paid, bank_ref, paid_by

## 3. Approval Workflow

### Approval Log (`approval_log`)
| Field | Tipe | Ket |
|---|---|---|
| approval_id | PK | |
| doc_type | enum | PR/PO |
| doc_id | FK | |
| approver_id | FK employee | |
| approval_level | int | |
| sequence | int | |
| action | enum | approve/reject/return |
| action_date | timestamp | |
| sla_hours | int | |
| actual_hours | decimal | SLA breach, cycle time |
| remarks | text | |

## 4. Budget & Kontrak

### Budget (`budget`)
budget_id, cost_center_id, category_id, period (year/month), budget_amount, committed_amount, actual_amount, currency

### Contract (`contract`)
contract_id, contract_number, vendor_id, category_id, start_date, end_date, contract_value, pricing_terms, auto_renew, status, negotiated_savings, baseline_price

## 5. Data Harga & Pasar (untuk price intelligence)

### Price History (`price_history`)
price_id, item_id, vendor_id, effective_date, unit_price, currency, source (catalog/po/market_index)

### Market Index (`market_index`)
index_id, commodity_name, index_date, index_value, source — untuk price index Laspeyres/Paasche

## 6. Data Inventori & Demand (forecasting)

### Inventory (`inventory`)
inventory_id, item_id, warehouse_id, stock_on_hand, stock_reserved, reorder_point, safety_stock, avg_consumption, lead_time_days, snapshot_date

### Demand History (`demand_history`)
demand_id, item_id, period, quantity_used, source (production/sales) — input forecast

### Driver Data (`driver_data`) — untuk regresi demand
driver_id, driver_name (produksi/sales/headcount), period, value

## 7. Data Vendor Performance (scoring)

### Vendor Performance (`vendor_performance`)
perf_id, vendor_id, period, on_time_delivery_pct, defect_rate, price_competitiveness, avg_response_hours, fill_rate, order_count, total_spend

### Vendor Risk (`vendor_risk`)
risk_id, vendor_id, score_date, financial_risk, geo_risk, single_source_flag, dependency_pct, composite_score

## 8. Data Referensi Pendukung

| Dataset | Field kunci | Fungsi |
|---|---|---|
| `currency_rate` | date, from, to, rate | konversi multi-currency |
| `warehouse` | warehouse_id, name, location | link GR & inventory |
| `entity` | entity_id, entity_name, country | benchmarking antar cabang |
| `payment_terms` | term_id, name, days | DPO calc |
| `esg_vendor` | vendor_id, local_pct, carbon_kg | ESG/sustainability |

## 9. Derived / Computed Fields (bukan input, hasil hitung)
- spend_amount, savings (baseline − actual), PPV, lead_time_days (po_date → gr_date), cycle_time_hours (approval), aging_bucket, severity_score (anomaly), pareto_cumulative_pct, kraljic_quadrant, abc_class, xyz_class, on_time_flag, dependency_pct.

## 10. Skema Relasi (ringkas)

```
vendor ─┐
item ───┼─< purchase_order >─ purchase_requisition
category┤         │
cost_center      │
employee ────────┴─< approval_log
         purchase_order >─ goods_receipt
         purchase_order >─ invoice >─ payment
         vendor >─ contract
         item >─ price_history, inventory, demand_history
         vendor >─ vendor_performance, vendor_risk
         budget ─(cost_center, category, period)
```

## 11. Catatan Kualitas Data
- **Grain/jenis**: transaksi (PO line-level) = faktanya; master + dimensi = konteks.
- **Kunci minimum** wajib: vendor_id, item_id, po_number, po_date, unit_price, qty, gr_date, invoice_amount, cost_center_id. Tanpa ini Pareto/forecast/anomaly tak jalan.
- **Timestamp** untuk approval (SLA) & **date** untuk aging.
- **Baseline price** (kontrak/katalog) wajib kalau mau hitung saving & PPV.
- Anomaly detection butuh **histori minimal 6–12 bulan** per item/vendor.

**Prioritas bangun dataset:** master (vendor/item/category/cost_center) → PR/PO/GR/Invoice (lifecycle) → approval_log → budget/contract → price_history → inventory/demand → vendor_performance/risk → referensi.
