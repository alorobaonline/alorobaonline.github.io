// خطوط جان البطيئة بعد الحركة القوية (فكرة المستخدم + نتيجة فحص التفاعل):
// المراوح من الأطراف الكبيرة بالشاشة (آخر 900 شمعة 4 ساعات): قاع 1 = أدنى سعر، قمة 1 = أعلى سعر، مع المستحدثة (فيبو 0.786 على Pivots 10/10).
// الزاوية: 45° لكل شمعة = (أعلى − أدنى بالشاشة) ÷ 460.
// الإشارة (بإغلاق شمعة 4 ساعات k): حركة قوية آخر 6 شموع (≥ 3 ATR) باتجاه خط بطيء (8×1، أو 8×1/4×1) من القاع الكبير (للشراء)
// أو من القمة الكبيرة (للبيع)، والسعر لسا قبل الخط بأكثر من ربع ATR → أمر ليمت على الخط خلال الشمعة الجاية (تنفيذ على شموع 15 دقيقة).
// الخروج: هدف وخسارة حسب النسخة (±1 ATR، أو +2/−1 ATR) من سعر الخط، حد أقصى 12 شمعة 4 ساعات. وقف أول بكل شمعة 15 دقيقة.
const GSLOW = (() => {
  const LR = 10, WIN = 900, DIV = 460, FIB = 0.786, M = 16;
  const memo = new WeakMap();
  function anchors(I) {   // لكل شمعة k: [b1i, b1p, t1i, t1p, u, atr] من البيانات لحد k
    const n = I.n, H = I.H, L = I.L, C = I.C, out = new Array(n).fill(null), ph = [], pl = [];
    const atr = new Array(n).fill(null); { let a = null; for (let k = 1; k < n; k++) { const tr = Math.max(H[k]-L[k], Math.abs(H[k]-C[k-1]), Math.abs(L[k]-C[k-1])); a = a === null ? tr : (a*13 + tr)/14; if (k >= 14) atr[k] = a; } }
    const isP = (p, hi) => { if (p - LR < 0 || p + LR >= n) return false; const v = hi ? H[p] : L[p]; for (let i = 1; i <= LR; i++) { const a = hi ? H[p-i] : L[p-i], b = hi ? H[p+i] : L[p+i]; if (hi ? !(v > a && v >= b) : !(v < a && v <= b)) return false; } return true; };
    const upd = (P, ix, p, hi) => { for (const [cj, v] of P) if (cj > ix) { let w = hi ? Infinity : -Infinity; for (let q = ix; q <= cj; q++) w = hi ? Math.min(w, L[q]) : Math.max(w, H[q]); const lvl = hi ? w + FIB*(p - w) : w - FIB*(w - p); if (hi ? v >= lvl : v <= lvl) { ix = cj; p = v; } } return [ix, p]; };
    for (let k = 0; k < n; k++) {
      if (k - LR >= 0 && isP(k - LR, true)) ph.push([k - LR, H[k - LR]]);
      if (k - LR >= 0 && isP(k - LR, false)) pl.push([k - LR, L[k - LR]]);
      if (k < 200 || atr[k] === null) continue;
      const lo0 = Math.max(0, k - WIN + 1); let hiI = lo0, loI = lo0;
      for (let j = lo0; j <= k; j++) { if (H[j] >= H[hiI]) hiI = j; if (L[j] <= L[loI]) loI = j; }
      const u = (H[hiI] - L[loI])/DIV;
      const php = ph.filter(x => x[0] >= lo0), plp = pl.filter(x => x[0] >= lo0);
      const [t1i, t1p] = upd(php, hiI, H[hiI], true), [b1i, b1p] = upd(plp, loI, L[loI], false);
      out[k] = [b1i, b1p, t1i, t1p, u, atr[k]];
    }
    return out;
  }
  function run(D, inds, sp, startTs) {
    const I = inds[16]; if (!I || I.n < 250) return [];
    if (!memo.has(I)) memo.set(I, anchors(I)); const AN = memo.get(I);
    const n = I.n, N15 = D.c.length, out = [];
    let busyUntil = -1;   // مؤشر 15 دقيقة
    for (let k = 6; k < n - 1; k++) {
      const a = AN[k]; if (!a || (k + 1)*M >= N15 || (k + 1)*M <= busyUntil) continue;
      if (D.t0 + (k + 1)*M*900000 <= startTs) continue;
      const [b1i, b1p, t1i, t1p, u, A] = a, C = I.C;
      const cands = [];
      for (const s of sp.lines) {
        if (sp.long !== false && k - b1i >= 6) cands.push({ d: 1, v0: b1p + u*s*(k - b1i), v1: b1p + u*s*(k + 1 - b1i) });
        if (!sp.longOnly && k - t1i >= 6) cands.push({ d: -1, v0: t1p - u*s*(k - t1i), v1: t1p - u*s*(k + 1 - t1i) });
      }
      let pick = null;
      for (const c of cands) {
        if (c.v1 <= 0) continue;
        const side = c.d;   // شراء: السعر فوق الخط ونازل بقوة لعنده
        if (!(side*(C[k] - c.v0) > 0.25*A && side*(C[k] - C[k-6]) <= -3*A)) continue;
        if (!pick || Math.abs(C[k] - c.v1) < Math.abs(C[k] - pick.v1)) pick = c;   // أقرب خط
      }
      if (!pick) continue;
      const d = pick.d, lvl = pick.v1, tgt = lvl + d*sp.tp*A, stop = lvl - d*sp.sl*A;
      // التنفيذ: أمر ليمت على الخط خلال شمعة الـ4 ساعات الجاية (16 شمعة 15 دقيقة)
      let e = -1, fill = null;
      for (let q = (k + 1)*M; q < Math.min(N15, (k + 2)*M); q++) {
        if (d === 1 ? D.l[q] <= lvl : D.h[q] >= lvl) { e = q; fill = d === 1 ? Math.min(lvl, D.o[q]) : Math.max(lvl, D.o[q]); break; }
      }
      if (e < 0) continue;
      let x = -1, raw = null, why = null;
      const end = Math.min(N15 - 1, (k + 1 + 12)*M - 1);
      for (let q = e; q <= end; q++) {
        const o = D.o[q];
        if (q > e && d*(o - stop) <= 0) { raw = o; why = "INIT_STOP"; }
        else if (q > e && d*(o - tgt) >= 0) { raw = o; why = "TARGET"; }
        else if (d === 1 ? D.l[q] <= stop : D.h[q] >= stop) { raw = stop; why = "INIT_STOP"; }
        else if (q > e && (d === 1 ? D.h[q] >= tgt : D.l[q] <= tgt)) { raw = tgt; why = "TARGET"; }
        if (raw !== null) { x = q; break; }
      }
      if (x < 0) {
        if (end >= N15 - 1 && (k + 1 + 12)*M - 1 > N15 - 1) { out.push({ name: sp.name, d, e, x: N15 - 1, rawIn: fill, rawOut: D.c[N15 - 1], why: "TIME", open: true, stop, target: tgt }); break; }
        x = end; raw = D.c[end]; why = "TIME";
      }
      out.push({ name: sp.name, d, e, x, rawIn: fill, rawOut: raw, why, open: false, stop, target: tgt });
      busyUntil = x;
    }
    return out;
  }
  const mk = (name, lines, tp, sl, longOnly) => ({ name, lines, tp, sl, longOnly, mult: 16, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "خطوط جان البطيئة بعد حركة قوية" });
  return { run, strats: [
    mk("Gann بطيء 8x1 ±1ATR", [1/8], 1, 1, false),
    mk("Gann بطيء 8x1 ±1ATR شراء بس", [1/8], 1, 1, true),
    mk("Gann بطيء 8x1+4x1 ±1ATR", [1/8, 1/4], 1, 1, false),
    mk("Gann بطيء 8x1 هدف2 وقف1", [1/8], 2, 1, false),
  ] };
})();
if (typeof module !== "undefined") module.exports = GSLOW;
