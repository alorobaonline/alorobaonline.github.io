// تقاطع مراوح جان — نسخة 2 بطريقة المستخدم ("تثبيت الشاشة"): المقياس من الموجة نفسها ونفس المقياس للمروحتين.
// 1×1 = (|القمة − القاع| ÷ عدد شموع الـ4 ساعات بينهم) × k  (k = 1، أو 1.25: بصورة FIL خط القمة→القاع طلع ~39° على الشاشة).
// المروحتين من آخر قمة مؤكدة وآخر قاع مؤكد (5/5، ذيول)، الـ9 خطوط. التقاطعات بس "جوّا الشاشة": لحد ضعف طول الموجة بعد آخر نقطة.
// (1×1 مع 1×1 بنفس المقياس دايماً بيتقاطعوا عند القاع/القمة نفسها، يعني بالماضي — فما إله معنى هون)
// الإشارة: تجمّع ≥2 أو ≥3 تقاطعات خلال 3 شموع 4 ساعات (زي الفواصل الحمرا بالصورة)،
// أو تجمّع + السعر قريب (≤1 ATR) من متوسط سعر التقاطعات. الدخول مع إغلاق شمعة الفاصل، عكس الحركة (6 شموع)، بدون تأكيد.
// تقاطع مراوح جان (فكرة المستخدم): مروحة طالعة من آخر قاع مؤكد ومروحة نازلة من آخر قمة مؤكدة (4 ساعات، ذيول، 5/5).
// نقطة تقاطع خط من القاع مع خط من القمة = "فاصل زمني": لما تسكّر شمعة الـ4 ساعات اللي فيها وقت التقاطع،
// بندخل فوراً (افتتاح الشمعة الجاية) عكس الحركة اللي جابت السعر (إغلاق هلأ مقابل إغلاق قبل 6 شموع).
// النسخ: بس 1×1 مع 1×1، أو أي خط من الـ9 مع أي خط · وقت بس، أو وقت + السعر قريب من نقطة التقاطع (≤ 1 ATR)
//        · هدف 2.5R، أو وقف متحرك 2ATR بعد 1R بدون هدف (لمسك الانفجار). الوقف: ورا أبعد ذيل بآخر 3 شموع ± ربع ATR.
//        حد أقصى 40 شمعة 4 ساعات. وحدة 1×1 = ربع ATR(14) لكل شمعة 4 ساعات.
const GANNX2 = (() => {
  const LR = 5, SP = [8, 4, 3, 2, 1, 1/2, 1/3, 1/4, 1/8];
  const memo = new WeakMap();
  function prep(I) {
    const n = I.n, tr = [I.H[0] - I.L[0]], atr = new Array(n).fill(null);
    for (let k = 1; k < n; k++) tr.push(Math.max(I.H[k] - I.L[k], Math.abs(I.H[k] - I.C[k-1]), Math.abs(I.L[k] - I.C[k-1])));
    let a = null; for (let k = 0; k < n; k++) { if (k === 13) { a = 0; for (let j = 0; j < 14; j++) a += tr[j]; a /= 14; } else if (k > 13) a = (a*13 + tr[k])/14; atr[k] = a; }
    return { atr };
  }
  function isPiv(I, p, side) {
    if (p - LR < 0 || p + LR >= I.n) return false;
    const v = side === 1 ? I.L[p] : I.H[p];
    for (let i = 1; i <= LR; i++) { const a = side === 1 ? I.L[p-i] : I.H[p-i], b = side === 1 ? I.L[p+i] : I.H[p+i];
      if (side === 1 ? !(v < a && v <= b) : !(v > a && v >= b)) return false; }
    return true;
  }
  function run(D, inds, sp, startTs) {
    const I = inds[16]; if (!I || I.n < 60) return [];
    if (!memo.has(I)) memo.set(I, prep(I)); const X = memo.get(I);
    const n = I.n, out = [], speeds = SP;
    let low = null, high = null, seps = new Map(), pos = null, pend = null, lastSig = -99;
    const rebuild = k => {   // تقاطعات جاية، مجمّعة بشمعة 4 ساعات: {cnt, P (مجموع الأسعار)}
      seps = new Map(); if (!low || !high || low.p === high.p) return;
      const span = Math.abs(high.p - low.p), u = Math.abs(high.A - low.A)/span*sp.k, edge = Math.max(high.p, low.p) + 2*span;
      for (const a of speeds) for (const b of speeds) {
        const ua = u*a, ub = u*b, t = (high.A - low.A + ua*low.p + ub*high.p)/(ua + ub);
        if (!(t > k) || t > edge) continue;
        const kk = Math.ceil(t), P = low.A + ua*(t - low.p);
        if (P <= 0) continue;
        const c = seps.get(kk) || { cnt: 0, P: 0, one: false }; c.cnt++; c.P += P; if (a === 1 && b === 1) c.one = true; seps.set(kk, c);
      }
    };
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
      // قاع/قمة صاروا مؤكدين بإغلاق هالشمعة؟
      const p = k - LR; let changed = false;
      if (p >= 14) for (const side of [1, -1]) if (isPiv(I, p, side) && X.atr[k] !== null) {
        const f = { A: side === 1 ? I.L[p] : I.H[p], p };
        if (side === 1) low = f; else high = f; changed = true;
      }
      if (changed) rebuild(k);
      // فاصل زمني بهالشمعة؟
      let fire = false, cnt = 0, Ps = 0;
      { for (const q of [k - 1, k, k + 1]) { const c = seps.get(q); if (c) { cnt += c.cnt; Ps += c.P; } }
        fire = cnt >= sp.minC && k - lastSig > 2; if (fire) Ps /= cnt; }
      if (!fire) continue;
      lastSig = k;
      if (pos || pend || k < 6 || k >= n - 1 || D.t0 + (k + 1)*16*900000 <= startTs || X.atr[k] === null) continue;
      if (sp.near && Math.abs(I.C[k] - Ps) > X.atr[k]) continue;
      const mv = I.C[k] - I.C[k - 6]; if (!mv) continue;
      const d = mv < 0 ? 1 : -1;
      const ext = d === 1 ? Math.min(I.L[k], I.L[k-1], I.L[k-2]) : Math.max(I.H[k], I.H[k-1], I.H[k-2]);
      pend = { d, stop: ext - d*0.25*X.atr[k] };
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*16, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length-1], why: "TIME", open: true, stop: pos.stop, target: pos.target || 0 });
    return out;
  }
  const mk = (name, k, minC, near, trl) => ({ name, k, minC, near, trl, mult: 16, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "تقاطع مراوح جان v2 (طريقة المستخدم)" });
  return { run, strats: [
    mk("GannX2 k1 تجمّع2 هدف2.5R", 1, 2, false, false),
    mk("GannX2 k1 تجمّع2 متحرك", 1, 2, false, true),
    mk("GannX2 k1 تجمّع3 هدف2.5R", 1, 3, false, false),
    mk("GannX2 k1 تجمّع3 متحرك", 1, 3, false, true),
    mk("GannX2 k1 تجمّع3+سعر هدف2.5R", 1, 3, true, false),
    mk("GannX2 k1 تجمّع3+سعر متحرك", 1, 3, true, true),
    mk("GannX2 k1.25 تجمّع2 هدف2.5R", 1.25, 2, false, false),
    mk("GannX2 k1.25 تجمّع2 متحرك", 1.25, 2, false, true),
    mk("GannX2 k1.25 تجمّع3 هدف2.5R", 1.25, 3, false, false),
    mk("GannX2 k1.25 تجمّع3 متحرك", 1.25, 3, false, true),
    mk("GannX2 k1.25 تجمّع3+سعر هدف2.5R", 1.25, 3, true, false),
    mk("GannX2 k1.25 تجمّع3+سعر متحرك", 1.25, 3, true, true),
  ] };
})();
if (typeof module !== "undefined") module.exports = GANNX2;
