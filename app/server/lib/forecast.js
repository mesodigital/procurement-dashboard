// Time-series forecasting: Holt-Winters (ETS), ARIMA(1,1,1)-lite, and a
// gradient-boosting-style regression on lag/seasonal features.
import { mean, std } from './stats.js';

// ---------- Holt-Winters additive ----------
export function holtWinters(series, horizon, season = 12, alpha = 0.3, beta = 0.1, gamma = 0.2) {
  const n = series.length;
  if (n < season * 2) return naive(series, horizon);
  // init
  const firstSeason = series.slice(0, season);
  let level = mean(firstSeason);
  let trend = (mean(series.slice(season, 2 * season)) - level) / season;
  const seasonal = firstSeason.map((v) => v - level);
  const fitted = [];
  for (let i = 0; i < n; i++) {
    const s = seasonal[i % season];
    const forecast = level + trend + s;
    fitted.push(forecast);
    const prevLevel = level;
    level = alpha * (series[i] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % season] = gamma * (series[i] - level) + (1 - gamma) * s;
  }
  const out = [];
  for (let h = 1; h <= horizon; h++) {
    out.push(level + h * trend + seasonal[(n + h - 1) % season]);
  }
  return { forecast: out, fitted, method: 'Holt-Winters (ETS additive)' };
}

function naive(series, horizon) {
  const m = mean(series);
  return { forecast: Array(horizon).fill(m), fitted: series.map(() => m), method: 'Mean' };
}

// ---------- ARIMA(1,1,1) via conditional least squares ----------
export function arima111(series, horizon) {
  const n = series.length;
  if (n < 8) return naive(series, horizon);
  const d = series.slice(1).map((v, i) => v - series[i]); // diff once
  // grid search phi, theta minimizing SSE
  let best = { phi: 0.3, theta: 0.3, sse: Infinity };
  for (let phi = -0.95; phi <= 0.95; phi += 0.05) {
    for (let theta = -0.95; theta <= 0.95; theta += 0.05) {
      let sse = 0;
      let prevErr = 0;
      for (let t = 1; t < d.length; t++) {
        const pred = phi * d[t - 1] + theta * prevErr;
        const err = d[t] - pred;
        sse += err * err;
        prevErr = err;
      }
      if (sse < best.sse) best = { phi, theta, sse };
    }
  }
  const { phi, theta } = best;
  const fittedD = [d[0]];
  let prevErr = 0;
  for (let t = 1; t < d.length; t++) {
    const pred = phi * d[t - 1] + theta * prevErr;
    fittedD.push(pred);
    prevErr = d[t] - pred;
  }
  // integrate
  const fitted = [series[0]];
  for (let t = 1; t < n; t++) fitted.push(fitted[t - 1] + fittedD[t - 1] || series[t]);
  const out = [];
  let last = series[n - 1];
  let lastD = d[d.length - 1];
  let lastErr = prevErr;
  for (let h = 0; h < horizon; h++) {
    lastD = phi * lastD + theta * lastErr;
    last += lastD;
    out.push(last);
  }
  return { forecast: out, fitted, method: `ARIMA(1,1,1) phi=${phi.toFixed(2)} theta=${theta.toFixed(2)}` };
}

// ---------- Gradient boosting proxy ----------
// Builds lag + seasonal features and fits shallow regression trees boosted.
// Small, dependency-free implementation.
export function gradBoost(series, horizon, season = 12, rounds = 40, lr = 0.1, depth = 3) {
  const n = series.length;
  if (n < season + 2) return naive(series, horizon);
  const maxLag = Math.min(season, n - 2);
  const buildFeatures = (vals, idx) => {
    const f = [];
    for (let l = 1; l <= maxLag; l++) f.push(vals[idx - l] ?? mean(vals));
    f.push(idx % season);
    return f;
  };
  // supervised on index >= maxLag
  const X = [];
  const Y = [];
  for (let i = maxLag; i < n; i++) {
    X.push(buildFeatures(series, i));
    Y.push(series[i]);
  }
  const base = mean(Y);
  const pred0 = Y.map(() => base);
  let residuals = Y.map((y, i) => y - pred0[i]);
  const trees = [];
  const allVals = [...series];
  for (let r = 0; r < rounds; r++) {
    const tree = fitTree(X, residuals, depth);
    trees.push(tree);
    residuals = residuals.map((res, i) => res - lr * predictTree(tree, X[i]));
  }
  const predictAt = (vals, idx) => {
    const f = buildFeatures(vals, idx);
    let p = base;
    for (const t of trees) p += lr * predictTree(t, f);
    return p;
  };
  const fitted = series.map((_, i) =>
    i < maxLag ? series[i] : predictAt(series, i)
  );
  const extended = [...series];
  const out = [];
  for (let h = 0; h < horizon; h++) {
    const idx = extended.length;
    const p = predictAt(extended, idx);
    out.push(p);
    extended.push(p);
  }
  return { forecast: out, fitted, method: `Gradient Boosting (${rounds} trees, depth ${depth})` };
}

