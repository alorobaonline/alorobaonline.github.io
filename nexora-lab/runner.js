// NEXORA LAB على سيرفرات GitHub: بيحمّل شموع بايننس الحقيقية من الأرشيف العام (data.binance.vision)
// وبيشغّل نفس محرك المنصة بالضبط (من nexora/index.html و nexora/lab.html)، وبيكتب النتائج بـ nexora-lab/results/
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto"), { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DATA = process.env.NEXORA_DATA || path.join(require("os").homedir(), ".nexora-data");
fs.mkdirSync(DATA, { recursive: true });
const M15 = 900000, H4 = 16*M15, DAY = 864e5;

// ---------- المحرك ----------
const grab = (file, id) => { const h = fs.readFileSync(path.join(ROOT, file), "utf8"); const m = h.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error("no " + id); return m[1]; };
const ctx = vm.createContext({ console, Math, Date, Map, Set, WeakMap, Array, Object, Number, String, JSON, Infinity, NaN, isFinite, parseFloat, Float64Array });
vm.runInContext(grab("nexora/index.html", "engine") + "\n" + grab("nexora/lab.html", "lab") +
  "\n;globalThis.E={STRATS,setBtcRef,makeInd,evaluate,money,statsOf,verdictOf,periodOf,periodDays,split3,portfolio,costSet,LAB_START,LAB_END,LAB_SPLIT,PERIODS};", ctx);
const E = ctx.E;

// ---------- البيانات ----------
async function dl(url, file, noRetry404 = false) {
  if (fs.existsSync(file)) return true;
  if (fs.existsSync(file + ".404")) return false;   // ملف مش موجود بالأرشيف (عملة لسا ما نزلت وقتها) — لا تعيد تسأل
  for (let k = 0; k < 4; k++) {
    try { const r = await fetch(url); if (r.status === 404) { if (noRetry404) fs.writeFileSync(file + ".404", ""); return false; } if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; } } catch (e) {}
    await new Promise(z => setTimeout(z, 1500*(k+1)));
  }
  throw new Error("download failed " + url);
}
function readZipCsv(file) { return execSync(`unzip -p "${file}"`, { maxBuffer: 1 << 30 }).toString().split("\n").filter(l => l && /^\d/.test(l)).map(l => l.split(",")); }
function months(from, to) { const out = []; const d = new Date(from); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); while (d.getTime() < to) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); } return out; }
async function klines(sym, iv, fromTs = null) {
  const now = Date.now(), thisMonth = new Date().toISOString().slice(0, 7), rows = new Map();
  const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const dir = path.join(DATA, iv, sym); fs.mkdirSync(dir, { recursive: true });
  let listed = true;   // من الأحدث للأقدم: أول شهر قديم مش موجود = العملة لسا ما كانت نازلة → ما في داعي نسأل عن اللي قبله
  for (const m of months(fromTs !== null ? fromTs : E.LAB_START - 40*DAY, now).reverse()) {
    if (m === thisMonth) continue;
    if (!listed) break;
    const f = path.join(dir, `${m}.zip`);
    let ok = await dl(`https://data.binance.vision/data/futures/um/monthly/klines/${sym}/${iv}/${sym}-${iv}-${m}.zip`, f, m < lastMonth);
    if (!ok && m < lastMonth) {   // شهر قديم مش بالأرشيف = العملة كانت لسا مش نازلة: بس أيام آخر الشهر (يمكن نزلت فيه)
      listed = false;
      for (let d = 20; d <= 31; d++) { const ds = `${m}-${String(d).padStart(2, "0")}`; if (new Date(ds + "T00:00:00Z").toISOString().slice(0, 7) !== m) break;
        const fd = path.join(dir, `${ds}.zip`);
        if (await dl(`https://data.binance.vision/data/futures/um/daily/klines/${sym}/${iv}/${sym}-${iv}-${ds}.zip`, fd, true)) for (const r of readZipCsv(fd)) rows.set(+r[0], r); }
      continue;
    }
    if (!ok) {   // الشهر الماضي ممكن لسا ما انرفع: خذه يوم يوم
      const [y, mo] = m.split("-").map(Number), days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      for (let d = 1; d <= days; d++) { const ds = `${m}-${String(d).padStart(2, "0")}`, fd = path.join(dir, `${ds}.zip`);
        if (await dl(`https://data.binance.vision/data/futures/um/daily/klines/${sym}/${iv}/${sym}-${iv}-${ds}.zip`, fd)) for (const r of readZipCsv(fd)) rows.set(+r[0], r); }
      continue;
    }
    for (const r of readZipCsv(f)) rows.set(+r[0], r);
  }
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  for (let t = start.getTime(); t < now - DAY; t += DAY) {
    const ds = new Date(t).toISOString().slice(0, 10), fd = path.join(dir, `${ds}.zip`);
    if (await dl(`https://data.binance.vision/data/futures/um/daily/klines/${sym}/${iv}/${sym}-${iv}-${ds}.zip`, fd)) for (const r of readZipCsv(fd)) rows.set(+r[0], r);
  }
  return rows;
}
async function funding(sym) {
  const out = [], dir = path.join(DATA, "funding", sym); fs.mkdirSync(dir, { recursive: true });
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastM = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  for (const m of months(E.LAB_START, Date.now()).reverse()) { if (m === thisMonth) continue;
    const f = path.join(dir, `${m}.zip`);
    if (await dl(`https://data.binance.vision/data/futures/um/monthly/fundingRate/${sym}/${sym}-fundingRate-${m}.zip`, f, m < lastM))
      for (const r of readZipCsv(f)) out.push({ t: +r[0], rate: +r[2], mark: 0 });
    else if (m < lastM) break; }
  return out.sort((a, b) => a.t - b.t);
}
function buildD(rows) {
  const keys = [...rows.keys()].sort((a, b) => a - b); if (!keys.length) return null;
  const t0 = Math.ceil(Math.max(keys[0], E.LAB_START) / H4) * H4;
  let n = Math.floor((keys[keys.length-1] - t0)/M15) + 1; n -= n % 16;
  if (n < 16*60) return null;
  const D = { t0, o: [], h: [], l: [], c: [], v: [] }; let prev = null;
  for (let i = 0; i < n; i++) { const r = rows.get(t0 + i*M15);
    if (r) { const o = +r[1], c = +r[4]; D.o.push(o); D.h.push(Math.max(+r[2], o, c)); D.l.push(Math.min(+r[3], o, c)); D.c.push(c); D.v.push(+r[5]); prev = c; }
    else { const p = prev ?? +rows.get(keys.find(x => x > t0 + i*M15))[1]; D.o.push(p); D.h.push(p); D.l.push(p); D.c.push(p); D.v.push(0); } }
  return D;
}
const fixF = (F, D) => F.map(f => f.mark ? f : { ...f, mark: D.c[Math.min(D.c.length-1, Math.max(0, Math.floor((f.t - D.t0)/M15)))] });

