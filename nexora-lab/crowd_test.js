// crowd_test.js — 28/11 (طلب المستخدم: فكرة 1 «التمويل والعقود المفتوحة»): هل ازدحام السوق بيعطي أفضلية؟
// بيانات بايننس الرسمية (data.binance.vision): metrics كل 5 د (العقود المفتوحة · نسبة لونج/شورت للحسابات · كبار المتداولين · نسبة الشاري/البايع)
//   + premiumIndexKlines ساعة (البريميوم = أساس التمويل) + شموع دقيقة للدخول والخروج
// الإشارات كل ساعة على أول الساعة (بس بالقيم المعروفة قبلها — بلا نظر للمستقبل) · المتطرف = فوق 95% أو تحت 5% من آخر 7 أيام لنفس العملة
//   prem: البريميوم (معدل 8 ساعات) · lsr: نسبة لونج/شورت الحسابات · top: نسبة كبار المتداولين (مراكز) · oi: العقود المفتوحة طلعت كتير بـ4 ساعات + السعر تحرك ≥2% · taker: نسبة الشاري/البايع آخر ساعة
//   كل إشارة بالاتجاهين: «عكس الزحمة» و «مع الزحمة»
// الخروج: E4 = بعد 4 ساعات · E8 = بعد 8 ساعات (وقف طوارئ 8% بالتنتين) · ATR = وقف 2×ATR ساعة وهدف 2×ATR وحد أقصى 8 ساعات
// تكاليف: دخول ماركت 0.05% + انزلاق 0.1% · خروج ماركت 0.05% + 0.1% (الهدف ليمت 0.02%) · ترتيب أسوأ جوا شمعة الدقيقة · صفقة 44$
// الحكم (محدد قبل الفحص): بنختار على أيلول+تشرين1 لعملات الغريد (ربح + PF>1.1 + 30 صفقة) ← لازم يربح بتشرين2 (PF>1.1) + يربح على 10 عملات تانية ما انشافت
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const DATA = process.env.NEXORA_DATA || path.join(require("os").homedir(), ".nexora-data");
const M1 = 60e3, H1 = 3600e3, DAY = 864e5;
const START = Date.UTC(2026, 8, 1), SPLIT = Date.UTC(2026, 10, 1);
const A = ["AKEUSDT", "JCTUSDT", "IDOLUSDT", "EVAAUSDT", "AGTUSDT", "BULLAUSDT", "BLESSUSDT", "INITUSDT", "ONUSDT", "ARIAUSDT"];
const B = ["SOLUSDT", "DOGEUSDT", "WLDUSDT", "TIAUSDT", "STRKUSDT", "BLURUSDT", "TRUMPUSDT", "SOPHUSDT", "PIEVERSEUSDT", "MMTUSDT"];
const SIZE = 44, TAKER = 0.0005, MAKER = 0.0002, SLIP = 0.001;
async function dl(url, file) { if (fs.existsSync(file)) return true; if (fs.existsSync(file + ".404")) return false;
  for (let k = 0; k < 4; k++) { try { const r = await fetch(url); if (r.status === 404) { fs.writeFileSync(file + ".404", ""); return false; } if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; } } catch (e) {} await new Promise(z => setTimeout(z, 1500*(k+1))); }
  return false; }
const rows = f => execSync(`unzip -p "${f}"`, { maxBuffer: 1 << 30 }).toString().split("\n").filter(l => /^\d/.test(l)).map(l => l.split(","));
const days = (a, b) => { const o = []; for (let t = a; t < b; t += DAY) o.push(new Date(t).toISOString().slice(0, 10)); return o; };
const END = Math.floor((Date.now() - DAY)/DAY)*DAY;   // آخر يوم كامل منشور
async function daily(kind, sym, sub, ds) { const dir = path.join(DATA, kind, sym, sub || ""); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${ds}.zip`), u = `https://data.binance.vision/data/futures/um/daily/${kind}/${sym}/${sub ? sub + "/" : ""}${sym}-${kind === "metrics" ? "metrics" : sub}-${ds}.zip`;
  return (await dl(u, f)) ? rows(f) : []; }
async function load(sym) {
  const K = new Map(), M = [], P = new Map(); const D = days(START - 8*DAY, END);
  for (let i = 0; i < D.length; i += 8) await Promise.all(D.slice(i, i + 8).map(async ds => {
    for (const r of await daily("klines", sym, "1m", ds)) K.set(+r[0], [+r[1], +r[2], +r[3], +r[4]]);
    for (const r of await daily("metrics", sym, null, ds)) M.push([Date.parse(r[0].replace(" ", "T") + "Z"), +r[2], +r[6], +r[5], +r[7]]);   // وقت · OI · لونج/شورت حسابات · كبار (مراكز) · شاري/بايع
    for (const r of await daily("premiumIndexKlines", sym, "1h", ds)) P.set(+r[0], +r[4]); }));
  const t = [...K.keys()].sort((a, b) => a - b); M.sort((a, b) => a[0] - b[0]);
  return { t, o: t.map(k => K.get(k)[0]), h: t.map(k => K.get(k)[1]), l: t.map(k => K.get(k)[2]), c: t.map(k => K.get(k)[3]), M, P }; }
