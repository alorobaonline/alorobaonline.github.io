// 23/11 11:45 (طلب المستخدم): فحص «سحب السيولة» على سنتين — هل بينفع على سوق طالع ونازل؟
// نفس قواعد المنصة: قيعان P=5 بآخر 24س · سحب = ذيل تحت القاع وإغلاق فوقه (عمق ≤1.5%) · ريتست ليمت على مستوى السحب خلال 8 شموع · وقف تحت الذيل 0.05% · هدف 1%
// الجماعي = 10 عملات أو أكثر سحبوا بنفس الشمعة · بلا لونج على قاع BTC 12س · فلتر «BTC مش طالع 4س» (b4 < +0.1%) · صفقة وحدة بالمرة لكل عملة
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
function sweeps(D, B, sym, REAL = false, MINS = 0) {   // REAL: الليمت بيتعبّى حتى لو نفس الشمعة ضربت الوقف (زي الحقيقي) + انزلاق وقف 0.05% · MINS: أقل بعد للوقف
  const N = D.c.length, P = 5, LOOK = 96, out = []; let lows = [];
  for (let i = 0; i < N - 1; i++) {
    const j = i - P;
    if (j >= P) { let lo = true; for (let q = j - P; q <= j + P; q++) if (D.l[q] < D.l[j]) { lo = false; break; } if (lo) lows.push({ i: j, p: D.l[j] }); }
    lows = lows.filter(x => i - x.i <= LOOK);
    const sw = lows.filter(x => x.i < i - P && D.l[i] < x.p); if (!sw.length) continue;
    lows = lows.filter(x => !(x.i < i - P && D.l[i] < x.p));
    const lvl = sw.reduce((a, b) => b.p < a.p ? b : a).p, depth = (lvl - D.l[i])/lvl, sig = D.t0 + i*M15;
    if (!(D.c[i] > lvl) || depth > 0.015 || sig < START) continue;
    const bi = Math.floor((sig + M15 - B.t0)/M15) - 1; if (bi < 48 || bi >= B.c.length) continue;
    let m = Infinity; for (let k = bi - 48; k < bi; k++) m = Math.min(m, B.l[k]);
    const btcLow = B.c[bi] <= m*1.003, b4 = B.c[bi]/B.c[bi - 16] - 1;
    const zone = lvl*1.0001; let stop = D.l[i]*(1 - 0.0005); if (MINS) stop = Math.min(stop, zone*(1 - MINS)); let e = -1, E = 0, same = false;
    for (let k = i + 1; k <= Math.min(N - 1, i + 8); k++) { if (!REAL && D.l[k] <= stop) break; if (D.l[k] <= zone) { e = k; E = Math.min(D.o[k], zone); same = REAL && D.l[k] <= stop; break; } }
    if (e < 0 || !(stop < E)) { out.push({ sym, sig, btcLow, b4, nofill: true }); continue; }
    const T = E*1.01, SL = REAL ? stop*(1 - 0.0005) : stop; let ox = null, xi = null;
    if (same) { ox = SL; xi = e; } else for (let k = e; k < N && k <= e + 192; k++) { if (D.l[k] <= stop) { ox = SL; xi = k; break; } if (D.h[k] >= T) { ox = T; xi = k; break; } }
    if (ox === null) { if (e + 192 >= N) continue; xi = e + 192; ox = D.c[xi]; }
    const fee = FEE.maker + FEE.taker + 2*FEE.slip;
    out.push({ sym, sig, btcLow, b4, pct: (ox/E - 1 - fee)*100, xTs: D.t0 + xi*M15, b24: B.c[bi]/B.c[Math.max(0, bi - 96)] - 1 });
  }
  return out;
}
function derive(raw, minC, flt) {
  const cnt = new Map(); for (const t of raw) cnt.set(t.sig, (cnt.get(t.sig) || 0) + 1);
  const by = new Map(); for (const t of raw) { if (t.nofill || (cnt.get(t.sig) || 0) < minC || t.btcLow || (flt && !flt(t))) continue; (by.get(t.sym) || by.set(t.sym, []).get(t.sym)).push(t); }
  const out = []; for (const a of by.values()) { let busy = -Infinity; for (const t of a.sort((x, y) => x.sig - y.sig)) { if (t.sig < busy) continue; out.push(t); busy = t.xTs - M15; } }
  return out;
}
const per = ts => ts < SPLIT ? 0 : ts < END ? 1 : 2;
function stats(a) { let G = 0, L = 0, w = 0; for (const t of a) { if (t.pct > 0) { G += t.pct; w++; } else L -= t.pct; } return { n: a.length, w, l: a.length - w, net: G - L, pf: L ? G/L : (G ? 99 : 0), aw: w ? G/w : 0, al: a.length - w ? L/(a.length - w) : 0 }; }
const f = x => (x >= 0 ? "+" : "") + x.toFixed(1), pf = x => x >= 99 ? "inf" : x.toFixed(2);
const line = (lab, a) => { const s = stats(a), p = [0, 1, 2].map(i => stats(a.filter(t => per(t.sig) === i)));
  const ok = p[0].net > 0 && p[1].net > 0 && s.pf > 1.1 ? "✅" : (p[0].net > 0 && p[1].net > 0 ? "🟡" : "❌");
  return `${ok} ${lab.padEnd(30)} n=${String(s.n).padStart(6)} W${s.w}/L${s.l} net${f(s.net)}% PF${pf(s.pf)} win+${s.aw.toFixed(2)} loss-${s.al.toFixed(2)} | train ${f(p[0].net)}% PF${pf(p[0].pf)} (n${p[0].n}) | test ${f(p[1].net)}% PF${pf(p[1].pf)} (n${p[1].n}) | new ${f(p[2].net)}% PF${pf(p[2].pf)} (n${p[2].n}) | batches ${new Set(a.map(t => t.sig)).size}`; };
