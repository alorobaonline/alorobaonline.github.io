// مروحة جان (فكرة المستخدم): الرسم على 4 ساعات، الدخول على الساعة. كل شي على الذيول.
// - المروحة من آخر قاع مؤكد (أدنى ذيل، 5 شموع 4 ساعات قبل و5 بعد) للونج، ومن آخر قمة مؤكدة (أعلى ذيل) للشورت.
//   القاع بينعرف بس بعد ما تسكّر الشمعة الخامسة بعده (ما في نظرة للمستقبل).
// - خط 1×1 (45°) بيمشي بسرعة "وحدة" لكل شمعة 4 ساعات. الوحدة: ربع ATR(14) على 4 ساعات (ATR كامل طلع حاد لدرجة إنه السعر ما بيلحقه أبداً)، أو ميل الموجة اللي قبل القاع
//   (ارتفاعها ÷ عدد شموعها). خط 2×1 نص السرعة.
// - الدخول: الذيل لمس خط 1×1 (أو نزل تحته) خلال آخر 6 ساعات، وبعدين شمعتين ساعة ورا بعض سكّروا فوق الخط → دخول على افتتاح الساعة الجاية.
// - الاتجاه انتهى (المروحة بتنلغى لحد قاع جديد) لما ينكسر خط 2×1: بالذيل أو بإغلاق ساعة (حسب النسخة).
// - الوقف: خط 2×1 (بيطلع مع الوقت). نسخة "ذيل": أمر وقف على الخط. نسخة "إغلاق": خروج على إغلاق ساعة تحت الخط،
//   مع وقف طوارئ ثابت تحت خط 2×1 وقت الدخول بـATR.
// - الهدف: 2.5R (R = الدخول − خط 2×1 وقت الدخول)، أو بدون هدف والخروج على إغلاق شمعة 4 ساعات تحت خط 1×1.
// - شرط سلامة: R لازم ≥ نص ATR (قريب من القاع الخطوط بتلتصق والهدف بيصير أصغر من الرسوم).
const GANN = (() => {
  const LR = 5;
  function prep4(I) {
    const n = I.n, tr = [I.H[0] - I.L[0]], atr = new Array(n).fill(null);
    for (let k = 1; k < n; k++) tr.push(Math.max(I.H[k] - I.L[k], Math.abs(I.H[k] - I.C[k-1]), Math.abs(I.L[k] - I.C[k-1])));
    let a = null; for (let k = 0; k < n; k++) { if (k === 13) { a = 0; for (let j = 0; j < 14; j++) a += tr[j]; a /= 14; } else if (k > 13) a = (a*13 + tr[k])/14; atr[k] = a; }
    return { atr };
  }
  const memo = new WeakMap();
  function isPiv(I, p, side) {   // side 1 = قاع (ذيل سفلي)، -1 = قمة (ذيل علوي)
    if (p - LR < 0 || p + LR >= I.n) return false;
    const v = side === 1 ? I.L[p] : I.H[p];
    for (let i = 1; i <= LR; i++) {
      const a = side === 1 ? I.L[p-i] : I.H[p-i], b = side === 1 ? I.L[p+i] : I.H[p+i];
      if (side === 1 ? !(v < a && v <= b) : !(v > a && v >= b)) return false;
    }
    return true;
  }
  function run(D, inds, sp, startTs) {
    const I4 = inds[16], I1 = inds[4]; if (!I4 || !I1 || I4.n < 60) return [];
    if (!memo.has(I4)) memo.set(I4, prep4(I4)); const X = memo.get(I4);
    const out = [], n1 = I1.n;
    const fan = { 1: null, [-1]: null }, lastPiv = { 1: null, [-1]: null };
    const xAt = j => (j + 1)/4 - 1;                     // وقت إغلاق ساعة j بوحدات شموع 4 ساعات
    const line = (f, j, slow) => f.A + f.side*(slow ? f.u/2 : f.u)*(xAt(j) - f.p);
    let pos = null, pend = null;
    for (let j = 0; j < n1; j++) {
      // بداية شمعة 4 ساعات جديدة: هل في قاع/قمة صارت مؤكدة؟
      if (j % 4 === 0) {
        const k = j/4, p = k - 1 - LR;
        for (const side of [1, -1]) {
          if (p >= 14 && isPiv(I4, p, side)) {
            const A = side === 1 ? I4.L[p] : I4.H[p], opp = lastPiv[-side];
            let u = null;
            if (sp.scale === "wave") { if (opp && opp.p < p) u = Math.abs(opp.v - A)/(p - opp.p); }
            else u = X.atr[k - 1] === null ? null : X.atr[k - 1]*(sp.atrK || 0.25);
            if (u && u > 0) fan[side] = { side, A, p, u, broken: false };
            lastPiv[side] = { p, v: A };
          }
        }
      }
      // الدخول المعلّق على افتتاح هالساعة
      if (pend) {
        const e = I1.O[j], s = pend.d, f = pend.f, stop0 = line(f, j - 1, true);
        const R = s*(e - stop0);
        if (R >= 0.5*pend.atr) pos = { d: s, e: j, entry: e, f, R, hard: stop0 - s*pend.atr, target: sp.tgt ? e + s*sp.tgt*R : null, stop: stop0 };
        pend = null;
      }
      // إدارة الصفقة
      if (pos) {
        const s = pos.d, f = pos.f, o = I1.O[j], l2 = line(f, j, true), prevL2 = line(f, j - 1, true);
        let raw = null, why = null;
        if (sp.brk === "wick") {
          const st = prevL2;   // أمر الوقف على خط 2×1 (قيمته معروفة من الساعة اللي قبل)
          if (s*(o - st) <= 0) { raw = o; why = "INIT_STOP"; }
          else if (pos.target !== null && s*(o - pos.target) >= 0) { raw = o; why = "TARGET"; }
          else if (s === 1 ? I1.L[j] <= st : I1.H[j] >= st) { raw = st; why = "INIT_STOP"; }
          else if (pos.target !== null && (s === 1 ? I1.H[j] >= pos.target : I1.L[j] <= pos.target)) { raw = pos.target; why = "TARGET"; }
          pos.stop = st;
        } else {
          const st = pos.hard;
          if (s*(o - st) <= 0) { raw = o; why = "INIT_STOP"; }
          else if (pos.target !== null && s*(o - pos.target) >= 0) { raw = o; why = "TARGET"; }
          else if (s === 1 ? I1.L[j] <= st : I1.H[j] >= st) { raw = st; why = "INIT_STOP"; }
          else if (pos.target !== null && (s === 1 ? I1.H[j] >= pos.target : I1.L[j] <= pos.target)) { raw = pos.target; why = "TARGET"; }
          else if (s*(I1.C[j] - l2) < 0) { raw = I1.C[j]; why = "TRAIL"; }
          pos.stop = s === 1 ? Math.max(st, l2) : Math.min(st, l2);
        }
        // بدون هدف: خروج على إغلاق شمعة 4 ساعات تحت خط 1×1
        if (raw === null && pos.target === null && j % 4 === 3 && s*(I1.C[j] - line(f, j, false)) < 0) { raw = I1.C[j]; why = "TIME"; }
        if (raw !== null) { out.push({ name: sp.name, d: s, e: pos.e*4, x: j*4 + 3, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: pos.target || 0 }); pos = null; continue; }
      }
      // حالة المراوح: كسر 2×1 بيلغيها
      for (const side of [1, -1]) {
        const f = fan[side]; if (!f || f.broken || xAt(j) <= f.p + LR) continue;
        const l2 = line(f, j, true);
        if (sp.brk === "wick" ? (side === 1 ? I1.L[j] < l2 : I1.H[j] > l2) : side*(I1.C[j] - l2) < 0) f.broken = true;
      }
      if (pos || pend || j < 6 || j >= n1 - 1 || D.t0 + (j + 1)*4*900000 <= startTs) continue;
      for (const side of [1, -1]) {
        const f = fan[side]; if (!f || f.broken || xAt(j - 6) <= f.p + LR) continue;
        const above = q => side*(I1.C[q] - line(f, q, false)) > 0;
        if (!(above(j) && above(j - 1))) continue;
        let touched = false; for (let q = j - 6; q <= j; q++) if (side === 1 ? I1.L[q] <= line(f, q, false) : I1.H[q] >= line(f, q, false)) { touched = true; break; }
        if (!touched) continue;
        const at = X.atr[Math.floor((j + 1)/4) - 1]; if (!at) continue;   // ATR آخر شمعة 4 ساعات مسكّرة
        pend = { d: side, f, atr: at }; break;
      }
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*4, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length-1], why: "TIME", open: true, stop: pos.stop, target: pos.target || 0 });
    return out;
  }
  const mk = (name, scale, brk, tgt) => ({ name, scale, brk, tgt, mult: 4, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "مروحة جان (فكرة المستخدم)" });
  return { run, strats: [
    mk("Gann ¼ATR ذيل هدف2.5R", "atr", "wick", 2.5),
    mk("Gann ¼ATR إغلاق هدف2.5R", "atr", "close", 2.5),
    mk("Gann ¼ATR ذيل بدون هدف", "atr", "wick", 0),
    mk("Gann ¼ATR إغلاق بدون هدف", "atr", "close", 0),
    mk("Gann موجة ذيل هدف2.5R", "wave", "wick", 2.5),
    mk("Gann موجة إغلاق هدف2.5R", "wave", "close", 2.5),
    mk("Gann موجة ذيل بدون هدف", "wave", "wick", 0),
    mk("Gann موجة إغلاق بدون هدف", "wave", "close", 0),
  ] };
})();
if (typeof module !== "undefined") module.exports = GANN;
