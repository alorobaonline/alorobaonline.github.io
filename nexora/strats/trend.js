// استراتيجية ترند مستقلة (عكس فكرة S15: S15 = انعكاس بعد سحب سيولة؛ هون = استمرار ترند كبير) — قنوات دونشيان ("السلاحف"):
// دخول: إغلاق شمعة فوق أعلى سعر بآخر N شمعة (قبلها) → شراء على الافتتاح الجاي؛ تحت أدنى سعر → بيع. فلتر اتجاه (نسخة): الإغلاق فوق/تحت EMA.
// خروج: وقف أولي 2 ATR، بعدين وقف متحرك (شاندلير: أعلى سعر من الدخول − k×ATR) أو كسر قناة الخروج (أدنى سعر بآخر X شمعة)، أيهم أقرب.
// كل الإشارات على شموع مسكّرة؛ الوقف بيتحدث بإغلاق الشمعة وبيطبق من اللي بعدها؛ وقف أول؛ صفقة وحدة لكل عملة.
const TREND = (() => {
  function emaArr(C, p) { const out = new Array(C.length).fill(null); let e = null;
    for (let k = p - 1; k < C.length; k++) { if (e === null) { e = 0; for (let j = 0; j < p; j++) e += C[j]; e /= p; } else e = C[k]*(2/(p+1)) + e*((p-1)/(p+1)); out[k] = e; } return out; }
  const memo = new WeakMap();
  function run(D, inds, sp, startTs) {
    const m = sp.mult, I = inds[m]; if (!I || I.n < sp.N + 30) return [];
    if (!memo.has(I)) memo.set(I, {}); const M = memo.get(I);
    const key = "e" + (sp.ema || 0); if (sp.ema && !M[key]) M[key] = emaArr(I.C, sp.ema);
    const E = sp.ema ? M[key] : null, H = I.H, L = I.L, C = I.C, O = I.O, A = I.atr, n = I.n, out = [];
    const hh = (a, b) => { let x = -Infinity; for (let j = a; j <= b; j++) x = Math.max(x, H[j]); return x; };
    const ll = (a, b) => { let x = Infinity; for (let j = a; j <= b; j++) x = Math.min(x, L[j]); return x; };
    let pos = null, pend = null;
    for (let k = sp.N + 1; k < n; k++) {
      if (pend) {
        const e = O[k], s = pend.d, a = pend.atr, stop = e - s*sp.stopAtr*a;
        if (s*(e - stop) > 0) pos = { d: s, e: k, entry: e, stop, stop0: stop, best: e };
        pend = null;
      }
      if (pos) {
        const s = pos.d, o = O[k]; let raw = null, why = null;
        if (s*(o - pos.stop) <= 0) { raw = o; why = pos.stop === pos.stop0 ? "INIT_STOP" : "TRAIL"; }
        else if (s === 1 ? L[k] <= pos.stop : H[k] >= pos.stop) { raw = pos.stop; why = pos.stop === pos.stop0 ? "INIT_STOP" : "TRAIL"; }
        if (raw !== null) { out.push({ name: sp.name, d: s, e: pos.e*m, x: k*m + m - 1, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: 0 }); pos = null; continue; }
        // تحديث الوقف بإغلاق الشمعة
        pos.best = s === 1 ? Math.max(pos.best, H[k]) : Math.min(pos.best, L[k]);
        let ns = pos.stop;
        if (A[k]) { const ch = pos.best - s*sp.trailAtr*A[k]; if (s*(ch - ns) > 0) ns = ch; }
        if (sp.X && k - sp.X + 1 >= 0) { const ex = s === 1 ? ll(k - sp.X + 1, k) : hh(k - sp.X + 1, k); if (s*(ex - ns) > 0) ns = ex; }
        pos.stop = ns;
        continue;
      }
      if (k >= n - 1 || D.t0 + (k + 1)*m*900000 <= startTs || !A[k]) continue;
      const up = C[k] > hh(k - sp.N, k - 1), dn = C[k] < ll(k - sp.N, k - 1);
      let d = up ? 1 : dn ? -1 : 0;
      if (d === -1 && sp.longOnly) d = 0;
      if (d && E && !(E[k] !== null && (C[k] - E[k])*d > 0)) d = 0;
      if (d) pend = { d, atr: A[k] };
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*m, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length - 1], why: "TIME", open: true, stop: pos.stop, target: 0 });
    return out;
  }
  const mk = (name, mult, N, o) => ({ name, mult, N, stopAtr: 2, trailAtr: 3, X: 0, ...o, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "ترند دونشيان (مستقلة عن S15)" });
  return { run, strats: [
    mk("TREND يومي 20 + EMA50", 96, 20, { ema: 50 }),
    mk("TREND يومي 55 خروج 20", 96, 55, { X: 20, trailAtr: 99, ema: 0 }),
    mk("TREND يومي 20 شراء بس + EMA50", 96, 20, { ema: 50, longOnly: true }),
    mk("TREND 4h 120 + EMA300", 16, 120, { ema: 300 }),
  ] };
})();
if (typeof module !== "undefined") module.exports = TREND;
