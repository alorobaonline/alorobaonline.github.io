// 25/11 19:35 (طلب المستخدم): Zero Lag Trend Signals (MTF) [AlgoAlpha] كما هو — سنتين على 15د/ساعة/4س/يوم
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DATA = process.env.NEXORA_DATA || path.join(require("os").homedir(), ".nexora-data");
const M15 = 900000, H4 = 16*M15, DAY = 864e5;
const START = Date.UTC(2024, 7, 16), SPLIT = START + Math.floor((Date.UTC(2026, 7, 16) - START)*2/3), END = Date.UTC(2026, 7, 16);
const FEE = { taker: 0.0005, maker: 0.0002, slip: 0.0001 };
async function dl(url, file, mark404) {
  if (fs.existsSync(file)) return true; if (fs.existsSync(file + ".404")) return false;
  for (let k = 0; k < 4; k++) { try { const r = await fetch(url); if (r.status === 404) { if (mark404) fs.writeFileSync(file + ".404", ""); return false; }
      if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; } } catch (e) {} await new Promise(z => setTimeout(z, 1500*(k+1))); }
  throw new Error("download failed " + url);
}
const csv = f => execSync(`unzip -p "${f}"`, { maxBuffer: 1 << 30 }).toString().split("\n").filter(l => /^\d/.test(l)).map(l => l.split(","));
function months(from, to) { const o = [], d = new Date(from); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); while (d.getTime() < to) { o.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); } return o; }
async function klines(sym) {
  const iv = "15m", now = Date.now(), thisM = new Date().toISOString().slice(0, 7), rows = new Map(), dir = path.join(DATA, iv, sym); fs.mkdirSync(dir, { recursive: true });
  const lastM = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  for (const m of months(START - 230*DAY, now).reverse()) { if (m === thisM) continue;
    const f = path.join(dir, `${m}.zip`);
    if (await dl(`https://data.binance.vision/data/futures/um/monthly/klines/${sym}/${iv}/${sym}-${iv}-${m}.zip`, f, m < lastM)) { for (const r of csv(f)) rows.set(+r[0], r); continue; }
    if (m < lastM) break;
    const [y, mo] = m.split("-").map(Number), days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) { const ds = `${m}-${String(d).padStart(2, "0")}`, fd = path.join(dir, `${ds}.zip`);
      if (await dl(`https://data.binance.vision/data/futures/um/daily/klines/${sym}/${iv}/${sym}-${iv}-${ds}.zip`, fd)) for (const r of csv(fd)) rows.set(+r[0], r); } }
  const s = new Date(); s.setUTCDate(1); s.setUTCHours(0, 0, 0, 0);
  for (let t = s.getTime(); t < now - DAY; t += DAY) { const ds = new Date(t).toISOString().slice(0, 10), fd = path.join(dir, `${ds}.zip`);
    if (await dl(`https://data.binance.vision/data/futures/um/daily/klines/${sym}/${iv}/${sym}-${iv}-${ds}.zip`, fd)) for (const r of csv(fd)) rows.set(+r[0], r); }
  return rows;
}
function build(rows) {
  const ks = [...rows.keys()].sort((a, b) => a - b); if (ks.length < 3000) return null;
  const t0 = Math.ceil(ks[0]/H4)*H4, n = Math.floor((ks[ks.length-1] - t0)/M15) + 1, D = { t0, o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n) };
  let p = +rows.get(ks[0])[1];
  for (let i = 0; i < n; i++) { const r = rows.get(t0 + i*M15); if (r) { const o = +r[1], c = +r[4]; D.o[i] = o; D.h[i] = Math.max(+r[2], o, c); D.l[i] = Math.min(+r[3], o, c); D.c[i] = c; p = c; } else D.o[i] = D.h[i] = D.l[i] = D.c[i] = p; }
  return D;
}




