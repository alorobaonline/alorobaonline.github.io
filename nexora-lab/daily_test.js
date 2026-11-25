// 25/11 19:22 (طلب المستخدم): استراتيجية على فريم اليوم بنسبة نجاح عالية — RSI(2) Connors على سنتين
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



// فريم اليوم (UTC) من شموع 15د
function daily(D) { const k0 = Math.ceil(D.t0/DAY)*DAY, s = (k0 - D.t0)/M15, N = Math.floor((D.c.length - s)/96), o = [], h = [], l = [], c = [], t = [];
  for (let b = 0; b < N; b++) { const a = s + b*96; let hh = -Infinity, ll = Infinity; for (let j = a; j < a + 96; j++) { if (D.h[j] > hh) hh = D.h[j]; if (D.l[j] < ll) ll = D.l[j]; } o.push(D.o[a]); h.push(hh); l.push(ll); c.push(D.c[a + 95]); t.push(k0 + b*DAY); }
  return { o, h, l, c, t }; }
const sma = (x, p) => x.map((_, i) => { if (i < p - 1) return NaN; let s = 0; for (let j = i - p + 1; j <= i; j++) s += x[j]; return s/p; });
function rsiW(c, p) { const o = new Array(c.length).fill(NaN); let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i-1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= p) { g += up; l += dn; if (i === p) { g /= p; l /= p; o[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } }
    else { g = (g*(p - 1) + up)/p; l = (l*(p - 1) + dn)/p; o[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } } return o; }
function atrD(d, p = 14) { const n = d.c.length, o = new Array(n).fill(NaN); let s = 0;
  for (let i = 0; i < n; i++) { const tr = i ? Math.max(d.h[i] - d.l[i], Math.abs(d.h[i] - d.c[i-1]), Math.abs(d.l[i] - d.c[i-1])) : d.h[i] - d.l[i];
    if (i < p) { s += tr; if (i === p - 1) o[i] = s/p; } else o[i] = (o[i-1]*(p - 1) + tr)/p; } return o; }
const RT = 2*FEE.taker + 2*FEE.slip;
// RSI(2) Connors: لونج لما الإغلاق فوق SMA200 و RSI2 < lo · شورت لما تحت SMA200 و RSI2 > 100-lo · دخول افتتاح اليوم الجاي · خروج لما الإغلاق يقطع SMA5 (افتتاح اليوم الجاي)
// stopK = وقف × ATR يومي (0 = بلا وقف) · maxDays = أقصى مدة · dirs: 1 لونج بس، -1 شورت بس، 0 الاتجاهين
function rsi2(D, fromTs, lo = 10, stopK = 0, maxDays = 10, dirs = 0) {
  const d = daily(D), n = d.c.length, S200 = sma(d.c, 200), S5 = sma(d.c, 5), R = rsiW(d.c, 2), A = atrD(d), out = []; let pos = null;
  for (let i = 200; i < n; i++) {
    if (pos) { const dd = pos.d; let x = null, why = null;
      if (stopK && (dd === 1 ? d.l[i] <= pos.sp : d.h[i] >= pos.sp)) { x = dd === 1 ? Math.min(pos.sp, d.o[i]) : Math.max(pos.sp, d.o[i]); why = "stop"; }
      if (x === null && i > pos.i && (dd === 1 ? d.c[i-1] > S5[i-1] : d.c[i-1] < S5[i-1]) && i - 1 > pos.i - 1) { /* exit signal from previous close handled below */ }
      if (x === null && pos.exitNext) { x = d.o[i]; why = "exit"; }
      if (x === null && i - pos.i >= maxDays) { x = d.o[i]; why = "time"; }
      if (x !== null) { out.push({ sig: d.t[pos.i], d: dd, why, pct: 100*(dd*(x/pos.e - 1) - RT), days: i - pos.i }); pos = null; }
      else if (dd === 1 ? d.c[i] > S5[i] : d.c[i] < S5[i]) pos.exitNext = true;
    }
    if (!pos && i + 1 < n && d.t[i + 1] >= fromTs && !isNaN(S200[i]) && !isNaN(R[i])) {
      const L = dirs >= 0 && d.c[i] > S200[i] && R[i] < lo, Sh = dirs <= 0 && d.c[i] < S200[i] && R[i] > 100 - lo;
      if (L || Sh) { const dd = L ? 1 : -1, e = d.o[i + 1]; pos = { d: dd, e, i: i + 1, sp: e - dd*stopK*A[i], exitNext: false }; i++;   // الدخول افتتاح اليوم الجاي — بنكمّل الإدارة من نفس يوم الدخول
        const j = i; if (stopK && (dd === 1 ? d.l[j] <= pos.sp : d.h[j] >= pos.sp)) { out.push({ sig: d.t[j], d: dd, why: "stop", pct: 100*(dd*(pos.sp/e - 1) - RT), days: 0 }); pos = null; }
        else if (dd === 1 ? d.c[j] > S5[j] : d.c[j] < S5[j]) pos.exitNext = true; }
    }
  }
  return out;
}
if (require.main !== module) module.exports = { rsi2, daily };
const per = ts => ts < SPLIT ? 0 : ts < END ? 1 : 2;
function stats(a) { let G = 0, L = 0, w = 0; for (const t of a) { if (t.pct > 0) { G += t.pct; w++; } else L -= t.pct; } return { n: a.length, w, l: a.length - w, net: G - L, pf: L ? G/L : (G ? 99 : 0), aw: w ? G/w : 0, al: a.length - w ? L/(a.length - w) : 0 }; }
const f = x => (x >= 0 ? "+" : "") + x.toFixed(1), pf = x => x >= 99 ? "inf" : x.toFixed(2);
const line = (lab, a) => { const s = stats(a), p = [0, 1, 2].map(i => stats(a.filter(t => per(t.sig) === i)));
  const ok = p[0].net > 0 && p[1].net > 0 && s.pf > 1.1 ? "✅" : (p[0].net > 0 && p[1].net > 0 ? "🟡" : "❌");
  return `${ok} ${lab.padEnd(22)} n=${String(s.n).padStart(6)} W${s.w}/L${s.l} net${f(s.net)}% PF${pf(s.pf)} win+${s.aw.toFixed(2)} loss-${s.al.toFixed(2)} | train ${f(p[0].net)}% PF${pf(p[0].pf)} (n${p[0].n}) | test ${f(p[1].net)}% PF${pf(p[1].pf)} (n${p[1].n}) | new ${f(p[2].net)}% PF${pf(p[2].pf)} (n${p[2].n})`; };


