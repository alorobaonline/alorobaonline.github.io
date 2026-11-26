// 26/11 22:10 (طلب المستخدم: «لازم يكون في حل انحصل نتائج مربحه»): غريد الزخم على شموع الدقيقة — تنفيذ واقعي زي الحقيقي
// الحقيقي اليوم خسر وهو بالمنصة (15د) و5د بيربح ← بنفحص على 1د مع فرق سعر الدخول/الوقف + العمولة، ومنقارن درجات/وقوف/فلاتر
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DATA = process.env.NEXORA_DATA || path.join(require("os").homedir(), ".nexora-data");
const M1 = 60000, H4 = 4*3600e3, DAY = 864e5;
const START = Date.UTC(2026, 8, 1), SPLIT = Date.UTC(2026, 10, 1), RESET = Date.UTC(2026, 10, 16, 13, 45);
const FEE = 0.0005, SLIP_IN = 0.0015, SLIP_OUT = 0.001;   // تيكر 0.05% · دخول ماركت أسوأ 0.15% (الحقيقي اليوم 0.14%) · وقف ماركت 0.1%
const COINS = ["AKEUSDT", "EVAAUSDT", "SOPHUSDT", "BLURUSDT", "STRKUSDT", "TRUMPUSDT", "GALAUSDT", "DOTUSDT", "TIAUSDT", "WLDUSDT"];
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
  return { t: ks, o: ks.map(k => +rows.get(k)[1]), h: ks.map(k => +rows.get(k)[2]), l: ks.map(k => +rows.get(k)[3]), c: ks.map(k => +rows.get(k)[4]) };
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
// ---- الغريد بتنفيذ الحقيقي: درجة وحدة لكل قطعة مسار (الأقرب للسعر) · دخول أسوأ · وقف ماركت أسوأ ----
function grid(D, B4, T4, from, to, step, trail, maxN = 5, lock = 0, TF = H4, pct = null) {   // pct = [تفعيل, مسافة]: بعد ما الربح يوصل تفعيل، الوقف بيلحق أعلى ربح بمسافة (زي TRAILING_STOP_MARKET تبع بايننس)   // lock = بعد ما تربح درجة: الوقف بيصير فوق الدخول بجزء من درجة (0 = على الدخول · 0.5 = نص درجة)
  const out = [], g = Math.log(1 + step); let i0 = D.t.findIndex(t => t >= from); if (i0 < 0) return out;
  const A = D.o[i0], K = p => Math.log(p/A)/g, LV = k => A*Math.pow(1 + step, k), legs = [];
  const tAt = t => { const b = Math.floor(t/TF)*TF - TF, j = B4.idx.get(b); return j === undefined ? 0 : T4[j]; };
  const stopK = q => q.d === 1 ? (q.best >= q.k + 1 ? Math.max(q.best - trail, q.k) : q.k - trail) : (q.best <= q.k - 1 ? Math.min(q.best + trail, q.k) : q.k + trail);
  const exit = (q, px, t) => { legs.splice(legs.indexOf(q), 1); const x = px*(1 - q.d*SLIP_OUT); out.push({ t, d: q.d, r: q.d*(x/q.fill - 1) - 2*FEE }); };
  let prev = D.o[i0];
  for (let i = i0; i < D.t.length && D.t[i] < to; i++) {
    const tr = tAt(D.t[i]), path = D.c[i] >= D.o[i] ? [D.o[i], D.l[i], D.h[i], D.c[i]] : [D.o[i], D.h[i], D.l[i], D.c[i]];
    for (const p of path) { if (p === prev) continue; const up = p > prev;
      // الوقوف أول (بايننس بتنفّذها لحالها)
      if (pct) for (const q of legs) { const f = q.d*(p/q.fill - 1); if (!(q.mfe >= f)) q.mfe = f; }
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
if (require.main !== module) module.exports = { grid, zl, emaT, st };
else (async () => {
  const D = {}, B4 = {};
  await Promise.all(COINS.map(async s => { D[s] = await klines(s, "1m", START); const k4 = await klines(s, "4h", START - 200*DAY);
    B4[s] = { ...k4, idx: new Map(k4.t.map((t, j) => [t, j])) }; B4[s].zl12 = zl(k4, 70, 1.2); B4[s].zl2 = zl(k4, 70, 2); B4[s].ema = emaT(k4); B4[s].none = new Int8Array(k4.t.length); }));
  const END = Math.min(...COINS.map(s => D[s].t[D[s].t.length - 1] + M1));
  const V = [{ f: "zl12", step: 0.03, trail: 3, lock: 0.25, pct: null, nm: "الحالي: وقف 3 درجات + قفل ربع" }, ...[[0.012, 0.005], [0.01, 0.005], [0.015, 0.007], [0.02, 0.01], [0.03, 0.015], [0.012, 0.003]].map(x => ({ f: "zl12", step: 0.03, trail: 3, lock: 0.25, pct: x, nm: `بعد +${x[0]*100}% بيلحق ${x[1]*100}%` })), { f: "zl12", step: 0.015, trail: 2, lock: 0.25, pct: [0.012, 0.005], nm: "درجة 1.5% + بعد +1.2% بيلحق 0.5%" }];
  const P = [["أيلول+تشرين1", START, SPLIT], ["تشرين2 (فحص)", SPLIT, END], ["من التصفير", RESET, END]];
  const out = [`# غريد الزخم على شموع الدقيقة · تنفيذ واقعي: دخول ماركت +0.15% · وقف +0.1% · عمولة 0.05%×2 · درجة وحدة لكل حركة · حتى 5 درجات`,
    `# من ${new Date(START).toISOString().slice(0, 10)} لـ ${new Date(END).toISOString().slice(0, 16)} · كل الأرقام لكل صفقة 100$`, ""];
  for (const [set, coins] of [["AKE+EVAA", COINS.slice(0, 2)], ["10 عملات", COINS]]) {
    out.push(`## ${set}`, "فلتر | درجة | وقف | " + P.map(p => p[0] + " (صفقات · ربح · خسارة · صافي · PF)").join(" | "));
    const rows = [];
    for (const v of V) { const cells = P.map(([, a, b]) => st(coins.flatMap(s => grid(D[s], B4[s], B4[s][v.f], a, b, v.step, v.trail, 5, v.lock || 0, H4, v.pct)))); rows.push({ v, cells }); }
    rows.sort((x, y) => y.cells[0].net + y.cells[1].net - x.cells[0].net - x.cells[1].net);
    for (const { v, cells } of rows) out.push(`${v.nm || v.f} | ${(v.step*100).toFixed(1)}% | ${v.trail} | ` + cells.map(c => `${c.n} · ${c.w} (${f$(c.W)}) · ${c.l} (${f$(c.L)}) · ${f$(c.net)} · ${c.pf.toFixed(2)}${c.net > 0 && c.pf > 1.1 ? " ✅" : c.net > 0 ? " 🟡" : " ❌"}`).join(" | "));
    out.push("");
  }
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", "grid1m_pct.txt"), out.join("\n") + "\n"); console.log(out.join("\n"));
})().catch(e => { console.error(e); process.exit(1); });
