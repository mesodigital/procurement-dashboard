#!/usr/bin/env python3
"""Generate dummy procurement dataset (CSV) per DATASET.md.

Stdlib only. Deterministic (seed=42).

Grain: 24 bulan (2024-01 .. 2025-12), ~1200 PO line.
Cukup untuk: Pareto, ABC/XYZ, Kraljic, Benford, Z-score/IQR,
Holt-Winters forecast, DPO/aging, SLA/cycle-time, vendor scoring.

Pola sengaja disuntik:
  - split PO (di bawah approval threshold)
  - vendor duplikat (npwp sama, bank account beda) -> fraud
  - maverick buying (PO off-contract)
  - harga outlier per item (Z-score/IQR)
  - SLA breach approval (ekor distribusi)
  - defect rate beda per vendor
  - invoice digit anomali (Benford)
  - single-source dependency

ponytail: satu file generator, stdlib, no framework. Ganti seed -> dataset baru.
"""
import csv
import os
import random
from datetime import date, datetime, timedelta

SEED = 42
random.seed(SEED)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)

START = date(2024, 1, 1)
END = date(2025, 12, 31)
TOTAL_DAYS = (END - START).days


# ---------------------------------------------------------------- helpers
def rand_date(a=START, b=END):
    return a + timedelta(days=random.randint(0, max((b - a).days, 0)))


def d(x):
    return x.strftime("%Y-%m-%d")


def ts(x):
    return x.strftime("%Y-%m-%d %H:%M:%S")


def month_key(x):
    return f"{x.year}-{x.month:02d}"


def money(x):
    return f"{round(x, 2):.2f}"


def write_csv(name, header, rows):
    path = os.path.join(OUT, name)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name:28s} {len(rows):6d} rows")
    return path


# ---------------------------------------------------------------- master
CATEGORIES = [
    # name, quadrant, abc, xyz
    ("IT Hardware", "strategic", "A", "X"),
    ("IT Software & Licenses", "strategic", "A", "Y"),
    ("Raw Materials", "strategic", "A", "X"),
    ("Packaging", "leverage", "B", "X"),
    ("Logistics & Freight", "leverage", "B", "Y"),
    ("Office Supplies", "non-critical", "C", "Z"),
    ("MRO / Maintenance", "bottleneck", "B", "Y"),
    ("Facility Services", "non-critical", "C", "Z"),
    ("Professional Services", "leverage", "B", "Y"),
    ("Chemicals", "bottleneck", "A", "Y"),
]
category_rows = []
cat_name_to_id = {}
for i, (cname, quad, abc, xyz) in enumerate(CATEGORIES, start=1):
    cid = f"CAT{i:03d}"
    cat_name_to_id[cname] = cid
    category_rows.append([cid, cname, "", quad, abc, xyz])
write_csv("category.csv",
          ["category_id", "category_name", "parent_category_id",
           "kraljic_quadrant", "abc_class", "xyz_class"], category_rows)