// Zero Lag Trend Signals (MTF) [AlgoAlpha] — نفس الكود: length 70 · mult 1.2 · ZLEMA + نطاق = أعلى ATR(70) آخر 210 شمعة × 1.2
function bars(D, k, alignDay) {   // تجميع 15د → فريم أكبر
  let s = 0, t0 = D.t0; if (alignDay) { t0 = Math.ceil(D.t0/DAY)*DAY; s = (t0 - D.t0)/M15; }
  const N = Math.floor((D.c.length - s)/k), o = [], h = [], l = [], c = [], t = [];
  for (let b = 0; b < N; b++) { const a = s + b*k; let hh = -Infinity, ll = Infinity; for (let j = a; j < a + k; j++) { if (D.h[j] > hh) hh = D.h[j]; if (D.l[j] < ll) ll = D.l[j]; } o.push(D.o[a]); h.push(hh); l.push(ll); c.push(D.c[a + k - 1]); t.push(t0 + b*k*M15); }
  return { o, h, l, c, t };
}
function zl(B, fromTs, mode, len = 70, mult = 1.2) {
  const n = B.c.length, c = B.c, lag = Math.floor((len - 1)/2), out = [];
  const z = new Array(n).fill(NaN), a = 2/(len + 1); let e = NaN;
  for (let i = 0; i < n; i++) { if (i < lag) continue; const x = c[i] + (c[i] - c[i - lag]); e = isNaN(e) ? x : a*x + (1 - a)*e; z[i] = e; }
  const atr = new Array(n).fill(NaN); let s = 0;
  for (let i = 0; i < n; i++) { const tr = i ? Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - c[i-1]), Math.abs(B.l[i] - c[i-1])) : B.h[i] - B.l[i];
    if (i < len) { s += tr; if (i === len - 1) atr[i] = s/len; } else atr[i] = (atr[i-1]*(len - 1) + tr)/len; }
  const vol = new Array(n).fill(NaN); for (let i = 0; i < n; i++) { let m = -Infinity, ok = false; for (let j = Math.max(0, i - 3*len + 1); j <= i; j++) if (!isNaN(atr[j])) { ok = true; if (atr[j] > m) m = atr[j]; } if (ok) vol[i] = m*mult; }
  const tr = new Int8Array(n); let T = 0;
  for (let i = 1; i < n; i++) { if (!isNaN(z[i]) && !isNaN(vol[i]) && !isNaN(z[i-1]) && !isNaN(vol[i-1])) {
      if (c[i] > z[i] + vol[i] && c[i-1] <= z[i-1] + vol[i-1]) T = 1;
      if (c[i] < z[i] - vol[i] && c[i-1] >= z[i-1] - vol[i-1]) T = -1; } tr[i] = T; }
  let pos = null; const RT = 2*FEE.taker + 2*FEE.slip;
  const close = (i, x) => { out.push({ sig: B.t[pos.i], d: pos.d, why: "flip", pct: 100*(pos.d*(x/pos.e - 1) - RT), bars: i - pos.i }); pos = null; };
  for (let i = 300; i < n - 1; i++) {
    const flip = tr[i] !== tr[i-1] && tr[i] !== 0;
    if (pos && flip && tr[i] === -pos.d) close(i + 1, B.o[i + 1]);
    if (B.t[i + 1] < fromTs) continue;
    if (mode === "flip") { if (!pos && flip) pos = { d: tr[i], e: B.o[i + 1], i: i + 1 }; }
    else { const up = c[i] > z[i] && c[i-1] <= z[i-1] && tr[i] === 1 && tr[i-1] === 1, dn = c[i] < z[i] && c[i-1] >= z[i-1] && tr[i] === -1 && tr[i-1] === -1;
      if (!pos && (up || dn) && (mode === "arrow" || (mode === "arrowL" && up))) pos = { d: up ? 1 : -1, e: B.o[i + 1], i: i + 1 }; }
  }
  return out;
}
if (require.main !== module) module.exports = { zl, bars };
const per = ts => ts < SPLIT ? 0 : ts < END ? 1 : 2;
function stats(a) { let G = 0, L = 0, w = 0; for (const t of a) { if (t.pct > 0) { G += t.pct; w++; } else L -= t.pct; } return { n: a.length, w, l: a.length - w, net: G - L, pf: L ? G/L : (G ? 99 : 0), aw: w ? G/w : 0, al: a.length - w ? L/(a.length - w) : 0 }; }
const f = x => (x >= 0 ? "+" : "") + x.toFixed(1), pf = x => x >= 99 ? "inf" : x.toFixed(2);
const line = (lab, a) => { const s = stats(a), p = [0, 1, 2].map(i => stats(a.filter(t => per(t.sig) === i)));
  const ok = p[0].net > 0 && p[1].net > 0 && s.pf > 1.1 ? "✅" : (p[0].net > 0 && p[1].net > 0 ? "🟡" : "❌");
  return `${ok} ${lab.padEnd(22)} n=${String(s.n).padStart(6)} W${s.w}/L${s.l} net${f(s.net)}% PF${pf(s.pf)} win+${s.aw.toFixed(2)} loss-${s.al.toFixed(2)} | train ${f(p[0].net)}% PF${pf(p[0].pf)} (n${p[0].n}) | test ${f(p[1].net)}% PF${pf(p[1].pf)} (n${p[1].n}) | new ${f(p[2].net)}% PF${pf(p[2].pf)} (n${p[2].n})`; };