// ---------- تحميل كل العملات وحساب الصفقات الخام ----------
function buildM5(rows, D) {   // شموع 5 دقايق (مع الفوليوم) على نفس بداية ونهاية الـ15 دقيقة
  const n = D.c.length*3, M5 = 300000, m = { t0: D.t0, o: new Array(n), h: new Array(n), l: new Array(n), c: new Array(n), v: new Array(n) }; let prev = D.o[0];
  for (let i = 0; i < n; i++) { const r = rows.get(D.t0 + i*M5);
    if (r) { const o = +r[1], c = +r[4]; m.o[i] = o; m.h[i] = Math.max(+r[2], o, c); m.l[i] = Math.min(+r[3], o, c); m.c[i] = c; m.v[i] = +r[5]; prev = c; }
    else { m.o[i] = m.h[i] = m.l[i] = m.c[i] = prev; m.v[i] = 0; } }
  return m;
}
async function universe(coins, strats, withM5) {
  const per = {};
  { const q = [...coins]; await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const sym = q.shift();   // تنزيل مسبق 8 عملات مع بعض (الكاش على القرص)
      try { await klines(sym, "15m"); if (withM5) await klines(sym, "5m"); await funding(sym); } catch (e) { console.log("prefetch fail", sym, e.message); } } })); }
  if (strats.some(s => s.btcF)) { E.setBtcRef(buildD(await klines("BTCUSDT", "15m"))); console.log("BTC filter ref loaded"); }
  for (const sym of coins) {
    const rows = await klines(sym, "15m"), D = buildD(rows); if (!D) { console.log("skip", sym); continue; }
    if (withM5) D.m5 = buildM5(await klines(sym, "5m"), D);
    const F = fixF(await funding(sym), D), inds = { 1: E.makeInd(D, 1), 4: E.makeInd(D, 4), 16: E.makeInd(D, 16) };
    for (const sp of strats) if (sp.mult && !inds[sp.mult]) inds[sp.mult] = E.makeInd(D, sp.mult);
    D.sym = sym;   // لاستراتيجيات محصورة بعملات معينة
    D.fund = F;   // للاستراتيجيات اللي بتستعمل التمويل كفلتر (بس التمويل اللي صار قبل وقت الإشارة)   // فريمات تانية (6 ساعات = 24، 8 ساعات = 32)
    const raw = {}; for (const sp of strats) raw[sp.name] = E.evaluate(D, inds, sp, D.t0).filter(t => !t.open);
    D.m5 = null;   // توفير ذاكرة
    per[sym] = { D, F, raw, I4: inds[4], I16: inds[16] };   // 19/11: ترند العملة (ساعة/4س) لفحص «السوق كله نازل» console.log(sym, D.c.length, "bars", new Date(D.t0 + D.c.length*M15).toISOString());
  }
  return per;
}
const f2 = x => (x >= 0 ? "+" : "") + x.toFixed(2);
const pfS = x => x >= 99 ? "inf" : x.toFixed(2);
const sP = s => `n=${s.n} ${f2(s.usd)}$ PF${pfS(s.pf)} win${s.win.toFixed(0)}% gross/t${f2(s.gross)}$ t${s.t.toFixed(1)} DD${s.dd.toFixed(0)}$`;
const Pmain = (job) => ({ notional: job.notional || 200, maker: 0.0002, taker: 0.0005, slip: 0.0001, makerEntry: false });