ITEM_TEMPLATES = {
    "IT Hardware": [
        ("Laptop 14\" i7", "unit", 14500), ("Server Rack 2U", "unit", 42000),
        ("Monitor 27\"", "unit", 3200), ("Network Switch 48-port", "unit", 9800),
        ("SSD 1TB NVMe", "pcs", 1350), ("Printer Laser A3", "unit", 6800),
    ],
    "IT Software & Licenses": [
        ("MS365 Business License", "license", 1800),
        ("Antivirus Enterprise", "license", 450),
        ("ERP Module License", "license", 32000),
        ("Cloud Hosting (annual)", "subscription", 24000),
    ],
    "Raw Materials": [
        ("Steel Sheet 2mm", "ton", 12500), ("Aluminium Ingot", "ton", 22000),
        ("Copper Wire 2.5mm", "roll", 850), ("Resin Pellets", "ton", 15800),
    ],
    "Packaging": [
        ("Carton Box 40x30x20", "pcs", 7.5), ("Stretch Film Roll", "roll", 65),
        ("Pallet Wood Standard", "pcs", 95), ("Bubble Wrap 100m", "roll", 120),
    ],
    "Logistics & Freight": [
        ("Trucking Jakarta-Surabaya", "trip", 8500),
        ("Air Freight Batch", "shipment", 26000),
        ("Sea Freight FCL 20ft", "container", 18000),
    ],
    "Office Supplies": [
        ("A4 Paper 80gsm", "ream", 52), ("Ballpoint Blue", "box", 38),
        ("Toner Cartridge", "pcs", 620), ("Whiteboard Marker", "pack", 45),
        ("Stapler Heavy Duty", "unit", 145),
    ],
    "MRO / Maintenance": [
        ("Bearing SKF 6204", "pcs", 185), ("Hydraulic Oil 20L", "pail", 780),
        ("V-Belt B-Series", "pcs", 95), ("Gasket Set", "set", 240),
        ("Air Filter Compressor", "pcs", 320),
    ],
    "Facility Services": [
        ("Office Cleaning Monthly", "month", 12000),
        ("AC Maintenance Service", "unit", 850),
        ("Security Guard Monthly", "month", 22000),
    ],
    "Professional Services": [
        ("Audit Service Annual", "project", 180000),
        ("Legal Consulting", "hour", 1500),
        ("Training Program", "batch", 45000),
    ],
    "Chemicals": [
        ("Sulfuric Acid 98%", "drum", 2800), ("Caustic Soda", "ton", 16500),
        ("Solvent Xylene", "drum", 3200),
    ],
}

item_rows = []
item_std_price = {}
item_cat = {}
item_is_catalogued = {}
item_id = 1
for cname, items in ITEM_TEMPLATES.items():
    cid = cat_name_to_id[cname]
    for j, (iname, uom, base) in enumerate(items):
        iid = f"ITM{item_id:04d}"
        item_id += 1
        price = round(base * random.uniform(0.9, 1.1), 2)
        catalogued = random.random() > 0.25
        item_std_price[iid] = price
        item_cat[iid] = cid
        item_is_catalogued[iid] = catalogued
        item_rows.append([
            iid, f"MAT-{item_id:05d}", iname,
            f"{iname} grade standard for {cname}",
            cid, "", uom, money(price), random.choice([1, 5, 10, 20]),
            str(catalogued).lower(), f"HS{random.randint(1000,9999)}",
        ])
write_csv("item.csv",
          ["item_id", "item_code", "item_name", "description", "category_id",
           "subcategory_id", "uom", "standard_price", "min_order_qty",
           "is_catalogued", "hs_code"], item_rows)

# ---- vendors
def npwp():
    return f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}.{random.randint(1,9)}-{random.randint(100,999)}.000"


VENDOR_NAMES = [
    "PT Teknologi Nusantara", "CV Sumber Makmur", "PT Global Material",
    "PT Logistik Cepat", "CV Berkah Jaya", "PT Sinergi Prima",
    "PT Karya Mandiri", "CV Anugerah Sentosa", "PT Mitra Abadi",
    "PT Sinar Terang", "CV Bintang Timur", "PT Dharma Utama",
    "PT Cipta Inovasi", "CV Rezeki Lancar", "PT Prima Solusi",
    "PT Multi Sarana", "CV Tunas Harapan", "PT Inti Persada",
    "PT Cahaya Baru", "CV Surya Gemilang", "PT Anda Perkasa",
    "PT Nusa Teknik", "CV Mandiri Sejahtera", "PT Graha Logam",
    "PT Energi Kimia", "CV Panca Warna", "PT Arta Niaga",
    "PT Wira Usaha", "CV Kencana Mas", "PT Bahari Jaya",
]
BANKS = ["BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Danamon"]
CITIES = [("Jakarta", "Indonesia"), ("Surabaya", "Indonesia"),
          ("Bandung", "Indonesia"), ("Medan", "Indonesia"),
          ("Semarang", "Indonesia"), ("Singapore", "Singapore"),
          ("Kuala Lumpur", "Malaysia"), ("Shanghai", "China")]
CATEGORY_TYPES = ["supplier", "manufacturer", "distributor"]
OWNERSHIP = ["", "", "", "minority", "women-owned"]
CREDIT = ["AAA", "AA", "A", "BBB", "BB", "B"]

