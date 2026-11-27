// 26/11 22:10 (طلب المستخدم: «لازم يكون في حل انحصل نتائج مربحه»): غريد الزخم على شموع الدقيقة — تنفيذ واقعي زي الحقيقي
// الحقيقي اليوم خسر وهو بالمنصة (15د) و5د بيربح ← بنفحص على 1د مع فرق سعر الدخول/الوقف + العمولة، ومنقارن درجات/وقوف/فلاتر
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DATA = process.env.NEXORA_DATA || path.join(require("os").homedir(), ".nexora-data");
const M1 = 60000, H4 = 4*3600e3, DAY = 864e5;
const START = Date.UTC(2026, 8, 1), SPLIT = Date.UTC(2026, 10, 1), RESET = Date.UTC(2026, 10, 16, 13, 45);
const FEE = 0.0005, SLIP_IN = 0.0015, SLIP_OUT = 0.001;   // تيكر 0.05% · دخول ماركت أسوأ 0.15% (الحقيقي اليوم 0.14%) · وقف ماركت 0.1%
const COINS = process.env.GRID_COINS ? process.env.GRID_COINS.split(",") : ["AKEUSDT", "EVAAUSDT", "SOPHUSDT", "BLURUSDT", "STRKUSDT", "TRUMPUSDT", "GALAUSDT", "DOTUSDT", "TIAUSDT", "WLDUSDT"];
async function dl(url, file, mark404) {
  if (fs.existsSync(file)) return true; if (fs.existsSync(file + ".404")) return false;
  for (let k = 0; k < 4; k++) { try { const r = await fetch(url); if (r.status === 404) { if (mark404) fs.writeFileSync(file + ".404", ""); return false; }
      if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; } } catch (e) {} await new Promise(z => setTimeout(z, 1500*(k+1))); }
  throw new Error("download failed " + url);
}
const csv = f => execSync(`unzip -p "${f}"`, { maxBuffer: 1 << 30 }).toString().split("\n").filter(l => /^\d/.test(l)).map(l => l.split(","));
async function klines(sym, iv, from) {
  const rows = new Map(), dir = path.join(DATA, iv, sym); fs.mkdirSync(dir, { recursive: true });
  const thisM = new Date().toISOString().slice(0, 7);
  for (let d = new Date(from); d.getTime() < Date.now(); d.setUTCMonth(d.getUTCMonth() + 1)) { d.setUTCDate(1); const m = d.toISOString().slice(0, 7);
    const f = path.join(dir, `${m}.zip`);
    if (m !== thisM && await dl(`https://data.binance.vision/data/futures/um/monthly/klines/${sym}/${iv}/${sym}-${iv}-${m}.zip`, f, true)) { for (const r of csv(f)) rows.set(+r[0], r); continue; }
    const [y, mo] = m.split("-").map(Number), days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    for (let dd = 1; dd <= days; dd++) { const t = Date.UTC(y, mo - 1, dd); if (t > Date.now() - DAY) break; const ds = new Date(t).toISOString().slice(0, 10), fd = path.join(dir, `${ds}.zip`);
      if (await dl(`https://data.binance.vision/data/futures/um/daily/klines/${sym}/${iv}/${sym}-${iv}-${ds}.zip`, fd)) for (const r of csv(fd)) rows.set(+r[0], r); } }
  const ks = [...rows.keys()].sort((a, b) => a - b);
  return { t: ks, o: ks.map(k => +rows.get(k)[1]), h: ks.map(k => +rows.get(k)[2]), l: ks.map(k => +rows.get(k)[3]), c: ks.map(k => +rows.get(k)[4]), v: ks.map(k => +rows.get(k)[5]) };
}
// ---- ترند 4س من شموع 4س جاهزة (آخر شمعة مسكّرة) ----
function zl(B, len = 70, mult = 1.2) {
  const n = B.c.length, c = B.c, lag = Math.floor((len - 1)/2), z = new Array(n).fill(NaN), a = 2/(len + 1); let e = NaN;
  for (let i = lag; i < n; i++) { const x = c[i] + (c[i] - c[i - lag]); e = isNaN(e) ? x : a*x + (1 - a)*e; z[i] = e; }
  const atr = new Array(n).fill(NaN); let s = 0;
  for (let i = 0; i < n; i++) { const tr = i ? Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - c[i-1]), Math.abs(B.l[i] - c[i-1])) : B.h[i] - B.l[i];
    if (i < len) { s += tr; if (i === len - 1) atr[i] = s/len; } else atr[i] = (atr[i-1]*(len - 1) + tr)/len; }
  const vol = new Array(n).fill(NaN); for (let i = 0; i < n; i++) { let m = -Infinity, ok = false; for (let j = Math.max(0, i - 3*len + 1); j <= i; j++) if (!isNaN(atr[j])) { ok = true; if (atr[j] > m) m = atr[j]; } if (ok) vol[i] = m*mult; }
  const T = new Int8Array(n); let t = 0;
  for (let i = 1; i < n; i++) { if (!isNaN(z[i]) && !isNaN(vol[i]) && !isNaN(z[i-1]) && !isNaN(vol[i-1])) { if (c[i] > z[i] + vol[i] && c[i-1] <= z[i-1] + vol[i-1]) t = 1; if (c[i] < z[i] - vol[i] && c[i-1] >= z[i-1] - vol[i-1]) t = -1; } T[i] = t; }
  return T;
}
function emaT(B) {
  const C = B.c, H = B.h, L = B.l, N = C.length, ema = (x, p) => { const a = 2/(p + 1), o = [x[0]]; for (let i = 1; i < x.length; i++) o.push(a*x[i] + (1 - a)*o[i-1]); return o; };
  const f = ema(C, 50), s = ema(C, 200), T = new Int8Array(N); let at = 0;
  for (let i = 0; i < N; i++) { const tr = i ? Math.max(H[i] - L[i], Math.abs(H[i] - C[i-1]), Math.abs(L[i] - C[i-1])) : H[0] - L[0]; at = i < 14 ? (at*i + tr)/(i + 1) : (at*13 + tr)/14;
    if (i >= 10) { const w = Math.abs(f[i] - s[i]) >= at; T[i] = w && C[i] > s[i] && f[i] > s[i] && s[i] > s[i-10] ? 1 : w && C[i] < s[i] && f[i] < s[i] && s[i] < s[i-10] ? -1 : 0; } }
  return T;
}
// 27/11: SuperTrend (Kivanc 10/3) + Ultimate MA (ChrisMoody SMA20 ميل [2]) + AlphaTrend (Kivanc 14/1 MFI) — قيمة لكل شمعة مسكّرة
function tri(B) { const n = B.c.length, h = B.h, l = B.l, c = B.c, v = B.v;
  const tr = c.map((_, i) => i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1])) : h[i] - l[i]);
  const ST = new Int8Array(n), UM = new Int8Array(n), AL = new Int8Array(n), T = new Int8Array(n);
  let a = 0, up = 0, dn = 0, d = 1; for (let i = 0; i < n; i++) { a = i < 10 ? (a*i + tr[i])/(i + 1) : (a*9 + tr[i])/10; const s = (h[i] + l[i])/2; let u = s - 3*a, w = s + 3*a;
    if (i) { u = c[i-1] > up ? Math.max(u, up) : u; w = c[i-1] < dn ? Math.min(w, dn) : w; d = d === -1 && c[i] > dn ? 1 : d === 1 && c[i] < up ? -1 : d; } up = u; dn = w; ST[i] = d; }
  const ma = []; let s = 0; for (let i = 0; i < n; i++) { s += c[i]; if (i >= 20) s -= c[i-20]; ma.push(s/20); if (i >= 21) UM[i] = ma[i] >= ma[i-2] ? 1 : -1; }
  const as = []; s = 0; for (let i = 0; i < n; i++) { s += tr[i]; if (i >= 14) s -= tr[i-14]; as.push(s/Math.min(i + 1, 14)); }
  const tp = c.map((x, i) => (h[i] + l[i] + x)/3), AT = [];
  for (let i = 0; i < n; i++) { let m = 50; if (i >= 15) { let P = 0, N = 0; for (let j = i - 13; j <= i; j++) { const f = tp[j]*v[j]; if (tp[j] > tp[j-1]) P += f; else if (tp[j] < tp[j-1]) N += f; } m = N ? 100 - 100/(1 + P/N) : 100; }
    const p = i ? AT[i-1] : c[0], uT = l[i] - as[i], dT = h[i] + as[i]; AT.push(m >= 50 ? (uT < p ? p : uT) : (dT > p ? p : dT)); if (i >= 2) AL[i] = AT[i] > AT[i-2] ? 1 : AT[i] < AT[i-2] ? -1 : AL[i-1]; }
  for (let i = 0; i < n; i++) T[i] = ST[i] === UM[i] && UM[i] === AL[i] ? ST[i] : 0;
  return { ST, UM, AL, T }; }
