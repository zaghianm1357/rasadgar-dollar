/* ================= موتور اسکلپ (نسخه مستقل) =================
 * پورت JS اندیکاتور کاربر «SBW + OB xATR + 4H Setup + Div»:
 * موج شکست سوئینگ (نرمال ATR) + اوردر بلاک با فیلتر FVG + ستاپ ۴ساعته
 * (برخورد ← شکست ساختار ← ریتست ← الگوی کندلی) + واگرایی ۵ابزاری.
 * منبع داده: کندل‌های Yahoo Finance از پروکسی عمومی — خروجی اطلاع‌رسانی است.
 * ================================================================ */

var SCALP_SYMS = {
  xau: { y: 'GC=F', label: 'طلا (اونس) — XAUUSD', mono: 'XAUUSD', spot: 'XAU' },
  xag: { y: 'SI=F', label: 'نقره — XAGUSD', mono: 'XAGUSD', spot: 'XAG' },
  eurusd: { y: 'EURUSD=X', label: 'یورو/دلار — EURUSD', mono: 'EURUSD' },
  dji: { y: '^DJI', label: 'داوجونز — DJI', mono: 'DJI · ^DJI' },
  btc: { y: 'BTC-USD', label: 'بیت‌کوین — BTC', mono: 'BTCUSDT · BTC-USD' }
};
var SCALP_TFS = {
  '1m': { i: '1m', r: '2d', label: '۱ دقیقه' },
  '5m': { i: '5m', r: '5d', label: '۵ دقیقه' },
  '15m': { i: '15m', r: '1mo', label: '۱۵ دقیقه' }
};
var SCALP_KEY = 'sd_scalp_v1';
var SCALP_FRESH = 3; /* سیگنال تا ۳ کندل بسته‌شدهٔ آخر «تازه» است */

var S_SCALP = { sym: 'xau', tf: '5m' };
try {
  var _sc = JSON.parse(lsGet(SCALP_KEY) || 'null');
  if (_sc && SCALP_SYMS[_sc.sym] && SCALP_TFS[_sc.tf]) S_SCALP = { sym: _sc.sym, tf: _sc.tf };
} catch (e) {}
function scSave() { lsSet(SCALP_KEY, JSON.stringify(S_SCALP)); }

var SCALP_CACHE = {}; /* key → { at, payload } */
var SCALP_BUSY = false;