vendor_rows = []
vendor_bias = {}  # vendor_id -> performance bias dict
for i in range(1, 31):
    vid = f"VEN{i:03d}"
    name = VENDOR_NAMES[i - 1]
    city, country = random.choice(CITIES)
    local = "true" if country == "Indonesia" else "false"
    # vendor duplikat: 2 vendor (VEN007, VEN021) share npwp dengan VEN001
    if vid in ("VEN007", "VEN021"):
        n = npwp_shared
    else:
        n = npwp()
        if vid == "VEN001":
            npwp_shared = n
    acct_name = name if random.random() > 0.15 else VENDOR_NAMES[random.randint(0, 29)]
    acct_no = str(random.randint(10**9, 10**10 - 1))
    status = random.choices(["active", "blacklist", "suspended"],
                            weights=[90, 4, 6])[0]
    vendor_rows.append([
        vid, name, f"VC{i:04d}", n, acct_name, acct_no,
        random.choice(BANKS), f"Jl. Industri No.{random.randint(1,200)}",
        city, country, random.choice(CATEGORY_TYPES), local,
        random.choice(OWNERSHIP), status,
        d(rand_date(date(2015, 1, 1), date(2024, 1, 1))),
        random.choice(CREDIT),
    ])
    # performance bias: unggul / rata / buruk (utk spread scoring nyata)
    tier = random.choices(["good", "avg", "bad"], weights=[30, 50, 20])[0]
    if tier == "good":
        vendor_bias[vid] = dict(otd=0.96, defect=0.01, resp=8, price=0.85)
    elif tier == "bad":
        vendor_bias[vid] = dict(otd=0.72, defect=0.09, resp=40, price=1.15)
    else:
        vendor_bias[vid] = dict(otd=0.88, defect=0.03, resp=18, price=1.0)
write_csv("vendor.csv",
          ["vendor_id", "vendor_name", "vendor_code", "npwp",
           "bank_account_name", "bank_account_no", "bank_name", "address",
           "city", "country", "category_type", "is_local", "ownership_type",
           "status", "registration_date", "credit_rating"], vendor_rows)

# ---- entity, cost_center, employee
ENTITY = [("ENT01", "PT Induk Holding", "Indonesia"),
          ("ENT02", "PT Cabang Surabaya", "Indonesia"),
          ("ENT03", "PT Cabang Medan", "Indonesia")]
write_csv("entity.csv", ["entity_id", "entity_name", "country"], ENTITY)

DEPARTMENTS = [
    ("DEP01", "IT"), ("DEP02", "Production"), ("DEP03", "Finance"),
    ("DEP04", "HR & GA"), ("DEP05", "Marketing"), ("DEP06", "R&D"),
]
N_CC = 12
cost_center_rows = []
cc_ids = []
for i in range(1, N_CC + 1):
    cid = f"CC{i:03d}"
    cc_ids.append(cid)
    dep = DEPARTMENTS[(i - 1) % len(DEPARTMENTS)]
    ent = ENTITY[(i - 1) % len(ENTITY)]
    cost_center_rows.append([
        cid, f"{dep[1]} Cost Center {i}", dep[0], dep[1], ent[0], ent[1],
        f"EMP{(i % 8) + 1:03d}",
    ])
write_csv("cost_center.csv",
          ["cost_center_id", "cost_center_name", "department_id",
           "department_name", "entity_id", "entity_name", "manager_id"],
          cost_center_rows)

ROLES = ["Staff", "Senior Staff", "Supervisor", "Manager", "Director"]
LEVEL_LIMIT = {"Staff": 10_000_000, "Senior Staff": 50_000_000,
               "Supervisor": 150_000_000, "Manager": 500_000_000,
               "Director": 5_000_000_000}
employee_rows = []
emp_ids = []
for i in range(1, 41):
    eid = f"EMP{i:03d}"
    emp_ids.append(eid)
    role = random.choices(ROLES, weights=[35, 30, 20, 10, 5])[0]
    dep = random.choice(DEPARTMENTS)
    employee_rows.append([
        eid, f"Employee {i}", role, dep[0],
        LEVEL_LIMIT[role], ROLES.index(role) + 1,
    ])
write_csv("employee.csv",
          ["employee_id", "name", "role", "department_id",
           "approval_limit", "position_level"], employee_rows)

