/* تست پارسر LiteFinance با متن واقعی صفحه (برداشت‌شده از خود سایت) */
const { parseLiteFinance } = await import("../src/lib/analysis-sources.ts").catch(() => ({}));

// شبیه‌سازی HTML صفحه بر اساس متن واقعی — ساختار تگ‌دار مثل خود صفحه
const html = `<!DOCTYPE html><html><head><title>Gold (XAU/USD) Price Forecast for Today, Tomorrow, Next Week and the 30 Days</title></head>
<body><h1>Gold (XAU/USD) Price Forecast for Today, Tomorrow, Next Week and the 30 Days</h1>
<p>Updated on October 20, 2026</p>
<section><h2>Trading plan</h2>
<p>Base scenario: Open long positions (1) on high volume above the $4,202.40 level, with price targets at $4,254.97, $4,313.67, $4,376.04, $4,441.34, $4,509.74, $4,576.74, $4,645.91, $4,698.44, $4,760.74, and $4,821.84.</p>
<p>Stop Loss (3): $4,180.17.</p>
<p>Alternative scenario: Open short positions (2) from below the $4,157.41 level, with targets $4,114.01, $4,059.90.</p></section>
<section><h2>Forecast for today</h2>
<table><tr><th>Date</th><th>Daily Low, $</th><th>Average Price, $</th><th>Daily High, $</th></tr>
<tr><td>20.10.2026</td><td>4,100.00</td><td>4,150.00</td><td>4,200.00</td></tr></table></section>
<section><h2>Forecast for tomorrow</h2>
<table><tr><th>Date</th><th>Daily Low, $</th><th>Average Price, $</th><th>Daily High, $</th></tr>
<tr><td>21.10.2026</td><td>4,057.82</td><td>4,185.74</td><td>4,313.67</td></tr></table></section>
<section><h2>Weekly forecast</h2>
<table><tr><th>Date</th><th>Weekly Low, $</th><th>Average Price, $</th><th>Weekly High, $</th></tr>
<tr><td>19.10.2026–25.10.2026</td><td>4,007.83</td><td>4,258.78</td><td>4,509.74</td></tr></table></section>
<section><h2>Technical analysis</h2><p>RSI is gradually rising at 56, potentially to continue rising.</p></section>
</body></html>`;

const r = parseLiteFinance(html);
console.log(JSON.stringify(r, null, 1));

// صحت‌سنجی
const assert = (cond, msg) => console.log((cond ? "PASS" : "FAIL") + " — " + msg);
assert(r.baseScenario === "long", "baseScenario=long");
assert(r.longAbove === 4202.4, "longAbove=4202.4 → " + r.longAbove);
assert(r.shortBelow === 4157.41, "shortBelow=4157.41 → " + r.shortBelow);
assert(r.stopLoss === 4180.17, "stopLoss=4180.17 → " + r.stopLoss);
assert(r.targets[0] === 4254.97 && r.targets[2] === 4376.04, "targets → " + r.targets);
assert(r.tomorrow.avg === 4185.74 && r.tomorrow.low === 4057.82 && r.tomorrow.high === 4313.67, "tomorrow → " + JSON.stringify(r.tomorrow));
assert(r.week.avg === 4258.78, "week → " + JSON.stringify(r.week));
assert(r.rsi === 56, "rsi=56 → " + r.rsi);
assert(r.reportedAtFa === "October 20, 2026", "date → " + r.reportedAtFa);
