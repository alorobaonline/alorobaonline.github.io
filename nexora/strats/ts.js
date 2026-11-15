// ICT Turtle Soup (Flux Charts) — port of the user's Pine indicator, default inputs:
// MSS swing 10, Wick breakout, Dynamic TP/SL, Risk "Low" (SL = MSS extreme ∓ 3.5×ATR(5)), RR 0.9.
// State machine per coin, exactly like the Pine: one setup at a time →
//   (1) at a bar close with no open setup: freeze the high/low of the last higher-timeframe window (incl. this bar)
//   (2) a later bar's wick breaks the frozen low → Long setup (high → Short); low is checked first like the Pine.
//       "Adaptive": the direction follows whichever side (long/short) has scored better so far on this coin.
//   (3) a later bar breaks the 10-bar MSS high (Long) / low (Short) → stop entry at that level.
//   (4) exit at TP / SL, no time limit; next setup starts the bar after the exit.
// Honest-fill changes vs the Pine dashboard (which overstates): the entry and exits are resolved on the 15m/5m
// sub-candles in time order (stop first), a gap through a level fills at the open, SL uses only data known at entry
// (previous bars + the current bar so far, ATR of the previous bar), and TP fills at the TP price (the Pine records
// max(TP, liquidity level) when the wick reaches both — a price no order could have got).
const TS = (() => {
  const M15 = 900000, M5 = 300000;
  function rma(tr, p) { const out = new Array(tr.length).fill(null); let a = null;
    for (let i = 0; i < tr.length; i++) { if (i === p - 1) { let s = 0; for (let k = 0; k < p; k++) s += tr[k]; a = s/p; } else if (i >= p) a = (a*(p-1) + tr[i])/p; if (i >= p - 1) out[i] = a; } return out; }
  function run(D, inds, sp, startTs) {
    let B, step, toE;
    if (sp.m5) { if (!D.m5 || D.m5.o.length < 300) return []; const m = D.m5; B = m; step = M5; toE = a => Math.floor((m.t0 + a*M5 - D.t0)/M15); }
    else { B = D; step = M15; toE = a => a; }
    const n0 = B.c.length, tfMs = step*sp.k, L = sp.htf, MSS = 10, mult = 3.5, RR = 0.9;
    // higher-timeframe bars built from sub-candles (aligned to the clock)
    const bs = [], be = [], O = [], H = [], Lo = [], C = [];
    for (let a = 0; a < n0; a++) {
      const t = B.t0 + a*step, g = Math.floor(t/tfMs);
      if (!bs.length || Math.floor((B.t0 + bs[bs.length-1]*step)/tfMs) !== g) { bs.push(a); be.push(a); O.push(B.o[a]); H.push(B.h[a]); Lo.push(B.l[a]); C.push(B.c[a]); }
      else { const j = bs.length - 1; be[j] = a; H[j] = Math.max(H[j], B.h[a]); Lo[j] = Math.min(Lo[j], B.l[a]); C[j] = B.c[a]; }
    }
    const n = O.length; if (n < 50) return [];
    const lastFull = (be[n-1] - bs[n-1] + 1 === sp.k) ? n - 1 : n - 2;   // the last bar may still be forming
    const tr = O.map((_, j) => j ? Math.max(H[j] - Lo[j], Math.abs(H[j] - C[j-1]), Math.abs(Lo[j] - C[j-1])) : H[j] - Lo[j]);
    const atr = rma(tr, 5);
    const hh = (a, b) => { let m = -Infinity; for (let j = a; j <= b; j++) m = Math.max(m, H[j]); return m; };
    const ll = (a, b) => { let m = Infinity; for (let j = a; j <= b; j++) m = Math.min(m, Lo[j]); return m; };
    const out = []; let ts = null, hb = 0, lb = 0;
    const W = Math.max(MSS + 1, L, 6);
    for (let j = W; j < n; j++) {
      const createAtClose = ts === null;
      if (ts && ts.state === "liq" && j > ts.start && j <= lastFull) {
        let side = 0;
        if (Lo[j] < ts.lo) side = sp.adaptive ? (hb > lb ? 1 : -1) : 1;
        else if (H[j] > ts.hi) side = sp.adaptive ? (hb <= lb ? -1 : 1) : -1;
        if (side) { ts.state = "exec"; ts.d = side; ts.sweep = j; }
      } else if (ts && ts.state === "exec" && j > ts.sweep) {
        const s = ts.d, lvl = s === 1 ? hh(j - MSS, j - 1) : ll(j - MSS, j - 1);
        for (let a = bs[j]; a <= be[j]; a++) {
          if (s === 1 ? B.h[a] > lvl : B.l[a] < lvl) {
            if (B.t0 + a*step < startTs) { ts = null; break; }   // before the account start: drop this setup
            const entry = s === 1 ? Math.max(lvl, B.o[a]) : Math.min(lvl, B.o[a]);
            let soFarH = -Infinity, soFarL = Infinity; for (let q = bs[j]; q <= a; q++) { soFarH = Math.max(soFarH, B.h[q]); soFarL = Math.min(soFarL, B.l[q]); }
            const at = atr[j-1]; if (at === null) { ts = null; break; }
            const stop = s === 1 ? Math.min(ll(j - MSS + 1, j - 1), soFarL) - at*mult : Math.max(hh(j - MSS + 1, j - 1), soFarH) + at*mult;
            if ((entry - stop)*s <= 0) { ts = null; break; }
            ts.state = "pos"; ts.entry = entry; ts.stop = stop; ts.target = entry + s*Math.abs(entry - stop)*RR; ts.ea = a; ts.from = a;
            break;
          }
        }
      }
      if (ts && ts.state === "pos") {
        const s = ts.d;
        for (let a = Math.max(ts.from, bs[j]); a <= be[j]; a++) {
          let raw = null, why = null; const o = B.o[a];
          if (a > ts.ea && s*(o - ts.stop) <= 0) { raw = o; why = "INIT_STOP"; }
          else if (a > ts.ea && s*(o - ts.target) >= 0) { raw = o; why = "TARGET"; }
          else if (s === 1 ? B.l[a] <= ts.stop : B.h[a] >= ts.stop) { raw = ts.stop; why = "INIT_STOP"; }
          else if (s === 1 ? B.h[a] >= ts.target : B.l[a] <= ts.target) { raw = ts.target; why = "TARGET"; }
          if (raw !== null) {
            out.push({ name: sp.name, d: s, e: toE(ts.ea), x: toE(a), rawIn: ts.entry, rawOut: raw, why, open: false, stop: ts.stop, target: ts.target });
            if (why === "TARGET") { if (s === 1) hb++; else lb++; } else { if (s === 1) hb--; else lb--; }
            ts = null; break;
          }
        }
        if (ts) ts.from = be[j] + 1;
      }
      if (createAtClose && ts === null && j <= lastFull) ts = { state: "liq", start: j, hi: hh(j - L + 1, j), lo: ll(j - L + 1, j) };
    }
    if (ts && ts.state === "pos") out.push({ name: sp.name, d: ts.d, e: toE(ts.ea), x: D.c.length - 1, rawIn: ts.entry, rawOut: D.c[D.c.length-1], why: "TIME", open: true, stop: ts.stop, target: ts.target });
    return out.filter(t => t.e >= 0 && t.e < D.c.length);
  }
  const mk = (name, k, htf, m5, adaptive) => ({ name, k, htf, adaptive, mult: 0, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "ICT Turtle Soup (Flux Charts)", ...(m5 ? { m5: true } : {}) });
  return { run, strats: [
    mk("TS Turtle Soup 5m (1H)", 1, 12, true, false),
    mk("TS Turtle Soup 15m (1H)", 1, 4, false, false),
    mk("TS Turtle Soup 1H (4H)", 4, 4, false, false),
    mk("TS Turtle Soup 4H (1D)", 16, 6, false, false),
    mk("TS Adaptive 5m (1H)", 1, 12, true, true),
    mk("TS Adaptive 15m (1H)", 1, 4, false, true),
    mk("TS Adaptive 1H (4H)", 4, 4, false, true),
    mk("TS Adaptive 4H (1D)", 16, 6, false, true),
  ] };
})();
if (typeof module !== "undefined") module.exports = TS;