(async () => {
  const html = fs.readFileSync(path.join(ROOT, "nexora/index.html"), "utf8");
  const COINS = JSON.parse(html.match(/const DEFAULT_TOP = (\[[^\]]*\])/)[1]);
  const B = build(await klines("BTCUSDT"));
  const raw = [], rawR = [], rawR5 = [], rawR8 = []; const q = [...COINS]; let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();
    try { const D = build(await klines(sym)); if (!D) continue; raw.push(...sweeps(D, B, sym)); rawR.push(...sweeps(D, B, sym, true)); rawR5.push(...sweeps(D, B, sym, true, 0.005)); rawR8.push(...sweeps(D, B, sym, true, 0.008)); console.log(++done, sym); } catch (e) { console.log("fail", sym, e.message); } } }));
  const out = [`# سحب السيولة لونج — سنتين (${new Date(START).toISOString().slice(0, 10)} → الحين) · ${COINS.length} عملة · تدريب→${new Date(SPLIT).toISOString().slice(0, 10)} · اختبار→2026-08-16 · جديدة→الحين`,
    `# النسبة = مجموع الصفقات بعد الرسوم (1% = 1$ على 100$) · ✅ = ربح بالتدريب والاختبار + PF>1.1`, ""];
  const b4 = t => t.b4 < 0.001;
  for (const N of [1, 5, 10, 15, 20]) { out.push(line(`دفعة ${N}+`, derive(raw, N)), line(`دفعة ${N}+ + BTC مش طالع 4س`, derive(raw, N, b4)), line(`دفعة ${N}+ + BTC طالع 4س`, derive(raw, N, t => !b4(t)))); }
  out.push("", "## تعبئة واقعية (الليمت بيتعبّى حتى لو نفس الشمعة كملت للوقف + انزلاق 0.05%)");
  for (const N of [10, 20]) out.push(line(`واقعي دفعة ${N}+`, derive(rawR, N)), line(`واقعي ${N}+ وقف ≥0.5%`, derive(rawR5, N)), line(`واقعي ${N}+ وقف ≥0.8%`, derive(rawR8, N)));
  out.push(""); const A = derive(raw, 10, b4), Q = new Map();
  for (const t of A) { const d = new Date(t.sig), k = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3) + 1}`; (Q.get(k) || Q.set(k, []).get(k)).push(t); }
  out.push("دفعة 10+ + BTC مش طالع، كل ربع: " + [...Q.entries()].sort().map(([k, a]) => { const s = stats(a); return `${k} n${s.n} ${f(s.net)}% PF${pf(s.pf)}`; }).join(" · "));
  const B24 = [["BTC نازل يوم كامل >2%", t => t.b24 < -0.02], ["BTC نازل 0..2%", t => t.b24 >= -0.02 && t.b24 < 0], ["BTC طالع 0..2%", t => t.b24 >= 0 && t.b24 < 0.02], ["BTC طالع يوم >2%", t => t.b24 >= 0.02]];
  out.push("دفعة 10+ + BTC مش طالع 4س، حسب BTC آخر 24س: " + B24.map(([k, fl]) => { const s = stats(A.filter(fl)); return `${k}: n${s.n} ${f(s.net)}% PF${pf(s.pf)}`; }).join(" · "));
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results/swp2y.txt"), out.join("\n") + "\n");
  console.log(out.join("\n"));
})();
