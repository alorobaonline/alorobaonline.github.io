// 25/11 15:24 (طلب المستخدم): فحص Liquidity Entry Zones كما هي على سنتين
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

// Liquidity Entry Zones [trade_w_samet] — نقل حرفي للكود بالإعدادات الافتراضية (15د)
const P = 5, NST = 20, SWD = 0.10, MINW = 0.35, MAXB = 0.65, MINR = 0.20, WIN = 2, COOL = 10, SLM = 1.5, RR = 3.0;
const RT = 2*FEE.taker + 2*FEE.slip;   // 0.12% دخول وخروج ماركت + انزلاق
function lez(D, fromTs) {
  const n = D.c.length, o = D.o, h = D.h, l = D.l, c = D.c, out = [];
  const E = new Float64Array(n), A = new Float64Array(n).fill(NaN); E[0] = c[0]; const a50 = 2/51;
  for (let i = 1; i < n; i++) E[i] = a50*c[i] + (1 - a50)*E[i-1];
  let s = 0; for (let i = 0; i < n; i++) { const tr = i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1])) : h[i] - l[i];
    if (i < 14) { s += tr; if (i === 13) A[i] = s/14; } else A[i] = (A[i-1]*13 + tr)/14; }
  const HL = [], HB = [], LL = [], LB = []; let pBull = null, pBear = null, last = null, pos = null;
  for (let i = 0; i < n; i++) {
    if (i >= 2*P) { const ce = i - P; let lh = -Infinity, rh = -Infinity, ll = Infinity, rl = Infinity;
      for (let j = ce - P; j < ce; j++) { if (h[j] > lh) lh = h[j]; if (l[j] < ll) ll = l[j]; }
      for (let j = ce + 1; j <= ce + P; j++) { if (h[j] > rh) rh = h[j]; if (l[j] < rl) rl = l[j]; }
      if (h[ce] > lh && h[ce] >= rh) { HL.push(h[ce]); HB.push(ce); if (HL.length > NST) { HL.shift(); HB.shift(); } }
      if (l[ce] < ll && l[ce] <= rl) { LL.push(l[ce]); LB.push(ce); if (LL.length > NST) { LL.shift(); LB.shift(); } } }
    const a = A[i]; if (!(a > 0)) continue;
    const rng = h[i] - l[i], body = Math.abs(c[i] - o[i]), uw = h[i] - Math.max(o[i], c[i]), lw = Math.min(o[i], c[i]) - l[i];
    const bp = rng > 0 ? body/rng : 0, uwp = rng > 0 ? uw/rng : 0, lwp = rng > 0 ? lw/rng : 0;
    let sH = null, sL = null;
    for (let j = HL.length - 1; j >= 0; j--) if (HB[j] < i && h[i] > HL[j] && h[i] - HL[j] >= SWD*a) { sH = HL[j]; break; }
    for (let j = LL.length - 1; j >= 0; j--) if (LB[j] < i && l[i] < LL[j] && LL[j] - l[i] >= SWD*a) { sL = LL[j]; break; }
    const vSell = sH !== null && c[i] < sH && uwp >= MINW && bp <= MAXB && rng >= MINR*a;
    const vBuy = sL !== null && c[i] > sL && lwp >= MINW && bp <= MAXB && rng >= MINR*a;
    if (vBuy) pBull = [i, (h[i] + l[i])/2]; if (vSell) pBear = [i, (h[i] + l[i])/2];
    const bW = pBull && i - pBull[0] <= WIN, sW = pBear && i - pBear[0] <= WIN;
    const buyC = bW && c[i] > o[i] && c[i] > E[i] && c[i] > pBull[1], sellC = sW && c[i] < o[i] && c[i] < E[i] && c[i] < pBear[1];
    const cd = last === null || i - last > COOL, buy = buyC && cd, sell = sellC && cd && !buy;
    if (buy || sell) last = i;
    if (buy || (pBull && i - pBull[0] > WIN)) pBull = null; if (sell || (pBear && i - pBear[0] > WIN)) pBear = null;
    const ts = D.t0 + i*M15;
    if (!pos) { if ((buy || sell) && ts >= fromTs) { const d = buy ? 1 : -1, sl = SLM*a; pos = { d, e: c[i], sp: c[i] - d*sl, tg: c[i] + d*sl*RR, i, ts }; } }
    else if (i > pos.i) { const d = pos.d, hs = d === 1 ? l[i] <= pos.sp : h[i] >= pos.sp, ht = d === 1 ? h[i] >= pos.tg : l[i] <= pos.tg;
      if (hs || ht) { const x = hs ? pos.sp : pos.tg; out.push({ sig: pos.ts, d, why: hs ? "stop" : "target", pct: 100*(d*(x/pos.e - 1) - RT) }); pos = null; } }
  }
  return out;
}
if (require.main !== module) module.exports = { lez };