function flatOf(per, name, P, rank) { return Object.keys(per).flatMap(sym => per[sym].raw[name].map(t => ({ ...E.money(t, per[sym].D, P, per[sym].F, 0), sym, name, rank: rank[sym] }))); }

// ---------- نوع 1: استراتيجيات على عدة عملات (تدريب/اختبار/جديدة + كل ربع) ----------
let LAST_SUM = null;
function jobMulti(job, per, coins) {
  const SUM = []; LAST_SUM = SUM;
  const P = Pmain(job), rank = Object.fromEntries(coins.map((c, i) => [c, i])), now = Math.max(...Object.values(per).map(x => x.D.t0 + x.D.c.length*M15));
  const days = E.periodDays(now), lines = [];
  const TAKEN = {};
  for (const name of job.strategies) {
    const { taken } = E.portfolio(flatOf(per, name, P, rank), job.slots || 10); TAKEN[name] = taken;
    const b = [[], [], []]; for (const t of taken) b[E.periodOf(t.eTs)].push(t);
    const s = b.map((x, i) => E.statsOf(x, days[i], P.notional));
    const q = new Map(); for (const t of taken) { const d = new Date(t.eTs), k = `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth()/3)+1}`; const o = q.get(k) || { n: 0, net: 0, L: 0, S: 0 }; o.n++; o.net += t.net; if (t.d === 1) o.L += t.net; else o.S += t.net; q.set(k, o); }
    const qs = [...q.entries()].sort();
    const coinsAll = Object.keys(per).filter(sym => { const raw = per[sym].raw[name]; const bb = [[], [], []]; for (const t of raw) { const m = E.money(t, per[sym].D, P, per[sym].F, 0); bb[E.periodOf(m.eTs)].push(m); } return bb.every(x => x.reduce((a, t) => a + t.net, 0) > 0); }).length;
    const PM = { ...P, makerEntry: true }, tm = E.portfolio(flatOf(per, name, PM, rank), job.slots || 10).taken, bm = [[], [], []];
    for (const t of tm) bm[E.periodOf(t.eTs)].push(t);
    const sm = bm.map((x, i) => E.statsOf(x, days[i], P.notional));
    if (job.coinPick) {   // اختيار العملات من فترة التدريب بس، وبعدين منشوف شو عملت هالعملات بالاختبار والجديدة
      for (const rule of job.coinPick) {
        const picked = Object.keys(per).filter(sym => { const tr = taken.filter(t => t.sym === sym && E.periodOf(t.eTs) === 0);
          if (tr.length < rule.minN) return false; let gp = 0, gl = 0; for (const t of tr) { if (t.net > 0) gp += t.net; else gl -= t.net; } return (gl ? gp/gl : 99) >= rule.pf; });
        const ps = new Set(picked), rest = Object.keys(per).filter(x => !ps.has(x));
        const st = set => { const b = [[], [], []]; for (const t of taken) if (set.has(t.sym)) b[E.periodOf(t.eTs)].push(t); return b.map((x, i) => E.statsOf(x, days[i], P.notional)); };
        const a = st(ps), o = st(new Set(rest));
        lines.push(`coin-pick (train n>=${rule.minN}, PF>=${rule.pf}) -> ${picked.length} coins [${picked.join(",")}]`,
          "  picked: " + E.PERIODS.map((p, i) => `${p}: ${sP(a[i])}`).join(" | "),
          "  others: " + E.PERIODS.map((p, i) => `${p}: ${sP(o[i])}`).join(" | "));
      }
    }
    SUM.push({ name, s, sm, v: E.verdictOf(s), vm: E.verdictOf(sm), coins: coinsAll, nc: Object.keys(per).length, q: qs.length ? [qs.filter(([, o]) => o.net > 0).length, qs.length] : null });
    lines.push(`## ${name} | ${E.verdictOf(s)} (maker-entry ${E.verdictOf(sm)}) | coins+all3 ${coinsAll}/${Object.keys(per).length}`,
      E.PERIODS.map((p, i) => `${p}: ${sP(s[i])}`).join(" | "),
      "maker-entry: " + E.PERIODS.map((p, i) => `${p}: ${sP(sm[i])}`).join(" | "),
      `quarters ${qs.filter(([, o]) => o.net > 0).length}/${qs.length}: ` + qs.map(([k, o]) => `${k} n${o.n} ${f2(o.net)} (L${f2(o.L)}/S${f2(o.S)})`).join(" | "), "");
    if (job.byCoin) {   // كل عملة لحال (بدون حد الـslots — العملة لوحدها)
      const rows = Object.keys(per).map(sym => {
        const tr = per[sym].raw[name].map(t => E.money(t, per[sym].D, P, per[sym].F, 0)), b = [[], [], []];
        for (const t of tr) b[E.periodOf(t.eTs)].push(t);
        const st = b.map((x, i) => E.statsOf(x, days[i], P.notional)), all = E.statsOf(tr, days[0] + days[1] + days[2], P.notional);
        return { sym, st, all };
      }).sort((a, z) => z.all.usd - a.all.usd);
      const c = x => x.n ? `n${x.n} ${f2(x.usd)}$ PF${pfS(x.pf)} w${x.win.toFixed(0)}%` : "—";
      lines.push(`### ${name} — كل عملة لحال (مرتبة حسب المجموع)`);
      for (const r of rows) lines.push(`${r.sym.padEnd(14)} | المجموع ${c(r.all)} | تدريب ${c(r.st[0])} | اختبار ${c(r.st[1])} | جديدة ${c(r.st[2])}`);
      const pos = rows.filter(r => r.all.usd > 0).length, p3 = rows.filter(r => r.st.every(x => x.n && x.usd > 0)).length;
      lines.push(`رابحة بالمجموع: ${pos}/${rows.length} | رابحة بالفترات الثلاث: ${p3}/${rows.length}`, "");
    }
  }
  if (job.corrWith && TAKEN[job.corrWith]) {   // ارتباط شهري مع استراتيجية أساسية + النتيجة لما يشتغلوا مع بعض (حسابين جنب بعض)
    const mon = tr => { const m = new Map(); for (const t of tr) { const d = new Date(t.xTs), k = d.getUTCFullYear()*12 + d.getUTCMonth(); m.set(k, (m.get(k) || 0) + t.net); } return m; };
    const base = TAKEN[job.corrWith], mb = mon(base);
    const byX = tr => [...tr].sort((a, z) => a.xTs - z.xTs);
    const stP = tr => { const b = [[], [], []]; for (const t of byX(tr)) b[E.periodOf(t.eTs)].push(t); return b.map((x, i) => E.statsOf(x, days[i], P.notional)); };
    lines.push(`# ارتباط مع: ${job.corrWith} (أرباح شهرية) + لما يشتغلوا مع بعض`);
    const sb = stP(base); lines.push(`لحالها: ` + E.PERIODS.map((p, i) => `${p}: ${sP(sb[i])}`).join(" | "));
    for (const name of job.strategies) { if (name === job.corrWith) continue;
      const mo = mon(TAKEN[name]), ks = [...new Set([...mb.keys(), ...mo.keys()])].sort((a, b) => a - b);
      const x = ks.map(k => mb.get(k) || 0), y = ks.map(k => mo.get(k) || 0), mx = x.reduce((a, b) => a + b, 0)/x.length, my = y.reduce((a, b) => a + b, 0)/y.length;
      let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]-mx)*(y[i]-my); sxx += (x[i]-mx)**2; syy += (y[i]-my)**2; }
      const corr = sxx && syy ? sxy/Math.sqrt(sxx*syy) : 0;
      const baseBad = ks.filter((k, i) => x[i] < 0), helped = baseBad.filter(k => (mo.get(k) || 0) > 0).length;
      const both = stP(base.concat(TAKEN[name]));
      lines.push(`${name}: ارتباط شهري ${corr.toFixed(2)} | بالشهور اللي ${job.corrWith} خسرت فيها (${baseBad.length}) هاي ربحت بـ${helped}`,
        `  مع بعض: ` + E.PERIODS.map((p, i) => `${p}: ${sP(both[i])}`).join(" | "));
    }
    lines.push("");
  }
  if (job.portGroups) {   // محافظ معرّفة قبل التشغيل: كل استراتيجية بحسابها (slots لحالها)، منجمع الصفقات ومنحسب PF و DD المشترك
    const stG = tr => { const b = [[], [], []]; for (const t of [...tr].sort((a, z) => a.xTs - z.xTs)) b[E.periodOf(t.eTs)].push(t); return b.map((x, i) => E.statsOf(x, days[i], P.notional)); };
    const rd = s => s.dd > 0 ? (s.usd/s.dd).toFixed(2) : "-";
    lines.push("# محافظ (حسابات منفصلة، مجموعة قبل التشغيل) — ربح/DD لكل فترة");
    for (const g of job.portGroups) { if (!g.every(n => TAKEN[n])) { lines.push(`(missing) ${g.join(" + ")}`); continue; }
      const s = stG(g.flatMap(n => TAKEN[n]));
      lines.push(`${g.join(" + ")} | ${E.verdictOf(s)} | ربح/DD ${s.map(rd).join(" / ")}`, "  " + E.PERIODS.map((p, i) => `${p}: ${sP(s[i])}`).join(" | ")); }
    lines.push("");
  }
  if (job.variants || job.select) {   // اختيار صادق: الأفضل بالتدريب بس، وبعدين منشوف اختباره وجديده
    const C = job.selectOnly ? SUM.filter(x => job.selectOnly.includes(x.name)) : SUM;
    const ok = C.filter(x => x.s[0].n >= 100).sort((a, b) => b.s[0].usd - a.s[0].usd);
    const okm = C.filter(x => x.sm[0].n >= 100).sort((a, b) => b.sm[0].usd - a.sm[0].usd);
    const show = (tag, x, k) => `${tag}: ${x.name} | ` + E.PERIODS.map((p, i) => `${p}: ${sP(x[k][i])}`).join(" | ");
    lines.unshift("# SELECTION (chosen on TRAIN only)", ok[0] ? show("best-train taker", ok[0], "s") : "none", okm[0] ? show("best-train maker", okm[0], "sm") : "none",
      "# all variants by train net (taker): " + ok.map(x => `${x.name} ${f2(x.s[0].usd)}/${f2(x.s[1].usd)}/${f2(x.s[2].usd)}`).join(" ; "), "");
  }
  return lines.join("\n");
}