// ميزات كل ساعة H (معروفة قبل H)
function feats(X) {
  const idx = new Map(X.t.map((t, i) => [t, i])), H0 = Math.ceil(X.t[0]/H1)*H1, out = [];
  let mi = -1, hh = [], atr = null, prevC = null;
  for (let H = H0; H <= X.t[X.t.length-1]; H += H1) { const i = idx.get(H); if (i === undefined) continue;
    // شمعة الساعة اللي سكّرت (H-1h → H) للـATR
    let hi = -1e18, lo = 1e18, ok = 0; for (let k = i - 60; k < i; k++) if (k >= 0 && X.t[k] >= H - H1) { hi = Math.max(hi, X.h[k]); lo = Math.min(lo, X.l[k]); ok++; }
    const c = X.c[i-1]; if (ok >= 50 && prevC !== null) { const tr = Math.max(hi - lo, Math.abs(hi - prevC), Math.abs(lo - prevC)); atr = atr === null ? tr : (atr*13 + tr)/14; } prevC = ok >= 50 ? c : prevC;
    while (mi + 1 < X.M.length && X.M[mi+1][0] + 5*M1 <= H) mi++;
    const m = mi >= 0 && H - X.M[mi][0] < 30*M1 ? X.M[mi] : null;
    let tk = 0, tn = 0; for (let q = mi; q >= 0 && X.M[q][0] > H - H1 - 5*M1; q--) { tk += X.M[q][4]; tn++; }
    let pr = 0, pn = 0; for (let q = 1; q <= 8; q++) { const v = X.P.get(H - q*H1); if (v !== undefined) { pr += v; pn++; } }
    out.push({ H, i, c, atr, oi: m ? m[1] : null, lsr: m ? m[2] : null, top: m ? m[3] : null, taker: tn ? tk/tn : null, prem: pn >= 6 ? pr/pn : null }); }
  const by = new Map(out.map((f, j) => [f.H, j]));
  for (let j = 0; j < out.length; j++) { const f = out[j], j4 = by.get(f.H - 4*H1);
    f.oic = j4 !== undefined && out[j4].oi && f.oi ? f.oi/out[j4].oi - 1 : null; f.pc = j4 !== undefined ? f.c/out[j4].c - 1 : null; }
  return out; }
function pct(F, j, key, lo = 0.05, hi = 0.95) {   // مكان القيمة الحالية بين آخر 168 ساعة (قبلها)
  const v = F[j][key]; if (v === null || v === undefined || j < 168) return 0; const a = []; for (let q = j - 168; q < j; q++) { const x = F[q][key]; if (x !== null && x !== undefined) a.push(x); }
  if (a.length < 120) return 0; a.sort((x, y) => x - y); return v >= a[Math.floor(hi*(a.length - 1))] ? 1 : v <= a[Math.floor(lo*(a.length - 1))] ? -1 : 0; }
const SIG = {   // بيرجع «اتجاه الزحمة» (1 = الكل لونج/الشرا قوي) — بعدين منقرر عكسها أو معها
  prem: (F, j) => pct(F, j, "prem"), lsr: (F, j) => pct(F, j, "lsr"), top: (F, j) => pct(F, j, "top"), taker: (F, j) => pct(F, j, "taker"),
  oi: (F, j) => { const f = F[j]; return pct(F, j, "oic") === 1 && f.pc !== null && Math.abs(f.pc) >= 0.02 ? Math.sign(f.pc) : 0; } };
function sim(X, F, sig, dir, ex, from, to) {
  const out = []; let busy = 0;
  for (let j = 0; j < F.length; j++) { const f = F[j]; if (f.H < from || f.H >= to || f.H < busy || !f.atr) continue;
    const s = SIG[sig](F, j); if (!s) continue; const d = dir === "contra" ? -s : s;
    let i = f.i, e = X.o[i]*(1 + d*SLIP), maxT = f.H + (ex === "E4" ? 4 : 8)*H1, stop = ex === "ATR" ? e - d*2*f.atr : e*(1 - d*0.08), tg = ex === "ATR" ? e + d*2*f.atr : null, r = null, why = "";
    for (; i < X.t.length; i++) { if (X.t[i] >= maxT) { r = d*(X.o[i]*(1 - d*SLIP)/e - 1) - 2*TAKER; why = "وقت"; break; }
      const adv = d === 1 ? X.l[i] : X.h[i], fav = d === 1 ? X.h[i] : X.l[i];   // ترتيب أسوأ: الضد أول
      if (d*(adv - stop) <= 0) { const x = d === 1 ? Math.min(X.o[i], stop) : Math.max(X.o[i], stop); r = d*(x*(1 - d*SLIP)/e - 1) - 2*TAKER; why = "وقف"; break; }
      if (tg !== null && d*(fav - tg) >= 0) { r = d*(tg/e - 1) - TAKER - MAKER; why = "هدف"; break; } }
    if (r === null) break; out.push({ t: f.H, r, why }); busy = X.t[i] + 1; }
  return out; }
