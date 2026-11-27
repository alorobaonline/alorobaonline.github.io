// 27/11 (طلب المستخدم: «تمام» بعد فحص تريدنج فيو على INIT): استراتيجية الفيديو "3 Free Trend Indicators Combined" بالحرف على شموع الدقيقة
// 4 setups: ST 5m (فلتر ST 15m، 9:30-15:30 NY، طلوع بيع ST5 / وقف 2×ATR / 4pm، لونج) · Ultimate MA 4m (Sling Shot 15m، أي ساعة، Chandelier 4m، لونج)
// AlphaTrend 2m (ADX 2m ≥ 20، 9:30-11:30، عكسية / 4pm، الجهتين) · AlphaTrend 1h (جهة EMA200 1h، 10-15، عكسية / وقف 2×ATR / 4pm، الجهتين)
// صفقة وحدة لكل عملة · أول setup بياخد الصفقة وبيقرر الطلوع · $50 للصفقة · نفس منطق NEXORA 3T PRO.pine
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DATA = process.env.NEXORA_DATA || path.join(require("os").homedir(), ".nexora-data");
const M1 = 60000, H4 = 4*3600e3, DAY = 864e5;
const START = Date.UTC(2026, 8, 1), SPLIT = Date.UTC(2026, 10, 1), RESET = Date.UTC(2026, 10, 16, 13, 45);
const FEE = 0.0005, SLIP_IN = 0.001, SLIP_OUT = 0.001;   // تيكر 0.05% بكل جهة · دخول ماركت بعد إغلاق الشمعة 0.1% · طلوع 0.1%
const COINS = (process.env.TRI_COINS || "BTCUSDT,ETHUSDT,AKEUSDT,EVAAUSDT,JCTUSDT,IDOLUSDT,AINUSDT,AGTUSDT,BLESSUSDT,BULLAUSDT,INITUSDT,ONUSDT,ARIAUSDT,BTWUSDT").split(",");
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

const NOTIONAL = 50;
// ---- أدوات المؤشرات (متل باين) ----
const rma = (x, p) => { const o = new Array(x.length).fill(NaN); let s = 0, k = 0; for (let i = 0; i < x.length; i++) { if (isNaN(x[i])) continue; if (k < p) { s += x[i]; k++; if (k === p) o[i] = s/p; } else o[i] = (o[i-1]*(p - 1) + x[i])/p; } return o; };
const sma = (x, p) => { const o = new Array(x.length).fill(NaN); let s = 0; for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= p) s -= x[i-p]; if (i >= p - 1) o[i] = s/p; } return o; };
const ema = (x, p) => { const a = 2/(p + 1), o = [x[0]]; for (let i = 1; i < x.length; i++) o.push(a*x[i] + (1 - a)*o[i-1]); return o; };
const trA = B => B.c.map((_, i) => i ? Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - B.c[i-1]), Math.abs(B.l[i] - B.c[i-1])) : B.h[i] - B.l[i]);
function agg(D, tf) { const ms = tf*60000, o = { t: [], o: [], h: [], l: [], c: [], v: [] }; let cur = -1;
  for (let i = 0; i < D.t.length; i++) { const b = Math.floor(D.t[i]/ms)*ms;
    if (b !== cur) { cur = b; o.t.push(b); o.o.push(D.o[i]); o.h.push(D.h[i]); o.l.push(D.l[i]); o.c.push(D.c[i]); o.v.push(D.v[i]); }
    else { const k = o.t.length - 1; o.h[k] = Math.max(o.h[k], D.h[i]); o.l[k] = Math.min(o.l[k], D.l[i]); o.c[k] = D.c[i]; o.v[k] += D.v[i]; } }
  return o; }
function stDir(B, len = 10, mult = 3) { const atr = rma(trA(B), len), n = B.c.length, d = new Int8Array(n); let up = NaN, dn = NaN, dir = 1;
  for (let i = 0; i < n; i++) { const src = (B.h[i] + B.l[i])/2; let u = src - mult*atr[i], w = src + mult*atr[i]; const u1 = isNaN(up) ? u : up, d1 = isNaN(dn) ? w : dn;
    if (i && B.c[i-1] > u1) u = Math.max(u, u1); if (i && B.c[i-1] < d1) w = Math.min(w, d1);
    if (!isNaN(atr[i])) { if (dir === -1 && B.c[i] > d1) dir = 1; else if (dir === 1 && B.c[i] < u1) dir = -1; up = u; dn = w; } d[i] = isNaN(atr[i]) ? 0 : dir; } return d; }
