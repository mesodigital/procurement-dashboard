// Segmentation: Kraljic 2D, ABC-XYZ, k-means clustering.
import { mean, std } from './stats.js';

// Kraljic: profit impact (spend) x supply risk (proxy).
// supply risk proxy = f(single_source, dependency, defect_rate, lead_time variability, geo)
export function kraljic(entries) {
  // entries: { key, name, value(spend), risk(raw score) }
  const spends = entries.map((e) => e.value);
  const risks = entries.map((e) => e.risk);
  const spendMed = median(spends);
  const riskMed = median(risks);
  return entries.map((e) => {
    const highImpact = e.value >= spendMed;
    const highRisk = e.risk >= riskMed;
    const quadrant = highImpact
      ? highRisk
        ? 'strategic'
        : 'leverage'
      : highRisk
      ? 'bottleneck'
      : 'non-critical';
    return { ...e, quadrant, highImpact, highRisk };
  });
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// k-means (k-means++ init, deterministic seed). points: number[][].
export function kmeans(points, k, iters = 100) {
  if (points.length < k) return points.map((_, i) => i % k);
  // deterministic init: spread by first principal axis
  const dim = points[0].length;
  const meanAxis = Array.from({ length: dim }, (_, d) => mean(points.map((p) => p[d])));
  const sd = Array.from({ length: dim }, (_, d) => std(points.map((p) => p[d])) || 1);
  const norm = points.map((p) => p.map((x, d) => (x - meanAxis[d]) / sd[d]));
  // k-means++ with fixed pseudo-random
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const centers = [norm[Math.floor(rnd() * norm.length)]];
  while (centers.length < k) {
    const d2 = norm.map((p) => Math.min(...centers.map((c) => dist2(p, c))));
    const tot = d2.reduce((s, x) => s + x, 0);
    let r = rnd() * tot;
    let idx = 0;
    for (; idx < d2.length; idx++) {
      r -= d2[idx];
      if (r <= 0) break;
    }
    centers.push(norm[Math.min(idx, norm.length - 1)]);
  }
  let assign = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (let i = 0; i < norm.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(norm[i], centers[c]);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }
    for (let c = 0; c < k; c++) {
      const pts = norm.filter((_, i) => assign[i] === c);
      if (pts.length) centers[c] = Array.from({ length: dim }, (_, d) => mean(pts.map((p) => p[d])));
    }
    if (!changed) break;
  }
  // silhouette
  const sil = silhouette(norm, assign, k);
  return { assign, silhouette: sil, k };
}

function dist2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

function silhouette(pts, assign, k) {
  if (k < 2) return 0;
  let tot = 0;
  for (let i = 0; i < pts.length; i++) {
    const own = assign[i];
    const same = pts.filter((_, j) => j !== i && assign[j] === own);
    const a = same.length ? mean(same.map((p) => Math.sqrt(dist2(pts[i], p)))) : 0;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === own) continue;
      const other = pts.filter((_, j) => assign[j] === c && j !== i);
      if (other.length) b = Math.min(b, mean(other.map((p) => Math.sqrt(dist2(pts[i], p)))));
    }
    if (b === Infinity) b = 0;
    const s = Math.max(a, b) === 0 ? 0 : (b - a) / Math.max(a, b);
    tot += s;
  }
  return tot / pts.length;
}
