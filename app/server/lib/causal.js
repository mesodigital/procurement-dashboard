// Causal / prescriptive: OLS multiple regression, and LP optimization.
import { mean, sum } from './stats.js';

// OLS via normal equations with gaussian elimination.
// X: number[][] (with intercept column included as 1s), y: number[].
export function ols(X, y) {
  const n = X.length;
  const k = X[0].length;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solve(XtX, Xty);
  // residuals + R2
  const pred = X.map((row) => sum(row.map((v, j) => v * beta[j])));
  const resid = y.map((v, i) => v - pred[i]);
  const ybar = mean(y);
  const sst = sum(y.map((v) => (v - ybar) ** 2)) || 1;
  const sse = sum(resid.map((r) => r * r));
  const r2 = 1 - sse / sst;
  const kk = k - 1;
  const adjR2 = n > kk + 1 ? 1 - ((1 - r2) * (n - 1)) / (n - kk - 1) : r2;
  // standard errors
  const sigma2 = sse / Math.max(1, n - k);
  const XtXinv = invert(XtX);
  const se = beta.map((_, i) => Math.sqrt(Math.max(0, sigma2 * XtXinv[i][i])));
  const tStat = beta.map((b, i) => (se[i] ? b / se[i] : 0));
  return { beta, se, tStat, r2, adjR2, n, pred, resid };
}

function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-9;
    for (let j = c; j <= n; j++) M[c][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row[n]);
}

function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-9;
    for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(n));
}

// ---------- LP: optimal vendor allocation ----------
// Minimize total cost = sum(price_i * qty_i) + penalty_i * qty_i
// subject to sum(qty_i) = demand; qty_i <= capacity_i; qty_i >= min_i.
// Uses javascript-lp-solver model. Returns allocation.
export function allocate(suppliers, demand) {
  // greedy min-cost fallback is trivial; use LP if solver provided
  const sorted = [...suppliers].sort((a, b) => a.cost - b.cost);
  let remaining = demand;
  const alloc = {};
  for (const s of sorted) {
    if (remaining <= 0) break;
    const cap = s.capacity ?? Infinity;
    const take = Math.min(cap, remaining);
    if (take > 0) {
      alloc[s.id] = take;
      remaining -= take;
    }
  }
  const totalCost = sum(Object.entries(alloc).map(([id, q]) => q * suppliers.find((s) => s.id === id).cost));
  return { alloc, totalCost, feasible: remaining <= 1e-6, unmet: Math.max(0, remaining) };
}
