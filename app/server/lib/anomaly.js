// Anomaly detection: IQR, modified Z-score (MAD), Benford's law, Isolation Forest.
import { mean, mad, quantile, sum, std } from './stats.js';

// IQR Tukey fence. values: number[]. Returns boolean flags.
export function iqrOutliers(values, k = 1.5) {
  const s = [...values].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  return values.map((v) => v < lo || v > hi);
}

// Modified Z-score using MAD. |0.6745*(x-med)|/MAD > threshold
export function modifiedZ(values, threshold = 3.5) {
  const med = quantile([...values].sort((a, b) => a - b), 0.5);
  const m = mad(values);
  if (m === 0) return values.map(() => false);
  return values.map((v) => Math.abs(0.6745 * (v - med)) / m > threshold);
}

// Benford first-digit test. Returns observed vs expected distribution + chi-square.
export function benford(values) {
  const digits = Array(10).fill(0);
  let n = 0;
  for (const v of values) {
    const x = Math.abs(Number(v));
    if (!x || x < 1) continue;
    const d = Number(String(x).replace(/[^0-9]/g, '')[0]);
    if (d >= 1 && d <= 9) {
      digits[d]++;
      n++;
    }
  }
  const observed = [];
  const expected = [];
  let chi2 = 0;
  for (let d = 1; d <= 9; d++) {
    const exp = Math.log10(1 + 1 / d) * n;
    const obs = digits[d];
    observed.push(obs);
    expected.push(exp);
    if (exp > 0) chi2 += (obs - exp) ** 2 / exp;
  }
  return { observed, expected, n, chi2, df: 8 };
}

// Isolation Forest (small, deterministic). X: number[][]. Returns score per point (higher = more anomalous).
export function isolationForest(X, nTrees = 100, sampleSize = 64) {
  const n = X.length;
  if (n < 6) return X.map(() => 0);
  const psi = Math.min(sampleSize, n);
  const cpsi = psi > 1 ? 2 * (Math.log(psi - 1) + 0.5772156649) - (2 * (psi - 1)) / psi : 1;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const scores = new Array(n).fill(0);
  for (let t = 0; t < nTrees; t++) {
    const sample = [];
    for (let i = 0; i < psi; i++) sample.push(Math.floor(rnd() * n));
    const tree = buildITree(sample.map((i) => X[i]), 0, Math.ceil(Math.log2(psi)), rnd);
    for (let i = 0; i < n; i++) {
      scores[i] += pathLength(tree, X[i], 0);
    }
  }
  const dim = X[0].length;
  return scores.map((s) => {
    const e = s / nTrees;
    return Math.pow(2, -e / cpsi);
  });
}

function buildITree(pts, depth, maxDepth, rnd) {
  if (depth >= maxDepth || pts.length <= 1) return { size: pts.length };
  const dim = pts[0].length;
  // pick random dimension with spread
  const dims = Array.from({ length: dim }, (_, d) => d).filter((d) => {
    const vals = pts.map((p) => p[d]);
    return Math.max(...vals) > Math.min(...vals);
  });
  if (!dims.length) return { size: pts.length };
  const d = dims[Math.floor(rnd() * dims.length)];
  const vals = pts.map((p) => p[d]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const split = lo + rnd() * (hi - lo);
  const left = pts.filter((p) => p[d] < split);
  const right = pts.filter((p) => p[d] >= split);
  return { d, split, left: buildITree(left, depth + 1, maxDepth, rnd), right: buildITree(right, depth + 1, maxDepth, rnd) };
}

function pathLength(node, x, depth) {
  if (node.size !== undefined && node.d === undefined) return depth + (node.size > 1 ? 2 * (Math.log(node.size - 1) + 0.5772156649) - (2 * (node.size - 1)) / node.size : 0);
  return x[node.d] < node.split ? pathLength(node.left, x, depth + 1) : pathLength(node.right, x, depth + 1);
}

// Combined anomaly verdict for one PO
export function combine({ zFlag, iqrFlag, ifScore }) {
  let score = 0;
  if (zFlag) score += 1;
  if (iqrFlag) score += 1;
  if (ifScore != null) score += (ifScore - 0.5) * 2; // ~0..1
  return score;
}