/* ---------- ابزارهای سری ---------- */
function scAtr(bars, len) {
  var out = [], i;
  for (i = 0; i < bars.length; i++) out.push(NaN);
  if (bars.length < len + 1) return out;
  var trs = [bars[0].h - bars[0].l];
  for (i = 1; i < bars.length; i++)
    trs.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
  var a = 0;
  for (i = 0; i < len; i++) a += trs[i];
  out[len] = a / len;
  for (i = len + 1; i < bars.length; i++) { a = (a * (len - 1) + trs[i]) / len; out[i] = a; }
  return out;
}
function scRma(v, len) {
  var out = [], sum = 0, prev = NaN, i;
  for (i = 0; i < v.length; i++) {
    if (i < len) { sum += v[i]; if (i === len - 1) { prev = sum / len; out.push(prev); } else out.push(NaN); }
    else { prev = (prev * (len - 1) + v[i]) / len; out.push(prev); }
  }
  return out;
}
function scRsi(c, len) {
  len = len || 14;
  var ch = [0], i;
  for (i = 1; i < c.length; i++) ch.push(c[i] - c[i - 1]);
  var g = ch.map(function (d) { return d > 0 ? d : 0; });
  var l = ch.map(function (d) { return d < 0 ? -d : 0; });
  var ag = scRma(g, len), al = scRma(l, len), out = [];
  for (i = 0; i < c.length; i++) {
    if (isNaN(ag[i]) || isNaN(al[i])) { out.push(NaN); continue; }
    out.push(al[i] === 0 ? (ag[i] === 0 ? 50 : 100) : 100 - 100 / (1 + ag[i] / al[i]));
  }
  return out;
}
function scMacdHist(c) {
  function ema(len) {
    var k = 2 / (len + 1), e = c[0], out = [], i;
    for (i = 0; i < c.length; i++) { e = i === 0 ? c[0] : c[i] * k + e * (1 - k); out.push(e); }
    return out;
  }
  var f = ema(12), s = ema(26), line = [], i;
  for (i = 0; i < c.length; i++) line.push(f[i] - s[i]);
  var k = 2 / 10, se = line[0], hist = [];
  for (i = 0; i < line.length; i++) { se = i === 0 ? line[0] : line[i] * k + se * (1 - k); hist.push(line[i] - se); }
  return hist;
}
function scStoch(bars, len) {
  len = len || 14;
  var out = [], i, j;
  for (i = 0; i < bars.length; i++) out.push(NaN);
  for (i = len - 1; i < bars.length; i++) {
    var hh = -Infinity, ll = Infinity;
    for (j = i - len + 1; j <= i; j++) { if (bars[j].h > hh) hh = bars[j].h; if (bars[j].l < ll) ll = bars[j].l; }
    out[i] = hh === ll ? 50 : ((bars[i].c - ll) / (hh - ll)) * 100;
  }
  return out;
}
function scCci(bars, len) {
  len = len || 20;
  var tp = bars.map(function (b) { return (b.h + b.l + b.c) / 3; }), out = [], i, j;
  for (i = 0; i < bars.length; i++) out.push(NaN);
  for (i = len - 1; i < bars.length; i++) {
    var mean = 0;
    for (j = i - len + 1; j <= i; j++) mean += tp[j];
    mean /= len;
    var dev = 0;
    for (j = i - len + 1; j <= i; j++) dev += Math.abs(tp[j] - mean);
    dev /= len;
    out[i] = dev === 0 ? 0 : (tp[i] - mean) / (0.015 * dev);
  }
  return out;
}
function scMfi(bars, len) {
  len = len || 14;
  var tp = bars.map(function (b) { return (b.h + b.l + b.c) / 3; }), out = [], i, j;
  for (i = 0; i < bars.length; i++) out.push(NaN);
  for (i = len; i < bars.length; i++) {
    var pos = 0, neg = 0;
    for (j = i - len + 1; j <= i; j++) {
      var flow = tp[j] * bars[j].c;
      if (tp[j] > tp[j - 1]) pos += flow; else if (tp[j] < tp[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? 100 : pos === 0 ? 0 : 100 - 100 / (1 + pos / neg);
  }
  return out;
}
function scPivots(high, low, L, R) {
  var hs = [], ls = [], i, k, okH, okL;
  for (i = L; i < high.length - R; i++) {
    okH = true; okL = true;
    for (k = 1; k <= L; k++) { if (high[i - k] >= high[i]) okH = false; if (low[i - k] <= low[i]) okL = false; }
    for (k = 1; k <= R; k++) { if (high[i + k] >= high[i]) okH = false; if (low[i + k] <= low[i]) okL = false; }
    if (okH) hs.push({ idx: i, price: high[i] });
    if (okL) ls.push({ idx: i, price: low[i] });
  }
  return { hs: hs, ls: ls };
}
function scPx(v, d) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  d = d === undefined ? 2 : d;
  return faDigits(Number(v).toLocaleString('en-US', { maximumFractionDigits: d })).replace(/,/g, '٬');
}

/* ---------- موتور اصلی اسکلپ ---------- */
function scalpRun(bars, h4bars) {
  var SWING = 5, PIVOT = 3, RETR = 23, ATRL = 14, OBLOOK = 20, MAXZ = 12;
  var DOJI = 10, KEYBAR = 70, KEYATR = 1, H4 = 14400;
  var n = bars.length, i, k;
  var high = bars.map(function (b) { return b.h; }), low = bars.map(function (b) { return b.l; });
  var close = bars.map(function (b) { return b.c; }), open = bars.map(function (b) { return b.o; });
  var atr = scAtr(bars, ATRL);
  var notes = [];

  /* نقشه ۴ساعته */
  var h4map = {};
  if (h4bars && h4bars.length >= 2) {
    for (i = 0; i < h4bars.length; i++) {
      var bk = Math.floor(h4bars[i].t / H4);
      if (!h4map[bk]) h4map[bk] = { h: h4bars[i].h, l: h4bars[i].l };
      else { h4map[bk].h = Math.max(h4map[bk].h, h4bars[i].h); h4map[bk].l = Math.min(h4map[bk].l, h4bars[i].l); }
    }
  }
  var h4count = Object.keys(h4map).length;
  var h4Ready = h4count >= 2;
  if (!h4Ready) notes.push('دادهٔ کندل‌های ۴ساعته کافی نبود؛ ستاپ ۴ساعته محاسبه نشد و فقط موج/OB/واگرایی فعال‌اند.');

  var pivDiv = scPivots(high, low, 5, 5);
  var pivSt = scPivots(high, low, PIVOT, PIVOT);
  var stHiPtr = 0, stLoPtr = 0, lastPivotLow = null, lastPivotHigh = null;
  var swPtr = 0, slPtr = 0, swingHigh = null, swingLow = null, hiBroken = false, loBroken = false;

  function Wave() { return null; }
  var bear = null, bull = null;

  var supply = [], demand = [];
  function ov(arr, t, b) {
    for (var j = 0; j < arr.length; j++) if (arr[j].live && arr[j].top > b && t > arr[j].bot) return true;
    return false;
  }

  var curBucket = null, sellArmed = false, buyArmed = false, sellWaiting = false, buyWaiting = false;
  var sellZone = null, buyZone = null, h4HighNow = null, h4LowNow = null;

  var rsi = scRsi(close, 14), macdH = scMacdHist(close), stoch = scStoch(bars, 14), cci = scCci(bars, 20), mfi = scMfi(bars, 14);
  var signals = [], lastDiv = null, lastBullIdx = null, lastBearIdx = null;

  function votesAt(idx, prev, dir) {
    var pairs = [[rsi[idx], rsi[prev]], [macdH[idx], macdH[prev]], [stoch[idx], stoch[prev]], [cci[idx], cci[prev]], [mfi[idx], mfi[prev]]];
    var v = 0;
    for (var j = 0; j < pairs.length; j++) {
      var a = pairs[j][0], b = pairs[j][1];
      if (isNaN(a) || isNaN(b)) continue;
      if ((dir === 'bull' && a > b) || (dir === 'bear' && a < b) || (dir === 'hBull' && a < b) || (dir === 'hBear' && a > b)) v++;
    }
    return v;
  }

  for (i = 0; i < n; i++) {
    var bar = bars[i], atrVal = atr[i];

    /* پیوت‌های سوئینگ */
    while (swPtr < pivDiv.hs.length && pivDiv.hs[swPtr].idx + SWING <= i) { swingHigh = pivDiv.hs[swPtr].price; hiBroken = false; swPtr++; }
    while (slPtr < pivDiv.ls.length && pivDiv.ls[slPtr].idx + SWING <= i) { swingLow = pivDiv.ls[slPtr].price; loBroken = false; slPtr++; }
    /* پیوت‌های شکست ساختار */
    while (stHiPtr < pivSt.hs.length && pivSt.hs[stHiPtr].idx + PIVOT <= i) { lastPivotHigh = pivSt.hs[stHiPtr].price; stHiPtr++; }
    while (stLoPtr < pivSt.ls.length && pivSt.ls[stLoPtr].idx + PIVOT <= i) { lastPivotLow = pivSt.ls[stLoPtr].price; stLoPtr++; }

    /* نگهداری زون‌ها (لمس/تخفیف) */
    var tapSell = null, tapBuy = null;
    for (k = 0; k < supply.length; k++) {
      var zs = supply[k];
      if (!zs.live) continue;
      if (zs.tappedIdx === null && bar.h >= zs.bot) { zs.tappedIdx = i; tapSell = zs; }
      if (close[i] >= zs.bot) { zs.live = false; zs.fadedIdx = i; }
    }
    for (k = 0; k < demand.length; k++) {
      var zd = demand[k];
      if (!zd.live) continue;
      if (zd.tappedIdx === null && bar.l <= zd.top) { zd.tappedIdx = i; tapBuy = zd; }
      if (close[i] <= zd.top) { zd.live = false; zd.fadedIdx = i; }
    }
    if (tapSell) signals.push({ side: 'sell', kind: 'ob-tap', idx: i, t: bar.t, price: bar.c, zoneLo: tapSell.bot, zoneHi: tapSell.top, ob: true, pat: 'برخورد اول قیمت به زون فروش (OB)' });
    if (tapBuy) signals.push({ side: 'buy', kind: 'ob-tap', idx: i, t: bar.t, price: bar.c, zoneLo: tapBuy.bot, zoneHi: tapBuy.top, ob: true, pat: 'برخورد اول قیمت به زون خرید (OB)' });

    /* موج شکست */
    var loBreakAny = false, hiBreakAny = false;
    if (swingLow !== null && !isNaN(atrVal) && atrVal > 0) {
      if (loBroken && close[i] > swingLow) loBroken = false;
      if (close[i] < swingLow) {
        if (!loBroken) { loBreakAny = true; if (!bear) bear = { active: true, brk: swingLow, atrBrk: atrVal, ext: bar.l, st: i }; }
        loBroken = true;
      }
    }
    if (swingHigh !== null && !isNaN(atrVal) && atrVal > 0) {
      if (hiBroken && close[i] < swingHigh) hiBroken = false;
      if (close[i] > swingHigh) {
        if (!hiBroken) { hiBreakAny = true; if (!bull) bull = { active: true, brk: swingHigh, atrBrk: atrVal, ext: bar.h, st: i }; }
        hiBroken = true;
      }
    }
    if (bear && bear.active) {
      if (bar.l < bear.ext) bear.ext = bar.l;
      if (i > bear.st) { var rngB = bear.brk - bear.ext; if (close[i] > bear.ext + rngB * (RETR / 100)) bear = null; }
    }
    if (bull && bull.active) {
      if (bar.h > bull.ext) bull.ext = bar.h;
      if (i > bull.st) { var rngU = bull.ext - bull.brk; if (close[i] < bull.ext - rngU * (RETR / 100)) bull = null; }
    }

    /* ساخت OB */
    if (loBreakAny) {
      var oB = null;
      for (k = 1; k <= OBLOOK && i - k >= 0; k++) if (close[i - k] > open[i - k]) { oB = k; break; }
      if (oB !== null) {
        var ztB = high[i - oB], zbB = low[i - oB], fvgB = false;
        for (k = 0; k <= oB - 2; k++) if (low[i - k - 2] > high[i - k]) { fvgB = true; break; }
        var leftB = false, preB = false;
        for (k = oB - 1; k >= 0; k--) { if (!leftB) { if (close[i - k] < zbB) leftB = true; } else if (close[i - k] >= zbB) { preB = true; break; } }
        if (fvgB && leftB && !preB && !ov(supply, ztB, zbB)) {
          supply.push({ side: 'supply', top: ztB, bot: zbB, live: true, createdIdx: i, tappedIdx: null, fadedIdx: null });
          if (supply.length > MAXZ) supply.shift();
        }
      }
    }
    if (hiBreakAny) {
      var oU = null;
      for (k = 1; k <= OBLOOK && i - k >= 0; k++) if (close[i - k] < open[i - k]) { oU = k; break; }
      if (oU !== null) {
        var ztU = high[i - oU], zbU = low[i - oU], fvgU = false;
        for (k = 0; k <= oU - 2; k++) if (high[i - k - 2] < low[i - k]) { fvgU = true; break; }
        var leftU = false, preU = false;
        for (k = oU - 1; k >= 0; k--) { if (!leftU) { if (close[i - k] > ztU) leftU = true; } else if (close[i - k] <= ztU) { preU = true; break; } }
        if (fvgU && leftU && !preU && !ov(demand, ztU, zbU)) {
          demand.push({ side: 'demand', top: ztU, bot: zbU, live: true, createdIdx: i, tappedIdx: null, fadedIdx: null });
          if (demand.length > MAXZ) demand.shift();
        }
      }
    }

    /* ستاپ ۴ساعته */
    var ocBuy = false, ocSell = false, j;
    for (k = 0; k < demand.length; k++) { var dzz = demand[k]; if (dzz.live && bar.l <= dzz.top && bar.h >= dzz.bot) { ocBuy = true; break; } }
    for (k = 0; k < supply.length; k++) { var szz = supply[k]; if (szz.live && bar.l <= szz.top && bar.h >= szz.bot) { ocSell = true; break; } }

    if (h4Ready) {
      var bucket = Math.floor(bar.t / H4);
      if (curBucket === null) curBucket = bucket;
      if (bucket !== curBucket) {
        curBucket = bucket; sellArmed = false; buyArmed = false; sellWaiting = false; buyWaiting = false; sellZone = null; buyZone = null;
      }
      for (var b = bucket - 1; b >= bucket - 12; b--) {
        if (h4map[b]) { h4HighNow = h4map[b].h; h4LowNow = h4map[b].l; break; }
      }
      var sellWas = sellArmed, buyWas = buyArmed;
      if (h4HighNow !== null && bar.h >= h4HighNow) { sellArmed = true; sellWaiting = false; sellZone = null; }
      if (h4LowNow !== null && bar.l <= h4LowNow) { buyArmed = true; buyWaiting = false; buyZone = null; }
      if (sellWas && !sellWaiting && lastPivotLow !== null && close[i] < lastPivotLow) { sellZone = { lo: bar.l, hi: bar.h }; sellWaiting = true; sellArmed = false; }
      if (buyWas && !buyWaiting && lastPivotHigh !== null && close[i] > lastPivotHigh) { buyZone = { lo: bar.l, hi: bar.h }; buyWaiting = true; buyArmed = false; }
    }

    /* الگوهای کندلی */
    var rng = bar.h - bar.l, body = Math.abs(bar.c - bar.o);
    var prevBar = i > 0 ? bars[i - 1] : null;
    var dojiPrev = prevBar ? (prevBar.h - prevBar.l > 0 && Math.abs(prevBar.c - prevBar.o) <= (prevBar.h - prevBar.l) * DOJI / 100) : false;
    var bearEng = bar.c < bar.o && i > 0 && close[i - 1] > open[i - 1] && bar.o >= close[i - 1] && bar.c <= open[i - 1];
    var bullEng = bar.c > bar.o && i > 0 && close[i - 1] < open[i - 1] && bar.o <= close[i - 1] && bar.c >= open[i - 1];
    var keyBar = rng > 0 && body >= rng * KEYBAR / 100 && !isNaN(atrVal) && body >= atrVal * KEYATR;
    var bullPat = bullEng || (dojiPrev && keyBar && bar.c > bar.o);
    var bearPat = bearEng || (dojiPrev && keyBar && bar.c < bar.o);
    var bullPatFa = bullEng ? 'انگالف صعودی' : 'دوجی + کی‌بار صعودی';
    var bearPatFa = bearEng ? 'انگالف نزولی' : 'دوجی + کی‌بار نزولی';

    /* ریتست + سیگنال */
    if (sellWaiting && sellZone && bar.l <= sellZone.hi && bar.h >= sellZone.lo && bearPat) {
      signals.push({ side: 'sell', kind: 'setup4h', idx: i, t: bar.t, price: bar.c, zoneLo: sellZone.lo, zoneHi: sellZone.hi, ob: ocSell, pat: bearPatFa + (ocSell ? ' + هم‌پوشانی OB' : '') });
      sellWaiting = false;
    }
    if (buyWaiting && buyZone && bar.l <= buyZone.hi && bar.h >= buyZone.lo && bullPat) {
      signals.push({ side: 'buy', kind: 'setup4h', idx: i, t: bar.t, price: bar.c, zoneLo: buyZone.lo, zoneHi: buyZone.hi, ob: ocBuy, pat: bullPatFa + (ocBuy ? ' + هم‌پوشانی OB' : '') });
      buyWaiting = false;
    }

    /* واگرایی */
    for (k = 0; k < pivDiv.hs.length; k++) {
      var p = pivDiv.hs[k];
      if (p.idx + 5 !== i) continue;
      var prevH = null;
      for (j = pivDiv.hs.length - 1; j >= 0; j--) if (pivDiv.hs[j].idx < p.idx) { prevH = pivDiv.hs[j]; break; }
      if (!prevH) continue;
      var gapH = p.idx - prevH.idx;
      if (gapH < 5 || gapH > 60) continue;
      if (high[p.idx] > high[prevH.idx]) { var vB = votesAt(p.idx, prevH.idx, 'bear'); if (vB >= 3) { lastDiv = { side: 'bear', votes: vB, hidden: false, idx: i }; lastBearIdx = i; } }
      else { var vHB = votesAt(p.idx, prevH.idx, 'hBear'); if (vHB >= 3) { lastDiv = { side: 'bear', votes: vHB, hidden: true, idx: i }; lastBearIdx = i; } }
    }
    for (k = 0; k < pivDiv.ls.length; k++) {
      var p2 = pivDiv.ls[k];
      if (p2.idx + 5 !== i) continue;
      var prevL = null;
      for (j = pivDiv.ls.length - 1; j >= 0; j--) if (pivDiv.ls[j].idx < p2.idx) { prevL = pivDiv.ls[j]; break; }
      if (!prevL) continue;
      var gapL = p2.idx - prevL.idx;
      if (gapL < 5 || gapL > 60) continue;
      if (low[p2.idx] < low[prevL.idx]) { var vBl = votesAt(p2.idx, prevL.idx, 'bull'); if (vBl >= 3) { lastDiv = { side: 'bull', votes: vBl, hidden: false, idx: i }; lastBullIdx = i; } }
      else { var vHl = votesAt(p2.idx, prevL.idx, 'hBull'); if (vHl >= 3) { lastDiv = { side: 'bull', votes: vHl, hidden: true, idx: i }; lastBullIdx = i; } }
    }
  }

  /* جمع‌بندی */
  var last = bars[n - 1], lastAtr = isNaN(atr[n - 1]) ? null : atr[n - 1];
  var tail = bars.slice(-200), bodyless = 0;
  for (i = 0; i < tail.length; i++) if (tail[i].o === tail[i].c) bodyless++;
  var degraded = tail.length > 0 && bodyless / tail.length > 0.6;
  if (degraded) notes.push('کیفیت داده: ' + faDigits(Math.round(bodyless / tail.length * 100)) + '٪ از ۲۰۰ کندل اخیر این تایم‌فریم از منبع بدون بدنه‌اند (open=close) — زون‌های OB، الگوهای کندلی و موج روی این داده قابل محاسبه نیستند؛ تایم‌فریم بزرگ‌تر (۵ یا ۱۵ دقیقه) را انتخاب کنید.');

  var lastDivIdx = lastDiv ? lastDiv.idx : null;
  var divRecent = lastDivIdx !== null && (n - 1 - lastDivIdx) <= 10;
  var liveSupply = supply.filter(function (z) { return z.live && z.bot > last.c; }).sort(function (a, b) { return a.bot - b.bot; }).slice(0, 3);
  var liveDemand = demand.filter(function (z) { return z.live && z.top < last.c; }).sort(function (a, b) { return b.top - a.top; }).slice(0, 3);

  var waveOut = { active: null, nAtr: null, retrLevel: null };
  if (bear && bear.active) { var rB = bear.brk - bear.ext; waveOut = { active: 'bear', nAtr: bear.atrBrk > 0 ? rB / bear.atrBrk : null, retrLevel: bear.ext + rB * (RETR / 100) }; }
  else if (bull && bull.active) { var rU = bull.ext - bull.brk; waveOut = { active: 'bull', nAtr: bull.atrBrk > 0 ? rU / bull.atrBrk : null, retrLevel: bull.ext - rU * (RETR / 100) }; }

  /* پیشنهاد حدودی */
  var sg = null;
  var fresh = signals.filter(function (s) { return (n - 1 - s.idx) <= SCALP_FRESH; });
  var latest = fresh.length ? fresh[fresh.length - 1] : null;
  if (latest && lastAtr && lastAtr > 0) {
    var mid = (latest.zoneLo + latest.zoneHi) / 2, buf = 0.5 * lastAtr;
    var risk = latest.side === 'buy' ? mid - (latest.zoneLo - buf) : (latest.zoneHi + buf) - mid;
    if (risk > 0) {
      function pickTp(dir, minDist) {
        var cands = [];
        if (dir === 1) {
          for (var q = 0; q < liveSupply.length; q++) { cands.push(liveSupply[q].bot); cands.push(liveSupply[q].top); }
          if (swingHigh !== null) cands.push(swingHigh);
          if (h4HighNow !== null) cands.push(h4HighNow);
          var okv = cands.filter(function (v) { return v >= mid + minDist; }).sort(function (a, b2) { return a - b2; });
          return okv.length ? okv[0] : mid + 2 * minDist;
        }
        for (var q2 = 0; q2 < liveDemand.length; q2++) { cands.push(liveDemand[q2].bot); cands.push(liveDemand[q2].top); }
        if (swingLow !== null) cands.push(swingLow);
        if (h4LowNow !== null) cands.push(h4LowNow);
        var okv2 = cands.filter(function (v) { return v <= mid - minDist; }).sort(function (a, b2) { return b2 - a; });
        return okv2.length ? okv2[0] : mid - 2 * minDist;
      }
      var tp1 = pickTp(latest.side === 'buy' ? 1 : -1, risk);
      var tp2 = pickTp(latest.side === 'buy' ? 1 : -1, 2 * risk);
      /* وضعیت سیگنال نسبت به قیمتِ «فعلی» (نه لحظهٔ صدور) */
      var eLo = latest.zoneLo, eHi = latest.zoneHi;
      var slV = latest.side === 'buy' ? eLo - buf : eHi + buf;
      var distV = (last.c >= eLo && last.c <= eHi) ? 0 :
        (latest.side === 'buy' ? (last.c < eLo ? eLo - last.c : last.c - eHi) : (last.c > eHi ? last.c - eHi : eLo - last.c));
      var stV = 'active', stFa = 'فعال — قیمت در ناحیه یا نزدیک آن است';
      if (latest.side === 'buy' ? last.c < slV : last.c > slV) { stV = 'invalidated'; stFa = 'ابطال شده — قیمت از حد ضرر عبور کرده است'; }
      else if (latest.side === 'buy' ? last.c >= tp1 : last.c <= tp1) { stV = 'tp1_reached'; stFa = 'هدف اول لمس شده — برای ورود جدید به تأیید تازه نیاز است'; }
      else if (distV > 1.2 * lastAtr) { stV = 'far'; stFa = 'قیمت فعلی دور از ناحیه است — سیگنال مال لحظهٔ صدور بود؛ اجرا فقط با بازگشت قیمت به ناحیه'; }
      sg = {
        side: latest.side, entryLo: eLo, entryHi: eHi,
        sl: slV,
        tp1: tp1, tp2: tp2, kind: latest.kind, barsAgo: n - 1 - latest.idx,
        status: stV, statusFa: stFa, dist: Math.round(distV * 100) / 100,
        distAtr: lastAtr > 0 ? Math.round(distV / lastAtr * 100) / 100 : null,
        reason: (latest.kind === 'setup4h' ? 'ستاپ ۴ساعته (' + latest.pat + ')' : latest.pat) + ' — سطوح و اهداف حدودی‌اند (ATR۱۴ تایم‌فریم: ' + scPx(lastAtr) + ')'
      };
    }
  }

  var divNote = 'واگرایی تازه‌ای در ۱۰ کندل اخیر ثبت نشده است.';
  if (lastDiv && divRecent)
    divNote = 'واگرایی ' + (lastDiv.hidden ? 'مخفی ' : '') + (lastDiv.side === 'bull' ? 'صعودی' : 'نزولی') + ' با توافق ' + faDigits(lastDiv.votes) + '/۵ ابزار، ' + faDigits(n - 1 - lastDiv.idx) + ' کندل پیش ثبت شده است.';

  return {
    bars: n, lastClose: last.c, lastT: last.t,
    atr: lastAtr, atrPct: lastAtr ? lastAtr / last.c * 100 : null,
    h4High: h4HighNow, h4Low: h4LowNow,
    swingHigh: swingHigh, swingLow: swingLow, swingHighBroken: hiBroken, swingLowBroken: loBroken,
    setup: {
      sell: sellWaiting ? 'retest' : sellArmed ? 'armed' : 'idle',
      buy: buyWaiting ? 'retest' : buyArmed ? 'armed' : 'idle',
      sellZone: sellZone, buyZone: buyZone, unavailable: !h4Ready
    },
    wave: waveOut,
    supplyZones: liveSupply, demandZones: liveDemand,
    signals: signals.slice(-6),
    divergence: {
      recentBull: !!(divRecent && lastDiv && lastDiv.side === 'bull'),
      recentBear: !!(divRecent && lastDiv && lastDiv.side === 'bear'),
      note: divNote
    },
    suggestion: sg, degraded: degraded, notes: notes
  };
}

/* ---------- دریافت داده از Yahoo با پروکسی ---------- */
function scFetchBars(yahooSym, interval, range) {
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooSym) + '?interval=' + interval + '&range=' + range + '&includePrePost=false';
  var i = 0;
  function attempt() {
    if (i >= PROXIES.length) return Promise.reject(new Error('proxy-fail'));
    var p = PROXIES[i++];
    return fetchJSON(p(u), 12000).then(function (j) {
      var r = j && j.chart && j.chart.result && j.chart.result[0];
      var q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
      if (!r || !q || !q.close || !r.timestamp) throw new Error('bad');
      var out = [], k;
      for (k = 0; k < q.close.length; k++) {
        if (q.close[k] == null || q.open[k] == null || q.high[k] == null || q.low[k] == null) continue;
        out.push({ t: r.timestamp[k], o: q.open[k], h: q.high[k], l: q.low[k], c: q.close[k] });
      }
      if (out.length < 80) throw new Error('thin');
      return out;
    }).catch(function () { return attempt(); });
  }
  return attempt();
}
function scAgg4h(bars) {
  var H = 14400, map = {}, keys = [], i;
  for (i = 0; i < bars.length; i++) {
    var b = Math.floor(bars[i].t / H) * H;
    if (map[b] === undefined) { map[b] = { t: b, o: bars[i].o, h: bars[i].h, l: bars[i].l, c: bars[i].c }; keys.push(b); }
    else { var e = map[b]; e.h = Math.max(e.h, bars[i].h); e.l = Math.min(e.l, bars[i].l); e.c = bars[i].c; }
  }
  keys.sort(function (a, b) { return a - b; });
  return keys.map(function (k) { return map[k]; });
}

/* ---------- کالیبراسیون اسپات (gold-api) ----------
 * کندل‌های Yahoo برای طلا/نقره از بازار آتی است و نسبت به اسپاتِ چارت کاربر
 * اختلاف دائمی دارد (طلا معمولا حدود ۲۰ دلار). برای هم‌ترازی سطوح با اسپات،
 * قیمت لحظه‌ای اسپات گرفته شده و همهٔ سطوح مطلق با همان اختلاف جابه‌جا می‌شوند.
 * gold-api.com بدون کلید کار می‌کند و Access-Control-Allow-Origin: * دارد؛
 * در صورت شکست، از پروکسی‌های عمومی هم تلاش می‌شود. */
function scFetchSpot(sym) {
  var u = 'https://api.gold-api.com/price/' + sym;
  function parse(j) {
    var p = j && typeof j.price === 'number' ? j.price : parseFloat(j && j.price);
    return isFinite(p) && p > 0 ? p : null;
  }
  return fetchJSON(u, 6000).then(function (j) {
    var p = parse(j);
    if (p !== null) return p;
    throw new Error('bad-spot');
  }).catch(function () {
    var i = 0;
    function attempt() {
      if (i >= PROXIES.length) return Promise.resolve(null);
      return fetchJSON(PROXIES[i++](u), 8000).then(parse).catch(attempt);
    }
    return attempt();
  });
}
function scShiftEngine(e, d) {
  function sh(v) { return typeof v === 'number' && isFinite(v) ? Math.round((v + d) * 100) / 100 : v; }
  function shZone(z) { return z ? { lo: sh(z.lo), hi: sh(z.hi) } : z; }
  function shArr(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(function (o) {
      if (typeof o.zoneLo === 'number') return Object.assign({}, o, { price: sh(o.price), zoneLo: sh(o.zoneLo), zoneHi: sh(o.zoneHi) });
      if (typeof o.top === 'number') return Object.assign({}, o, { top: sh(o.top), bot: sh(o.bot) });
      return Object.assign({}, o, { o: sh(o.o), h: sh(o.h), l: sh(o.l), c: sh(o.c) });
    });
  }
  if (e.suggestion) {
    e.suggestion.entryLo = sh(e.suggestion.entryLo);
    e.suggestion.entryHi = sh(e.suggestion.entryHi);
    e.suggestion.sl = sh(e.suggestion.sl);
    e.suggestion.tp1 = sh(e.suggestion.tp1);
    e.suggestion.tp2 = sh(e.suggestion.tp2);
  }
  e.lastClose = sh(e.lastClose);
  e.h4High = sh(e.h4High);
  e.h4Low = sh(e.h4Low);
  e.swingHigh = sh(e.swingHigh);
  e.swingLow = sh(e.swingLow);
  if (e.setup) { e.setup.sellZone = shZone(e.setup.sellZone); e.setup.buyZone = shZone(e.setup.buyZone); }
  if (e.wave) e.wave.retrLevel = sh(e.wave.retrLevel);
  e.supplyZones = shArr(e.supplyZones);
  e.demandZones = shArr(e.demandZones);
  e.signals = shArr(e.signals);
  if (e.suggestion && typeof e.lastClose === 'number') {
    var sg = e.suggestion, buy = sg.side === 'buy';
    var dist = (e.lastClose >= sg.entryLo && e.lastClose <= sg.entryHi) ? 0 :
      buy ? (e.lastClose < sg.entryLo ? sg.entryLo - e.lastClose : e.lastClose - sg.entryHi)
          : (e.lastClose > sg.entryHi ? e.lastClose - sg.entryHi : sg.entryLo - e.lastClose);
    sg.dist = Math.round(dist * 100) / 100;
    sg.distAtr = typeof e.atr === 'number' && e.atr > 0 ? Math.round(dist / e.atr * 100) / 100 : null;
  }
}

/* ---------- محاسبه + کش ---------- */
function scKey() { return S_SCALP.sym + '@' + S_SCALP.tf; }
function scalpCompute(force) {
  var key = scKey();
  var cached = SCALP_CACHE[key];
  if (!force && cached && Date.now() - cached.at < 60000) return Promise.resolve(cached.payload);
  var symCfg = SCALP_SYMS[S_SCALP.sym], tfCfg = SCALP_TFS[S_SCALP.tf];
  if (!symCfg || !tfCfg) return Promise.reject(new Error('cfg'));
  SCALP_BUSY = true;
  var h4p = null;
  return scFetchBars(symCfg.y, tfCfg.i, tfCfg.r).then(function (bars) {
    return scFetchBars(symCfg.y, '1h', '3mo').then(function (h1) { h4p = scAgg4h(h1); return bars; }).catch(function () { return bars; });
  }).then(function (bars) {
    var engine = scalpRun(bars, h4p);
    var rw = null;
    try {
      rw = trRangeComp(bars.map(function (b) { return b.h; }), bars.map(function (b) { return b.l; }), bars.map(function (b) { return b.c; }));
    } catch (e) { rw = null; }
    /* کالیبراسیون اسپات: حذف اختلاف دائمی آتی↔اسپات از همهٔ سطوح */
    var basisInfo = null;
    var spotP = symCfg.spot ? scFetchSpot(symCfg.spot) : Promise.resolve(null);
    return spotP.then(function (spot) {
      if (spot !== null && isFinite(engine.lastClose)) {
        var basis = Math.round((spot - engine.lastClose) * 100) / 100;
        if (Math.abs(basis) > 0.01) scShiftEngine(engine, basis);
        basisInfo = {
          applied: Math.abs(basis) > 0.01, spot: spot, futures: engine.lastClose - (Math.abs(basis) > 0.01 ? basis : 0), basis: basis,
          note: 'کندل‌های منبع از بازار آتی (Yahoo) است؛ همهٔ سطوح با اختلاف لحظه‌ای آتی↔اسپات (' + (basis > 0 ? '+' : '') + scPx(basis) + ' دلار) کالیبره شدند تا با چارت اسپات هم‌تراز باشند.'
        };
      } else {
        basisInfo = { applied: false, futures: engine.lastClose, note: 'کالیبراسیون اسپات انجام نشد (سرویس قیمت لحظه‌ای در دسترس نبود) — سطوح مستقیماً از بازار آتی هستند و با چارت اسپات اختلاف دارند (تاریخچهٔ معمول: حدود ۲۰ دلار برای طلا).' };
      }
      /* گیت تازگی داده */
      var tfSec = { '1m': 60, '5m': 300, '15m': 900 }[S_SCALP.tf] || 300;
      var lastAge = Math.max(0, Math.floor(Date.now() / 1000) - engine.lastT);
      var stale = lastAge > Math.max(3 * tfSec, 900);
      var payload = {
        ok: true, sym: S_SCALP.sym, symbolLabel: symCfg.label, symbolMono: symCfg.mono,
        tf: S_SCALP.tf, tfLabel: tfCfg.label, engine: engine, rangeWarn: rw, basis: basisInfo,
        freshness: { lastAgeSec: lastAge, stale: stale, note: stale ? 'آخرین کندل منبع ' + faDigits(Math.round(lastAge / 60)) + ' دقیقه پیش است — بازار ممکن است بسته باشد یا فید تأخیر/قطعی داشته باشد؛ تا بازشدن فید، سیگنال‌ها به‌روز نیستند.' : null },
        feedNote: 'کندل‌های اینترادی Yahoo ~۱۰ دقیقه تأخیر دارند؛ سطوح حدودی‌اند.', at: Date.now()
      };
      SCALP_CACHE[key] = { at: Date.now(), payload: payload };
      SCALP_BUSY = false;
      return payload;
    });
  }).catch(function (err) {
    SCALP_BUSY = false;
    throw err;
  });
}

/* ---------- رندر: باکس اسکلپ (داخل اپ پیشنهاد معامله) ---------- */
function scStateChip(label, st) {
  var cls = st === 'retest' ? 'mid' : st === 'armed' ? 'warn' : 'na';
  var txt = st === 'retest' ? 'در انتظار ریتست' : st === 'armed' ? 'مسلح' : 'غیرفعال';
  return '<span class="chip ' + cls + '">' + label + ': ' + txt + '</span>';
}
function scBodyHTML(d, fixed) {
  var e = d.engine, h = '';
  if (d.freshness && d.freshness.stale)
    h += '<div class="bt-warn red"><b>⚠ دادهٔ منبع به‌روز نیست</b><span>' + d.freshness.note + '</span></div>';
  if (d.basis)
    h += '<div class="sc-basis' + (d.basis.applied ? ' ok' : '') + '"><b>' + (d.basis.applied ? '✓ سطوح با اسپات هم‌تراز شدند (اختلاف آتی↔اسپات لحظه‌ای: ' + scPx(d.basis.basis) + ' دلار)' : '⚠ کالیبراسیون اسپات انجام نشد — سطوح بر اساس بازار آتی‌اند و با چارت اسپات اختلاف دارند') + '</b><span>' + d.basis.note + '</span></div>';
  if (e.degraded) h += '<div class="bt-warn">⚠ کیفیت داده این تایم‌فریم برای موتور اسکلپ کافی نیست — ' + e.notes[0] + '</div>';
  var sg = e.suggestion;
  if (sg) {
    var stCls = sg.status === 'active' ? 'ok' : sg.status === 'far' ? 'warn' : 'bad';
    h += '<div class="sc-sig ' + (sg.side === 'buy' ? 'b' : 's') + '">' +
      '<div class="sc-sig-top"><b>' + icon(sg.side === 'buy' ? 'trendUp' : 'trendDown', 15) + (sg.side === 'buy' ? 'پیشنهاد خرید اسکلپ' : 'پیشنهاد فروش اسکلپ') + '</b>' +
      '<span class="chip na">' + (sg.kind === 'setup4h' ? 'ستاپ ۴ساعته' : 'برخورد اوردر بلاک') + ' · ' + faDigits(sg.barsAgo) + ' کندل پیش</span></div>' +
      '<div class="sc-status ' + stCls + '">وضعیت نسبت به قیمت فعلی: ' + sg.statusFa + ' — <span dir="ltr">Δ ' + scPx(sg.dist) + (sg.distAtr !== null && sg.distAtr !== undefined ? ' (' + scPx(sg.distAtr) + '×ATR)' : '') + '</span></div>' +
      '<div class="sc-grid">' +
      '<span>ناحیه ورود (حدودی): <b dir="ltr">' + scPx(sg.entryLo) + ' – ' + scPx(sg.entryHi) + '</b></span>' +
      '<span>حد ضرر: <b class="r" dir="ltr">' + scPx(sg.sl) + '</b></span>' +
      '<span>هدف ۱: <b class="g" dir="ltr">' + scPx(sg.tp1) + '</b></span>' +
      '<span>هدف ۲: <b class="g" dir="ltr">' + scPx(sg.tp2) + '</b></span></div>' +
      '<p class="m">' + sg.reason + '</p>' +
      '<p class="m amber">ابطال محاسباتی: بسته‌شدن کندل خارج و خلاف ناحیه ورود — اجرا، حجم و ریسک بر عهده خودتان است.</p></div>';
  } else {
    var stTxt = '';
    if (e.setup.sell === 'retest' && e.setup.sellZone) stTxt += '<p class="m">ناحیه ریتست فروش: <b dir="ltr">' + scPx(e.setup.sellZone.lo) + ' – ' + scPx(e.setup.sellZone.hi) + '</b> — بازگشت به ناحیه + الگوی نزولی = سیگنال فروش.</p>';
    if (e.setup.buy === 'retest' && e.setup.buyZone) stTxt += '<p class="m">ناحیه ریتست خرید: <b dir="ltr">' + scPx(e.setup.buyZone.lo) + ' – ' + scPx(e.setup.buyZone.hi) + '</b> — بازگشت به ناحیه + الگوی صعودی = سیگنال خرید.</p>';
    h += '<div class="sc-wait"><div class="sc-sig-top"><b>' + icon('hourglass', 14) + 'سیگنال تازه‌ای صادر نشده است</b></div>' +
      '<p class="m">اندیکاتور فعلاً ستاپ کامل (برخورد ← شکست ← ریتست ← الگو) یا برخورد تازه به زون OB ندارد؛ این وضعیت «عدم سیگنال» است، نه «عدم داده».</p>' +
      '<div class="sc-chips">' + scStateChip('ستاپ فروش', e.setup.sell) + scStateChip('ستاپ خرید', e.setup.buy) + '</div>' + stTxt + '</div>';
  }
  if (d.rangeWarn && d.rangeWarn.active)
    h += '<div class="bt-warn' + (d.rangeWarn.severity === 'tight' ? ' red' : '') + '"><b>' + (d.rangeWarn.severity === 'tight' ? 'هشدار جدی: رنج فشرده در تایم‌فریم اسکلپ' : 'هشدار: بازار رنج است') + '</b><span>' + d.rangeWarn.message + '</span></div>';

  h += '<div class="sc-lv"><p class="t">' + icon('target', 13) + 'سطوح مهم (مقادیر حدودی)</p>' +
    '<div class="sc-grid">' +
    '<span>سقف کندل ۴ساعتهٔ بسته‌شده: <b class="r" dir="ltr">' + scPx(e.h4High) + '</b></span>' +
    '<span>کف کندل ۴ساعتهٔ بسته‌شده: <b class="g" dir="ltr">' + scPx(e.h4Low) + '</b></span>' +
    '<span>آخرین سقف سوئینگ: <b dir="ltr">' + scPx(e.swingHigh) + (e.swingHighBroken ? ' (شکسته)' : '') + '</b></span>' +
    '<span>آخرین کف سوئینگ: <b dir="ltr">' + scPx(e.swingLow) + (e.swingLowBroken ? ' (شکسته)' : '') + '</b></span></div>';
  var zi;
  for (zi = 0; zi < e.supplyZones.length; zi++) h += '<p class="z r">زون فروش OB (زنده): <b dir="ltr">' + scPx(e.supplyZones[zi].bot) + ' – ' + scPx(e.supplyZones[zi].top) + '</b></p>';
  for (zi = 0; zi < e.demandZones.length; zi++) h += '<p class="z g">زون خرید OB (زنده): <b dir="ltr">' + scPx(e.demandZones[zi].bot) + ' – ' + scPx(e.demandZones[zi].top) + '</b></p>';
  if (e.wave.active) h += '<p class="m">موج شکست ' + (e.wave.active === 'bear' ? 'نزولی' : 'صعودی') + ' فعال است (' + scPx(e.wave.nAtr) + ' برابر ATR) — سطح پایان موج (اصلاح ۲۳٪): <b dir="ltr">' + scPx(e.wave.retrLevel) + '</b></p>';
  if (e.setup.unavailable && e.notes[0]) h += '<p class="m amber">' + e.notes[0] + '</p>';
  h += '</div>';
  h += '<p class="sc-div">واگرایی چندابزاری (RSI/MACD/Stoch/CCI/MFI — توافق ۳ از ۵): ' + e.divergence.note + '</p>';

  if (e.signals.length) {
    h += '<div class="sc-hist"><p class="t">سیگنال‌های اخیر موتور (۶ مورد آخر)</p>';
    var sigs = e.signals.slice().reverse();
    for (var si = 0; si < sigs.length; si++) {
      var s = sigs[si];
      h += '<div class="sc-hrow"><span class="' + (s.side === 'buy' ? 'g' : 'r') + '">' + (s.side === 'buy' ? 'خرید' : 'فروش') + ' — ' + (s.kind === 'setup4h' ? 'ستاپ ۴ساعته' : 'برخورد OB') + '</span><span dir="ltr">' + scPx(s.zoneLo) + ' – ' + scPx(s.zoneHi) + '</span><span>' + faTime(new Date(s.t * 1000)) + '</span></div>';
    }
    h += '</div>';
  }
  h += '<p class="sc-foot">' + d.symbolLabel + ' · تایم‌فریم ' + d.tfLabel + ' · قیمت آخرین کندل بسته‌شده (کالیبره به اسپات): <span dir="ltr">' + scPx(e.lastClose) + '</span> · ATR۱۴: <span dir="ltr">' + scPx(e.atr) + '</span> · آخرین محاسبه: ' + faTime(new Date(d.at)) +
    '<br>' + (d.feedNote || '') + ' پورت الگوریتمی اندیکاتور کاربر روی کندل‌های Yahoo Finance — سطوح حدودی‌اند و سیگنال قطعی یا توصیه خرید/فروش نیستند؛ تایم‌فریم‌های کوچک نویز بیشتری دارند.</p>';
  return h;
}
function scSelectorsHTML(fixed) {
  var h = '<div class="sc-sels">';
  if (!fixed) {
    h += '<div class="sc-chips" data-sc-syms>';
    Object.keys(SCALP_SYMS).forEach(function (k) {
      h += '<button type="button" class="cchip' + (S_SCALP.sym === k ? ' on' : '') + '" data-sc-sym="' + k + '">' + SCALP_SYMS[k].label.split(' — ')[0] + '</button>';
    });
    h += '</div>';
  }
  h += '<div class="sc-chips" data-sc-tfs>';
  Object.keys(SCALP_TFS).forEach(function (t) {
    h += '<button type="button" class="cchip' + (S_SCALP.tf === t ? ' on' : '') + '" data-sc-tf="' + t + '">' + SCALP_TFS[t].label + '</button>';
  });
  h += '</div>' +
    '<button type="button" class="iconbtn" data-sc-refresh aria-label="بروزرسانی اسکلپ"><span data-sc-spin style="display:inline-flex">' + icon('refresh', 14) + '</span></button>' +
    '</div>';
  return h;
}
function scContentHTML(fixed, d) {
  var head = '<div class="sc-head">' + icon('zap', 15) + '<b>' + (fixed ? 'سیگنال اسکلپ اونس — XAUUSD' : 'پیشنهاد اسکلپ') + '</b>' +
    '<span class="sc-sub">موتور اندیکاتور: SBW موج شکست · اوردر بلاک FVG · ستاپ ۴ساعته · واگرایی ۵ابزاری</span></div>' + scSelectorsHTML(fixed);
  if (!d) return head + '<div class="bt-state"><span class="spin">' + icon('refresh', 18) + '</span>در حال تحلیل کندل‌ها…<span class="s">موج، اوردر بلاک‌ها و ستاپ ۴ساعته روی داده Yahoo Finance</span></div>';
  return head + scBodyHTML(d, fixed);
}
function bindScalpControls(rerender) {
  var syms = appScroll.querySelectorAll('[data-sc-sym]');
  for (var i = 0; i < syms.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (S_SCALP.sym === b.dataset.scSym) return;
        S_SCALP.sym = b.dataset.scSym; scSave();
        rerender(true);
      });
    })(syms[i]);
  }
  var tfs = appScroll.querySelectorAll('[data-sc-tf]');
  for (var j = 0; j < tfs.length; j++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (S_SCALP.tf === b.dataset.scTf) return;
        S_SCALP.tf = b.dataset.scTf; scSave();
        rerender(true);
      });
    })(tfs[j]);
  }
  var rf = appScroll.querySelector('[data-sc-refresh]');
  if (rf) rf.addEventListener('click', function () { rerender(true); });
}
/* باکس داخل اپ پیشنهاد معامله */
function renderScalpBox(force) {
  var slot = appScroll.querySelector('[data-sc-slot]');
  if (!slot) return;
  if (SCALP_BUSY && !force) { slot.innerHTML = scContentHTML(false, null); return; }
  slot.innerHTML = '<div class="bt-state"><span class="spin">' + icon('refresh', 18) + '</span>در حال تحلیل کندل‌ها…</div>';
  scalpCompute(!!force).then(function (d) {
    var s2 = appScroll.querySelector('[data-sc-slot]');
    if (!s2) return;
    s2.innerHTML = scContentHTML(false, d);
    bindScalpControls(renderScalpBox);
  }).catch(function () {
    var s3 = appScroll.querySelector('[data-sc-slot]');
    if (!s3) return;
    s3.innerHTML = '<div class="bt-state"><span style="color:var(--red)">' + icon('wifi', 20) + '</span>دریافت کندل‌ها از Yahoo Finance ممکن نشد — اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.<button type="button" class="btn" data-sc-retry>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
    var rb = s3.querySelector('[data-sc-retry]');
    if (rb) rb.addEventListener('click', function () { renderScalpBox(true); });
  });
}

