/* دیباگ موتور اسکلپ مستقل — اجرای scalpRun روی mock */
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('/home/z/my-project/scripts/standalone/app.f.js', 'utf8');
const mock = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/mock_active.json', 'utf8'));
const SPOT = 4168.4;

const sandbox = {
  faDigits: (s) => String(s),
  lsGet: () => 'null',
  lsSet: () => {},
  console,
  Math,
  Date,
  JSON,
  isFinite,
  isNaN,
  Promise,
  Error,
  parseFloat,
  Object,
  Array,
  String,
  Number,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const r = mock.chart.result[0];
const q = r.indicators.quote[0];
const bars = [];
for (let i = 0; i < r.timestamp.length; i++) {
  if (q.open[i] == null) continue;
  bars.push({ t: r.timestamp[i], o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] });
}
const engine = sandbox.scalscalpRun ? null : null;
// scalpRun صدا زده می‌شود
const out = vm.runInContext('scalpRun', sandbox)(bars, null);
console.log('bars:', bars.length, '| lastClose:', out.lastClose, '| ATR:', out.atr && out.atr.toFixed(2));
console.log('signals:', out.signals.map((s) => `${s.side}/${s.kind}@${s.idx} zone ${s.zoneLo}-${s.zoneHi}`));
console.log('supplyZones:', out.supplyZones.map((z) => `${z.bot}-${z.top}`));
console.log('demandZones:', out.demandZones.map((z) => `${z.bot}-${z.top}`));
console.log('suggestion:', out.suggestion);
console.log('swingHigh/Low:', out.swingHigh, out.swingLow, '| broken:', out.swingHighBroken, out.swingLowBroken);
console.log('setup:', JSON.stringify(out.setup));
