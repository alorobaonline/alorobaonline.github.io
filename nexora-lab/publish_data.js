// بيانات جاهزة للمنصة: شموع 15m و5m (وتمويل) من أرشيف بايننس، مضغوطة، على فرع nexora-data
// المنصة بتحمّلها من raw.githubusercontent.com (سريع، بدون حد طلبات بايننس) وبتكمّل آخر ساعات من بايننس.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { klines, funding } = require("./runner.js");
const OUT = process.env.OUT || "/tmp/nexora-data", DAY = 864e5;
const COINS = process.env.COINS ? process.env.COINS.split(",") : JSON.parse(fs.readFileSync(path.join(__dirname, "jobs", "s15-improve.json"), "utf8")).coins;
const D15 = +(process.env.D15 || 420), D5 = +(process.env.D5 || 120);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const now = Date.now(), from15 = now - D15*DAY, from5 = now - D5*DAY, meta = { updated: new Date().toISOString(), coins: {} };
  const one = async sym => {
    try {
      const r15 = [...(await klines(sym, "15m", from15 - 31*DAY)).values()].filter(r => +r[0] >= from15).sort((a, b) => a[0] - b[0]);
      if (!r15.length) { console.log("skip", sym); return; }
      fs.writeFileSync(path.join(OUT, `k15_${sym}.csv.gz`), zlib.gzipSync(r15.map(r => [r[0], r[1], r[2], r[3], r[4], r[5]].join(","))   /* + فوليوم */.join("\n"), { level: 9 }));
      const r5 = [...(await klines(sym, "5m", from5 - 31*DAY)).values()].filter(r => +r[0] >= from5).sort((a, b) => a[0] - b[0]);
      fs.writeFileSync(path.join(OUT, `k5_${sym}.csv.gz`), zlib.gzipSync(r5.map(r => [r[0], r[1], r[2], r[3], r[4], r[5]].join(",")).join("\n"), { level: 9 }));
      const f = (await funding(sym)).filter(x => x.t >= from15).map(x => [x.t, x.rate]);
      fs.writeFileSync(path.join(OUT, `f_${sym}.json`), JSON.stringify(f));
      meta.coins[sym] = { first15: +r15[0][0], last15: +r15[r15.length-1][0], first5: r5.length ? +r5[0][0] : null, last5: r5.length ? +r5[r5.length-1][0] : null, lastF: f.length ? f[f.length-1][0] : null };
      console.log(sym, r15.length, r5.length);
    } catch (e) { console.log("fail", sym, e.message); }
  };
  const q = [...COINS]; await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) await one(q.shift()); }));   // 6 عملات مع بعض
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta));
})();
