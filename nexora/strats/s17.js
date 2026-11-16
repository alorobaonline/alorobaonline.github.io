// ===================== Strategy 17: SSL Hybrid + QQE MOD + WAE (منقولة حرفياً من strategy17_math.py) =====================
const S17 = (() => {
  const fin = v => v !== null && v !== undefined && Number.isFinite(v);
  const CFG = { baselineLength: 60, continuationLength: 5, jurikPhase: 3, jurikPower: 1, exitLength: 15, atrPeriod: 14,
    qqe1RsiLength: 6, qqe1Smoothing: 6, qqe1Factor: 3, qqe1Threshold: 3, qqeBollingerLength: 50, qqeBollingerMultiplier: 0.35,
    qqe2RsiLength: 6, qqe2Smoothing: 5, qqe2Factor: 1.61, qqe2Threshold: 3, waeSensitivity: 180, waeFastLength: 20,
    waeSlowLength: 40, waeChannelLength: 20, waeBollingerMultiplier: 2, stopReferenceOffset: 2, stopBufferBps: 5 };
  function rolling(v, n, fn) {
    const out = new Array(v.length).fill(null);
    for (let i = n - 1; i < v.length; i++) { let ok = true; for (let k = i - n + 1; k <= i; k++) if (!fin(v[k])) { ok = false; break; }
      if (ok) out[i] = fn(v, i - n + 1, i); }
    return out;
  }
  const sma = (v, n) => rolling(v, n, (a, s, e) => { let t = 0; for (let k = s; k <= e; k++) t += a[k]; return t / n; });
  const stdev = (v, n) => rolling(v, n, (a, s, e) => { let t = 0; for (let k = s; k <= e; k++) t += a[k]; const m = t / n; let q = 0; for (let k = s; k <= e; k++) q += (a[k] - m) ** 2; return Math.sqrt(q / n); });
  const wma = (v, n) => { const den = n * (n + 1) / 2; return rolling(v, n, (a, s, e) => { let t = 0; for (let k = s; k <= e; k++) t += a[k] * (k - s + 1); return t / den; }); };
  function ema(v, n) { const out = new Array(v.length).fill(null), al = 2 / (n + 1); let p = null;
    for (let i = 0; i < v.length; i++) { if (!fin(v[i])) { p = null; continue; } p = p === null ? v[i] : al * v[i] + (1 - al) * p; out[i] = p; } return out; }
  function rma(v, n) { const out = new Array(v.length).fill(null); let seed = [], p = null;
    for (let i = 0; i < v.length; i++) { const x = v[i]; if (!fin(x)) { seed = []; p = null; continue; }
      if (p === null) { seed.push(x); if (seed.length === n) { p = seed.reduce((s, y) => s + y, 0) / n; out[i] = p; } }
      else { p = (p * (n - 1) + x) / n; out[i] = p; } } return out; }
  function hma(v, n) { const half = Math.max(1, Math.floor(n / 2)), root = Math.max(1, Math.floor(Math.sqrt(n) + 0.5));
    const a = wma(v, half), b = wma(v, n); return wma(a.map((x, i) => fin(x) && fin(b[i]) ? 2 * x - b[i] : null), root); }
  function jma(v, n, phase, power) {
    const pr = phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
    const beta = n > 1 ? 0.45 * (n - 1) / (0.45 * (n - 1) + 2) : 0, alpha = beta ** power;
    const out = new Array(v.length).fill(null); let e0 = 0, e1 = 0, e2 = 0, prev = 0;
    for (let i = 0; i < v.length; i++) { if (!fin(v[i])) continue; const x = v[i];
      e0 = (1 - alpha) * x + alpha * e0; e1 = (x - e0) * (1 - beta) + beta * e1;
      e2 = (e0 + pr * e1 - prev) * (1 - alpha) ** 2 + alpha ** 2 * e2; prev = e2 + prev; out[i] = prev; }
    return out;
  }
  function rsi(c, n) { const g = new Array(c.length).fill(null), l = new Array(c.length).fill(null);
    for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g[i] = Math.max(0, d); l[i] = Math.max(0, -d); }
    const ag = rma(g, n), al = rma(l, n);
    return ag.map((x, i) => fin(x) && fin(al[i]) ? (al[i] === 0 ? 100 : x === 0 ? 0 : 100 - 100 / (1 + x / al[i])) : null); }
  const crossUp = (a, b, i) => i > 0 && fin(a[i-1]) && fin(b[i-1]) && fin(a[i]) && fin(b[i]) && a[i-1] <= b[i-1] && a[i] > b[i];
  const crossDn = (a, b, i) => i > 0 && fin(a[i-1]) && fin(b[i-1]) && fin(a[i]) && fin(b[i]) && a[i-1] >= b[i-1] && a[i] < b[i];
  function qqe(c, rl, sm, fac) {
    const raw = rsi(c, rl), s = ema(raw, sm), delta = new Array(c.length).fill(null);
    for (let i = 1; i < c.length; i++) if (fin(s[i]) && fin(s[i-1])) delta[i] = Math.abs(s[i] - s[i-1]);
    const w = rl * 2 - 1, dar = ema(ema(delta, w), w).map(x => fin(x) ? x * fac : null);
    const L = new Array(c.length).fill(null), Sh = new Array(c.length).fill(null), trail = new Array(c.length).fill(null);
    let ts = 1;
    for (let i = 0; i < c.length; i++) {
      if (!fin(s[i]) || !fin(dar[i])) continue;
      const cur = s[i], nl = cur - dar[i], ns = cur + dar[i];
      const pl = i ? L[i-1] : null, ps = i ? Sh[i-1] : null, prs = i ? s[i-1] : null;
      L[i] = fin(pl) && fin(prs) && prs > pl && cur > pl ? Math.max(pl, nl) : nl;
      Sh[i] = fin(ps) && fin(prs) && prs < ps && cur < ps ? Math.min(ps, ns) : ns;
      if (i >= 2 && [s[i-1], s[i], Sh[i-2], Sh[i-1], L[i-2], L[i-1]].every(fin)) {
        const cs = s[i-1] <= Sh[i-2] && s[i] > Sh[i-1];
        const cl = (L[i-2] <= s[i-1] && L[i-1] > s[i]) || (L[i-2] >= s[i-1] && L[i-1] < s[i]);
        if (cs) ts = 1; else if (cl) ts = -1;
      }
      trail[i] = ts === 1 ? L[i] : Sh[i];
    }
    return { smoothed: s, trail };
  }
  // المؤشرات على شموع الفريم (O,H,L,C)
  function calc(O, H, Lo, C) {
    const n = C.length, J = [CFG.jurikPhase, CFG.jurikPower];
    const base = hma(C, CFG.baselineLength), bH = hma(H, CFG.baselineLength), bL = hma(Lo, CFG.baselineLength);
    const cH = jma(H, CFG.continuationLength, ...J), cL = jma(Lo, CFG.continuationLength, ...J);
    const xH = hma(H, CFG.exitLength), xL = hma(Lo, CFG.exitLength);
    const tr = C.map((_, i) => i ? Math.max(H[i] - Lo[i], Math.abs(H[i] - C[i-1]), Math.abs(Lo[i] - C[i-1])) : H[i] - Lo[i]);
    const atr = wma(tr, CFG.atrPeriod);
    const bs = [], exitLine = new Array(n).fill(null); let bd = 0, ed = 0;
    for (let i = 0; i < n; i++) {
      if (fin(bH[i]) && C[i] > bH[i]) bd = 1; else if (fin(bL[i]) && C[i] < bL[i]) bd = -1;
      if (fin(xH[i]) && C[i] > xH[i]) ed = 1; else if (fin(xL[i]) && C[i] < xL[i]) ed = -1;
      bs.push(bd); exitLine[i] = ed < 0 ? xH[i] : ed > 0 ? xL[i] : null;
    }
    const arrowUp = new Array(n).fill(false), arrowDn = new Array(n).fill(false);
    for (let i = 1; i < n; i++) { if (fin(exitLine[i-1]) && fin(exitLine[i]) && crossUp(C, exitLine, i)) arrowUp[i] = true;
      if (fin(exitLine[i-1]) && fin(exitLine[i]) && crossDn(C, exitLine, i)) arrowDn[i] = true; }
    const q1 = qqe(C, CFG.qqe1RsiLength, CFG.qqe1Smoothing, CFG.qqe1Factor), q2 = qqe(C, CFG.qqe2RsiLength, CFG.qqe2Smoothing, CFG.qqe2Factor);
    const fc = q1.trail.map(x => fin(x) ? x - 50 : null), bb = sma(fc, CFG.qqeBollingerLength), bd2 = stdev(fc, CFG.qqeBollingerLength);
    const up = bb.map((b, i) => fin(b) && fin(bd2[i]) ? b + bd2[i] * CFG.qqeBollingerMultiplier : null);
    const lw = bb.map((b, i) => fin(b) && fin(bd2[i]) ? b - bd2[i] * CFG.qqeBollingerMultiplier : null);
    const qh = q2.smoothed.map(x => fin(x) ? x - 50 : null), q1h = q1.smoothed.map(x => fin(x) ? x - 50 : null);
    const qL = qh.map((x, i) => fin(x) && x > CFG.qqe2Threshold && fin(q1h[i]) && q1h[i] > CFG.qqe1Threshold && fin(up[i]) && q1h[i] > up[i]);
    const qS = qh.map((x, i) => fin(x) && x < -CFG.qqe2Threshold && fin(q1h[i]) && q1h[i] < -CFG.qqe1Threshold && fin(lw[i]) && q1h[i] < lw[i]);
    const mf = ema(C, CFG.waeFastLength), ms = ema(C, CFG.waeSlowLength), macd = mf.map((a, i) => fin(a) && fin(ms[i]) ? a - ms[i] : null);
    const wu = new Array(n).fill(null), wd = new Array(n).fill(null);
    for (let i = 1; i < n; i++) if (fin(macd[i]) && fin(macd[i-1])) { const d = (macd[i] - macd[i-1]) * CFG.waeSensitivity; wu[i] = Math.max(d, 0); wd[i] = Math.max(-d, 0); }
    const bw = stdev(C, CFG.waeChannelLength), expl = bw.map(d => fin(d) ? 2 * CFG.waeBollingerMultiplier * d : null);
    const long = new Array(n).fill(false), short = new Array(n).fill(false), ready = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      ready[i] = [base[i], exitLine[i], atr[i], fc[i], qh[i], wu[i], wd[i], expl[i]].every(fin);
      long[i] = ready[i] && C[i] > O[i] && C[i] > base[i] && bs[i] === 1 && qL[i] && wu[i] > expl[i];
      short[i] = ready[i] && C[i] < O[i] && C[i] < base[i] && bs[i] === -1 && qS[i] && wd[i] > expl[i];
    }
    return { ready, long, short, arrowUp, arrowDn, base, exitLine };
  }
  const memo = new WeakMap();
  const get = I => { if (!memo.has(I)) memo.set(I, calc(I.O, I.H, I.L, I.C)); return memo.get(I); };
  // إشارة (للرادار)
  const sig = (I, i) => { const X = get(I); return X.long[i] ? 1 : X.short[i] ? -1 : 0; };
  // تشغيل الصفقات بنفس منطق replay_strategy17 (دخول فتح الشمعة الجاية، وقف على شمعة i-2، خروج بالوقف أو سهم خروج SSL)
  function run(D, inds, sp, startTs) {
    const m = sp.mult, I = inds[m], X = get(I), n = I.n, out = [], buf = CFG.stopBufferBps / 10000;
    let pos = null, pend = null;
    for (let i = 0; i < n; i++) {
      let closedNow = false;
      if (pend) {
        const p = pend; pend = null;
        const entry = I.O[i], sign = p.d;
        if (sign * (entry - p.stop) > 0) pos = { d: p.d, e: i, entry, stop: p.stop, stop0: p.stop, best: entry, target: sp.tgtR ? entry + sign*sp.tgtR*Math.abs(entry - p.stop) : NaN,
          ...(sp.riskPct ? { w: Math.min(sp.wMax || 3, sp.riskPct/(100*Math.abs(entry - p.stop)/entry)) } : {}) };
      }
      if (pos) {
        const sign = pos.d, gap = sign === 1 ? I.O[i] <= pos.stop : I.O[i] >= pos.stop, rng = sign === 1 ? I.L[i] <= pos.stop : I.H[i] >= pos.stop;
        let raw = null, why = null;
        if (gap || rng) { raw = gap ? I.O[i] : pos.stop; why = "INIT_STOP"; }
        else if (sp.tgtR && (sign === 1 ? I.H[i] >= pos.target : I.L[i] <= pos.target)) { raw = sign*(I.O[i] - pos.target) >= 0 ? I.O[i] : pos.target; why = "TARGET"; }
        else if ((sign === 1 ? X.arrowDn[i] : X.arrowUp[i]) && i >= pos.e) { raw = I.C[i]; why = "SSL_EXIT"; }
        if (raw !== null) {
          if (why === "INIT_STOP" && pos.stop !== pos.stop0) why = "TRAIL";
          out.push({ name: sp.name, d: pos.d, e: pos.e*m, x: i*m + m - 1, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: pos.target, ...(pos.w ? { w: pos.w } : {}) });
          pos = null; closedNow = true;
        } else if (sp.trailAtr && I.atr[i]) {   // وقف متحرك بعد ما تربح trailFrom×R (بيطبق من الشمعة الجاية)
          pos.best = sign === 1 ? Math.max(pos.best, I.H[i]) : Math.min(pos.best, I.L[i]);
          if (sign*(pos.best - pos.entry) >= (sp.trailFrom || 1)*Math.abs(pos.entry - pos.stop0)) { const t = pos.best - sign*sp.trailAtr*I.atr[i]; if (sign*(t - pos.stop) > 0) pos.stop = t; }
        }
      }
      if (!closedNow && !pos && i + 1 <= n && D.t0 + (i+1)*m*M15 > startTs && X.ready[i] && i >= 2) {
        const d = X.long[i] ? 1 : X.short[i] ? -1 : 0;
        if (d) {
          const ref = i - CFG.stopReferenceOffset;
          let stop = d === 1 ? I.L[ref] * (1 - buf) : I.H[ref] * (1 + buf);
          if (sp.atrStop && I.atr[i]) stop = I.C[i] - d*sp.atrStop*I.atr[i];   // نسخ محسّنة: وقف ATR
          const trendOk = !sp.trend || (I.ema200[i] !== null && I.ema200[i] !== undefined && (d === 1 ? I.C[i] > I.ema200[i] : I.C[i] < I.ema200[i]));
          if (trendOk && (i + 1) * m < D.o.length) pend = { d, stop };
        }
      }
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*m, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length-1], why: "TIME", open: true, stop: pos.stop, target: pos.target, ...(pos.w ? { w: pos.w } : {}) });
    return out;
  }
  return { calc, sig, run, CFG };
})();