function maDir(B, len = 20, sm = 2) { const m = sma(B.c, len); return m.map((x, i) => i < len + sm ? 0 : (x >= m[i-sm] ? 1 : -1)); }
function atDir(B, coef = 1, len = 14) { const n = B.c.length, tr = trA(B), atr = sma(tr, len), tp = B.c.map((c, i) => (B.h[i] + B.l[i] + c)/3), d = new Int8Array(n), A = new Array(n).fill(0); let dir = 0;
  for (let i = 0; i < n; i++) { let up = 0, lo = 0; if (i >= len) for (let j = i - len + 1; j <= i; j++) { const ch = tp[j] - tp[j-1]; if (ch > 0) up += B.v[j]*tp[j]; else if (ch < 0) lo += B.v[j]*tp[j]; }
    const mfi = lo ? 100 - 100/(1 + up/lo) : 100, prev = i ? A[i-1] : 0, uT = B.l[i] - atr[i]*coef, dT = B.h[i] + atr[i]*coef;
    A[i] = isNaN(atr[i]) ? 0 : (mfi >= 50 ? (uT < prev ? prev : uT) : (dT > prev ? prev : dT));
    if (i >= 2 && !isNaN(atr[i])) { if (A[i] > A[i-2]) dir = 1; else if (A[i] < A[i-2]) dir = -1; } d[i] = i > 2*len ? dir : 0; } return d; }
function ceDir(B, len = 22, mult = 3) { const n = B.c.length, atr = rma(trA(B), len), d = new Int8Array(n); let ls = NaN, ss = NaN, dir = 1;
  for (let i = 0; i < n; i++) { if (isNaN(atr[i])) continue; let hi = -Infinity, lo = Infinity; for (let j = Math.max(0, i - len + 1); j <= i; j++) { hi = Math.max(hi, B.c[j]); lo = Math.min(lo, B.c[j]); }
    let l = hi - mult*atr[i], s = lo + mult*atr[i]; const lp = isNaN(ls) ? l : ls, sp = isNaN(ss) ? s : ss;
    if (B.c[i-1] > lp) l = Math.max(l, lp); if (B.c[i-1] < sp) s = Math.min(s, sp);
    if (B.c[i] > sp) dir = 1; else if (B.c[i] < lp) dir = -1; ls = l; ss = s; d[i] = dir; } return d; }
function adx(B, len = 14) { const n = B.c.length, pd = [0], md = [0]; for (let i = 1; i < n; i++) { const u = B.h[i] - B.h[i-1], dw = B.l[i-1] - B.l[i]; pd.push(u > dw && u > 0 ? u : 0); md.push(dw > u && dw > 0 ? dw : 0); }
  const tr = rma(trA(B), len), p = rma(pd, len), m = rma(md, len), dx = tr.map((t, i) => { const P = 100*p[i]/t, M = 100*m[i]/t; return isNaN(P) ? NaN : Math.abs(P - M)/((P + M) || 1); }); return rma(dx, len).map(x => 100*x); }
// قيمة الشمعة الأعلى المسكّرة عند كل شمعة دقيقة: بتصير معروفة بعد إغلاق آخر دقيقة فيها
function onM1(D, B, tf, arr) { const ms = tf*60000, out = new Float64Array(D.t.length).fill(NaN); let k = -1;
  const idx = new Map(B.t.map((t, i) => [t, i]));
  for (let i = 0; i < D.t.length; i++) { const end = D.t[i] + 60000; if (end % ms === 0) { const j = idx.get(end - ms); if (j !== undefined) k = j; } out[i] = k >= 0 ? arr[k] : NaN; } return out; }
// ساعات نيويورك (EDT لـ 1 نوف 2026، بعدين EST)
const nyMin = t => { const off = t < Date.UTC(2026, 10, 1, 6) ? 4 : 5; const d = new Date(t - off*3600e3); return d.getUTCHours()*60 + d.getUTCMinutes(); };
const inWin = (t, a, b) => { const m = nyMin(t); return m >= a && m < b; };