// ---- الغريد بتنفيذ الحقيقي: درجة وحدة لكل قطعة مسار (الأقرب للسعر) · دخول أسوأ · وقف ماركت أسوأ ----
function grid(D, B4, T4, from, to, step, trail, maxN = 5, lock = 0, TF = H4, pct = null, flip = 0, tp = 0) {   // tp: هدف ثابت (ليمت، عمولة ميكر 0.02%)   // flip: 1 = سكّر الصفقة لما الترند ينقلب ضدها · 2 = بس إذا خسرانة   // pct = [تفعيل, مسافة]: بعد ما الربح يوصل تفعيل، الوقف بيلحق أعلى ربح بمسافة (زي TRAILING_STOP_MARKET تبع بايننس)   // lock = بعد ما تربح درجة: الوقف بيصير فوق الدخول بجزء من درجة (0 = على الدخول · 0.5 = نص درجة)
  const out = [], g = Math.log(1 + step); let i0 = D.t.findIndex(t => t >= from); if (i0 < 0) return out;
  const A = D.o[i0], K = p => Math.log(p/A)/g, LV = k => A*Math.pow(1 + step, k), legs = [];
  const tAt = t => { const b = Math.floor(t/TF)*TF - TF, j = B4.idx.get(b); return j === undefined ? 0 : T4[j]; };
  const stopK = q => q.d === 1 ? (q.best >= q.k + 1 ? Math.max(q.best - trail, q.k) : q.k - trail) : (q.best <= q.k - 1 ? Math.min(q.best + trail, q.k) : q.k + trail);
  const exit = (q, px, t) => { legs.splice(legs.indexOf(q), 1); const x = px*(1 - q.d*SLIP_OUT); out.push({ t, d: q.d, r: q.d*(x/q.fill - 1) - 2*FEE }); };
  let prev = D.o[i0], lastTr = 0;
  for (let i = i0; i < D.t.length && D.t[i] < to; i++) {
    const tr = tAt(D.t[i]), path = D.c[i] >= D.o[i] ? [D.o[i], D.l[i], D.h[i], D.c[i]] : [D.o[i], D.h[i], D.l[i], D.c[i]];
    for (const p of path) { if (p === prev) continue; const up = p > prev;
      // الوقوف أول (بايننس بتنفّذها لحالها)
      if (flip && tr !== 0) { for (const q of [...legs]) if (tr === -q.d && (flip !== 2 || q.d*(p/q.fill - 1) < 0)) exit(q, p, D.t[i]);
        if (flip === 3 && !legs.length && lastTr !== tr) { const kk = tr === 1 ? Math.floor(K(p) + 1e-12) : Math.ceil(K(p) - 1e-12); legs.push({ k: kk, d: tr, best: kk, fill: p*(1 + tr*SLIP_IN) }); } }   // 3 = سكّر واقلب فوراً ماركت مع الترند
      lastTr = tr;
      if (pct) for (const q of legs) { const f = q.d*(p/q.fill - 1); if (!(q.mfe >= f)) q.mfe = f; }
      if (tp) for (const q of [...legs]) { const tpx = q.fill*(1 + q.d*tp); if (q.d === 1 ? p >= tpx : p <= tpx) { legs.splice(legs.indexOf(q), 1); out.push({ t: D.t[i], d: q.d, r: tp - FEE - 0.0002 }); } }
      for (const q of [...legs]) { let sp = LV(stopK(q)); if (pct && q.mfe >= pct[0]) { const pp = q.fill*(1 + q.d*(q.mfe - pct[1])); sp = q.d === 1 ? Math.max(sp, pp) : Math.min(sp, pp); } if (lock && q.d*(q.best - q.k) >= 1) { const lp = LV(q.k + q.d*lock); sp = q.d === 1 ? Math.max(sp, lp) : Math.min(sp, lp); } if (q.d === 1 ? p <= sp : p >= sp) exit(q, sp, D.t[i]); }
      const lv = up ? Math.floor(K(p) + 1e-12) : Math.ceil(K(p) - 1e-12), crossed = up ? lv > Math.floor(K(prev) + 1e-12) : lv < Math.ceil(K(prev) - 1e-12);
      if (crossed) { const d = up ? 1 : -1;
        for (const q of legs) if (q.d === d && (up ? lv > q.best : lv < q.best)) q.best = lv;
        if (tr === d && !legs.some(q => q.d === -d) && !legs.some(q => q.k === lv && q.d === d) && legs.filter(q => q.d === d).length < maxN) legs.push({ k: lv, d, best: lv, fill: LV(lv)*(1 + d*SLIP_IN) }); }
      prev = p; }
  }
  let j = D.t.length - 1; while (j > 0 && D.t[j] >= to) j--;
  for (const q of legs) out.push({ t: to, d: q.d, r: q.d*(D.c[j]*(1 - q.d*SLIP_OUT)/q.fill - 1) - 2*FEE, open: true });
  return out;
}
function st(a) { const w = a.filter(x => x.r > 0), l = a.filter(x => x.r <= 0), W = 100*w.reduce((s, x) => s + x.r, 0), L = 100*l.reduce((s, x) => s + x.r, 0);
  return { n: a.length, w: w.length, l: l.length, W, L, net: W + L, pf: L ? W/-L : 99 }; }
