// خطوط جان كمناطق قرار (طريقة المستخدم): المراوح الأربعة (الأطراف الكبيرة + آخر موجة عايشة)، كل الـ9 زوايا.
// النقاط: قمة 1/قاع 1 = أعلى/أدنى سعر بآخر 900 شمعة 4 ساعات، مع المستحدثة (Pivots 10/10، فيبو 0.786).
//         قمة 2/قاع 2 = آخر قمة/قاع عايش (ما سكّر السعر وراه) بعيد عن الكبير ≥ 60 شمعة.
// الزاوية: 45° لكل شمعة 4 ساعات = (أعلى − أدنى بالشاشة) ÷ 460. المراوح محسوبة من آخر شمعة 4 ساعات مسكّرة.
// التأكيد: شمعتين ورا بعض (ساعة أو 15 دقيقة حسب النسخة) بيسكّروا ورا الخط:
//   كسر = إغلاق قبلهم بالجهة الثانية → دخول باتجاه الكسر.
//   ارتداد (نسخة) = الذيل لمس الخط والشمعتين سكّروا بنفس الجهة اللي إجا منها السعر → دخول بنفس الجهة.
// الدخول على افتتاح الشمعة الجاية. الوقف: ورا الخط بربع ATR. الهدف: الخط اللي بعده باتجاه الصفقة (أقرب خط من المراوح الأربعة
// أبعد من نص المخاطرة)، وإذا ما في = 2R. حد أقصى 5 أيام.
const GDEC = (() => {
  const LR = 10, WIN = 900, DIV = 460, FIB = 0.786, MIND = 60, SP = [8, 4, 3, 2, 1, 1/2, 1/3, 1/4, 1/8];
  const memo = new WeakMap();
  function anchors(I) {
    const n = I.n, H = I.H, L = I.L, C = I.C, out = new Array(n).fill(null), ph = [], pl = [];
    const atr = new Array(n).fill(null); { let a = null; for (let k = 1; k < n; k++) { const tr = Math.max(H[k]-L[k], Math.abs(H[k]-C[k-1]), Math.abs(L[k]-C[k-1])); a = a === null ? tr : (a*13 + tr)/14; if (k >= 14) atr[k] = a; } }
    const isP = (p, hi) => { if (p - LR < 0 || p + LR >= n) return false; const v = hi ? H[p] : L[p]; for (let i = 1; i <= LR; i++) { const a = hi ? H[p-i] : L[p-i], b = hi ? H[p+i] : L[p+i]; if (hi ? !(v > a && v >= b) : !(v < a && v <= b)) return false; } return true; };
    const upd = (P, ix, p, hi) => { for (const x of P) { const cj = x[0], v = x[1]; if (cj > ix) { let w = hi ? Infinity : -Infinity; for (let q = ix; q <= cj; q++) w = hi ? Math.min(w, L[q]) : Math.max(w, H[q]); const lvl = hi ? w + FIB*(p - w) : w - FIB*(w - p); if (hi ? v >= lvl : v <= lvl) { ix = cj; p = v; } } } return [ix, p]; };
    for (let k = 0; k < n; k++) {
      if (k - LR >= 0 && isP(k - LR, true)) ph.push([k - LR, H[k - LR], true]);
      if (k - LR >= 0 && isP(k - LR, false)) pl.push([k - LR, L[k - LR], true]);
      for (const x of ph) if (x[2] && x[0] < k && C[k] > x[1]) x[2] = false;   // ماتت
      for (const x of pl) if (x[2] && x[0] < k && C[k] < x[1]) x[2] = false;
      if (k < 200 || atr[k] === null) continue;
      const lo0 = Math.max(0, k - WIN + 1); let hiI = lo0, loI = lo0;
      for (let j = lo0; j <= k; j++) { if (H[j] >= H[hiI]) hiI = j; if (L[j] <= L[loI]) loI = j; }
      const u = (H[hiI] - L[loI])/DIV;
      const php = ph.filter(x => x[0] >= lo0), plp = pl.filter(x => x[0] >= lo0);
      const [t1i, t1p] = upd(php, hiI, H[hiI], true), [b1i, b1p] = upd(plp, loI, L[loI], false);
      const A = [[t1i, t1p, -1], [b1i, b1p, 1]];
      for (let j = php.length - 1; j >= 0; j--) { const x = php[j]; if (x[2] && Math.abs(x[0] - t1i) >= MIND) { A.push([x[0], x[1], -1]); break; } }
      for (let j = plp.length - 1; j >= 0; j--) { const x = plp[j]; if (x[2] && Math.abs(x[0] - b1i) >= MIND) { A.push([x[0], x[1], 1]); break; } }
      out[k] = { A, u, atr: atr[k] };
    }
    return out;
  }
  function run(D, inds, sp, startTs) {
    const I4 = inds[16], m = sp.tf, T = inds[m]; if (!I4 || !T || I4.n < 250) return [];
    if (!memo.has(I4)) memo.set(I4, anchors(I4)); const AN = memo.get(I4);
    const per4 = 16/m, n = T.n, out = [], maxHold = Math.round(5*24*4/m);
    const xAt = j => (j + 1)/per4 - 1;   // وقت إغلاق الشمعة j بوحدات 4 ساعات
    let pos = null;
    for (let j = 3; j < n - 1; j++) {
      if (pos) {
        const s = pos.d, o = T.O[j]; let raw = null, why = null;
        if (j > pos.e) {
          if (s*(o - pos.stop) <= 0) { raw = o; why = "INIT_STOP"; }
          else if (s*(o - pos.target) >= 0) { raw = o; why = "TARGET"; }
        }
        if (raw === null) {
          if (s === 1 ? T.L[j] <= pos.stop : T.H[j] >= pos.stop) { raw = pos.stop; why = "INIT_STOP"; }
          else if (s === 1 ? T.H[j] >= pos.target : T.L[j] <= pos.target) { raw = pos.target; why = "TARGET"; }
          else if (j - pos.e + 1 >= maxHold) { raw = T.C[j]; why = "TIME"; }
        }
        if (raw !== null) { out.push({ name: sp.name, d: s, e: pos.e*m, x: j*m + m - 1, rawIn: pos.entry, rawOut: raw, why, open: false, stop: pos.stop, target: pos.target }); pos = null; }
        continue;
      }
      if (D.t0 + (j + 1)*m*900000 <= startTs) continue;
      const k4 = Math.floor((j + 1)/per4) - 1; const a = AN[k4]; if (!a || k4 - 3 < 0) continue;
      const { A, u, atr } = a, xs = [xAt(j - 2), xAt(j - 1), xAt(j)];
      let sig = null;
      for (const [ai, ap, dir] of A) for (const s of SP) {
        const lv = xs.map(x => ap + dir*u*s*(x - ai)); if (lv[2] <= 0) continue;
        const c0 = T.C[j - 2] - lv[0], c1 = T.C[j - 1] - lv[1], c2 = T.C[j] - lv[2];
        let d = 0, kind = null;
        if (c1*c2 > 0 && c0*c1 < 0) { d = c2 > 0 ? 1 : -1; kind = "break"; }
        else if (sp.bounce && c0*c1 > 0 && c1*c2 > 0) {
          const side = c2 > 0 ? 1 : -1, touched = side === 1 ? T.L[j - 1] <= lv[1] : T.H[j - 1] >= lv[1], clean = side === 1 ? T.L[j - 2] > lv[0] : T.H[j - 2] < lv[0];
          if (touched && clean) { d = side; kind = "bounce"; }
        }
        if (!d) continue;
        if (!sig || Math.abs(T.C[j] - lv[2]) < Math.abs(T.C[j] - sig.lv)) sig = { d, lv: lv[2], kind };
      }
      if (!sig) continue;
      const e = T.O[j + 1], d = sig.d, stop = sig.lv - d*0.25*atr, R = d*(e - stop);
      if (!(R > 0)) continue;
      // الهدف: أقرب خط (من كل المراوح) أبعد من نص المخاطرة باتجاه الصفقة، وإلا 2R
      const xe = xAt(j + 1); let tgt = null;
      for (const [ai, ap, dir] of A) for (const s of SP) { const v = ap + dir*u*s*(xe - ai); if (d*(v - e) >= 0.5*R && (tgt === null || d*(v - tgt) < 0)) tgt = v; }
      if (tgt === null) tgt = e + d*2*R;
      pos = { d, e: j + 1, entry: e, stop, target: tgt };
    }
    if (pos) out.push({ name: sp.name, d: pos.d, e: pos.e*m, x: D.o.length - 1, rawIn: pos.entry, rawOut: D.c[D.c.length - 1], why: "TIME", open: true, stop: pos.stop, target: pos.target });
    return out;
  }
  const mk = (name, tf, bounce) => ({ name, tf, bounce, mult: tf, sig: () => 0, run, sm: 0, tm: 0, hold: 0, trail: null, cd: null, entry: "imm", src: "خطوط جان كمناطق قرار (طريقة المستخدم)" });
  const anchorsOf = I => { if (!memo.has(I)) memo.set(I, anchors(I)); return memo.get(I); };
  function near(I, k, side, mode) {
    const a = anchorsOf(I)[k]; if (!a) return mode === "none";
    const { A, u, atr } = a, c = I.C[k];
    const list = mode === "slow" ? [side === 1 ? A[1] : A[0]] : A, sp = mode === "slow" ? [1/8, 1/4, 1/3, 1/2] : SP;
    let hit = false;
    for (const [ai, ap, dir] of list) for (const s of sp) { const v = ap + dir*u*s*(k - ai); if (Math.abs(c - v) <= 0.5*atr) hit = true; }
    return mode === "none" ? !hit : hit;
  }
  return { run, near, anchorsOf, strats: [
    mk("Gann قرار كسر ساعة", 4, false),
    mk("Gann قرار كسر 15د", 1, false),
  ] };
})();
if (typeof module !== "undefined") module.exports = GDEC;
