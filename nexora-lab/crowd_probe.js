// 28/11: فحص شكل ملفات بايننس العامة (metrics · premiumIndexKlines · fundingRate) قبل فحص التمويل/العقود المفتوحة
const { execSync } = require("child_process"), fs = require("fs");
const U = ["https://data.binance.vision/data/futures/um/daily/metrics/AKEUSDT/AKEUSDT-metrics-2026-11-20.zip",
  "https://data.binance.vision/data/futures/um/daily/metrics/EVAAUSDT/EVAAUSDT-metrics-2026-09-05.zip",
  "https://data.binance.vision/data/futures/um/daily/premiumIndexKlines/AKEUSDT/1h/AKEUSDT-1h-2026-11-20.zip",
  "https://data.binance.vision/data/futures/um/monthly/premiumIndexKlines/AKEUSDT/1h/AKEUSDT-1h-2026-10.zip",
  "https://data.binance.vision/data/futures/um/monthly/fundingRate/AKEUSDT/AKEUSDT-fundingRate-2026-10.zip",
  "https://data.binance.vision/data/futures/um/daily/fundingRate/AKEUSDT/AKEUSDT-fundingRate-2026-11-20.zip"];
(async () => { const out = [];
  for (const u of U) { const r = await fetch(u); out.push(`## ${u.split("/").slice(-1)[0]} → ${r.status}`); if (!r.ok) continue;
    fs.writeFileSync("/tmp/p.zip", Buffer.from(await r.arrayBuffer())); const t = execSync("unzip -p /tmp/p.zip").toString().split("\n"); out.push(...t.slice(0, 4), `(${t.length} سطر)`); }
  fs.writeFileSync("nexora-lab/results/crowd_probe.txt", out.join("\n") + "\n"); console.log(out.join("\n")); })();