if (require.main === module) (async () => {
  const html = fs.readFileSync(path.join(ROOT, "nexora/index.html"), "utf8");
  const COINS = JSON.parse(html.match(/const DEFAULT_TOP = (\[[^\]]*\])/)[1]);
  const TF = [["15د", 1, false], ["ساعة", 4, false], ["4 ساعات", 16, false], ["يوم", 96, true]], MODES = [["انقلاب الترند (السهم الكبير)", "flip"], ["سهم الدخول الصغير ← خروج عند الانقلاب", "arrow"]];
  const R = {}; const q = [...COINS]; let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();
    try { const D = build(await klines(sym)); if (!D) continue;
      for (const [tn, k, ad] of TF) { const B = k === 1 ? { ...D, t: Array.from({ length: D.c.length }, (_, i) => D.t0 + i*M15) } : bars(D, k, ad);
        for (const [mn, m] of MODES) { const key = tn + " · " + mn; for (const t of zl(B, START, m)) (R[key] || (R[key] = [])).push({ ...t, sym }); } }
      console.log(++done, sym); } catch (e) { console.log("ERR", sym, e.message); } } }));
  const out = [`# Zero Lag Trend Signals (MTF) [AlgoAlpha] — كما هو (70 · 1.2) · سنتين ${new Date(START).toISOString().slice(0, 10)} → الحين · ${COINS.length} عملة`,
    `# المؤشر ما فيه خروج: الصفقة بتطلع لما الترند ينقلب (افتتاح الشمعة الجاية) · رسوم 0.12% · التمويل مش محسوب · ✅ = ربح بالتدريب والاختبار + PF>1.1`, ""];
  for (const [tn] of TF) for (const [mn] of MODES) { const key = tn + " · " + mn, a = R[key] || [], w = a.filter(t => t.pct > 0).length;
    out.push(line(key, a) + ` | نجاح ${(100*w/Math.max(1, a.length)).toFixed(0)}% · مدة ${(a.reduce((s, t) => s + t.bars, 0)/Math.max(1, a.length)).toFixed(0)} شمعة`,
      line("   لونج", a.filter(t => t.d === 1)), line("   شورت", a.filter(t => t.d === -1)));
    const Q = new Map(); for (const t of a) { const d = new Date(t.sig), kk = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3) + 1}`; (Q.get(kk) || Q.set(kk, []).get(kk)).push(t); }
    out.push("   كل ربع: " + [...Q.entries()].sort().map(([kk, b]) => { const s = stats(b); return `${kk} ${f(s.net)}% PF${pf(s.pf)}`; }).join(" · "), ""); }
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results/zerolag2y.txt"), out.join("\n") + "\n");
  console.log(out.join("\n"));
})();
