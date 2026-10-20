const bars = [];
const n = 300;
const t0 = Math.floor(Date.now() / 1000) - n * 86400;
let base = 4100;
let seed = 7;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648 - 0.5;
};
for (let i = 0; i < n; i++) {
  base += rnd() * 14 + Math.sin(i / 16) * 5;
  const c = base;
  const h = c + 4 + rnd() * 6;
  const l = c - 5 - rnd() * 6;
  const o = c - rnd() * 8;
  bars.push({ t: t0 + i * 86400, o, h, l, c, v: 90000 + Math.floor(rnd() * 80000) + 40000 });
}
const json = {
  chart: {
    result: [
      {
        meta: { regularMarketPrice: bars[bars.length - 1].c },
        timestamp: bars.map((b) => b.t),
        indicators: {
          quote: [
            {
              open: bars.map((b) => +b.o.toFixed(2)),
              high: bars.map((b) => +b.h.toFixed(2)),
              low: bars.map((b) => +b.l.toFixed(2)),
              close: bars.map((b) => +b.c.toFixed(2)),
              volume: bars.map((b) => b.v),
            },
          ],
        },
      },
    ],
  },
};
require("fs").writeFileSync("/home/z/my-project/scripts/pt-mock.json", JSON.stringify(json));
console.log("mock written:", (JSON.stringify(json).length / 1024).toFixed(1), "KB, bars:", n);