# ---- warehouse
warehouse_rows = [
    ["WH01", "Gudang Utama Jakarta", "Jakarta"],
    ["WH02", "Gudang Surabaya", "Surabaya"],
    ["WH03", "Gudang Medan", "Medan"],
]
write_csv("warehouse.csv", ["warehouse_id", "name", "location"], warehouse_rows)

# ---- payment terms
payment_terms_rows = [
    ["PT01", "Net 30", 30], ["PT02", "Net 45", 45],
    ["PT03", "Net 60", 60], ["PT04", "Net 90", 90],
    ["PT05", "COD", 0], ["PT06", "Net 15", 15],
]
write_csv("payment_terms.csv", ["term_id", "name", "days"], payment_terms_rows)

# ---- currency rate
currency_rows = []
CUR = {"IDR": 1.0, "USD": 16200.0, "SGD": 12100.0, "CNY": 2250.0}
for mth in range(24):
    y, mo = 2024 + mth // 12, mth % 12 + 1
    base = date(y, mo, 1)
    for code, rate in CUR.items():
        if code == "IDR":
            continue
        wobble = rate * random.uniform(0.97, 1.03)
        currency_rows.append([d(base), "USD", code, money(wobble)])
write_csv("currency_rate.csv",
          ["date", "from_currency", "to_currency", "rate"], currency_rows)

# ---------------------------------------------------------------- budget
budget_rows = []
for mth in range(24):
    y, mo = 2024 + mth // 12, mth % 12 + 1
    for cc in cc_ids:
        for cname in random.sample(list(cat_name_to_id), 4):
            amt = round(random.uniform(50_000_000, 900_000_000), -3)
            committed = amt * random.uniform(0.3, 0.9)
            actual = committed * random.uniform(0.5, 1.15)
            budget_rows.append([
                f"BUD{len(budget_rows)+1:05d}", cc, cat_name_to_id[cname],
                f"{y}-{mo:02d}", money(amt), money(committed),
                money(actual), "IDR",
            ])
write_csv("budget.csv",
          ["budget_id", "cost_center_id", "category_id", "period",
           "budget_amount", "committed_amount", "actual_amount", "currency"],
          budget_rows)

# ---------------------------------------------------------------- contract
contract_rows = []
contract_by_catven = {}
contract_by_cat = {}
for i in range(1, 26):
    ctid = f"CTR{i:03d}"
    vid = f"VEN{random.randint(1,30):03d}"
    cname = random.choice(list(cat_name_to_id))
    cid = cat_name_to_id[cname]
    sd = rand_date(date(2023, 1, 1), date(2025, 6, 1))
    ed = sd + timedelta(days=random.choice([365, 730, 1095]))
    cval = round(random.uniform(200_000_000, 5_000_000_000), -3)
    baseline = round(random.uniform(0.85, 1.05), 3)
    negotiated = round(random.uniform(0.03, 0.15), 3)
    status = "active" if ed >= END else "expired"
    if ed <= END + timedelta(days=60) and ed >= END:
        status = "expiring"
    contract_rows.append([
        ctid, f"CTR/{sd.year}/{i:03d}", vid, cid, d(sd), d(ed), money(cval),
        "volume discount tiered", random.choice(["true", "false"]), status,
        money(cval * negotiated), money(baseline),
    ])
    contract_by_catven.setdefault((cid, vid), ctid)
    contract_by_cat.setdefault(cid, ctid)
write_csv("contract.csv",
          ["contract_id", "contract_number", "vendor_id", "category_id",
           "start_date", "end_date", "contract_value", "pricing_terms",
           "auto_renew", "status", "negotiated_savings", "baseline_price"],
          contract_rows)

# ---------------------------------------------------------------- PR + PO
PRIORITY = ["low", "normal", "high", "urgent"]
pr_rows = []
po_rows = []
gr_rows = []
inv_rows = []
pay_rows = []
approval_rows = []
price_hist_rows = []

N_PO = 1200
APPROVAL_THRESHOLD = 5_000_000  # IDR, split PO di bawah ini

ITEM_IDS = list(item_std_price.keys())
# item dengan vendor dominan (single source)
single_source = {}
for cname, items in ITEM_TEMPLATES.items():
    cid = cat_name_to_id[cname]
    for j in range(len(items)):
        pass
