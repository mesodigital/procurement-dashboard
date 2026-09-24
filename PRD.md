# PRD — Procurement Portal Dashboard

## 1. Overview
Dashboard monitoring & control pengadaan untuk divisi Procurement, Finance, dan Management. Tujuan: visibility real-time, kontrol biaya, deteksi anomali, decision support.

**Stakeholder & kebutuhan:**

| Role | Butuh |
|---|---|
| Procurement Ops | tracking PR→PO→GR→Invoice, aging, bottleneck |
| Procurement Manager | approval load, SLA tim, vendor performance |
| Finance | budget vs actual, 3-way match, cashflow commitment |
| Vendor/Supplier | status PO, pembayaran |
| Management | spend trend, saving, KPI global |

## 2. Fitur Wajib (Core / Expected)
1. **Metric cards** — Total Spend, Open PO, Savings, Avg Lead Time, On-Time Delivery %, Unapproved backlog.
2. **Purchase funnel** — PR → Approval → PO → GR → Invoice → Paid (count + value tiap stage). Bar drop-off = bottleneck.
3. **Spend analytics**
   - by kategori/commodity (treemap atau bar)
   - by vendor (top N + Pareto 80/20)
   - by department/cost center
   - by bulan/kuartal (trend + YoY/YoY cumulative)
4. **Budget vs Actual** — per cost center, per kategori; burnout % + forecast akhir periode.
5. **Vendor scorecard** — on-time %, quality reject rate, price competitiveness, response time. Ranking + trend.
6. **PO tracking** — list + filter + status timeline, aging buckets (0-30/31-60/61-90/90+).
7. **Approval workflow monitor** — siapa pending, berapa lama, SLA breach flag.
8. **Saved reports + export** — Excel/PDF/CSV, scheduled email.
9. **Filter global** — periode, entitas, kategori, vendor, cost center (semua chart react).
10. **Drill-down** — klik chart → detail transaksi, breadcrumb navigation.

## 3. Fitur Added Value (Differentiator)
1. **Anomaly & fraud detection** — split PO (hindari threshold approval), vendor duplikat/bank account beda, maverick buying (beli di luar kontrak), harga outlier per katalog.
2. **Price intelligence** — tracking harga historis per item, index harga vs pasar, alert kenaikan tak wajar, best-price recommendation per supplier.
3. **Contract compliance** — % spend via kontrak vs off-contract, kontrak mau expired (countdown), auto-renew reminder.
4. **Demand & inventory link** — forecast kebutuhan dari pemakaian historis (reorder point), hindari overstock/stockout.
5. **What-if simulation** — skenario konsolidasi vendor, nego harga, dampak ke saving.
6. **Auto-classification (NLP)** — kategorisasi PR otomatis dari deskripsi teks, deteksi item serupa.
7. **Supplier risk score** — gabung performa + data eksternal (kredit, lokasi, ketergantungan single-source), flag single-source risk.
8. **Real-time alerts** — SLA breach, budget overrun, approval menginap, PO overdue delivery. Channel: email/WA/Slack.
9. **Collaboration & audit trail** — komentar per PR/PO, riwayat perubahan harga/qty.
10. **AI insight summary** — narasi otomatis: "Spend bulan ini naik 12% didorong kategori IT; 3 vendor telat kirim." Natural-language query.
11. **Sustainability/ESG** — % spend ke vendor lokal, minority/women-owned, carbon footprint estimasi.
12. **Benchmarking** — banding spend per kategori antar cabang/entitas.

## 4. Metode Statistik — Manage Pembelian Efektif & Efisien

### A. Spend Analysis & Segmentasi
- **Pareto (80/20)** — identifikasi 20% vendor/item yang pegang 80% spend → fokus nego & kontrol.
- **Kraljic Matrix** (risk vs profit impact) — klasifikasi item jadi strategic/leverage/bottleneck/non-critical → strategi sourcing beda tiap kuadran.
- **ABC Analysis** — klasifikasi item berdasarkan nilai konsumsi → kebijakan stok & approval berbeda.

### B. Forecasting Demand & Harga
- **Time-series**: Moving Average / **Exponential Smoothing (Holt-Winters)** untuk pola tren+musiman. Simpel, cocok untuk reorder.
- **ARIMA/SARIMA** — kalau data musiman & stasioner, akurasi lebih baik jangka menengah.
- **Regression (linear/multiple)** — prediksi kebutuhan dari driver (produksi, sales, headcount).
- **Safety stock** = Z × σ_demand × √lead time. Jaga service level.
- **Reorder Point (ROP)** = (avg usage × lead time) + safety stock.

### C. Vendor Performance & Scoring
- **Weighted scoring model / AHP (Analytic Hierarchy Process)** — bobot kriteria (harga, kualitas, delivery, respons) → skor vendor objektif.
- **TOPSIS** — ranking vendor multi-kriteria, alternatif AHP untuk normalisasi lebih adil.
- **SPC (Statistical Process Control)** — control chart (p-chart, X-bar) untuk monitor defect rate & on-time, deteksi tren turun sebelum jadi masalah.

### D. Deteksi Anomali & Fraud
- **Z-score / Modified Z-score (MAD)** — flag harga/kuantitas outlier vs histori item. Robust terhadap outlier ekstrem.
- **IQR (Tukey)** — deteksi outlier split PO dan harga.
- **Benford's Law** — distribusi digit pertama nominal; penyimpangan = indikasi fraud/manipulasi.
- **Isolation Forest / DBSCAN** — unsupervised ML, deteksi pola maverick buying & vendor anomali multi-dimensi.

### E. Kontrol & Efisiensi Operasional
- **Control chart (SPC)** untuk lead time & cycle time → deteksi bottleneck sistematis.
- **Process mining / throughput analysis** pada approval workflow → temukan stage paling lama, hitung rework loop.
- **Regression on lead time vs Harga** — analisis korelasi harga ↔ lead time ↔ volume.

### F. Cost Saving & Negosiasi
- **Should-cost modeling** (regresi biaya vs driver) → target harga realistis.
- **Price index** (Laspeyres/Paasche) → ukur inflasi pengadaan vs pasar.
- **Total Cost of Ownership (TCO)** — bukan hanya harga beli, termasuk Q/C/D + inventory carrying cost (biasanya 15–25%/tahun).

### G. Pengukuran Kinerja
- **KPI dashboard statistik**: PPV (Purchase Price Variance), cost avoidance vs cost saving, defect rate (Six Sigma DPMO), fill rate.
- **Run chart / trend + kontrol** untuk deteksi penyimpangan KPI.

## 5. Rekomendasi Arsitektur (Modern & Scalable)
- **Stack**: React/Next.js + TypeScript, chart **Recharts/visx/ECharts**, tabel TanStack.
- **Backend**: REST/tRPC + PostgreSQL; OLAP untuk agregasi (materialized view / DuckDB / ClickHouse kalau volume besar).
- **Async jobs**: queue untuk refresh cache, alert, scheduled report.
- **Realtime**: WebSocket untuk approval & alert.
- **Caching**: Redis untuk metric hot.
- **Auth**: RBAC per role, SSO.
- **Data layer**: staging → warehouse; ETL harian.

## 6. Prioritas Rilis
- **MVP**: core 1–6, filter, export, drill-down.
- **V1**: anomaly detection, alerts, approval monitor, contract compliance.
- **V2**: ML forecasting, price intelligence, what-if, AI summary.

**Mulai dari mana:** bangun metric + funnel + spend analytics + Pareto dulu (MVP), karena 80% value datang dari situ dan fondasinya dipakai semua fitur lanjutan.
