// ===================== Strategy 15: Liquidity Sweep + MSS (منقولة من sweep_rules.py + sweep_replay.py) =====================
const S15 = (() => {
  function prepare(I) {
    const n = I.n, atr = new Array(n).fill(null), ema = new Array(n).fill(null), events = new Map();
    const tr = [0]; for (let k = 1; k < n; k++) tr.push(Math.max(I.H[k] - I.L[k], Math.abs(I.H[k] - I.C[k-1]), Math.abs(I.L[k] - I.C[k-1])));
    let a = null, e = null;
    for (let k = 0; k < n; k++) {
      if (k >= 14) { if (a === null) { a = 0; for (let j = 1; j < 15; j++) a += tr[j]; a /= 14; } else a = (a*13 + tr[k]) / 14; atr[k] = a; }
      if (k >= 199) { if (e === null) { e = 0; for (let j = 0; j < 200; j++) e += I.C[j]; e /= 200; } else e = I.C[k]*(2/201) + e*(199/201); ema[k] = e; }
    }
    for (const side of [1, -1]) {
      let level = null, pending = null;
      for (let k = 0; k < n; k++) {
        if (level !== null && atr[k] !== null && k >= 3) {
          const sweep = side === 1 ? (level - I.L[k] >= .1*atr[k] && I.C[k] > level) : (I.H[k] - level >= .1*atr[k] && I.C[k] < level);
          if (sweep) {
            const th = side === 1 ? Math.max(I.H[k-3], I.H[k-2], I.H[k-1]) : Math.min(I.L[k-3], I.L[k-2], I.L[k-1]);
            pending = [k, th, level];
          } else if (pending && (I.C[k] - pending[1])*side > 0 && k - pending[0] >= 1 && k - pending[0] <= 5) {
            const s = pending[0], stop = side === 1 ? I.L[s] - .25*atr[k] : I.H[s] + .25*atr[k];
            if (!events.has(k)) events.set(k, []);
            events.get(k).push({ side, sweepIndex: s, stopLoss: stop, base: side === 1 ? I.L[s] : I.H[s], atrk: atr[k] });
            pending = null;
          }
        }
        if (pending && k - pending[0] > 5) pending = null;
        const i = k - 3;
        if (i >= 3) {
          const arr = side === 1 ? I.L : I.H; let ok = true;
          for (let j = i - 3; j <= k; j++) if (j !== i && !((arr[j] - arr[i])*side > 0)) { ok = false; break; }
          if (ok) level = arr[i];
        }
      }
    }
    return { atr, ema, events };
  }
  const memo = new WeakMap();
  const prep = I => { if (!memo.has(I)) memo.set(I, prepare(I)); return memo.get(I); };
  const emaMemo = new WeakMap();
  function emaOf(I, p) {   // EMA بنفس طريقة الأصل (أول قيمة = متوسط أول p إغلاق)
    if (!emaMemo.has(I)) emaMemo.set(I, {}); const mm = emaMemo.get(I); if (mm[p]) return mm[p];
    const out = new Array(I.n).fill(null); let e = null;
    for (let k = p - 1; k < I.n; k++) { if (e === null) { e = 0; for (let j = 0; j < p; j++) e += I.C[j]; e /= p; } else e = I.C[k]*(2/(p+1)) + e*((p-1)/(p+1)); out[k] = e; }
    return (mm[p] = out);
  }
  const okTrend = (P, I, k, side, f) => {   // f: قائمة فترات EMA؛ يكفي وحدة منهم توافق (افتراضي [200])
    if (!f) return P.ema[k] !== null && (I.C[k] - P.ema[k])*side > 0;
    if (f.all) return f.all.every(p => { const e = emaOf(I, p)[k]; return e !== null && (I.C[k] - e)*side > 0; });
    return f.some(p => { const e = emaOf(I, p)[k]; return e !== null && (I.C[k] - e)*side > 0; });
  };
  const hitsAt = (P, I, k, v2, f) => (P.events.get(k) || []).filter(x => !v2 || okTrend(P, I, k, x.side, f));
  const sig = v2 => (I, i) => { const h = hitsAt(prep(I), I, i, v2); return h.length ? h[0].side : 0; };
  function run(D, inds, sp, startTs) {
    const m = sp.mult, I = inds[m], P = prep(I), out = [], n = I.n;
    let pos = null, pend = null, busy = -1;
    for (let k = 0; k < n; k++) {
      let closedHere = false;
      if (pend) {
        const [hit] = pend, sign = hit.side, raw = I.O[k], stop = sp.sb === undefined ? hit.stopLoss : hit.base - sign*sp.sb*hit.atrk;
        if ((raw - stop)*sign > 0 && stop > 0) pos = { d: sign, e: k, entry: raw, stop, stop0: stop, target: raw + sign*(sp.R || 2)*Math.abs(raw - stop) };
        pend = null;
      }
      if (pos) {
        const s = pos.d, o = I.O[k]; let raw = null, why = null;
        if (s*(o - pos.stop) <= 0) { raw = o; why = "INIT_STOP"; }
        else if (s === 1 ? I.L[k] <= pos.stop : I.H[k] >= pos.stop) { raw = pos.stop; why = "INIT_STOP"; }
        else if (s*(o - pos.target) >= 0) { raw = o; why = "TARGET"; }
        else if (s === 1 ? I.H[k] >= pos.target : I.L[k] <= pos.target) { raw = pos.target; why = "TARGET"; }
        else if (k - pos.e + 1 >= (sp.hold || 20)) { raw = I.C[k]; why = "TIME"; }
        if (raw !== null) { if (why === "INIT_STOP" && pos.moved) why = "TRAIL";
          out.push({ name: sp.name, d: s, e: pos.e*m, x: k*m + m - 1, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: pos.target });
          pos = null; busy = k; closedHere = true; }
        else if (sp.be || sp.trailAtr) {   // تعديل الوقف بعد إغلاق الشمعة (بيطبق من الشمعة الجاية)
          const r0 = Math.abs(pos.entry - pos.stop0), fav = s === 1 ? I.H[k] : I.L[k];
          pos.best = pos.best === undefined ? fav : (s === 1 ? Math.max(pos.best, fav) : Math.min(pos.best, fav));
          const gain = s*(pos.best - pos.entry);
          let ns = pos.stop;
          if (sp.be && gain >= sp.be*r0) ns = s === 1 ? Math.max(ns, pos.entry) : Math.min(ns, pos.entry);
          if (sp.trailAtr && gain >= (sp.trailFrom || 1)*r0 && P.atr[k] !== null) { const t = pos.best - s*sp.trailAtr*P.atr[k]; ns = s === 1 ? Math.max(ns, t) : Math.min(ns, t); }
          if (ns !== pos.stop) { pos.stop = ns; pos.moved = true; }
        }
      }
      const h = hitsAt(P, I, k, sp.v2, sp.emaF);
      if (!h.length) continue;
      const blocked = pos !== null || closedHere || k <= busy || k === n - 1 || D.t0 + (k+1)*m*900000 <= startTs || (k+1)*m >= D.o.length;
      if (!blocked) pend = [h[0], k];
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*m, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length-1], why: "TIME", open: true, stop: pos.stop, target: pos.target });
    return out;
  }
  const mk = (label, mult, v2) => ({ name: "S15 Sweep+MSS " + label, mult, v2, sig: sig(v2), run, sm: 0, tm: 0, hold: 20, trail: null, cd: null, entry: "imm", src: "Replit #15" });
  return { prepare, run, strats: [mk("V2 15m", 1, true), mk("V2 1h", 4, true), mk("V2 4h", 16, true), mk("V1 15m", 1, false)] };
})();