// ---------- 19/11: «السوق كله نازل» (breadth) — نسبة العملات النازلة بآخر X ساعة قبل الدخول (شموع مسكّرة بس) ----------
// job.breadth = { lookbacks: [8, 16], thr: [0.7, 0.8] } · بيعمل لكل استراتيجية: «| ترند» (قوانين المرآة) و «| ترند + سوق»
// قوانين المرآة (18/11): لونج والعملة طالعة على الساعة ← لا · شورت والعملة طالعة على 4 ساعات ← لا · Range لازم مع ترند 4 ساعات
function applyBreadth(job, per) {
  const syms = Object.keys(per), cfg = job.breadth, BR = {};
  const t0 = Math.min(...syms.map(s => per[s].D.t0)), t1 = Math.max(...syms.map(s => per[s].D.t0 + per[s].D.c.length*M15)), N = Math.round((t1 - t0)/M15) + 1;
  for (const lb of cfg.lookbacks) { const dn = new Float32Array(N), tot = new Float32Array(N);
    for (const s of syms) { const D = per[s].D, off = Math.round((D.t0 - t0)/M15);
      for (let i = lb; i < D.c.length; i++) { const g = off + i + 1; if (g >= N) break; tot[g]++; if (D.c[i] < D.c[i - lb]) dn[g]++; } }   // g = وقت الدخول بعد ما الشمعة i سكّرت
    BR[lb] = { dn, tot }; }
  const brAt = (lb, ts) => { const g = Math.round((ts - t0)/M15), b = BR[lb]; return g >= 0 && g < N && b.tot[g] >= 20 ? b.dn[g]/b.tot[g] : null; };
  const trendOf = (I, m, i) => { const k = Math.floor((i + 1)/m) - 1; return k >= 50 && k < I.n && I.ema50[k] != null ? (I.C[k] > I.ema50[k] ? 1 : -1) : 0; };
  if (cfg.buckets) {   // 19/11: تقرير بس — كل استراتيجية مقسومة حسب الاتجاه × حالة السوق (نسبة العملات النازلة بآخر lb شمعة)
    const lb = cfg.buckets.lb, [c1, c2] = cfg.buckets.cuts, lab = b => b < c1 ? "سوق طالع" : b < c2 ? "سوق مختلط" : "سوق نازل", out = [];
    for (const name of job.strategies) for (const d of [1, -1]) for (const m of ["سوق طالع", "سوق مختلط", "سوق نازل"]) out.push(`${name} ⟨${d === 1 ? "لونج" : "شورت"} · ${m}⟩`);
    for (const s of syms) { const P = per[s], D = P.D;
      for (const name of job.strategies) for (const t of (P.raw[name] || [])) { const b = brAt(lb, D.t0 + t.e*M15); if (b === null) continue;
        const k = `${name} ⟨${t.d === 1 ? "لونج" : "شورت"} · ${lab(b)}⟩`; (P.raw[k] = P.raw[k] || []).push(t); }
      for (const k of out) P.raw[k] = P.raw[k] || []; }
    return out.filter(k => syms.some(s => per[s].raw[k].length));
  }
  const names = [], combo = job.combo ? job.combo.name : null, tags = ["", " | ترند"];
  for (const lb of cfg.lookbacks) for (const th of cfg.thr) tags.push(` | ترند + لونج لا إذا ${Math.round(th*100)}%+ نازلة ${lb/4}س`);
  for (const name of job.strategies) for (const tag of tags) names.push(name + tag);
  const stats = {};
  for (const s of syms) { const P = per[s], D = P.D;
    for (const name of job.strategies) { const raw = P.raw[name] || [];
      const tr = raw.filter(t => { const i = t.e - 1, c1 = trendOf(P.I4, 4, i), c4 = trendOf(P.I16, 16, i);
        if (t.d === 1 && c1 === 1) return false; if (t.d === -1 && c4 === 1) return false; if (/^Range/.test(name) && c4 !== t.d) return false; return true; });
      P.raw[name + " | ترند"] = tr;
      for (const lb of cfg.lookbacks) for (const th of cfg.thr) {
        P.raw[name + ` | ترند + لونج لا إذا ${Math.round(th*100)}%+ نازلة ${lb/4}س`] = tr.filter(t => { if (t.d !== 1) return true; const b = brAt(lb, D.t0 + t.e*M15); const k = `${lb}|${th}`; stats[k] = stats[k] || [0, 0]; stats[k][1]++; if (b !== null && b >= th) { stats[k][0]++; return false; } return true; }); }
    }
    if (combo) for (const tag of tags) {   // كل الحقيقي مع بعض: صفقة وحدة لكل عملة (زي المرآة)، والأولوية حسب ترتيب القائمة
      const all = job.strategies.flatMap((n, r) => (P.raw[n + tag] || []).map(t => ({ t, r }))).sort((a, b) => a.t.e - b.t.e || a.r - b.r);
      const out = []; let busy = -1; for (const { t } of all) { if (t.e <= busy) continue; out.push(t); busy = t.x; } P.raw[combo + tag] = out; }
  }
  if (combo) for (const tag of tags) names.push(combo + tag);
  console.log("breadth: blocked longs", JSON.stringify(stats));
  return names;
}