# assign single-source utk beberapa item strategis
strategic_items = [iid for iid in ITEM_IDS if item_cat[iid] in
                   (cat_name_to_id["Chemicals"], cat_name_to_id["Raw Materials"])]
for iid in random.sample(strategic_items, min(4, len(strategic_items))):
    single_source[iid] = f"VEN{random.randint(1,30):03d}"

pr_id = 0
po_id = 0
gr_id = 0
inv_id = 0
pay_id = 0

for _ in range(N_PO):
    po_date = rand_date()
    if random.random() < 0.55:
        po_date = min(END, po_date + timedelta(days=30))
    iid = random.choice(ITEM_IDS)
    cid = item_cat[iid]
    base = item_std_price[iid]

    # vendor: single source kalau ada, else random
    if iid in single_source and random.random() < 0.85:
        vid = single_source[iid]
    else:
        vid = f"VEN{random.randint(1,30):03d}"
    while f"VEN{int(vid[3:]):03d}" in ("", ):
        break
    if vid in ("VEN007", "VEN021"):
        pass
    # hindari vendor blacklist aktif (kadang tetap lolos = maverick)
    bias = vendor_bias.get(vid, vendor_bias["VEN001"])

    vendor_disc = random.uniform(0.85, 1.0) + (1 - bias["price"])
    unit_price = base * vendor_disc
    # outlier harga: 4% line
    if random.random() < 0.04:
        unit_price = base * random.choice([0.4, 0.55, 1.8, 2.3])
    qty = random.choices([1, 2, 5, 10, 20, 50, 100],
                         weights=[20, 15, 15, 15, 15, 12, 8])[0]
    if base < 1000:
        qty = random.choice([50, 100, 200, 500, 1000])
    qty *= random.choice([1, 1, 2, 5])  # naikkan nilai line

    subtotal = unit_price * qty
    total_est = subtotal

    # ---- PR
    pr_id += 1
    pr_no = f"PR{po_date.year}{pr_id:05d}"
    req_date = po_date - timedelta(days=random.randint(3, 20))
    requester = random.choice(emp_ids)
    cc = random.choice(cc_ids)
    dep = [x for x in cost_center_rows if x[0] == cc][0][2]
    pr_status = random.choices(["approved", "rejected", "pending", "draft"],
                               weights=[82, 6, 8, 4])[0]
    pr_rows.append([
        f"PR{pr_id:05d}", pr_no, d(req_date), requester, cc, dep, iid,
        f"Request {iid}", qty, money(unit_price), money(total_est), "IDR",
        d(po_date + timedelta(days=random.randint(5, 30))),
        random.choice(PRIORITY), pr_status,
        f"BUD{random.randint(1, len(budget_rows)):05d}",
        f"https://docs.internal/pr/{pr_no}.pdf",
    ])
    if pr_status != "approved":
        continue

    # ---- approval log (PR)
    seq = 0
    cur = req_date
    stages = random.choices([1, 2, 3], weights=[30, 45, 25])[0]
    breached = False
    for lvl in range(stages):
        seq += 1
        sla = 24 if lvl == 0 else 48
        # SLA breach: 22% stage, atau selalu kalau urgent+high value
        if random.random() < 0.22 or (pr_status == "approved" and
                                      total_est > 200_000_000 and
                                      random.random() < 0.3):
            actual = sla * random.uniform(1.5, 4.0)
            breached = True
        else:
            actual = random.uniform(1, sla * 0.9)
        cur = cur + timedelta(hours=actual)
        approval_rows.append([
            f"APR{len(approval_rows)+1:06d}", "PR", f"PR{pr_id:05d}",
            random.choice(emp_ids), lvl + 1, seq, "approve", ts(cur),
            sla, round(actual, 2),
            "SLA breach" if breached else "ok",
        ])

    # ---- split PO: 15% dari PO; pecah jadi 2-3 PO kecil < threshold
    split = random.random() < 0.15 and subtotal > APPROVAL_THRESHOLD
    po_group = []
    if split:
        parts = random.randint(2, 3)
        for p in range(parts):
            po_group.append((qty / parts, unit_price, True))
    else:
        po_group.append((qty, unit_price, False))

    parent_po_id = None
    for (pq, pup, is_split_part) in po_group:
        po_id += 1
        po_no = f"PO{po_date.year}{po_id:05d}"
        sibling_date = po_date + timedelta(days=random.randint(0, 2) if split else 0)
        discount = (pup * pq) * random.uniform(0, 0.05)
        tax = (pup * pq - discount) * 0.11
        freight = (pup * pq) * random.uniform(0, 0.03) if base > 5000 else 0
        total_amt = pup * pq - discount + tax + freight
        pt = random.choice(payment_terms_rows)
        promised = sibling_date + timedelta(days=random.randint(7, 45))
        # on-time mengikuti bias vendor
        if random.random() < bias["otd"]:
            actual_gap = random.randint(0, (promised - sibling_date).days)
        else:
            actual_gap = (promised - sibling_date).days + random.randint(3, 30)
        actual_deliv = sibling_date + timedelta(days=actual_gap)

        # contract compliance: match by (cat,vendor) dulu, fallback cat saja
        ckey = (cid, vid)
        if ckey in contract_by_catven:
            ctr = contract_by_catven[ckey]
        elif cid in contract_by_cat:
            ctr = contract_by_cat[cid]
        else:
            ctr = ""
        if random.random() < 0.18:  # extra maverick buying
            ctr = ""

        po_status = random.choices(["closed", "open", "partial", "cancelled"],
                                   weights=[70, 10, 15, 5])[0]
        po_key = f"PO{po_id:05d}"
        po_rows.append([
            po_key, po_no, d(sibling_date), f"PR{pr_id:05d}", vid, iid,
            money(pq), money(pup), money(total_amt), money(discount),
            money(tax), money(freight), "IDR", 1.0, pt[1], d(promised),
            d(actual_deliv), random.choice(["FOB", "CIF", "EXW", "DDP"]), ctr,
            po_status,
            ("true" if split else "false"),
            (parent_po_id or ""),
        ])
        if split and parent_po_id is None:
            parent_po_id = po_key

        if po_status in ("cancelled",):
            continue

        # ---- GR
        gr_id += 1
        recv = pq if po_status in ("closed", "partial") else pq * 0.5
        rejected = max(0, round(pq * random.gauss(bias["defect"], 0.01), 2))
        recv = max(0, recv - rejected)
        if rejected > pq * 0.05:
            insp = "fail"
        elif rejected > 0:
            insp = "partial"
        else:
            insp = "pass"
        gr_date_actual = actual_deliv + timedelta(days=random.randint(0, 3))
        gr_key = f"GR{gr_id:05d}"
        gr_rows.append([
            gr_key, f"GR{gr_date_actual.year}{gr_id:05d}",
            d(gr_date_actual), po_key, money(recv), money(rejected),
            "" if rejected == 0 else random.choice(
                ["kualitas tidak sesuai", "rusak saat kirim", "spesifikasi beda"]),
            insp, random.choice(["WH01", "WH02", "WH03"]),
            random.choice(emp_ids),
        ])

        # ---- Invoice (Benford: 90% natural, 10% anomali digit)
        inv_id += 1
        inv_amt = total_amt * random.uniform(0.97, 1.03)
        if random.random() < 0.10:  # anomali -> digit depan menumpuk 8-9
            inv_amt = float(f"{random.choice([8, 9])}{random.randint(0, 9)}0000") + random.uniform(0, 9999)
        inv_date_ = gr_date_actual + timedelta(days=random.randint(1, 10))
        term_days = pt[2]
        due = inv_date_ + timedelta(days=term_days)
        paid = random.random() > 0.2
        if paid:
            pay_date = inv_date_ + timedelta(days=random.randint(1, term_days + 40))
            pstat = "paid"
        else:
            pay_date = None
            pstat = "overdue" if due < END else "unpaid"
        variance = inv_amt - total_amt
        inv_rows.append([
            f"INV{inv_id:05d}", f"INV/{inv_date_.year}/{inv_id:05d}",
            d(inv_date_), po_key, gr_key, vid, money(inv_amt),
            money(inv_amt * 0.11), d(due),
            d(pay_date) if pay_date else "", pstat, money(variance),
        ])

        if paid:
            pay_id += 1
            pay_rows.append([
                f"PAY{pay_id:05d}", f"INV{inv_id:05d}", d(pay_date),
                random.choice(["transfer", "giro", "virtual_account"]),
                money(inv_amt), f"REF{random.randint(10**6,10**7)}",
                random.choice(emp_ids),
            ])

        # ---- price history dari PO
        price_hist_rows.append([
            f"PH{len(price_hist_rows)+1:06d}", iid, vid, d(sibling_date),
            money(pup), "IDR", "po",
        ])

