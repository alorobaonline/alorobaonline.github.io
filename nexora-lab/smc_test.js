// 25/11 15:34 (طلب المستخدم): فحص SMC (سحب سيولة + فجوة) على سنتين قبل ما نضيفله فلاتر LEZ
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
  for (const m of months(START - 60*DAY, now).reverse()) { if (m === thisM) continue;
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


// SMC: سحب سيولة (قاع/قمة P=5) + فجوة FVG باتجاه السحب خلال 10 شموع + (ترند 4س) — نفس فحص الريست 25/11
const RT_MKT = 2*FEE.taker + 2*FEE.slip, RT_LIM = FEE.maker + FEE.taker + 0.0002;
function emaA(x, p) { const a = 2/(p + 1), o = new Float64Array(x.length); o[0] = x[0]; for (let i = 1; i < x.length; i++) o[i] = a*x[i] + (1 - a)*o[i-1]; return o; }
function atrA(h, l, c, p = 14) { const n = c.length, o = new Float64Array(n).fill(NaN); let s = 0;
  for (let i = 0; i < n; i++) { const tr = i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1])) : h[i] - l[i];
    if (i < p) { s += tr; if (i === p - 1) o[i] = s/p; } else o[i] = (o[i-1]*(p - 1) + tr)/p; } return o; }
function trend4(D) {   // ترند 4س (EMA50/200 + مسافة ≥ ATR + ميل 10) لآخر شمعة 4س مسكّرة
  const n = D.c.length, N = Math.floor(n/16), O = [], H = [], L = [], C = [];
  for (let b = 0; b < N; b++) { let hh = -Infinity, ll = Infinity; for (let j = b*16; j < b*16 + 16; j++) { if (D.h[j] > hh) hh = D.h[j]; if (D.l[j] < ll) ll = D.l[j]; } O.push(D.o[b*16]); H.push(hh); L.push(ll); C.push(D.c[b*16 + 15]); }
  const f = emaA(C, 50), s = emaA(C, 200), a = atrA(H, L, C), T = new Int8Array(N);
  for (let i = 10; i < N; i++) { const w = Math.abs(f[i] - s[i]) >= a[i]; T[i] = w && C[i] > s[i] && f[i] > s[i] && s[i] > s[i-10] ? 1 : w && C[i] < s[i] && f[i] < s[i] && s[i] < s[i-10] ? -1 : 0; }
  const out = new Int8Array(n); for (let k = 0; k < n; k++) { const b = Math.floor(k/16) - 1; out[k] = b >= 0 && b < N ? T[b] : 0; } return out;
}
function smc(D, fromTs, useHtf, mode, P = 5, W = 10, EXP = 20, rr = 2, fvgK = 0.3) {
  const n = D.c.length, o = D.o, h = D.h, l = D.l, c = D.c, A = atrA(h, l, c), hT = useHtf ? trend4(D) : null, out = [];
  let lastL = NaN, lastH = NaN, sw = null, setup = null, pos = null; const RT = mode === "mkt" ? RT_MKT : RT_LIM;
  const rec = (ib, d, e, x, why) => out.push({ sig: D.t0 + ib*M15, d, why, pct: 100*(d*(x/e - 1) - RT) });
  for (let i = 2*P + 2; i < n; i++) {
    const j = i - P; let mn = Infinity, mx = -Infinity; for (let q = j - P; q <= j + P; q++) { if (l[q] < mn) mn = l[q]; if (h[q] > mx) mx = h[q]; }
    if (l[j] === mn) lastL = l[j]; if (h[j] === mx) lastH = h[j];
    if (pos) { const [d, e, sp, tg, ib] = pos;
      if (d === 1 ? l[i] <= sp : h[i] >= sp) { rec(ib, d, e, sp, "stop"); pos = null; }
      else if (d === 1 ? h[i] >= tg : l[i] <= tg) { rec(ib, d, e, tg, "target"); pos = null; }
      continue; }
    if (setup) { const [d, e, sp, tg, ex] = setup;
      if (i > ex || (d === 1 ? h[i] >= tg : l[i] <= tg) || (d === 1 ? c[i] < sp : c[i] > sp)) setup = null;
      else if (d === 1 ? l[i] <= e : h[i] >= e) {
        if (d === 1 ? l[i] <= sp : h[i] >= sp) { rec(i, d, e, sp, "stop"); setup = null; continue; }
        pos = [d, e, sp, tg, i]; setup = null; continue; } }
    if (!isNaN(lastL) && l[i] < lastL && c[i] > lastL) { sw = [1, l[i], i]; lastL = NaN; } else if (!isNaN(lastL) && c[i] < lastL) lastL = NaN;
    if (!isNaN(lastH) && h[i] > lastH && c[i] < lastH) { sw = [-1, h[i], i]; lastH = NaN; } else if (!isNaN(lastH) && c[i] > lastH) lastH = NaN;
    if (sw && !setup && i - sw[2] <= W && i > sw[2] && D.t0 + i*M15 >= fromTs) {
      const [d, wick] = sw;
      if (useHtf && hT[i] !== d) continue;
      if (d === 1 && l[i] > h[i-2] && l[i] - h[i-2] >= fvgK*A[i]) { const e = mode === "mkt" ? c[i] : (l[i] + h[i-2])/2, sp = wick - 0.1*A[i];
        if (e > sp) { setup = [1, e, sp, e + rr*(e - sp), i + EXP]; sw = null; if (mode === "mkt") { pos = [1, e, sp, setup[3], i]; setup = null; } } }
      if (d === -1 && h[i] < l[i-2] && l[i-2] - h[i] >= fvgK*A[i]) { const e = mode === "mkt" ? c[i] : (h[i] + l[i-2])/2, sp = wick + 0.1*A[i];
        if (sp > e) { setup = [-1, e, sp, e - rr*(sp - e), i + EXP]; sw = null; if (mode === "mkt") { pos = [-1, e, sp, setup[3], i]; setup = null; } } }
    }
    if (sw && i - sw[2] > W) sw = null;
  }
  return out;
}
if (require.main !== module) module.exports = { smc };
const per = ts => ts < SPLIT ? 0 : ts < END ? 1 : 2;
function stats(a) { let G = 0, L = 0, w = 0; for (const t of a) { if (t.pct > 0) { G += t.pct; w++; } else L -= t.pct; } return { n: a.length, w, l: a.length - w, net: G - L, pf: L ? G/L : (G ? 99 : 0), aw: w ? G/w : 0, al: a.length - w ? L/(a.length - w) : 0 }; }
const f = x => (x >= 0 ? "+" : "") + x.toFixed(1), pf = x => x >= 99 ? "inf" : x.toFixed(2);
const line = (lab, a) => { const s = stats(a), p = [0, 1, 2].map(i => stats(a.filter(t => per(t.sig) === i)));
  const ok = p[0].net > 0 && p[1].net > 0 && s.pf > 1.1 ? "✅" : (p[0].net > 0 && p[1].net > 0 ? "🟡" : "❌");
  return `${ok} ${lab.padEnd(22)} n=${String(s.n).padStart(6)} W${s.w}/L${s.l} net${f(s.net)}% PF${pf(s.pf)} win+${s.aw.toFixed(2)} loss-${s.al.toFixed(2)} | train ${f(p[0].net)}% PF${pf(p[0].pf)} (n${p[0].n}) | test ${f(p[1].net)}% PF${pf(p[1].pf)} (n${p[1].n}) | new ${f(p[2].net)}% PF${pf(p[2].pf)} (n${p[2].n})`; };

