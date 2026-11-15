// فواصل جان الزمنية (طريقة المستخدم، متفق عليها خطوة خطوة):
// 1) القمم والقيعان: Pivots HL 10/10 على 4 ساعات (القمة بتتأكد بعد 10 شموع).
//    قمة جديدة بتصير "المستحدثة" (بننقل المروحة عليها) إذا: أعلى من القمة الحالية، أو فوق مستوى فيبو f من الموجة
//    (القاع الحالي → القمة الحالية)، أو إذا القمة الحالية صار عمرها أكثر من 900 شمعة (طلعت برّا الشاشة). ونفس الإشي للقيعان.
//    f = 0.786 أو 0.618 (نسختين).
// 2) الزاوية (تثبيت الشاشة بتريدنج فيو): 45° لكل شمعة 4 ساعات = (أعلى − أدنى بآخر 900 شمعة) ÷ 460، بتنحسب وقت ما تتغيّر المراوح.
//    (طابقت أرقام المستخدم على FIL و BTC و SOL بفرق أقل من 1%.)
// 3) مروحة جان كاملة (9 زوايا) طالعة من القاع ونازلة من القمة. كل تقاطع جاي بين خط من القمة وخط من القاع = فاصل زمني.
// 4) الدخول: إغلاق شمعة الـ4 ساعات اللي فيها الفاصل → فوراً على افتتاح اللي بعدها، عكس حركة آخر 6 شموع. بدون تأكيد.
// 5) الوقف: ورا أبعد ذيل بآخر 3 شموع ± ربع ATR. الخروج: هدف 2.5R، أو وقف متحرك 2ATR بعد 1R. حد أقصى 40 شمعة.
const GANNTS = (() => {
  const LR = 10, WIN = 900, DIV = 460, SP = [8, 4, 3, 2, 1, 1/2, 1/3, 1/4, 1/8];
  const memo = new WeakMap();
  function prep(I) {
    const n = I.n, tr = [I.H[0] - I.L[0]], atr = new Array(n).fill(null);
    for (let k = 1; k < n; k++) tr.push(Math.max(I.H[k] - I.L[k], Math.abs(I.H[k] - I.C[k-1]), Math.abs(I.L[k] - I.C[k-1])));
    let a = null; for (let k = 0; k < n; k++) { if (k === 13) { a = 0; for (let j = 0; j < 14; j++) a += tr[j]; a /= 14; } else if (k > 13) a = (a*13 + tr[k])/14; atr[k] = a; }
    return { atr };
  }
  function piv(I, p, side) {   // زي ta.pivothigh/pivotlow(10, 10)
    if (p - LR < 0 || p + LR >= I.n) return null;
    const v = side === 1 ? I.H[p] : I.L[p];
    for (let i = 1; i <= LR; i++) {
      const a = side === 1 ? I.H[p-i] : I.L[p-i], b = side === 1 ? I.H[p+i] : I.L[p+i];
      if (side === 1 ? !(v > a && v >= b) : !(v < a && v <= b)) return null;
    }
    return v;
  }
  // كل الأحداث (تغيير المراوح والفواصل) — بتنستعمل بالاستراتيجية وبالفحص
  function seps(I, f) {
    const n = I.n, out = new Set();
    let H = null, tH = null, L = null, tL = null, pending = [];
    for (let k = 0; k < n; k++) {
      const p = k - LR; let changed = false;
      const ph = piv(I, p, 1), pl = piv(I, p, -1);
      if (ph !== null) {
        if (H === null || ph >= H || k - tH > WIN || (L !== null && ph >= L + f*(H - L))) { H = ph; tH = p; changed = true; }
      }
      if (pl !== null) {
        if (L === null || pl <= L || k - tL > WIN || (H !== null && pl <= H - f*(H - L))) { L = pl; tL = p; changed = true; }
      }
      if (changed && H !== null && L !== null && H > L) {
        let hi = -Infinity, lo = Infinity; for (let j = Math.max(0, k - WIN + 1); j <= k; j++) { if (I.H[j] > hi) hi = I.H[j]; if (I.L[j] < lo) lo = I.L[j]; }
        const u = (hi - lo)/DIV; pending = [];
        if (u > 0) for (const a of SP) for (const b of SP) {
          const t = (H - L + u*a*tL + u*b*tH)/(u*(a + b)), kk = Math.ceil(t);
          if (kk > k) pending.push(kk);
        }
        pending = new Set(pending);
      }
      if (pending.has && pending.has(k)) out.add(k);
    }
    return out;
  }
  function run(D, inds, sp, startTs) {
    const I = inds[16]; if (!I || I.n < 60) return [];
    if (!memo.has(I)) memo.set(I, { X: prep(I), S: {} }); const M = memo.get(I), X = M.X;
    if (!M.S[sp.f]) M.S[sp.f] = seps(I, sp.f); const S = M.S[sp.f];
    const n = I.n, out = []; let pos = null, pend = null;
    for (let k = 0; k < n; k++) {
      if (pend) {
        const e = I.O[k], s = pend.d;
        if (s*(e - pend.stop) > 0) { const R = s*(e - pend.stop); pos = { d: s, e: k, entry: e, stop: pend.stop, stop0: pend.stop, R, target: sp.trl ? null : e + s*2.5*R, best: e }; }
        pend = null;
      }
      if (pos) {
        const s = pos.d, o = I.O[k]; let raw = null, why = null;
        if (s*(o - pos.stop) <= 0) { raw = o; why = pos.stop === pos.stop0 ? "INIT_STOP" : "TRAIL"; }
        else if (pos.target !== null && s*(o - pos.target) >= 0) { raw = o; why = "TARGET"; }
        else if (s === 1 ? I.L[k] <= pos.stop : I.H[k] >= pos.stop) { raw = pos.stop; why = pos.stop === pos.stop0 ? "INIT_STOP" : "TRAIL"; }
        else if (pos.target !== null && (s === 1 ? I.H[k] >= pos.target : I.L[k] <= pos.target)) { raw = pos.target; why = "TARGET"; }
        else if (k - pos.e + 1 >= 40) { raw = I.C[k]; why = "TIME"; }
        if (raw !== null) { out.push({ name: sp.name, d: s, e: pos.e*16, x: k*16 + 15, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: pos.target || 0 }); pos = null; }
        else if (sp.trl && X.atr[k] !== null) {
          pos.best = s === 1 ? Math.max(pos.best, I.H[k]) : Math.min(pos.best, I.L[k]);
          if (s*(pos.best - pos.entry) >= pos.R) { const t = pos.best - s*2*X.atr[k]; if (s*(t - pos.stop) > 0) pos.stop = t; }
        }
      }
      if (!S.has(k) || pos || pend || k < 6 || k >= n - 1 || D.t0 + (k + 1)*16*900000 <= startTs || X.atr[k] === null) continue;
      const mv = I.C[k] - I.C[k - 6]; if (!mv) continue;
      const d = mv < 0 ? 1 : -1;
      const ext = d === 1 ? Math.min(I.L[k], I.L[k-1], I.L[k-2]) : Math.max(I.H[k], I.H[k-1], I.H[k-2]);
      pend = { d, stop: ext - d*0.25*X.atr[k] };
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*16, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length-1], why: "TIME", open: true, stop: pos.stop, target: pos.target || 0 });
    return out;
  }
  const mk = (name, f, trl) => ({ name, f, trl, mult: 16, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "فواصل جان الزمنية (طريقة المستخدم)" });
  return { run, seps, strats: [
    mk("Gann فواصل فيبو0.786 هدف2.5R", 0.786, false),
    mk("Gann فواصل فيبو0.786 متحرك", 0.786, true),
    mk("Gann فواصل فيبو0.618 هدف2.5R", 0.618, false),
    mk("Gann فواصل فيبو0.618 متحرك", 0.618, true),
  ] };
})();
if (typeof module !== "undefined") module.exports = GANNTS;
