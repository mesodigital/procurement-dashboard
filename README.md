# Procurement Analytics Dashboard

Dashboard analitik pengadaan (procurement) berbasis React + Vite (frontend) dan Express (API analytics), dengan dataset CSV di `data/`.

## Struktur

- `app/` — frontend React + server Express (`app/server`)
- `data/` — 25 file CSV dataset
- `generate_data.py` — generator dataset
- `PRD.md`, `DATASET.md` — dokumen produk & dataset

## Jalankan lokal (dev)

```bash
cd app
npm install
npm run dev        # API :5177 + Vite :5173 (proxy /api)
```

## Jalankan produksi (lokal)

```bash
cd app
npm install
npm run build      # hasil ke app/dist
npm start          # Express serve API + static dist di :5177
```

Buka http://localhost:5177

## Deploy di server baru

### Opsi A — Docker (paling mudah)

```bash
git clone <repo-url> && cd dashboard-procurement
docker compose up -d --build
```

Buka `http://<server-ip>:5177`. Ganti port host di `docker-compose.yml` bila perlu.

### Opsi B — Tanpa Docker (Node 22+)

```bash
git clone <repo-url> && cd dashboard-procurement/app
npm ci
npm run build
PORT=5177 npm start
```

Jadikan service (systemd) atau jalankan via `pm2`:

```bash
pm2 start server/index.js --name procurement-dashboard
```

### Konfigurasi

- `PORT` — port server (default `5177`)
- `DATA_DIR` — lokasi folder CSV (default `<repo>/data`)