const st = a => { const W = a.filter(x => x.r > 0), L = a.filter(x => x.r <= 0), gw = W.reduce((q, x) => q + x.r, 0), gl = L.reduce((q, x) => q + x.r, 0);
  return { n: a.length, wr: a.length ? W.length/a.length : 0, net: SIZE*(gw + gl), pf: gl ? gw/-gl : (gw ? 99 : 0) }; };
const fmt = s => `${s.n} · ${(100*s.wr).toFixed(0)}% · ${(s.net >= 0 ? "+" : "") + s.net.toFixed(0)}$ · PF ${s.pf.toFixed(2)}`;
(async () => {
  const X = {}, F = {};
  for (const sym of [...A, ...B]) { X[sym] = await load(sym); if (!X[sym].t.length) { console.log("ما في بيانات", sym); continue; } F[sym] = feats(X[sym]);
    const f = F[sym], n = k => f.filter(x => x[k] !== null && x[k] !== undefined).length; console.log(sym, X[sym].t.length, "دقيقة ·", f.length, "ساعة · OI", n("oi"), "· بريميوم", n("prem")); }
  const SN = { prem: "البريميوم (أساس التمويل) متطرف", lsr: "نسبة لونج/شورت الحسابات متطرفة", top: "نسبة كبار المتداولين متطرفة", taker: "الشاري/البايع آخر ساعة متطرف", oi: "العقود المفتوحة طلعت كتير + السعر تحرك ≥2%" };
  const DN = { contra: "عكس الزحمة", follow: "مع الزحمة" }, EN = { E4: "تسكير بعد 4 س", E8: "تسكير بعد 8 س", ATR: "وقف/هدف 2×ATR" };
  const out = [`# ازدحام السوق (عقود مفتوحة · نسب لونج/شورت · بريميوم التمويل) · بيانات بايننس الرسمية · شموع دقيقة · ترتيب أسوأ · تكلفة حقيقية · صفقة ${SIZE}$`,
    `# من ${new Date(START).toISOString().slice(0, 10)} لـ ${new Date(END).toISOString().slice(0, 10)} · الاختيار على أيلول+تشرين1 (عملات الغريد) · الفحص: تشرين2 + 10 عملات تانية`,
    `# عملات الغريد: ${A.map(s => s.replace("USDT", "")).join(" ")} · العملات التانية: ${B.map(s => s.replace("USDT", "")).join(" ")}`, "",
    "الإشارة | الاتجاه | الخروج | اختيار: أيلول+تشرين1 (صفقات · نسبة · صافي · PF) | فحص: تشرين2 | فحص: عملات تانية كل الفترة | الحكم"];
  const res = [];
  for (const sig in SIG) for (const dir of ["contra", "follow"]) for (const ex of ["E4", "E8", "ATR"]) {
    const run = (C, a, b) => C.filter(s => F[s]).flatMap(s => sim(X[s], F[s], sig, dir, ex, a, b));
    const tr = st(run(A, START, SPLIT)), te = st(run(A, SPLIT, END + DAY)), ob = st(run(B, START, END + DAY));
    const pick = tr.net > 0 && tr.pf > 1.1 && tr.n >= 30, ok = pick && te.net > 0 && te.pf > 1.1 && ob.net > 0;
    res.push({ sig, dir, ex, tr, te, ob, pick, ok });
    out.push(`${SN[sig]} | ${DN[dir]} | ${EN[ex]} | ${fmt(tr)} | ${fmt(te)} | ${fmt(ob)} | ${ok ? "✅ نجح" : pick ? "🟡 انختار بس ما نجح بالفحص" : "❌"}`); }
  const ok = res.filter(r => r.ok); out.push("", ok.length ? `## نجح ${ok.length}: ` + ok.map(r => `${SN[r.sig]} · ${DN[r.dir]} · ${EN[r.ex]}`).join(" | ") : "## ولا إشارة نجحت بالحكم المحدد");
  fs.writeFileSync(path.join(__dirname, "results", "crowd_test.txt"), out.join("\n") + "\n"); console.log(out.join("\n"));
})();