if (require.main === module) (async () => {
  const html = fs.readFileSync(path.join(ROOT, "nexora/index.html"), "utf8");
  const COINS = JSON.parse(html.match(/const DEFAULT_TOP = (\[[^\]]*\])/)[1]);
  const V = [["RSI2<10 · الاتجاهين · بلا وقف · 10 أيام", [10, 0, 10, 0]], ["RSI2<10 · لونج بس", [10, 0, 10, 1]], ["RSI2<10 · شورت بس", [10, 0, 10, -1]],
             ["RSI2<10 · الاتجاهين · وقف 2ATR", [10, 2, 10, 0]], ["RSI2<5 · الاتجاهين · بلا وقف", [5, 0, 10, 0]], ["RSI2<5 · الاتجاهين · وقف 2ATR", [5, 2, 10, 0]]];
  const R = V.map(() => []); const q = [...COINS]; let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();
    try { const D = build(await klines(sym)); if (!D) continue; V.forEach(([, a], k) => { for (const t of rsi2(D, START, ...a)) R[k].push({ ...t, sym }); }); console.log(++done, sym); } catch (e) { console.log("ERR", sym, e.message); } } }));
  const out = [`# فريم اليوم — RSI(2) Connors مع ترند SMA200 — سنتين ${new Date(START).toISOString().slice(0, 10)} → الحين · ${COINS.length} عملة`,
    `# دخول افتتاح اليوم الجاي · خروج لما الإغلاق يقطع SMA5 (افتتاح اليوم الجاي) أو 10 أيام · رسوم 0.12% (التمويل مش محسوب) · ✅ = ربح بالتدريب والاختبار + PF>1.1`, ""];
  V.forEach(([nm], k) => { const a = R[k]; const w = a.filter(t => t.pct > 0).length;
    out.push(line(nm, a) + ` | نسبة النجاح ${(100*w/Math.max(1, a.length)).toFixed(0)}% · متوسط المدة ${(a.reduce((s, t) => s + t.days, 0)/Math.max(1, a.length)).toFixed(1)} يوم`);
    const by = {}; for (const t of a) (by[t.why] || (by[t.why] = [])).push(t);
    out.push("  " + Object.entries(by).map(([k2, b]) => `${k2} ${b.length} ${f(b.reduce((s, t) => s + t.pct, 0))}%`).join(" · "));
    const Q = new Map(); for (const t of a) { const d = new Date(t.sig), kk = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3) + 1}`; (Q.get(kk) || Q.set(kk, []).get(kk)).push(t); }
    out.push("  كل ربع: " + [...Q.entries()].sort().map(([kk, b]) => { const s = stats(b); return `${kk} n${s.n} ${f(s.net)}% PF${pf(s.pf)} win${Math.round(100*s.w/Math.max(1, s.n))}%`; }).join(" · "), ""); });
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results/daily2y.txt"), out.join("\n") + "\n");
  console.log(out.join("\n"));
})();