function run(D, I, hours, lim = null) {   // lim: { x: نسبة الرجعة تحت سعر الإشارة (أو "low" = قاع شمعة الإشارة) , ttl: دقايق }
  const n = D.t.length, trades = []; let pos = 0, setup = 0, ent = 0, et = 0, stop = NaN, fin = FEE, pend = null, sig = 0, fills = 0;
  const flip = (a, i, d) => a[i] === d && a[i-1] === -d;
  const close = (i, px, why) => { const r = pos*(px/ent - 1) - fin - FEE; trades.push({ t: et, setup, side: pos, r, why }); pos = 0; setup = 0; };
  const exitSig = (s, d, i, t) => (s === 1 && flip(I.st5, i, -1)) || (s === 2 && flip(I.ce4, i, -1)) || (s === 3 && flip(I.at2, i, -d)) || (s === 4 && flip(I.at60, i, -d)) || (hours && s !== 2 && inWin(t, 960, 1080));
  for (let i = 1; i < n - 1; i++) {
    const t = D.t[i] + 60000;
    if (t < START) continue;
    if (pend) {   // أمر ليمت معلّق: بيتنفّذ إذا السعر لمسه بهالشمعة
      const hit = pend.d === 1 ? D.l[i] <= pend.px : D.h[i] >= pend.px;
      if (hit) { fills++; pos = pend.d; setup = pend.s; et = t; ent = pend.d === 1 ? Math.min(pend.px, D.o[i]) : Math.max(pend.px, D.o[i]); fin = 0.0002;
        stop = pend.s === 1 ? ent - 2*pend.atr : pend.s === 4 ? ent - pend.d*2*pend.atr : NaN; pend = null; continue; }
      if (t >= pend.exp || exitSig(pend.s, pend.d, i, t)) pend = null; else continue; }
    if (pos) {
      if (!isNaN(stop) && (pos === 1 ? D.l[i] <= stop : D.h[i] >= stop)) { const px = (pos === 1 ? Math.min(stop, D.o[i]) : Math.max(stop, D.o[i]))*(1 - pos*SLIP_OUT); close(i, px, "stop"); continue; }
      let why = "";
      if (setup === 1 && flip(I.st5, i, -1)) why = "st5";
      if (setup === 2 && flip(I.ce4, i, -1)) why = "ce4";
      if (setup === 3 && flip(I.at2, i, -pos)) why = "opp";
      if (setup === 4 && flip(I.at60, i, -pos)) why = "opp";
      if (hours && setup !== 2 && inWin(t, 960, 1080)) why = why || "4pm";
      if (why) close(i, D.c[i]*(1 - pos*SLIP_OUT), why);
      continue; }
    const W = (a, b) => !hours || inWin(t, a, b);
    let s = 0, d = 0;
    if (flip(I.st5, i, 1) && I.st15[i] === 1 && W(570, 930)) { s = 1; d = 1; }
    else if (flip(I.ma4, i, 1) && I.sl15[i] === 1) { s = 2; d = 1; }
    else if ((flip(I.at2, i, 1) || flip(I.at2, i, -1)) && I.adx2[i] >= 20 && W(570, 690)) { s = 3; d = I.at2[i]; }
    else if ((flip(I.at60, i, 1) || flip(I.at60, i, -1)) && I.e60[i] === I.at60[i] && W(600, 900)) { s = 4; d = I.at60[i]; }
    if (!s) continue;
    sig++;
    const atr = s === 1 ? I.atr5[i] : I.atr60[i];
    if (lim) { const px = lim.x === "low" ? (d === 1 ? D.l[i] : D.h[i]) : lim.x === "mid" ? (D.h[i] + D.l[i])/2 : D.c[i]*(1 - d*lim.x);
      pend = { s, d, px, atr, exp: t + lim.ttl*60000 }; continue; }
    pos = d; setup = s; et = t; ent = D.c[i]*(1 + d*SLIP_IN); fin = FEE;
    stop = s === 1 ? ent - 2*atr : s === 4 ? ent - d*2*atr : NaN; }
  trades.sig = sig; trades.fills = fills;
  return trades;
}
function syn(sym) { let seed = sym.length*7919, x = 100; const r = () => (seed = (seed*16807) % 2147483647)/2147483647; const D = { t: [], o: [], h: [], l: [], c: [], v: [] };
  for (let t = START - 15*DAY; t < Date.UTC(2026, 10, 27); t += 60000) { const o = x; x *= 1 + (r() - 0.5)*0.004; D.t.push(t); D.o.push(o); D.c.push(x); D.h.push(Math.max(o, x)*(1 + r()*0.001)); D.l.push(Math.min(o, x)*(1 - r()*0.001)); D.v.push(1 + r()); } return D; }