write_csv("purchase_requisition.csv",
          ["pr_id", "pr_number", "pr_date", "requester_id", "cost_center_id",
           "department_id", "item_id", "description", "quantity",
           "estimated_unit_price", "estimated_total", "priority", "currency",
           "required_date", "status", "budget_id", "attachment_url"],
          pr_rows)
write_csv("purchase_order.csv",
          ["po_id", "po_number", "po_date", "pr_id", "vendor_id", "item_id",
           "quantity", "unit_price", "total_amount", "discount", "tax_amount",
           "freight_cost", "currency", "exchange_rate", "payment_terms",
           "delivery_date_promised", "delivery_date_actual", "incoterms",
           "contract_id", "status", "is_split_po", "parent_po_id"], po_rows)
write_csv("goods_receipt.csv",
          ["gr_id", "gr_number", "gr_date", "po_id", "received_qty",
           "rejected_qty", "reject_reason", "inspection_result", "warehouse_id",
           "received_by"], gr_rows)
write_csv("invoice.csv",
          ["invoice_id", "invoice_number", "invoice_date", "po_id", "gr_id",
           "vendor_id", "invoice_amount", "tax_amount", "due_date",
           "payment_date", "payment_status", "variance_amount"], inv_rows)
write_csv("payment.csv",
          ["payment_id", "invoice_id", "payment_date", "payment_method",
           "amount_paid", "bank_ref", "paid_by"], pay_rows)