const per = ts => ts < SPLIT ? 0 : ts < END ? 1 : 2;
function stats(a) { let G = 0, L = 0, w = 0; for (const t of a) { if (t.pct > 0) { G += t.pct; w++; } else L -= t.pct; } return { n: a.length, w, l: a.length - w, net: G - L, pf: L ? G/L : (G ? 99 : 0), aw: w ? G/w : 0, al: a.length - w ? L/(a.length - w) : 0 }; }
const f = x => (x >= 0 ? "+" : "") + x.toFixed(1), pf = x => x >= 99 ? "inf" : x.toFixed(2);
const line = (lab, a) => { const s = stats(a), p = [0, 1, 2].map(i => stats(a.filter(t => per(t.sig) === i)));
  const ok = p[0].net > 0 && p[1].net > 0 && s.pf > 1.1 ? "✅" : (p[0].net > 0 && p[1].net > 0 ? "🟡" : "❌");
  return `${ok} ${lab.padEnd(22)} n=${String(s.n).padStart(6)} W${s.w}/L${s.l} net${f(s.net)}% PF${pf(s.pf)} win+${s.aw.toFixed(2)} loss-${s.al.toFixed(2)} | train ${f(p[0].net)}% PF${pf(p[0].pf)} (n${p[0].n}) | test ${f(p[1].net)}% PF${pf(p[1].pf)} (n${p[1].n}) | new ${f(p[2].net)}% PF${pf(p[2].pf)} (n${p[2].n})`; };
if (require.main === module) (async () => {
  const html = fs.readFileSync(path.join(ROOT, "nexora/index.html"), "utf8");
  const COINS = JSON.parse(html.match(/const DEFAULT_TOP = (\[[^\]]*\])/)[1]);
  const all = []; const q = [...COINS]; let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();
    try { const D = build(await klines(sym)); if (!D) continue; for (const t of lez(D, START)) all.push({ ...t, sym }); console.log(++done, sym); } catch (e) { console.log("ERR", sym, e.message); } } }));
  const out = [`# Liquidity Entry Zones [trade_w_samet] كما هي (الإعدادات الافتراضية) — سنتين ${new Date(START).toISOString().slice(0, 10)} → الحين · ${COINS.length} عملة · 15د`,
    `# تدريب→${new Date(SPLIT).toISOString().slice(0, 10)} · اختبار→2026-08-16 · جديدة→الحين · النسبة = مجموع الصفقات بعد الرسوم 0.12% · ✅ = ربح بالتدريب والاختبار + PF>1.1`, ""];
  out.push(line("الكل", all), line("لونج", all.filter(t => t.d === 1)), line("شورت", all.filter(t => t.d === -1)));
  const tg = all.filter(t => t.why === "target"), st = all.filter(t => t.why === "stop");
  out.push("", `✅ هدف: ${tg.length} صفقة ${f(tg.reduce((s, t) => s + t.pct, 0))}% · ❌ وقف: ${st.length} صفقة ${f(st.reduce((s, t) => s + t.pct, 0))}%`);
  const Q = new Map(); for (const t of all) { const d = new Date(t.sig), k = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3) + 1}`; (Q.get(k) || Q.set(k, []).get(k)).push(t); }
  out.push("", "كل ربع: " + [...Q.entries()].sort().map(([k, a]) => { const s = stats(a); return `${k} n${s.n} ${f(s.net)}% PF${pf(s.pf)}`; }).join(" · "));
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results/lez2y.txt"), out.join("\n") + "\n");
  console.log(out.join("\n"));
})();
