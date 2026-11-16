// سحب سيولة عند خطوط جان البطيئة + كسر هيكل (جان بيحدد "وين"، S15 بيحدد "إيمتى"):
// المراوح من GDEC.anchorsOf (الأطراف الكبيرة مع المستحدثة + آخر قمة/قاع عايش)، الزاوية (مدى الشاشة)/460، على 4 ساعات.
// شراء: شمعة 4 ساعات k نزل ذيلها تحت خط بطيء من مروحة قاع (≥ 0.1 ATR) وسكّرت فوقه = سحب. بعدها خلال 1..5 شموع إغلاق فوق
//   أعلى قمة لآخر 3 شموع قبل السحب = كسر هيكل → دخول على افتتاح الشمعة الجاية. الوقف تحت ذيل السحب بربع ATR. الهدف 2.5R، حد 40 شمعة.
// بيع: نفس الإشي بالعكس عند الخطوط البطيئة من مراوح القمم.
// نسخة مقارنة: نفس كل إشي بس زوايا مخربطة (× 0.6..1.6) — لنعرف إذا زاوية جان نفسها بتفرق.
const GSWEEP = (() => {
  const ALL = [8, 4, 3, 2, 1, 1/2, 1/3, 1/4, 1/8];
  const emaMemo = new WeakMap();
  function ema200(I) { if (emaMemo.has(I)) return emaMemo.get(I); const out = new Array(I.n).fill(null); let e = null;
    for (let k = 199; k < I.n; k++) { if (e === null) { e = 0; for (let j = 0; j < 200; j++) e += I.C[j]; e /= 200; } else e = I.C[k]*(2/201) + e*(199/201); out[k] = e; }
    emaMemo.set(I, out); return out; }
  function jit(ai, li) { let x = (ai*73856093 ^ (li + 3)*19349663) >>> 0; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return 0.6 + x/4294967296; }
  function run(D, inds, sp, startTs) {
    const I = inds[16]; if (!I || I.n < 250) return [];
    const AN = GDEC.anchorsOf(I), E = sp.ema ? ema200(I) : null, n = I.n, out = [];
    const speeds = sp.lines, H = I.H, L = I.L, C = I.C, O = I.O;
    let pos = null, pend = null, setups = [];
    for (let k = 4; k < n; k++) {
      if (pend) {
        const e = O[k], s = pend.d;
        if (s*(e - pend.stop) > 0) { const R = s*(e - pend.stop); pos = { d: s, e: k, entry: e, stop: pend.stop, target: e + s*2.5*R }; }
        pend = null;
      }
      if (pos) {
        const s = pos.d, o = O[k]; let raw = null, why = null;
        if (s*(o - pos.stop) <= 0) { raw = o; why = "INIT_STOP"; }
        else if (s*(o - pos.target) >= 0) { raw = o; why = "TARGET"; }
        else if (s === 1 ? L[k] <= pos.stop : H[k] >= pos.stop) { raw = pos.stop; why = "INIT_STOP"; }
        else if (s === 1 ? H[k] >= pos.target : L[k] <= pos.target) { raw = pos.target; why = "TARGET"; }
        else if (k - pos.e + 1 >= 40) { raw = C[k]; why = "TIME"; }
        if (raw !== null) { out.push({ name: sp.name, d: s, e: pos.e*16, x: k*16 + 15, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: pos.target }); pos = null; setups = []; }
        continue;
      }
      // كسر هيكل لسحب سابق؟
      setups = setups.filter(st => k - st.k <= 5);
      let fired = null;
      for (const st of setups) if (k > st.k && (C[k] - st.th)*st.d > 0) { fired = st; break; }
      if (fired && k < n - 1 && D.t0 + (k + 1)*16*900000 > startTs && (!E || (E[k] !== null && (C[k] - E[k])*fired.d > 0))) {
        const a = AN[k]; const A = a ? a.atr : null;
        if (A) { pend = { d: fired.d, stop: fired.ext - fired.d*0.25*A }; setups = []; continue; }
      }
      // سحب جديد عند خط بطيء؟
      const a = AN[k]; if (!a) continue;
      const { A: anc, u, atr } = a;
      for (const [ai, ap, dir] of anc) {
        const d = dir;   // مروحة قاع (طالعة) → شراء، مروحة قمة (نازلة) → بيع
        if (sp.longOnly && d !== 1) continue;
        for (const s of speeds) {
          const li = ALL.indexOf(s), sp2 = sp.jitter ? s*jit(ai, li) : s;
          const v = ap + dir*u*sp2*(k - ai); if (v <= 0 || k - ai < 6) continue;
          const swept = d === 1 ? (v - L[k] >= 0.1*atr && C[k] > v) : (H[k] - v >= 0.1*atr && C[k] < v);
          if (!swept) continue;
          const th = d === 1 ? Math.max(H[k-3], H[k-2], H[k-1]) : Math.min(L[k-3], L[k-2], L[k-1]);
          setups.push({ k, d, th, ext: d === 1 ? L[k] : H[k] });
          break;
        }
      }
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*16, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length - 1], why: "TIME", open: true, stop: pos.stop, target: pos.target });
    return out;
  }
  const mk = (name, lines, o = {}) => ({ name, lines, ...o, mult: 16, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "سحب سيولة عند خطوط جان البطيئة + كسر هيكل" });
  return { run, strats: [
    mk("Gann سحب 8x1+4x1", [1/8, 1/4]),
    mk("Gann سحب 8x1..2x1", [1/8, 1/4, 1/3, 1/2]),
    mk("Gann سحب 8x1+4x1 شراء بس", [1/8, 1/4], { longOnly: true }),
    mk("Gann سحب 8x1..2x1 +EMA200", [1/8, 1/4, 1/3, 1/2], { ema: true }),
    mk("مقارنة: سحب زوايا مخربطة", [1/8, 1/4, 1/3, 1/2], { jitter: true }),
  ] };
})();
if (typeof module !== "undefined") module.exports = GSWEEP;