write_csv("approval_log.csv",
          ["approval_id", "doc_type", "doc_id", "approver_id",
           "approval_level", "sequence", "action", "action_date", "sla_hours",
           "actual_hours", "remarks"], approval_rows)

# ---- market index (untuk Laspeyres/Paasche)
market_rows = []
commodities = ["Steel", "Aluminium", "Copper", "Resin", "Diesel"]
base_idx = {c: 100.0 for c in commodities}
for mth in range(24):
    y, mo = 2024 + mth // 12, mth % 12 + 1
    for c in commodities:
        base_idx[c] *= random.uniform(0.98, 1.04)
        market_rows.append([
            f"MI{len(market_rows)+1:05d}", c, d(date(y, mo, 1)),
            round(base_idx[c], 2), "commodity_index",
        ])
write_csv("market_index.csv",
          ["index_id", "commodity_name", "index_date", "index_value", "source"],
          market_rows)

# ---- inventory snapshot (12 bulan terakhir)
inv_snap_rows = []
for mth in range(12):
    y, mo = 2025 + mth // 12, mth % 12 + 1
    snap = date(y, mo, 1)
    for iid in random.sample(ITEM_IDS, 30):
        soh = random.randint(0, 500)
        avg_cons = random.uniform(5, 120)
        lt = random.randint(3, 45)
        safety = avg_cons * random.uniform(1, 2)
        inv_snap_rows.append([
            f"INVST{len(inv_snap_rows)+1:06d}", iid,
            random.choice(["WH01", "WH02", "WH03"]), soh,
            random.randint(0, 50), round(avg_cons * lt * 0.6, 2),
            round(safety, 2), round(avg_cons, 2), lt, d(snap),
        ])
write_csv("inventory.csv",
          ["inventory_id", "item_id", "warehouse_id", "stock_on_hand",
           "stock_reserved", "reorder_point", "safety_stock",
           "avg_consumption", "lead_time_days", "snapshot_date"],
          inv_snap_rows)