(async () => {
  const out = [`# NEXORA 3-Trend PRO (فيديو 3 Free Trend Indicators) — شموع الدقيقة · ${new Date().toISOString().slice(0, 16)}`,
    `# $${NOTIONAL}/صفقة · عمولة ${FEE*100}% بكل جهة · انزلاق دخول ${SLIP_IN*100}% طلوع ${SLIP_OUT*100}% · فترات: سبت-أكت | 1نوف-الريسيت | بعد الريسيت (16/11 13:45)`];
  const P = t => t >= RESET ? 2 : t >= SPLIT ? 1 : 0, PN = ["سبت-أكت", "نوف-ريسيت", "بعد الريسيت"];
  const ALL = {}, SIG = {}, FIL = {};
  const VAR = [["ماركت على فتحة الشمعة الجاية (الفيديو)", null], ["ليمت −0.3% · 30د", { x: 0.003, ttl: 30 }], ["ليمت −0.5% · 30د", { x: 0.005, ttl: 30 }], ["ليمت −1% · 30د", { x: 0.01, ttl: 30 }], ["ليمت −2% · 60د", { x: 0.02, ttl: 60 }], ["ليمت نص شمعة الإشارة · 30د", { x: "mid", ttl: 30 }], ["ليمت قاع شمعة الإشارة · 30د", { x: "low", ttl: 30 }]];
  for (const sym of COINS) {
    const D = process.env.TRI_SYN ? syn(sym) : await klines(sym, "1m", START - 15*DAY); if (!D.t.length) { out.push(sym + ": ما في داتا"); continue; }
    const B = {}; for (const tf of [2, 4, 5, 15, 60]) B[tf] = agg(D, tf);
    const e = (tf, a) => onM1(D, B[tf], tf, a);
    const I = { st5: e(5, stDir(B[5])), st15: e(15, stDir(B[15])), atr5: e(5, rma(trA(B[5]), 14)), ma4: e(4, maDir(B[4])),
      sl15: e(15, (() => { const f = ema(B[15].c, 38), g = ema(B[15].c, 62); return f.map((x, i) => i < 62 ? 0 : (x > g[i] ? 1 : -1)); })()), ce4: e(4, ceDir(B[4])),
      at2: e(2, atDir(B[2])), adx2: e(2, adx(B[2])), at60: e(60, atDir(B[60])), atr60: e(60, rma(trA(B[60]), 14)) };
    const e200 = ema(B[60].c, 200); I.e60 = e(60, B[60].c.map((c, i) => i < 200 ? 0 : (c > e200[i] ? 1 : -1)));
    for (const [k, lim] of VAR) { const T = run(D, I, 1, lim); T.forEach(x => x.sym = sym); ALL[k] = ALL[k] || []; ALL[k].push(...T); SIG[k] = (SIG[k] || 0) + T.sig; FIL[k] = (FIL[k] || 0) + (lim ? T.fills : T.length); }
    console.log(sym, "done"); }
  const st = a => { if (!a.length) return "—"; const w = a.filter(x => x.r > 0), l = a.filter(x => x.r <= 0), W = w.reduce((s, x) => s + x.r, 0), L = l.reduce((s, x) => s + x.r, 0);
    const gross = (W + L)/a.length + 2*FEE + SLIP_IN + SLIP_OUT;   // تقريبي
    return `${a.length} صفقة · ${w.length}✅ ${(NOTIONAL*W).toFixed(0)}$ / ${l.length}❌ ${(NOTIONAL*L).toFixed(0)}$ · صافي ${(NOTIONAL*(W + L)).toFixed(1)}$ · PF ${(W/(-L || 1e-9)).toFixed(2)} · قبل التكاليف/صفقة ${(100*gross).toFixed(2)}%`; };
  out.push("", "## وين نحط الدخول؟ ماركت مقابل ليمت على رجعة · بساعات الفيديو + 4pm · الليمت عمولة ميكر 0.02% بلا انزلاق · بينلغى إذا ما تنفّذ أو إذا إشارة الطلوع إجت قبله");
  for (const [k] of VAR) { out.push("", `### ${k} · تنفّذ ${FIL[k]} من ${SIG[k]} إشارة (${(100*FIL[k]/Math.max(1, SIG[k])).toFixed(0)}%)`);
    for (let p = 0; p < 3; p++) { const A = ALL[k].filter(x => P(x.t) === p); out.push(`${PN[p]}: الكل ${st(A)}`); out.push(`   UMA 4m: ${st(A.filter(x => x.setup === 2))} | الباقي: ${st(A.filter(x => x.setup !== 2))}`); } }
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", "tri1m.txt"), out.join("\n") + "\n"); console.log(out.join("\n"));
})();