// ---------- نوع 2: اختيار متحرك (شغّل اللي شغال) ----------
function jobRolling(job, per, coins) {
  const P = Pmain(job), rank = Object.fromEntries(coins.map((c, i) => [c, i])), now = Math.max(...Object.values(per).map(x => x.D.t0 + x.D.c.length*M15));
  const names = job.strategies, T = {};
  for (const name of names) T[name] = E.portfolio(flatOf(per, name, P, rank), job.slots || 10).taken;
  const mStarts = []; { const d = new Date(E.LAB_START); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); while (d.getTime() < now) { mStarts.push(d.getTime()); d.setUTCMonth(d.getUTCMonth() + 1); } }
  const out = [];
  const pfOf = a => { let gp = 0, gl = 0; for (const t of a) { if (t.net > 0) gp += t.net; else gl -= t.net; } return gl ? gp/gl : (gp ? 99 : 0); };
  for (const look of job.lookbacks || [30, 60, 90]) for (const thr of job.thresholds || [1.1, 1.2, 1.3]) {
    let tot = 0, n = 0, eq = 0, peak = 0, dd = 0, monthsPos = 0, monthsAct = 0; const rows = [], all = [];
    for (let k = 0; k < mStarts.length; k++) {
      const ms = mStarts[k], me = k + 1 < mStarts.length ? mStarts[k+1] : now; if (ms - look*DAY < E.LAB_START) continue;
      const on = names.filter(nm => { const past = T[nm].filter(t => t.xTs <= ms && t.eTs >= ms - look*DAY); return past.length >= (job.minTrades || 20) && pfOf(past) >= thr; });
      const tr = on.flatMap(nm => T[nm].filter(t => t.eTs >= ms && t.eTs < me));
      const net = tr.reduce((a, t) => a + t.net, 0); tot += net; n += tr.length; all.push(...tr);
      if (on.length) { monthsAct++; if (net > 0) monthsPos++; }
      eq += net; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
      rows.push(`${new Date(ms).toISOString().slice(0, 7)} on=${on.length} n=${tr.length} ${f2(net)}$ [${on.join(", ")}]`);
    }
    out.push(`## lookback ${look}d PF>=${thr} | total ${f2(tot)}$ n=${n} PF${pfS(pfOf(all))} DD${dd.toFixed(0)}$ | active months ${monthsAct}, positive ${monthsPos}`, ...rows, "");
  }
  // مرجع: كل الاستراتيجيات دايماً شغالة، وكل وحدة لحالها
  const base = names.map(nm => ({ nm, net: T[nm].reduce((a, t) => a + t.net, 0), n: T[nm].length })).sort((a, b) => b.net - a.net);
  out.push("## reference: each strategy always on (same period)", ...base.map(x => `${x.nm}: n=${x.n} ${f2(x.net)}$`));
  return out.join("\n");
}

