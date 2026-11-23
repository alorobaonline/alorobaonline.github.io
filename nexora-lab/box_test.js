// 23/11 (طلب المستخدم): فحص «المربع» على سنتين — بيانات بايننس العامة (data.binance.vision)، 100 عملة الحقيقي
// المربع: R = √((H−O)² + (C−L)²) لشمعة 15د · حد علوي = H+R · حد سفلي = L−R
// المربع بيضل قائم لحد ما ينكسر/ينلمس · بعد ما الصفقة تسكّر، الشمعة اللي بعدها بتعمل مربع جديد · أقصى مدة للصفقة 24 ساعة
// كسر = إغلاق فوق الحد العلوي لونج / تحت السفلي شورت (ماركت) · ارتداد = لمس العلوي شورت / السفلي لونج (ليمت)
// الدفعة = عدد العملات اللي عملت نفس الإشارة بنفس الشمعة وبنفس الاتجاه · فلتر الترند = EMA200 على 4 ساعات
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
function build(rows) {   // شموع متواصلة (الفجوة = شمعة مسطّحة)
  const ks = [...rows.keys()].sort((a, b) => a - b); if (ks.length < 3000) return null;
  const t0 = Math.ceil(ks[0]/H4)*H4, n = Math.floor((ks[ks.length-1] - t0)/M15) + 1, D = { t0, o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n) };
  let p = +rows.get(ks[0])[1];
  for (let i = 0; i < n; i++) { const r = rows.get(t0 + i*M15); if (r) { const o = +r[1], c = +r[4]; D.o[i] = o; D.h[i] = Math.max(+r[2], o, c); D.l[i] = Math.min(+r[3], o, c); D.c[i] = c; p = c; } else D.o[i] = D.h[i] = D.l[i] = D.c[i] = p; }
  return D;
}
function trend4(D) {   // اتجاه EMA200 على 4 ساعات — آخر شمعة 4س مسكّرة قبل الشمعة i
  const n4 = Math.floor(D.c.length/16), C = [], e = new Float64Array(n4); const k = 2/201; let x = null;
  for (let j = 0; j < n4; j++) { const c = D.c[j*16 + 15]; x = x === null ? c : x + k*(c - x); e[j] = x; C.push(c); }
  return i => { const j = Math.floor(i/16) - 1; return j >= 200 ? (C[j] > e[j] ? 1 : -1) : 0; };
}
function run(D, mode, ex) {   // كل صفقات العملة (المربع ما بيتأثر بالفلاتر — الفلتر بس بيقرر ناخد الصفقة أو لا)
  const T = [], n = D.c.length - 1, tr = trend4(D); let b = Math.max(0, Math.floor((START - D.t0)/M15));
  while (b < n - 2) {
    const O = D.o[b], H = D.h[b], L = D.l[b], C = D.c[b], R = Math.sqrt((H - O)**2 + (C - L)**2); if (!(R > 0)) { b++; continue; }
    const U = H + R, Dn = L - R; let d = 0, E = 0, j = -1;
    for (let k = b + 1; k < n; k++) {
      if (mode === "brk") { if (D.c[k] > U) { d = 1; E = D.c[k]; j = k; break; } if (D.c[k] < Dn) { d = -1; E = D.c[k]; j = k; break; } }
      else { const tu = D.h[k] >= U, td = D.l[k] <= Dn; if (tu && td) { j = -2; b = k; break; } if (tu) { d = -1; E = Math.max(D.o[k], U); j = k; break; } if (td) { d = 1; E = Math.min(D.o[k], Dn); j = k; break; } } }
    if (j === -2) continue; if (j < 0) break;
    const tp = ex === "pct" ? E*0.02 : R*2, sl = ex === "pct" ? E*0.01 : R, TG = E + d*tp, SL = E - d*sl;
    let out = null, xi = null;
    if (mode === "bnc" && (d === 1 ? D.c[j] <= SL : D.c[j] >= SL)) { out = SL; xi = j; }
    for (let k = j + 1; out === null && k < n && k <= j + 96; k++) { if (d === 1 ? D.l[k] <= SL : D.h[k] >= SL) { out = SL; xi = k; break; } if (d === 1 ? D.h[k] >= TG : D.l[k] <= TG) { out = TG; xi = k; break; } }
    if (out === null) { if (j + 96 >= n) break; xi = j + 96; out = D.c[xi]; }
    const fee = (mode === "brk" ? FEE.taker : FEE.maker) + FEE.taker + 2*FEE.slip;
    T.push({ ts: D.t0 + j*M15, d, pct: (d*(out/E - 1) - fee)*100, gross: d*(out/E - 1)*100, tr: tr(j) });
    b = xi + 1;
  }
  return T;
}
const per = ts => ts < SPLIT ? 0 : ts < END ? 1 : 2;
function stats(a) { let G = 0, L = 0, w = 0, gr = 0; for (const t of a) { gr += t.gross; if (t.pct > 0) { G += t.pct; w++; } else L -= t.pct; }
  return { n: a.length, w, l: a.length - w, net: G - L, pf: L ? G/L : (G ? 99 : 0), g: a.length ? gr/a.length : 0 }; }