const f$ = x => (x >= 0 ? "+" : "") + x.toFixed(0) + "$";
if (require.main !== module) module.exports = { grid, zl, emaT, st, tri };
else (async () => {
  const D = {}, B4 = {};
  await Promise.all(COINS.map(async s => { D[s] = await klines(s, "1m", START); if (!D[s].t.length) { console.log("no data", s); return; } const k4 = await klines(s, "4h", START - 200*DAY);
    B4[s] = { ...k4, idx: new Map(k4.t.map((t, j) => [t, j])) }; B4[s].zl12 = zl(k4, 70, 1.2); B4[s].zl2 = zl(k4, 70, 2); B4[s].ema = emaT(k4); B4[s].none = new Int8Array(k4.t.length); }));
  for (const s of [...COINS]) if (!D[s] || !D[s].t.length) COINS.splice(COINS.indexOf(s), 1);
  const END = Math.min(...COINS.map(s => D[s].t[D[s].t.length - 1] + M1));
  const V = [{ f: "zl12", step: 0.03, trail: 3, lock: 0.25, pct: null, nm: "الحالي: وقف 3 درجات + قفل ربع" }, ...[[0.012, 0.005], [0.01, 0.005], [0.015, 0.007], [0.02, 0.01], [0.03, 0.015], [0.012, 0.003]].map(x => ({ f: "zl12", step: 0.03, trail: 3, lock: 0.25, pct: x, nm: `بعد +${x[0]*100}% بيلحق ${x[1]*100}%` })), { f: "zl12", step: 0.015, trail: 2, lock: 0.25, pct: [0.012, 0.005], nm: "درجة 1.5% + بعد +1.2% بيلحق 0.5%" }];
  const P = [["أيلول+تشرين1", START, SPLIT], ["تشرين2 (فحص)", SPLIT, END], ["من التصفير", RESET, END]];
  const out = [`# غريد الزخم على شموع الدقيقة · تنفيذ واقعي: دخول ماركت +0.15% · وقف +0.1% · عمولة 0.05%×2 · درجة وحدة لكل حركة · حتى 5 درجات`,
    `# من ${new Date(START).toISOString().slice(0, 10)} لـ ${new Date(END).toISOString().slice(0, 16)} · كل الأرقام لكل صفقة 100$`, ""];
  if (process.env.GRID_TRI) { const aggV = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0, v: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; y.v += X.v[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c), v: ks.map(k => m.get(k).v) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); Object.assign(B, tri(B)); B.ZT = B.Z.map((z, j) => z === B.T[j] ? z : 0); return B; };
    const B30 = {}, B60 = {}; for (const s of COINS) { B30[s] = aggV(D[s], 18e5); B60[s] = aggV(D[s], 36e5); }
    out.push("## فلتر الاتجاه للغريد: Zero Lag مقابل SuperTrend + Ultimate MA + AlphaTrend · 3% · وقف 6% · +1.0%←0.3% · صفقة 50$", "الفلتر | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الربح · معدل الخسارة · صافي · PF)").join(" | "));
    const VV = [["Zero Lag 30د (الحالي)", B30, "Z", 18e5], ["الثلاثة متفقين 30د", B30, "T", 18e5], ["الثلاثة متفقين ساعة", B60, "T", 36e5], ["Zero Lag 30د + الثلاثة متفقين", B30, "ZT", 18e5], ["SuperTrend لحاله 30د", B30, "ST", 18e5], ["AlphaTrend لحاله 30د", B30, "AL", 18e5], ["Ultimate MA لحاله 30د", B30, "UM", 18e5]];
    for (const [nm, BB, key, TF] of VV) out.push(`${nm} | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], BB[s], BB[s][key], a, b, 0.03, 2, 1, 0.25, TF, [0.01, 0.003])); const c = st(all); const ws = all.filter(x => x.r > 0), ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · +${(50*ws.reduce((q, x) => q + x.r, 0)/Math.max(1, ws.length)).toFixed(2)}$ · ${(50*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_FILT) {   // 27/11 11:05 (طلب المستخدم: «لازم نقوي الغريد بفلاتر/مؤشرات تفهم حركة السوق»): فلاتر حالة السوق فوق Zero Lag 30د — بتمنع الدخول بس، الطلوع متل ما هو
    const aggV = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0, v: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; y.v += X.v[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c), v: ks.map(k => m.get(k).v) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); return B; };
    const rma = (x, p) => { const o = new Array(x.length).fill(NaN); let s = 0, k = 0; for (let i = 0; i < x.length; i++) { if (isNaN(x[i])) continue; if (k < p) { s += x[i]; k++; if (k === p) o[i] = s/p; } else o[i] = (o[i-1]*(p - 1) + x[i])/p; } return o; };
    const sma = (x, p) => { const o = new Array(x.length).fill(NaN); let s = 0; for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= p) s -= x[i-p]; if (i >= p - 1) o[i] = s/p; } return o; };
    const IND = B => { const n = B.c.length, c = B.c, tr = c.map((_, i) => i ? Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - c[i-1]), Math.abs(B.l[i] - c[i-1])) : B.h[i] - B.l[i]);
      const pd = [0], md = [0]; for (let i = 1; i < n; i++) { const u = B.h[i] - B.h[i-1], d = B.l[i-1] - B.l[i]; pd.push(u > d && u > 0 ? u : 0); md.push(d > u && d > 0 ? d : 0); }
      const at = rma(tr, 14), P = rma(pd, 14), Mm = rma(md, 14), dx = at.map((a, i) => { const p = 100*P[i]/a, m = 100*Mm[i]/a; return isNaN(p) ? NaN : 100*Math.abs(p - m)/((p + m) || 1); }), ADX = rma(dx, 14);
      const CH = new Array(n).fill(NaN); for (let i = 13; i < n; i++) { let st = 0, hh = -1e18, ll = 1e18; for (let j = i - 13; j <= i; j++) { st += tr[j]; hh = Math.max(hh, B.h[j]); ll = Math.min(ll, B.l[j]); } CH[i] = hh > ll ? 100*Math.log10(st/(hh - ll))/Math.log10(14) : NaN; }
      const at50 = rma(tr, 50), m20 = sma(c, 20), sd = c.map((_, i) => { if (i < 19) return NaN; let q = 0; for (let j = i - 19; j <= i; j++) q += (c[j] - m20[i])**2; return Math.sqrt(q/20); }), bbw = sd.map((x, i) => 4*x/m20[i]), bbwM = sma(bbw.map(x => isNaN(x) ? 0 : x), 50);
      const vm = sma(B.v, 20), ER = c.map((_, i) => { if (i < 20) return NaN; let q = 0; for (let j = i - 19; j <= i; j++) q += Math.abs(c[j] - c[j-1]); return q ? Math.abs(c[i] - c[i-20])/q : 0; });
      const RSI = (() => { const g = [0], l = [0]; for (let i = 1; i < n; i++) { const d = c[i] - c[i-1]; g.push(Math.max(d, 0)); l.push(Math.max(-d, 0)); } const G = rma(g, 14), L = rma(l, 14); return G.map((x, i) => L[i] ? 100 - 100/(1 + x/L[i]) : 100); })();
      return { ADX, CH, AR: at.map((x, i) => x/at50[i]), BB: bbw.map((x, i) => x > bbwM[i] ? 1 : 0), VOL: B.v.map((x, i) => x > vm[i] ? 1 : 0), ER, RSI }; };
    const HTF = (B, Bh, TFh) => B.t.map(t => { const j = Bh.idx.get(Math.floor((t + 18e5)/TFh)*TFh - TFh); return j === undefined ? 0 : Bh.Z[j]; });   // آخر شمعة أعلى مسكّرة لما تسكّر شمعة الـ30د
    const BB = {}; for (const s of COINS) { const B = aggV(D[s], 18e5); B.I = IND(B); B.H1 = HTF(B, aggV(D[s], 36e5), 36e5); B.H4 = HTF(B, { ...B4[s], Z: B4[s].zl12 }, H4); B.M15 = (() => { const b = aggV(D[s], 9e5); return B.t.map(t => { const j = b.idx.get(t + 9e5); return j === undefined ? 0 : b.Z[j]; }); })(); BB[s] = B; }
    out.push("## فلاتر حالة السوق فوق الغريد الحالي · 30د Zero Lag ×1.2 · درجة 3% · وقف 3% · +1%←0.3% · صفقة 50$ · الفلتر بيمنع الدخول بس", "الفلتر | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · صافي · PF)").join(" | "));
    const VV = [["الحالي (بدون فلتر)", () => 1], ["ADX ≥ 20 (في ترند)", (B, j) => B.I.ADX[j] >= 20], ["ADX ≥ 25", (B, j) => B.I.ADX[j] >= 25], ["Choppiness < 55 (مش تذبذب)", (B, j) => B.I.CH[j] < 55], ["Choppiness < 50", (B, j) => B.I.CH[j] < 50],
      ["ATR 14 > ATR 50 (السوق عم يتحرك)", (B, j) => B.I.AR[j] > 1], ["عرض البولنجر فوق معدله", (B, j) => B.I.BB[j] === 1], ["فوليوم فوق معدل 20", (B, j) => B.I.VOL[j] === 1], ["Efficiency Ratio ≥ 0.3 (حركة نظيفة)", (B, j) => B.I.ER[j] >= 0.3],
      ["بلا ملاحقة: RSI لونج < 70 / شورت > 30", (B, j, d) => d === 1 ? B.I.RSI[j] < 70 : B.I.RSI[j] > 30], ["Zero Lag ساعة متفق", (B, j, d) => B.H1[j] === d], ["Zero Lag 4س متفق", (B, j, d) => B.H4[j] === d], ["Zero Lag 15د متفق (أسرع)", (B, j, d) => B.M15[j] === d],
      ["ADX ≥ 20 + Choppiness < 55", (B, j) => B.I.ADX[j] >= 20 && B.I.CH[j] < 55]];
    for (const [nm, f] of VV) out.push(`${nm} | ` + P.map(([, a, b]) => { const c = st(COINS.flatMap(s => { const B = BB[s], T = B.Z.map((z, j) => z && f(B, j, z) ? z : 0); return grid(D[s], B, T, a, b, 0.03, 1, 1, 0.25, 18e5, [0.01, 0.003]); })); return `${c.n} · ${c.w}/${c.l} · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_TP2) {   // 27/11 10:46 (طلب المستخدم): هدف ثابت 2.5% ووقف 0.7% مقابل الحالي
    const aggB = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); return B; };
    const BB = {}; for (const s of COINS) BB[s] = aggB(D[s], 18e5);
    out.push("## هدف ثابت + وقف قريب مقابل الحالي · 30د Zero Lag ×1.2 · درجة 3% · صفقة 50$ · الوقف من سعر الدرجة متل البوت · الهدف ليمت (ميكر)", "الإعداد | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الربح · معدل الخسارة · صافي · PF)").join(" | "));
    const VV = [["الحالي: وقف 3% · بعد +1% بيلحق 0.3% · قفل", 1, 0.25, [0.01, 0.003], 0], ["⭐ هدف 2.5% · وقف 0.7% (الطلب)", 0.7/3, 0, null, 0.025], ["هدف 2.5% · وقف 1%", 1/3, 0, null, 0.025], ["هدف 2.5% · وقف 1.5%", 0.5, 0, null, 0.025], ["هدف 2.5% · وقف 3%", 1, 0, null, 0.025], ["وقف 0.7% · بعد +1% بيلحق 0.3% (بدون هدف)", 0.7/3, 0, [0.01, 0.003], 0]];
    for (const [nm, tr, lk, pc, tp] of VV) out.push(`${nm} | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], BB[s], BB[s].Z, a, b, 0.03, tr, 1, lk, 18e5, pc, 0, tp)); const c = st(all); const ws = all.filter(x => x.r > 0), ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · +${(50*ws.reduce((q, x) => q + x.r, 0)/Math.max(1, ws.length)).toFixed(2)}$ · ${(50*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_GAP) { const aggB = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); return B; };
    // 27/11 10:07 (طلب المستخدم «اه افحص»): الرابحة بتتسكر على +0.3..0.7$ والخسرانة −3$ ← نكبّر مسافة التتبع و/أو نقصّر الوقف
    const BB = {}; for (const s of COINS) BB[s] = aggB(D[s], 18e5);
    out.push("## مسافة التتبع × الوقف الأول · 30د Zero Lag ×1.2 · درجة 3% · قفل 0.25 · عملة وحدة صفقة وحدة · صفقة 50$", "الوقف | التتبع | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الربح · معدل الخسارة · صافي · PF)").join(" | "));
    const PC = [["+1.0% ← 0.3% (الحالي)", [0.01, 0.003]], ["+1.0% ← 0.6%", [0.01, 0.006]], ["+1.5% ← 0.5%", [0.015, 0.005]], ["+1.5% ← 0.8%", [0.015, 0.008]], ["+2% ← 1%", [0.02, 0.01]], ["+3% ← 1.5%", [0.03, 0.015]], ["بدون تتبع نسبة (درجات بس)", null]];
    for (const tr of [2, 1.5, 1]) for (const [nm, pc] of PC) out.push(`${(tr*3).toFixed(1)}%${tr === 2 && pc && pc[1] === 0.003 ? " ⭐" : ""} | ${nm} | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], BB[s], BB[s].Z, a, b, 0.03, tr, 1, 0.25, 18e5, pc)); const c = st(all); const ws = all.filter(x => x.r > 0), ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · +${(50*ws.reduce((q, x) => q + x.r, 0)/Math.max(1, ws.length)).toFixed(2)}$ · ${(50*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_TP) { const aggB = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); return B; };
    const BB = {}; for (const s of COINS) BB[s] = aggB(D[s], 18e5);
    out.push("## هدف ثابت مقابل الوقف المتحرك · 30د Zero Lag · 3% · وقف 6% · صفقة 50$ (الهدف ليمت: عمولة ميكر)", "الطريقة | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الربح · معدل الخسارة · صافي · PF)").join(" | "));
    const VV = [["الحالي: +1.0% ← بيلحق 0.3%", [0.01, 0.003], 0], ["هدف ثابت 1%", null, 0.01], ["هدف ثابت 1.5%", null, 0.015], ["هدف ثابت 2%", null, 0.02], ["هدف ثابت 3%", null, 0.03], ["هدف ثابت 5%", null, 0.05], ["هدف ثابت 8%", null, 0.08], ["هدف 3% + قبله بيلحق (1.0%←0.3%)", [0.01, 0.003], 0.03], ["هدف 5% + قبله بيلحق (1.0%←0.3%)", [0.01, 0.003], 0.05]];
    for (const [nm, pc, tp] of VV) out.push(`${nm} | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], BB[s], BB[s].Z, a, b, 0.03, 2, 1, pc ? 0.25 : 0, 18e5, pc, 0, tp)); const c = st(all); const ws = all.filter(x => x.r > 0), ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · +${(50*ws.reduce((q, x) => q + x.r, 0)/Math.max(1, ws.length)).toFixed(2)}$ · ${(50*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_FLIP) { const aggB = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); return B; };
    const BB = {}; for (const s of COINS) BB[s] = aggB(D[s], 18e5);
    out.push("## الصفقة الخسرانة لما الترند (30د) ينقلب ضدها · 3% · وقف 6% · +1.0%←0.3% · صفقة 50$", "الطريقة | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الخسارة · صافي · PF)").join(" | "));
    for (const [nm, fl] of [["نستنى الوقف (الحالي)", 0], ["نسكّرها لما الترند ينقلب (رابحة أو خسرانة)", 1], ["نسكّرها لما الترند ينقلب بس إذا خسرانة", 2], ["نسكّرها ونقلب فوراً ماركت مع الترند الجديد", 3]])
      out.push(`${nm} | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], BB[s], BB[s].Z, a, b, 0.03, 2, 1, 0.25, 18e5, [0.01, 0.003], fl)); const c = st(all); const ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · ${(50*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_TF) { out.push("## فريم الاتجاه (Zero Lag ×1.2) · 3% · وقف 6% · بعد +1.0% بيلحق 0.3% · صفقة 50$", "الفريم | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · صافي · PF)").join(" | "));
    const aggB = (X, TF) => { const m = new Map(); for (let i = 0; i < X.t.length; i++) { const b = Math.floor(X.t[i]/TF)*TF; let y = m.get(b); if (!y) { y = { h: -1e18, l: 1e18, c: 0 }; m.set(b, y); } if (X.h[i] > y.h) y.h = X.h[i]; if (X.l[i] < y.l) y.l = X.l[i]; y.c = X.c[i]; } const ks = [...m.keys()].sort((a, b) => a - b); const B = { t: ks, h: ks.map(k => m.get(k).h), l: ks.map(k => m.get(k).l), c: ks.map(k => m.get(k).c) }; B.idx = new Map(ks.map((t, j) => [t, j])); B.Z = zl(B, 70, 1.2); return B; };
    for (const [nm, TF] of [["5 دقايق", 3e5], ["15 دقيقة", 9e5], ["30 دقيقة", 18e5], ["ساعة", 36e5], ["ساعتين", 72e5], ["4 ساعات (الحالي)", H4]]) {
      const BB = {}; for (const s of COINS) BB[s] = TF === H4 ? { ...B4[s], Z: B4[s].zl12 } : aggB(D[s], TF);
      out.push(`${nm} | ` + P.map(([, a, b]) => { const c = st(COINS.flatMap(s => grid(D[s], BB[s], BB[s].Z, a, b, 0.03, 2, 1, 0.25, TF, [0.01, 0.003]))); return `${c.n} · ${c.w}/${c.l} · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | ")); }
    out.push(""); }
  if (process.env.GRID_PCT) { out.push("## ربح أكتر؟ (3% · وقف 6% · 4س Zero Lag) · صفقة 50$", "الإعداد | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الربح · معدل الخسارة · صافي · PF)").join(" | "));
    const VV = [["الحالي: +1.2% بيلحق 0.5% · 1 درجة", [0.012, 0.005], 1], ["+1.2% بيلحق 0.3%", [0.012, 0.003], 1], ["+1.0% بيلحق 0.3%", [0.010, 0.003], 1], ["+0.8% بيلحق 0.3%", [0.008, 0.003], 1], ["+1.5% بيلحق 0.5%", [0.015, 0.005], 1], ["+2% بيلحق 0.7%", [0.02, 0.007], 1], ["+3% بيلحق 1%", [0.03, 0.01], 1], ["الحالي بس 2 درجات/عملة", [0.012, 0.005], 2], ["+1.2% بيلحق 0.3% · 2 درجات", [0.012, 0.003], 2]];
    for (const [nm, pc, mx] of VV) out.push(`${nm} | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], B4[s], B4[s].zl12, a, b, 0.03, 2, mx, 0.25, H4, pc)); const c = st(all); const ws = all.filter(x => x.r > 0), ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · +${(50*ws.reduce((q, x) => q + x.r, 0)/Math.max(1, ws.length)).toFixed(2)}$ · ${(50*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.5)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_STOPS) { out.push("## الوقف الأول (درجة 3% · صفقة وحدة لكل عملة · بعد +1.2% بيلحق 0.5%) · كل الأرقام لصفقة 75$", "الوقف | " + P.map(p => p[0] + " (صفقات · ربح/خسارة · معدل الخسارة · صافي · PF)").join(" | "));
    for (const tr of [1, 1.5, 2, 2.5, 3]) out.push(`${(tr*3).toFixed(1)}% | ` + P.map(([, a, b]) => { const all = COINS.flatMap(s => grid(D[s], B4[s], B4[s].zl12, a, b, 0.03, tr, 1, 0.25, H4, [0.012, 0.005])); const c = st(all); const ls = all.filter(x => x.r <= 0); return `${c.n} · ${c.w}/${c.l} · ${(75*ls.reduce((q, x) => q + x.r, 0)/Math.max(1, ls.length)).toFixed(2)}$ · ${f$(c.net*0.75)} · PF ${c.pf.toFixed(2)}`; }).join(" | "));
    out.push(""); }
  if (process.env.GRID_COINS) { out.push("## كل عملة لحالها (الإعداد الحالي: 3% · وقف 9% · بعد +1.2% بيلحق 0.5%)", "عملة | من | " + P.map(p => p[0]).join(" | "));
    for (const s of COINS) out.push(`${s.replace("USDT", "")} | ${new Date(D[s].t[0]).toISOString().slice(0, 10)} | ` + P.map(([, a, b]) => { const c = st(grid(D[s], B4[s], B4[s].zl12, a, b, 0.03, 3, 5, 0.25, H4, [0.012, 0.005])); return `${c.n} · ${c.w}/${c.l} · ${f$(c.net)} · PF ${c.pf.toFixed(2)}`; }).join(" | ")); out.push(""); }
  for (const [set, coins] of [["AKE+EVAA", COINS.slice(0, 2)], ["كل العملات", COINS]]) {
    out.push(`## ${set}`, "فلتر | درجة | وقف | " + P.map(p => p[0] + " (صفقات · ربح · خسارة · صافي · PF)").join(" | "));
    const rows = [];
    for (const v of V) { const cells = P.map(([, a, b]) => st(coins.flatMap(s => grid(D[s], B4[s], B4[s][v.f], a, b, v.step, v.trail, 5, v.lock || 0, H4, v.pct)))); rows.push({ v, cells }); }
    rows.sort((x, y) => y.cells[0].net + y.cells[1].net - x.cells[0].net - x.cells[1].net);
    for (const { v, cells } of rows) out.push(`${v.nm || v.f} | ${(v.step*100).toFixed(1)}% | ${v.trail} | ` + cells.map(c => `${c.n} · ${c.w} (${f$(c.W)}) · ${c.l} (${f$(c.L)}) · ${f$(c.net)} · ${c.pf.toFixed(2)}${c.net > 0 && c.pf > 1.1 ? " ✅" : c.net > 0 ? " 🟡" : " ❌"}`).join(" | "));
    out.push("");
  }
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", process.env.GRID_COINS ? "grid1m_scan.txt" : "grid1m_pct.txt"), out.join("\n") + "\n"); console.log(out.join("\n"));
})().catch(e => { console.error(e); process.exit(1); });