function pushFiles(files, msg) {   // فحوصات متوازية: كل واحد بيرفع ملفاته، ومع إعادة محاولة
  try { execSync(`git add ${files.map(f => `"${f}"`).join(" ")} && git commit -q -m "nexora-lab: ${msg}"`, { cwd: ROOT, stdio: "inherit" }); } catch (e) { return; }
  for (let k = 0; k < 8; k++) { try { execSync("git pull --rebase -q && git push -q", { cwd: ROOT, stdio: "inherit" }); return; } catch (e) { try { execSync("git rebase --abort", { cwd: ROOT }); } catch (_) {} execSync(`sleep ${2 + k*3}`); } }
  console.log("push failed after retries");
}
// عملات من أرشيف بايننس (USDT فيوتشر) ما استعملناها: لازم يكون إلها بيانات بالشهر الماضي، وعيّنة ثابتة (hash) بعدد limit
async function archiveCoins(cfg) {
  const ex = new Set(cfg.exclude || []), syms = []; let marker = "";
  for (let page = 0; page < 20; page++) {
    const url = `https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=data/futures/um/monthly/klines/${marker ? "&marker=" + encodeURIComponent(marker) : ""}`;
    const xml = await (await fetch(url)).text();
    const got = [...xml.matchAll(/<Prefix>data\/futures\/um\/monthly\/klines\/([A-Z0-9]+)\/<\/Prefix>/g)].map(m => m[1]);
    syms.push(...got);
    const nm = xml.match(/<NextMarker>([^<]+)<\/NextMarker>/); if (!/<IsTruncated>true/.test(xml) || !nm) break; marker = nm[1];
  }
  const bad = /^(USDC|BUSD|TUSD|FDUSD|USDP|DAI|BTCDOM|DEFI|FOOTBALL|BLUEBIRD)/;
  const cand = [...new Set(syms)].filter(x => x.endsWith("USDT") && !ex.has(x) && !bad.test(x));
  const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const h = x => crypto.createHash("sha1").update(x + (cfg.seed || "nexora")).digest("hex");
  const out = [];
  for (const x of cand.sort((a, b) => h(a) < h(b) ? -1 : 1)) {
    if (out.length >= (cfg.limit || 100)) break;
    const r = await fetch(`https://data.binance.vision/data/futures/um/monthly/klines/${x}/15m/${x}-15m-${lastMonth}.zip`, { method: "HEAD" }).catch(() => null);
    if (r && r.ok) out.push(x);
  }
  return out;
}