# ---- demand history (24 bulan per item sampel)
demand_rows = []
for iid in random.sample(ITEM_IDS, 30):
    base_demand = random.uniform(50, 800)
    for mth in range(24):
        y, mo = 2024 + mth // 12, mth % 12 + 1
        season = 1 + 0.2 * random.choice([-1, 0, 1])
        trend = 1 + 0.01 * mth
        qty = base_demand * season * trend * random.uniform(0.9, 1.1)
        demand_rows.append([
            f"DH{len(demand_rows)+1:06d}", iid, f"{y}-{mo:02d}",
            round(qty, 2), random.choice(["production", "sales"]),
        ])
write_csv("demand_history.csv",
          ["demand_id", "item_id", "period", "quantity_used", "source"],
          demand_rows)

# ---- driver data
driver_rows = []
for mth in range(24):
    y, mo = 2024 + mth // 12, mth % 12 + 1
    period = f"{y}-{mo:02d}"
    driver_rows.append([f"DR{len(driver_rows)+1:04d}", "production", period,
                        round(random.uniform(1000, 5000), 2)])
    driver_rows.append([f"DR{len(driver_rows)+1:04d}", "sales", period,
                        round(random.uniform(5000, 20000), 2)])
    driver_rows.append([f"DR{len(driver_rows)+1:04d}", "headcount", period,
                        random.randint(200, 260)])
write_csv("driver_data.csv",
          ["driver_id", "driver_name", "period", "value"], driver_rows)

# ---- price history: tambah catalog + market_index rows
for iid in random.sample(ITEM_IDS, 40):
    price_hist_rows.append([
        f"PH{len(price_hist_rows)+1:06d}", iid,
        "", d(date(2024, 1, 1)), money(item_std_price[iid]), "IDR", "catalog",
    ])
write_csv("price_history.csv",
          ["price_id", "item_id", "vendor_id", "effective_date", "unit_price",
           "currency", "source"], price_hist_rows)

# ---- vendor performance (per vendor per kuartal)
vp_rows = []
for vid in [f"VEN{i:03d}" for i in range(1, 31)]:
    b = vendor_bias[vid]
    for q in range(8):
        y = 2024 + q // 4
        qq = q % 4 + 1
        period = f"{y}-Q{qq}"
        otd = min(1.0, max(0.0, random.gauss(b["otd"], 0.05)))
        defect = max(0.0, random.gauss(b["defect"], 0.008))
        resp = max(1.0, random.gauss(b["resp"], 5))
        vp_rows.append([
            f"VP{len(vp_rows)+1:06d}", vid, period, round(otd * 100, 2),
            round(defect * 100, 3), round(b["price"] * random.uniform(0.95, 1.05), 3),
            round(resp, 1), round(min(1.0, otd + 0.02) * 100, 2),
            random.randint(5, 80),
            money(random.uniform(50_000_000, 3_000_000_000)),
        ])
write_csv("vendor_performance.csv",
          ["perf_id", "vendor_id", "period", "on_time_delivery_pct",
           "defect_rate", "price_competitiveness", "avg_response_hours",
           "fill_rate", "order_count", "total_spend"], vp_rows)

# ---- vendor risk
vr_rows = []
for vid in [f"VEN{i:03d}" for i in range(1, 31)]:
    fin = random.randint(0, 100)
    geo = random.randint(0, 100)
    single = "true" if vid in single_source.values() else "false"
    dep = round(random.uniform(5, 90), 1)
    if single == "true":
        dep = round(random.uniform(70, 95), 1)
    comp = round(0.4 * fin + 0.3 * geo + 0.3 * dep, 1)
    vr_rows.append([
        f"VR{len(vr_rows)+1:05d}", vid, d(END), fin, geo, single, dep, comp,
    ])
write_csv("vendor_risk.csv",
          ["risk_id", "vendor_id", "score_date", "financial_risk", "geo_risk",
           "single_source_flag", "dependency_pct", "composite_score"], vr_rows)

# ---- esg vendor
esg_rows = []
for i, v in enumerate(vendor_rows, start=1):
    local_pct = round(random.uniform(40, 100) if v[11] == "true" else random.uniform(0, 30), 1)
    esg_rows.append([f"VEN{i:03d}", local_pct,
                     round(random.uniform(500, 50000), 1)])
write_csv("esg_vendor.csv", ["vendor_id", "local_pct", "carbon_kg"], esg_rows)

print("\nDone. Output ->", OUT)
