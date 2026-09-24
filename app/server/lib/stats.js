// Descriptive concentration & distribution statistics. Pure functions.

export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);

export function std(a, sample = true) {
  if (a.length < 2) return 0;
  const m = mean(a);
  const v = sum(a.map((x) => (x - m) ** 2)) / (a.length - (sample ? 1 : 0));
  return Math.sqrt(v);
}

export function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

// Median absolute deviation -> robust scale
export function mad(a) {
  const m = [...a].sort((x, y) => x - y);
  const med = quantile(m, 0.5);
  const dev = a.map((x) => Math.abs(x - med)).sort((x, y) => x - y);
  return quantile(dev, 0.5);
}

// Herfindahl-Hirschman Index. shares = proportions in [0,1]. Returns 0..1.
export function hhi(values) {
  const t = sum(values);
  if (!t) return 0;
  return sum(values.map((v) => (v / t) ** 2));
}

// Normalized HHI on 0..1 (0 = perfectly even, 1 = single actor)
export function hhiNormalized(values) {
  const n = values.filter((v) => v > 0).length;
  if (n <= 1) return 1;
  const h = hhi(values);
  return (h - 1 / n) / (1 - 1 / n);
}

// Gini coefficient of a value distribution (concentration). 0..1
export function gini(values) {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const n = v.length;
  const t = sum(v);
  if (!n || !t) return 0;
  let cum = 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    cum += v[i];
    s += (2 * (i + 1) - n - 1) * v[i];
  }
  return s / (n * t);
}

// Lorenz curve points (population share vs value share)
export function lorenz(values) {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const t = sum(v);
  const n = v.length;
  const pts = [{ x: 0, y: 0 }];
  let cum = 0;
  v.forEach((x, i) => {
    cum += x;
    pts.push({ x: (i + 1) / n, y: t ? cum / t : 0 });
  });
  return pts;
}

// Pareto: rank descending, cumulative share. Returns rows + head count for p% of value.
export function pareto(entries, p = 0.8) {
  const rows = [...entries].sort((a, b) => b.value - a.value);
  const t = sum(rows.map((r) => r.value));
  let cum = 0;
  const out = rows.map((r, i) => {
    cum += r.value;
    return {
      rank: i + 1,
      ...r,
      share: t ? r.value / t : 0,
      cumulative: t ? cum / t : 0,
    };
  });
  const needed = out.findIndex((r) => r.cumulative >= p);
  return { rows: out, total: t, headCount: needed < 0 ? out.length : needed + 1, headShare: out.length ? (needed + 1) / out.length : 0 };
}

// Coefficient of variation (XYZ classification: demand variability)
export const cv = (a) => {
  const m = mean(a);
  return m ? std(a) / m : 0;
};

// ABC classification by cumulative value (A ~80%, B ~95%, C rest)
export function abcClassify(entries) {
  const { rows } = pareto(entries, 0.8);
  return rows.map((r) => ({
    ...r,
    abc: r.cumulative <= 0.8 ? 'A' : r.cumulative <= 0.95 ? 'B' : 'C',
  }));
}

// XYZ by demand variability
export function xyzClassify(entries, cvValue) {
  const x = cvValue <= 0.5 ? 'X' : cvValue <= 1 ? 'Y' : 'Z';
  return x;
}