if (require.main === module) (async () => {
  const jobsDir = process.env.JOBS_DIR || path.join(__dirname, "jobs"), resDir = process.env.RES_DIR || path.join(__dirname, "results");
  const jobs = fs.readdirSync(jobsDir).filter(f => f.endsWith(".json"));
  const engineHash = crypto.createHash("sha1").update(grab("nexora/index.html", "engine")).digest("hex").slice(0, 8);
  const todo = [];
  for (const f of jobs) {
    const raw = fs.readFileSync(path.join(jobsDir, f), "utf8"), job = JSON.parse(raw), id = f.replace(/\.json$/, "");
    const hash = crypto.createHash("sha1").update(raw + engineHash + (job.daily ? new Date().toISOString().slice(0, 10) : "")).digest("hex").slice(0, 10);
    const rf = path.join(resDir, id + ".txt"); const old = fs.existsSync(rf) ? fs.readFileSync(rf, "utf8") : "";
    if (old.includes(`hash=${hash}`) && !process.env.FORCE) continue;
    todo.push({ id, job, hash, rf });
  }
  if (process.env.ONLY_CHANGED !== undefined) { const keep = process.env.ONLY_CHANGED.split(",").filter(Boolean); todo.splice(0, todo.length, ...todo.filter(t => keep.includes(t.id))); }
  if (process.env.LIST) { fs.writeFileSync(process.env.LIST, JSON.stringify(todo.sort((a, b) => (b.job.priority || 0) - (a.job.priority || 0)).map(t => t.id))); console.log("todo:", todo.map(t => t.id).join(",")); return; }
  if (process.env.ONLY) { const keep = process.env.ONLY.split(","); todo.splice(0, todo.length, ...todo.filter(t => keep.includes(t.id))); }
  if (!todo.length) { console.log("nothing to do"); return; }
  todo.sort((a, b) => (b.job.priority || 0) - (a.job.priority || 0));
  const coins = [...new Set(todo.flatMap(t => t.job.coins))];
  // نسخ معدّلة من استراتيجية موجودة (نفس الكود، إعدادات مختلفة)
  for (const t of todo) for (const v of (t.job.variants || [])) { const b = E.STRATS.find(s => s.name === v.base); if (b && !E.STRATS.find(s => s.name === v.name)) E.STRATS.push({ ...b, ...v, base: undefined }); }
  for (const t of todo) if (t.job.variants) t.job.strategies = [...(t.job.strategies || []), ...t.job.variants.map(v => v.name)];
  for (const t of todo) if (t.job.pairs) t.job.strategies = [...new Set(t.job.pairs.flat())];
  const names = [...new Set(todo.flatMap(t => t.job.strategies))];
  const strats = E.STRATS.filter(s => names.includes(s.name));
  const missing = names.filter(n => !strats.find(s => s.name === n)); if (missing.length) console.log("unknown strategies:", missing);
  const t0 = Date.now();
  for (let { id, job, hash, rf } of todo) try {   // كل فحص: بس عملاته واستراتيجياته (أسرع)
    if (job.coinsFromArchive) { job.coins = await archiveCoins(job.coinsFromArchive); console.log("archive coins:", job.coins.length, job.coins.join(",")); }
    const sub = await universe(job.coins, strats.filter(s => job.strategies.includes(s.name)), !!job.m5);
    let body;
    if (job.breadth) { const nm = applyBreadth(job, sub); job = { ...job, strategies: nm, slots: job.slots }; }
    if (job.type === "confirm") {   // دمج: صفقة A بتنحسب بس إذا B فاتحة صفقة بنفس الاتجاه على نفس العملة لحظة الدخول
      const names = [];
      for (const [A, B] of job.pairs) { const nm = `${A} ✚ ${B}`; names.push(nm);
        for (const sym of Object.keys(sub)) { const r = sub[sym].raw, bt = r[B] || [];
          r[nm] = (r[A] || []).filter(a => bt.some(b => b.d === a.d && b.e <= a.e && a.e <= b.x)); } }
      body = jobMulti({ ...job, strategies: [...new Set(job.pairs.flatMap(p => p))].concat(names), select: true, selectOnly: names }, sub, job.coins);
    } else body = job.type === "rolling" ? jobRolling(job, sub, job.coins) : jobMulti(job, sub, job.coins);
    const head = `NEXORA LAB (GitHub) | ${id} | ${new Date().toISOString()} | hash=${hash} | engine=${engineHash} | coins ${Object.keys(sub).length} | slots ${job.slots || 10} | taker 0.05% maker 0.02% slip 0.01% | $${job.notional || 200}/trade | periods: train<${new Date(E.LAB_SPLIT).toISOString().slice(0,10)}, test<${new Date(E.LAB_END).toISOString().slice(0,10)}, fresh after\n`;
    fs.writeFileSync(rf, head + body + "\n"); console.log("wrote", rf);
    if (job.type !== "rolling" && LAST_SUM) {   // ملخص للمنصة: حكم كل استراتيجية
      const sdir = path.join(resDir, "summary"); fs.mkdirSync(sdir, { recursive: true });
      const sf = path.join(sdir, id + ".json"), sumj = {};
      const pick = x => ({ n: x.n, usd: +x.usd.toFixed(2), pf: +Math.min(x.pf, 99).toFixed(3), t: +x.t.toFixed(2), gross: +x.gross.toFixed(3), avg: +x.avg.toFixed(4), dd: +x.dd.toFixed(1), win: +x.win.toFixed(1) });
      for (const r of LAST_SUM) sumj[r.name] = { at: new Date().toISOString(), verdict: r.v, verdictMaker: r.vm, coinsAll3: r.coins, coins: r.nc, quarters: r.q, notional: job.notional || 200, train: pick(r.s[0]), test: pick(r.s[1]), fresh: pick(r.s[2]) };
      fs.writeFileSync(sf, JSON.stringify(sumj));
      if (process.env.CI) pushFiles([sf], "summary " + id);
    }
    if (process.env.CI) pushFiles([rf], id);   // نتيجة كل فحص بتنرفع أول ما تخلص
  
  } catch (err) {   // اكتب الخطأ بملف النتيجة عشان نشوفه
    console.error(err); fs.writeFileSync(rf, `NEXORA LAB ERROR | ${id} | ${new Date().toISOString()}\n${err && err.stack || err}\n`);
    if (process.env.CI) pushFiles([rf], "error " + id);
  }
  console.log("done in", ((Date.now() - t0)/1000).toFixed(0), "s");
})().catch(e => { console.error(e); process.exit(1); });

module.exports = { klines, funding, E, applyBreadth };