/* ---------- اپ مستقل سیگنال اسکلپ اونس ---------- */
var SCALP_AUTO = null; /* تایمر بروزرسانی خودکار — فقط وقتی اپ باز است */
function scStopAuto() { if (SCALP_AUTO) { clearInterval(SCALP_AUTO); SCALP_AUTO = null; } }
function renderScalpApp() {
  scStopAuto();
  appScroll.innerHTML = '<div class="app-pad"><div data-sc-app>' + scContentHTML(true, null) + '</div>' +
    '<p class="ms-note">این پنجره مستقل، همان موتور اندیکاتور را روی نماد اونس (XAUUSD) اجرا می‌کند و هر ۶۰ ثانیه خودکار بروزرسانی می‌شود؛ اگر اندیکاتور شما در تریدینگ‌ویو سیگنال بدهد، این پنجره همان سیگنال را با سطوح حدودی نشان می‌دهد. خروجی اطلاع‌رسانی است و توصیه معامله نیست.</p></div>';
  bindScalpControls(renderScalpAppInner);
  renderScalpAppInner(true);
}
function renderScalpAppInner(force) {
  var box = appScroll.querySelector('[data-sc-app]');
  if (!box) return;
  if (!force && SCALP_BUSY) return;
  scalpCompute(!!force).then(function (d) {
    var b2 = appScroll.querySelector('[data-sc-app]');
    if (!b2) return;
    b2.innerHTML = scContentHTML(true, d);
    bindScalpControls(renderScalpAppInner);
    /* بروزرسانی خودکار ۶۰ ثانیه‌ای فقط برای اپ مستقل */
    scStopAuto();
    SCALP_AUTO = setInterval(function () {
      if (!appScroll.querySelector('[data-sc-app]')) { scStopAuto(); return; }
      renderScalpAppInner(true);
    }, 60000);
  }).catch(function () {
    var b3 = appScroll.querySelector('[data-sc-app]');
    if (!b3) return;
    b3.innerHTML = '<div class="bt-state"><span style="color:var(--red)">' + icon('wifi', 20) + '</span>دریافت کندل‌ها از Yahoo Finance ممکن نشد — اتصال اینترنت یا VPN را بررسی کنید و دوباره تلاش کنید.<button type="button" class="btn" data-sc-retry2>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
    var rb = b3.querySelector('[data-sc-retry2]');
    if (rb) rb.addEventListener('click', function () { renderScalpAppInner(true); });
  });
}