const f = x => (x >= 0 ? "+" : "") + x.toFixed(1), pf = x => x >= 99 ? "inf" : x.toFixed(2);
const line = (lab, a) => { const s = stats(a), p = [0, 1, 2].map(i => stats(a.filter(t => per(t.ts) === i)));
  const ok = p[0].net > 0 && p[1].net > 0 && s.pf > 1.1 ? "✅" : (p[0].net > 0 && p[1].net > 0 ? "🟡" : "❌");
  return `${ok} ${lab.padEnd(26)} n=${String(s.n).padStart(6)} W${s.w}/L${s.l} net${f(s.net)}% PF${pf(s.pf)} gross/t${f(s.g)}% | train ${f(p[0].net)}% PF${pf(p[0].pf)} | test ${f(p[1].net)}% PF${pf(p[1].pf)} | new ${f(p[2].net)}% PF${pf(p[2].pf)} (n${p[2].n}) | batches ${new Set(a.map(t => t.ts)).size}`; };

(async () => {
  const html = fs.readFileSync(path.join(ROOT, "nexora/index.html"), "utf8");
  const COINS = JSON.parse(html.match(/const DEFAULT_TOP = (\[[^\]]*\])/)[1]);
  const out = [`# المربع — سنتين (${new Date(START).toISOString().slice(0, 10)} → الحين) · ${COINS.length} عملة (قائمة الحقيقي) · تدريب→${new Date(SPLIT).toISOString().slice(0, 10)} · اختبار→2026-08-16 · جديدة→الحين`,
    `# النسبة = مجموع نسب الصفقات بدون رافعة بعد الرسوم (Taker 0.05% · Maker 0.02% · انزلاق 0.01%) · ✅ = ربح بالتدريب والاختبار + PF>1.1`, ""];
  const all = { "brk|pct": [], "brk|R": [], "bnc|pct": [], "bnc|R": [] };
  const q = [...COINS]; let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();
    try { const D = build(await klines(sym)); if (!D) { console.log("skip", sym); continue; }
      for (const k of Object.keys(all)) { const [m, e] = k.split("|"); for (const t of run(D, m, e)) all[k].push({ ...t, sym }); }
      console.log(++done, sym, D.c.length); } catch (e) { console.log("fail", sym, e.message); } } }));
  for (const [k, T] of Object.entries(all)) {
    const cnt = new Map(); for (const t of T) { const key = t.ts + "|" + t.d; cnt.set(key, (cnt.get(key) || 0) + 1); } for (const t of T) t.n = cnt.get(t.ts + "|" + t.d);
    const [m, e] = k.split("|");
    out.push(`## ${m === "brk" ? "كسر" : "ارتداد"} · ${e === "pct" ? "هدف 2% وقف 1%" : "هدف 2R وقف 1R"}`);
    for (const [dl_, dd] of [["لونج", 1], ["شورت", -1]]) {
      const A = T.filter(t => t.d === dd);
      out.push(line(`${dl_} بدون فلتر`, A), line(`${dl_} + ترند`, A.filter(t => t.tr === dd)));
      for (const N of [5, 10, 15, 20, 30]) { out.push(line(`${dl_} دفعة ${N}+`, A.filter(t => t.n >= N)), line(`${dl_} دفعة ${N}+ + ترند`, A.filter(t => t.n >= N && t.tr === dd))); }
    }
    // كل ربع سنة لكسر الشورت 20+ (أقوى نسخة بفحص الريست)
    if (m === "brk") { const A = T.filter(t => t.d === -1 && t.n >= 20), Q = new Map(); for (const t of A) { const d = new Date(t.ts), key = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3) + 1}`; (Q.get(key) || Q.set(key, []).get(key)).push(t); }
      out.push(`  شورت 20+ كل ربع: ` + [...Q.entries()].sort().map(([key, a]) => { const s = stats(a); return `${key} n${s.n} ${f(s.net)}% PF${pf(s.pf)}`; }).join(" · ")); }
    out.push("");
  }
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results/box2y.txt"), out.join("\n") + "\n");
  console.log(out.join("\n"));
})();