if (require.main === module) (async () => {
  const html = fs.readFileSync(path.join(ROOT, "nexora/index.html"), "utf8");
  const COINS = JSON.parse(html.match(/const DEFAULT_TOP = (\[[^\]]*\])/)[1]);
  const V = [["ماركت + ترند 4س", true, "mkt"], ["ماركت بدون فلتر", false, "mkt"], ["ليمت نص الفجوة + ترند 4س", true, "mid"], ["ليمت نص الفجوة بدون فلتر", false, "mid"]];
  const R = V.map(() => []); const q = [...COINS]; let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();
    try { const D = build(await klines(sym)); if (!D) continue; V.forEach(([, u, m], k) => { for (const t of smc(D, START, u, m)) R[k].push({ ...t, sym }); }); console.log(++done, sym); } catch (e) { console.log("ERR", sym, e.message); } } }));
  const out = [`# SMC (سحب سيولة + فجوة) — سنتين ${new Date(START).toISOString().slice(0, 10)} → الحين · ${COINS.length} عملة · 15د · وقف ورا ذيل السحب · هدف 2R`,
    `# تدريب→${new Date(SPLIT).toISOString().slice(0, 10)} · اختبار→2026-08-16 · جديدة→الحين · ماركت 0.12% · ليمت 0.09% · ✅ = ربح بالتدريب والاختبار + PF>1.1`, ""];
  V.forEach(([nm], k) => { const a = R[k]; out.push(line(nm, a), line("  لونج", a.filter(t => t.d === 1)), line("  شورت", a.filter(t => t.d === -1)));
    const tg = a.filter(t => t.why === "target"), st = a.filter(t => t.why === "stop");
    out.push(`  ✅ هدف ${tg.length} ${f(tg.reduce((s, t) => s + t.pct, 0))}% · ❌ وقف ${st.length} ${f(st.reduce((s, t) => s + t.pct, 0))}%`);
    const Q = new Map(); for (const t of a) { const d = new Date(t.sig), kk = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3) + 1}`; (Q.get(kk) || Q.set(kk, []).get(kk)).push(t); }
    out.push("  كل ربع: " + [...Q.entries()].sort().map(([kk, b]) => { const s = stats(b); return `${kk} n${s.n} ${f(s.net)}% PF${pf(s.pf)}`; }).join(" · "), ""); });
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results/smc2y.txt"), out.join("\n") + "\n");
  console.log(out.join("\n"));
})();