function fitTree(X, y, depth) {
  const idxs = X.map((_, i) => i);
  return grow(X, y, idxs, depth);
}

function grow(X, y, idxs, depth) {
  const node = { value: mean(idxs.map((i) => y[i])) };
  if (depth <= 0 || idxs.length < 4) return node;
  const nFeat = X[0].length;
  let best = null;
  for (let f = 0; f < nFeat; f++) {
    const vals = idxs.map((i) => X[i][f]).slice().sort((a, b) => a - b);
    const candidates = [vals[Math.floor(vals.length * 0.25)], vals[Math.floor(vals.length * 0.5)], vals[Math.floor(vals.length * 0.75)]];
    for (const thr of candidates) {
      const left = idxs.filter((i) => X[i][f] <= thr);
      const right = idxs.filter((i) => X[i][f] > thr);
      if (!left.length || !right.length) continue;
      const sse =
        sum2(left.map((i) => y[i])) + sum2(right.map((i) => y[i]));
      if (!best || sse < best.sse) best = { f, thr, left, right, sse };
    }
  }
  if (!best) return node;
  node.f = best.f;
  node.thr = best.thr;
  node.left = grow(X, y, best.left, depth - 1);
  node.right = grow(X, y, best.right, depth - 1);
  return node;
}

const sum2 = (a) => {
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0);
};

function predictTree(node, x) {
  if (node.f === undefined) return node.value;
  return x[node.f] <= node.thr ? predictTree(node.left, x) : predictTree(node.right, x);
}

// ---------- accuracy metrics ----------
export function backtest(series, forecaster, season = 12) {
  const split = Math.max(season + 2, Math.floor(series.length * 0.8));
  const train = series.slice(0, split);
  const test = series.slice(split);
  if (!test.length) return { mape: null, mae: null, rmse: null, test: [], pred: [] };
  const { forecast } = forecaster(train, test.length);
  const mae = mean(test.map((y, i) => Math.abs(y - forecast[i])));
  const rmse = Math.sqrt(mean(test.map((y, i) => (y - forecast[i]) ** 2)));
  const mape = mean(test.map((y, i) => (y ? Math.abs((y - forecast[i]) / y) : 0))) * 100;
  const maseDenom = mean(train.slice(1).map((v, i) => Math.abs(v - train[i]))) || 1;
  const mase = mae / maseDenom;
  return { mape, mae, rmse, mase, test, pred: forecast };
}

// auto-select best by backtest MAPE
export function autoForecast(series, horizon, season = 12) {
  const candidates = [
    { name: 'Holt-Winters', fn: (s, h) => holtWinters(s, h, season) },
    { name: 'ARIMA(1,1,1)', fn: (s, h) => arima111(s, h) },
    { name: 'Gradient Boosting', fn: (s, h) => gradBoost(s, h, season) },
  ];
  let best = null;
  for (const c of candidates) {
    const bt = backtest(series, c.fn, season);
    const score = bt.mape == null ? Infinity : bt.mape;
    if (!best || score < best.score) best = { ...c, score, backtest: bt };
  }
  const chosen = best || candidates[0];
  const res = chosen.fn(series, horizon);
  return { ...res, name: chosen.name, backtest: chosen.backtest, candidates: candidates.map((c) => ({ name: c.name, mape: backtest(series, c.fn, season).mape })) };
}
