/* ================= اپ «سبک‌های اسکلپ» — موتور ۵ سبک =================
 * پنج سبک مستقل اسکلپ که هرکدام بر اساس داده‌های واقعی Yahoo (با کالیبراسیون اسپات)
 * وضعیت سیگنال خرید/فروش/انتظار می‌سازند:
 *   ۱) بریک‌اوت رنج آسیا   ۲) پولبک روندی   ۳) ریورسال حمایت/مقاومت
 *   ۴) فیک‌اوت/ری‌تست        ۵) اسکلپ رنج
 * بروزرسانی خودکار: ساعتی (+ دکمه بروزرسانی دستی).
 * خروجی اطلاع‌رسانی تحلیلی است، نه سیگنال قطعی و نه توصیه معاملاتی.
 * ================================================================ */

var STYLES_KEY = 'sd_styles_v1';
var STYLES_TTL = 60 * 60 * 1000; /* ساعتی */
var S_STYLES = { sym: 'xau' };
try {
  var _stc = JSON.parse(lsGet(STYLES_KEY) || 'null');
  if (_stc && SCALP_SYMS[_stc.sym]) S_STYLES = { sym: _stc.sym };
} catch (e) {}
function stSave() { lsSet(STYLES_KEY, JSON.stringify(S_STYLES)); }
var STYLES_CACHE = null, STYLES_BUSY = false, STYLES_AUTO = null;

/* اسنپ‌شات کندل‌های زمان ساخت (fallback آفلاین — توسط build تزریق می‌شود) */
var ST_SNAP = null;
try { ST_SNAP = JSON.parse(document.getElementById('sd-snapshot-styles').textContent); } catch (e) { ST_SNAP = null; }

/* ---------- ابزارهای محلی ---------- */
function stClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function stEma(v, len) {
  var out = [], k = 2 / (len + 1), prev = v[0], i;
  out.push(prev);
  for (i = 1; i < v.length; i++) { prev = v[i] * k + prev * (1 - k); out.push(prev); }
  return out;
}
function stPivots(bars, L) {
  var hs = [], ls = [], n = bars.length, i, k, okH, okL;
  for (i = L; i < n - L; i++) {
    okH = true; okL = true;
    for (k = 1; k <= L; k++) {
      if (bars[i + k].h >= bars[i].h) okH = false;
      if (bars[i + k].l <= bars[i].l) okL = false;
    }
    if (okH) hs.push({ i: i, p: bars[i].h });
    if (okL) ls.push({ i: i, p: bars[i].l });
  }
  return { hs: hs, ls: ls };
}
var _stKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TEHRAN, year: 'numeric', month: '2-digit', day: '2-digit' });
var _stHMFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TEHRAN, hour: '2-digit', minute: '2-digit', hour12: false });
function stParts(tSec) {
  var d = new Date(tSec * 1000), hm = _stHMFmt.format(d).split(':');
  return { key: _stKeyFmt.format(d), min: (+hm[0]) * 60 + (+hm[1]) };
}
function stSessionOf(min) {
  if (min < 540) return { id: 'asia', label: 'سشن آسیا', endMin: 540 };
  if (min < 990) return { id: 'london', label: 'سشن لندن', endMin: 990 };
  return { id: 'ny', label: 'سشن نیویورک', endMin: 1410 };
}
/* کندل بازگشتی: برخورد به سطح + بسته‌شدن خلاف جهت سایه با سایه ≥ ۴۵٪ دامنه */
function stReject(bars, i, level, dir) {
  var b = bars[i], rng = (b.h - b.l) || 1e-9;
  if (dir === 'sell') {
    var wick = b.h - Math.max(b.o, b.c);
    return { ok: b.h >= level && b.c < level && wick >= 0.45 * rng, strength: wick / rng };
  }
  var wick2 = Math.min(b.o, b.c) - b.l;
  return { ok: b.l <= level && b.c > level && wick2 >= 0.45 * rng, strength: wick2 / rng };
}
var ST_STATUS_FA = { active: 'سیگنال فعال', watch: 'زیر نظر', wait: 'در انتظار شرایط', off: 'امروز مناسب نیست' };

/* ---------- زمینه بازار (یک‌بار برای هر ۵ سبک) ---------- */
function stContext(m15, h1, cfg) {
  var nowSec = Math.floor(Date.now() / 1000);
  var now = stParts(nowSec);
  var atrArr = scAtr(m15, 14), atr = atrArr[atrArr.length - 1];
  var c15 = m15.map(function (b) { return b.c; });
  var eM20 = stEma(c15, 20), eM50 = stEma(c15, 50);
  var rsiArr = scRsi(c15, 14), rsi = rsiArr[rsiArr.length - 1];
  var last = c15[c15.length - 1], lastT = m15[m15.length - 1].t;

  /* رنج آسیا: ۰۲:۳۰ تا ۰۹:۰۰ تهران */
  var asian = { hi: -Infinity, lo: Infinity, bars: 0, complete: now.min >= 540 };
  var i, p;
  for (i = 0; i < m15.length; i++) {
    p = stParts(m15[i].t);
    if (p.key === now.key && p.min >= 150 && p.min < 540) {
      if (m15[i].h > asian.hi) asian.hi = m15[i].h;
      if (m15[i].l < asian.lo) asian.lo = m15[i].l;
      asian.bars++;
    }
  }
  if (!asian.bars) { asian.hi = null; asian.lo = null; }

  /* روز قبل + پیوت کلاسیک از H1 */
  var yKey = addDaysToKey(now.key, -1), prev = { hi: -Infinity, lo: Infinity, c: null }, tmp = {};
  for (i = 0; i < h1.length; i++) {
    p = stParts(h1[i].t);
    if (p.key === yKey) {
      if (h1[i].h > prev.hi) prev.hi = h1[i].h;
      if (h1[i].l < prev.lo) prev.lo = h1[i].l;
      prev.c = h1[i].c;
    }
    if (p.key === now.key) {
      if (tmp[p.key] === undefined) tmp[p.key] = { hi: -Infinity, lo: Infinity };
      if (h1[i].h > tmp[p.key].hi) tmp[p.key].hi = h1[i].h;
      if (h1[i].l < tmp[p.key].lo) tmp[p.key].lo = h1[i].l;
    }
  }
  if (prev.hi === -Infinity) { prev = null; }
  var piv = null;
  if (prev) {
    var P = (prev.hi + prev.lo + (prev.c !== null ? prev.c : (prev.hi + prev.lo) / 2)) / 3;
    piv = { p: P, r1: 2 * P - prev.lo, s1: 2 * P - prev.hi, r2: P + (prev.hi - prev.lo), s2: P - (prev.hi - prev.lo) };
  }

  /* روند H1 */
  var cH1 = h1.length ? h1.map(function (b) { return b.c; }) : c15;
  var eH20 = stEma(cH1, 20), eH50 = stEma(cH1, 50);
  var v20 = eH20[eH20.length - 1], v50 = eH50[eH50.length - 1];
  var atrH1 = h1.length ? scAtr(h1, 14).slice(-1)[0] : atr * 2;
  var trend = 'flat', tScore = 0;
  if (isFinite(v20) && isFinite(v50) && atrH1 > 0) {
    var sep = (v20 - v50) / atrH1;
    tScore = stClamp(Math.abs(sep) / 0.8, 0, 1);
    if (last > v50 && sep > 0.12) trend = 'up';
    else if (last < v50 && sep < -0.12) trend = 'dn';
  }

  /* سوئینگ‌های اخیر M15 */
  var pv = stPivots(m15.slice(-60), 4), swingHi = null, swingLo = null;
  if (pv.hs.length) swingHi = pv.hs[pv.hs.length - 1].p;
  if (pv.ls.length) swingLo = pv.ls[pv.ls.length - 1].p;

  /* رنج ۶ ساعته (۲۴ کندل M15) */
  var r24 = m15.slice(-24), rHi = -Infinity, rLo = Infinity;
  for (i = 0; i < r24.length; i++) { if (r24[i].h > rHi) rHi = r24[i].h; if (r24[i].l < rLo) rLo = r24[i].l; }
  var flat = isFinite(v20) && isFinite(v50) && Math.abs(v20 - v50) < 0.4 * atrH1 && (rHi - rLo) < 2.4 * atr;

  /* سطوح کلیدی مرتب‌شده بر اساس نزدیکی */
  var levels = [];
  if (prev) { levels.push({ p: prev.hi, label: 'سقف روز قبل' }); levels.push({ p: prev.lo, label: 'کف روز قبل' }); }
  if (piv) { levels.push({ p: piv.r1, label: 'R1 پیوت' }); levels.push({ p: piv.s1, label: 'S1 پیوت' }); levels.push({ p: piv.p, label: 'پیوت روزانه' }); }
  if (asian.hi !== null && asian.complete) { levels.push({ p: asian.hi, label: 'سقف رنج آسیا' }); levels.push({ p: asian.lo, label: 'کف رنج آسیا' }); }
  levels.sort(function (a, b) { return Math.abs(last - a.p) - Math.abs(last - b.p); });

  return {
    cfg: cfg, nowSec: nowSec, now: now, session: stSessionOf(now.min),
    m15: m15, last: last, lastT: lastT, atr: atr, rsi: rsi,
    eM20: eM20[eM20.length - 1], eM50: eM50[eM50.length - 1],
    asian: asian, prev: prev, piv: piv,
    trend: trend, tScore: tScore, vH20: v20, vH50: v50, atrH1: atrH1,
    swingHi: swingHi, swingLo: swingLo,
    rHi: rHi, rLo: rLo, flat: flat,
    levels: levels, basis: 0, basisNote: null
  };
}
function stShift(ctx, d) {
  var k;
  ctx.last += d;
  ctx.eM20 += d; ctx.eM50 += d; ctx.vH20 += d; ctx.vH50 += d;
  if (ctx.asian.hi !== null) { ctx.asian.hi += d; ctx.asian.lo += d; }
  if (ctx.prev) { ctx.prev.hi += d; ctx.prev.lo += d; }
  if (ctx.piv) for (k in ctx.piv) ctx.piv[k] += d;
  if (ctx.swingHi !== null) ctx.swingHi += d;
  if (ctx.swingLo !== null) ctx.swingLo += d;
  ctx.rHi += d; ctx.rLo += d;
  for (k = 0; k < ctx.levels.length; k++) ctx.levels[k].p += d;
}

/* ---------- کارت پایه هر سبک ---------- */
function stBase(id, label, ic) {
  return { id: id, label: label, ic: ic, status: 'wait', side: null, entryLo: null, entryHi: null, sl: null, tp1: null, tp2: null, conf: null, reason: '', badge: null, confParts: [] };
}
function stFinalize(r, ctx) {
  if (r.status === 'active' && r.side) {
    var bonus = 0;
    for (var i = 0; i < r.confParts.length; i++) bonus += r.confParts[i];
    r.conf = Math.round(stClamp(55 + bonus, 40, 90));
    if (r.entryLo !== null && r.sl !== null && r.tp2 == null) {
      var mid = (r.entryLo + r.entryHi) / 2;
      r.tp2 = mid + 2 * Math.abs(mid - r.sl) * (r.side === 'buy' ? 1 : -1);
    }
    if (r.tp2 == null) r.tp2 = null; /* نرمال‌سازی undefined → null */
  } else { r.conf = null; }
  return r;
}

/* ---------- سبک ۱: بریک‌اوت رنج آسیا ---------- */
function stEvalBreakout(ctx) {
  var r = stBase('breakout', 'بریک‌اوت رنج آسیا', 'moveH'), a = ctx.asian, atr = ctx.atr, last = ctx.last;
  if (a.hi === null) { r.reason = 'کندلی از سشن آسیا امروز در دسترس نیست — این سبک فعلاً قابل ارزیابی نیست.'; return stFinalize(r, ctx); }
  if (!a.complete) {
    r.status = 'wait';
    r.reason = 'رنج آسیا هنوز در حال شکل‌گیری است (تا ۰۹:۰۰ تهران). سقف فعلی: ' + scPx(a.hi) + ' — کف: ' + scPx(a.lo) + '. پس از تکمیل، شکستِ تثبیت‌شدهٔ این سطوح سیگنال می‌سازد.';
    return stFinalize(r, ctx);
  }
  var h = a.hi - a.lo, up = last > a.hi, dn = last < a.lo;
  if (!up && !dn) {
    r.status = 'watch';
    r.reason = 'قیمت داخل رنج آسیاست (عرض ' + scPx(h) + ' دلار). تثبیت M15 فراتر از سقف ' + scPx(a.hi) + ' → خرید؛ زیر کف ' + scPx(a.lo) + ' → فروش.';
    return stFinalize(r, ctx);
  }
  var side = up ? 'buy' : 'sell', lvl = up ? a.hi : a.lo, dist = up ? last - a.hi : a.lo - last;
  if (dist > 1.5 * atr) {
    r.status = 'watch'; r.side = side;
    r.reason = 'شکست ' + (up ? 'سقف' : 'کف') + ' آسیا (' + scPx(lvl) + ') رخ داده اما قیمت ' + scPx(dist) + ' دلار دور شده — فقط با ری‌تستِ موفق سطح، ورود منطقی است.';
    return stFinalize(r, ctx);
  }
  r.status = 'active'; r.side = side;
  r.entryLo = up ? lvl : lvl - 0.15 * atr; r.entryHi = up ? lvl + 0.15 * atr : lvl;
  r.sl = up ? lvl - 0.8 * atr : lvl + 0.8 * atr;
  r.tp1 = last + (up ? 1 : -1) * Math.max(h, atr);
  r.confParts = [ctx.trend === (up ? 'up' : 'dn') ? 14 : ctx.trend === 'flat' ? 0 : -10, dist < 0.4 * atr ? 8 : 0, h > 0.5 * atr ? 6 : -4];
  r.reason = 'تثبیت M15 فراتر از ' + (up ? 'سقف' : 'کف') + ' رنج آسیا (' + scPx(lvl) + ') با فاصله ' + scPx(dist / atr, 1) + '×ATR' + (ctx.trend === (up ? 'up' : 'dn') ? ' — هم‌جهت با روند H1' : '');
  r.badge = 'اعتبار: تا ابطال با بسته‌شدن M15 خلاف جهت';
  return stFinalize(r, ctx);
}

/* ---------- سبک ۲: پولبک روندی ---------- */
function stEvalPullback(ctx) {
  var r = stBase('pullback', 'پولبک روندی', 'trendUp'), atr = ctx.atr, last = ctx.last;
  if (ctx.trend === 'flat') { r.reason = 'روند H1 تعریف‌شده نیست (EMA20 و EMA50 فاصله معنادار ندارند) — این سبک امروز موضوعیت ندارد.'; return stFinalize(r, ctx); }
  var up = ctx.trend === 'up';
  r.side = up ? 'buy' : 'sell';
  var zLo = ctx.eM20 - 0.35 * atr, zHi = ctx.eM20 + 0.35 * atr;
  var inZone = last >= zLo && last <= zHi;
  var rsiOk = up ? (ctx.rsi > 32 && ctx.rsi < 60) : (ctx.rsi > 40 && ctx.rsi < 68);
  if (inZone) {
    if (!rsiOk) { r.status = 'watch'; r.reason = 'قیمت در ناحیه پولبک است (' + scPx(zLo) + '–' + scPx(zHi) + ') اما RSI (' + faDigits(Math.round(ctx.rsi)) + ') هنوز شرایط ' + (up ? 'اشباع فروش نسبی' : 'اشباع خرید نسبی') + ' را ندارد — منتظر کف‌سازی/سقف‌سازی.'; return stFinalize(r, ctx); }
    r.status = 'active';
    r.entryLo = zLo; r.entryHi = zHi;
    var mid = (zLo + zHi) / 2;
    if (up) {
      r.sl = (ctx.swingLo !== null && ctx.swingLo < zLo) ? ctx.swingLo - 0.25 * atr : zLo - 0.9 * atr;
      r.tp1 = (ctx.swingHi !== null && ctx.swingHi > last) ? ctx.swingHi : last + 1.4 * atr;
    } else {
      r.sl = (ctx.swingHi !== null && ctx.swingHi > zHi) ? ctx.swingHi + 0.25 * atr : zHi + 0.9 * atr;
      r.tp1 = (ctx.swingLo !== null && ctx.swingLo < last) ? ctx.swingLo : last - 1.4 * atr;
    }
    r.confParts = [ctx.tScore * 12, Math.abs((zHi + zLo) / 2 - last) < 0.15 * atr ? 6 : 0];
    r.reason = 'روند H1 ' + (up ? 'صعودی' : 'نزولی') + '، قیمت به ناحیه EMA20 پنج‌دقیقه (' + scPx(zLo) + '–' + scPx(zHi) + ') اصلاح کرد و RSI در محدوده سالم (' + faDigits(Math.round(ctx.rsi)) + ') است.';
    r.badge = 'اعتبار: تا خروج M15 از ناحیه با بسته‌شدن خلاف روند';
    return stFinalize(r, ctx);
  }
  var beyond = up ? (last > zHi + 1.2 * atr) : (last < zLo - 1.2 * atr);
  r.status = beyond ? 'watch' : 'wait';
  r.reason = beyond
    ? 'روند ' + (up ? 'صعودی' : 'نزولی') + ' است اما قیمت کشیده شده (فاصله ' + scPx(up ? last - zHi : zLo - last) + ' دلار از ناحیه) — در انتظار پولبک به ' + scPx(zLo) + '–' + scPx(zHi) + '.'
    : 'روند ' + (up ? 'صعودی' : 'نزولی') + ' است؛ قیمت فعلاً ' + (up ? 'زیر' : 'بالای') + ' ناحیه پولبک (' + scPx(zLo) + '–' + scPx(zHi) + ') است — منتظر بازگشت قیمت به ناحیه.';
  return stFinalize(r, ctx);
}

/* ---------- سبک ۳: ریورسال حمایت/مقاومت ---------- */
function stEvalReversal(ctx) {
  var r = stBase('reversal', 'ریورسال حمایت/مقاومت', 'moveH'), atr = ctx.atr, last = ctx.last;
  if (!ctx.levels.length) { r.reason = 'سطح کلیدی محاسبه‌پذیری (روز قبل/پیوت/آسیا) در دسترس نیست.'; return stFinalize(r, ctx); }
  var lv = ctx.levels[0], dist = Math.abs(last - lv.p);
  if (dist > 1.6 * atr) {
    r.status = 'wait';
    r.reason = 'نزدیک‌ترین سطح کلیدی «' + lv.label + '» در ' + scPx(lv.p) + ' است (' + scPx(dist) + ' دلار فاصله) — هنوز زون واکنش نیست.';
    return stFinalize(r, ctx);
  }
  var dir = lv.p > last ? 'sell' : 'buy';
  var rej = null, j;
  for (j = ctx.m15.length - 3; j < ctx.m15.length; j++) {
    if (j < 0) continue;
    var t = stReject(ctx.m15, j, lv.p, dir);
    if (t.ok) { rej = t; break; }
  }
  r.side = dir;
  if (!rej) {
    r.status = 'watch';
    r.reason = 'قیمت در زون واکنش «' + lv.label + '» (' + scPx(lv.p) + ') است — منتظر کندل بازگشتی M15 (سایه بلند یا انگالف) در همین ناحیه.';
    return stFinalize(r, ctx);
  }
  r.status = 'active';
  r.entryLo = lv.p - 0.12 * atr; r.entryHi = lv.p + 0.12 * atr;
  if (dir === 'sell') {
    r.sl = lv.p + 0.55 * atr;
    r.tp1 = (ctx.piv && ctx.piv.p < last) ? ctx.piv.p : last - atr;
    if (ctx.piv && ctx.piv.s1 < last) r.tp2 = ctx.piv.s1;
  } else {
    r.sl = lv.p - 0.55 * atr;
    r.tp1 = (ctx.piv && ctx.piv.p > last) ? ctx.piv.p : last + atr;
    if (ctx.piv && ctx.piv.r1 > last) r.tp2 = ctx.piv.r1;
  }
  r.confParts = [rej.strength > 0.6 ? 16 : 10, dir === 'sell' ? (ctx.rsi > 62 ? 10 : 0) : (ctx.rsi < 38 ? 10 : 0), lv.label.indexOf('روز قبل') >= 0 ? 8 : 4];
  r.reason = 'کندل بازگشتی با سایه ' + faDigits(Math.round(rej.strength * 100)) + '٪ دامنه از «' + lv.label + '» در ' + scPx(lv.p) + (dir === 'sell' ? (ctx.rsi > 62 ? ' — RSI ناحیه اشباع خرید (' + faDigits(Math.round(ctx.rsi)) + ')' : '') : (ctx.rsi < 38 ? ' — RSI ناحیه اشباع فروش (' + faDigits(Math.round(ctx.rsi)) + ')' : ''));
  r.badge = 'اعتبار: تا بسته‌شدن M15 فراتر از حد ضرر';
  return stFinalize(r, ctx);
}

/* ---------- سبک ۴: فیک‌اوت/ری‌تست ---------- */
function stEvalFakeout(ctx) {
  var r = stBase('fakeout', 'فیک‌اوت / ری‌تست', 'moveH'), atr = ctx.atr, last = ctx.last;
  var pool = [];
  if (ctx.asian.hi !== null && ctx.asian.complete) { pool.push({ p: ctx.asian.hi, label: 'سقف رنج آسیا', opp: ctx.asian.lo, oppLabel: 'کف رنج آسیا' }); pool.push({ p: ctx.asian.lo, label: 'کف رنج آسیا', opp: ctx.asian.hi, oppLabel: 'سقف رنج آسیا' }); }
  if (ctx.prev) { pool.push({ p: ctx.prev.hi, label: 'سقف روز قبل', opp: ctx.prev.lo, oppLabel: 'کف روز قبل' }); pool.push({ p: ctx.prev.lo, label: 'کف روز قبل', opp: ctx.prev.hi, oppLabel: 'سقف روز قبل' }); }
  if (!pool.length) { r.reason = 'سطح مرجعی برای تشخیص تله شکست در دسترس نیست.'; return stFinalize(r, ctx); }
  var n = ctx.m15.length, best = null, i, L, j;
  for (i = 0; i < pool.length; i++) {
    L = pool[i];
    for (j = Math.max(0, n - 13); j < n - 1; j++) {
      var fakeUp = ctx.m15[j].c > L.p && last < L.p - 0.12 * atr;
      var fakeDn = ctx.m15[j].c < L.p && last > L.p + 0.12 * atr;
      if (!fakeUp && !fakeDn) continue;
      var ext = -Infinity, k;
      if (fakeUp) { for (k = j; k < n - 1; k++) if (ctx.m15[k].h > ext) ext = ctx.m15[k].h; }
      else { for (k = j; k < n - 1; k++) if (ctx.m15[k].l < ext || ext === -Infinity) ext = ctx.m15[k].l; }
      if (!best || j > best.j) best = { j: j, L: L, up: fakeUp, ext: ext };
    }
  }
  if (!best) {
    r.status = 'wait';
    r.reason = 'تله شکست تازه‌ای در ۳ ساعت اخیر ثبت نشده — شکست‌های ' + (ctx.asian.hi !== null ? 'سطوح آسیا (' + scPx(ctx.asian.hi) + ' / ' + scPx(ctx.asian.lo) + ')' : 'سطوح روز قبل') + ' زیر نظر است.';
    return stFinalize(r, ctx);
  }
  r.status = 'active';
  r.side = best.up ? 'sell' : 'buy';
  r.entryLo = last - 0.1 * atr; r.entryHi = last + 0.1 * atr;
  r.sl = best.up ? best.ext + 0.25 * atr : best.ext - 0.25 * atr;
  var mid = (best.L.p + best.L.opp) / 2;
  r.tp1 = mid;
  r.tp2 = best.L.opp;
  r.confParts = [ctx.trend === (best.up ? 'dn' : 'up') ? 12 : 0, Math.abs(last - best.L.p) > 0.25 * atr ? 8 : 0];
  r.reason = 'شکست کاذب ' + best.L.label + ' (' + scPx(best.L.p) + '): قیمت فراتر رفت و به داخل بازگشت — هدف بازگشت تا ' + best.L.oppLabel + ' در ' + scPx(best.L.opp) + '.';
  r.badge = 'اعتبار: تا بسته‌شدن M15 دوباره فراتر از ' + scPx(best.L.p);
  return stFinalize(r, ctx);
}

/* ---------- سبک ۵: اسکلپ رنج ---------- */
function stEvalRange(ctx) {
  var r = stBase('range', 'اسکلپ رنج', 'gauge'), atr = ctx.atr, last = ctx.last;
  var w = ctx.rHi - ctx.rLo;
  if (!ctx.flat) {
    r.status = 'off';
    r.reason = 'بازار مومنتوم روند دارد (فاصله EMAهای H1: ' + scPx(Math.abs(ctx.vH20 - ctx.vH50)) + ' دلار) — اسکلپ رنج امروز توصیه نمی‌شود، سبک پولبک را ببینید.';
    return stFinalize(r, ctx);
  }
  var pos = (last - ctx.rLo) / (w || 1e-9);
  if (pos > 0.28 && pos < 0.72) {
    r.status = 'watch';
    r.reason = 'رنج آرام ۶ساعته: ' + scPx(ctx.rLo) + ' تا ' + scPx(ctx.rHi) + ' (عرض ' + scPx(w) + ' = ' + scPx(w / atr, 1) + '×ATR). قیمت میانه رنج است — خرید در کف / فروش در سقف.';
    return stFinalize(r, ctx);
  }
  var side = pos <= 0.28 ? 'buy' : 'sell', edge = side === 'buy' ? ctx.rLo : ctx.rHi;
  var rej = null, j;
  for (j = ctx.m15.length - 3; j < ctx.m15.length; j++) {
    if (j < 0) continue;
    var t = stReject(ctx.m15, j, edge, side === 'buy' ? 'buy' : 'sell');
    if (t.ok) { rej = t; break; }
  }
  if (!rej) {
    r.status = 'watch';
    r.reason = 'قیمت در ' + (side === 'buy' ? 'کف' : 'سقف') + ' رنج (' + scPx(edge) + ') است — منتظر کندل بازگشتی برای تایید ورود.';
    return stFinalize(r, ctx);
  }
  r.status = 'active'; r.side = side;
  r.entryLo = edge + (side === 'buy' ? 0 : -0.15 * atr); r.entryHi = edge + (side === 'buy' ? 0.15 * atr : 0);
  r.sl = side === 'buy' ? ctx.rLo - 0.5 * atr : ctx.rHi + 0.5 * atr;
  r.tp1 = (ctx.rLo + ctx.rHi) / 2;
  r.tp2 = side === 'buy' ? ctx.rHi : ctx.rLo;
  r.confParts = [rej.strength > 0.55 ? 12 : 6, pos <= 0.15 || pos >= 0.85 ? 8 : 0];
  r.reason = 'رنج آرام (عرض ' + scPx(w) + ' = ' + scPx(w / atr, 1) + '×ATR) — قیمت در ' + (side === 'buy' ? 'کف' : 'سقف') + ' با سایه بازگشتی ' + faDigits(Math.round(rej.strength * 100)) + '٪.';
  r.badge = 'اعتبار: تا شکست و تثبیت خارج از رنج';
  return stFinalize(r, ctx);
}

/* ---------- محاسبه + کش (بروزرسانی ساعتی) ----------
 * منبع زنده: پروکسی‌های عمومی Yahoo — در شکست، اسنپ‌شات کندل‌های زمان ساخت
 * (بدون اتصال هم کار می‌کند؛ با برچسب شفاف «اسنپ‌شات»). */
function stylesCompute(force) {
  if (STYLES_CACHE && !force && Date.now() - STYLES_CACHE.at < STYLES_TTL) return Promise.resolve(STYLES_CACHE.payload);
  if (STYLES_BUSY) return STYLES_CACHE ? Promise.resolve(STYLES_CACHE.payload) : Promise.reject(new Error('busy'));
  STYLES_BUSY = true;
  var cfg = SCALP_SYMS[S_STYLES.sym];
  return scFetchBars(cfg.y, '15m', '5d').then(function (m15) {
    return scFetchBars(cfg.y, '1h', '3mo').then(function (h1) { return { m15: m15, h1: h1 }; }).catch(function () { return { m15: m15, h1: [] }; });
  }).catch(function () {
    /* fallback: اسنپ‌شات داخل فایل */
    var snapBars = ST_SNAP && ST_SNAP.ok && ST_SNAP.symbol === S_STYLES.sym && Array.isArray(ST_SNAP.bars15) ? ST_SNAP : null;
    if (!snapBars) throw new Error('proxy-fail');
    return { m15: snapBars.bars15, h1: snapBars.bars1h || [], snapshot: true, snapAt: ST_SNAP.generatedAtISO };
  }).then(function (r) {
    var ctx = stContext(r.m15, r.h1, cfg);
    var spotP = cfg.spot ? scFetchSpot(cfg.spot) : Promise.resolve(null);
    return spotP.then(function (spot) {
      if (spot !== null && isFinite(ctx.last)) {
        var basis = Math.round((spot - ctx.last) * 100) / 100;
        if (Math.abs(basis) > 0.01) { stShift(ctx, basis); ctx.basis = basis; ctx.basisNote = 'سطوح با اختلاف لحظه‌ای آتی↔اسپات (' + (basis > 0 ? '+' : '') + scPx(basis) + ' دلار) کالیبره شدند تا با چارت اسپات هم‌تراز باشند.'; }
      } else if (cfg.spot) {
        ctx.basisNote = 'کالیبراسیون اسپات انجام نشد — سطوح مستقیماً از بازار آتی Yahoo هستند (تاریخچهٔ معمول طلا: حدود ۲۰ دلار اختلاف).';
      }
      var styles = [stEvalBreakout(ctx), stEvalPullback(ctx), stEvalReversal(ctx), stEvalFakeout(ctx), stEvalRange(ctx)];
      var act = 0, buys = 0, sells = 0;
      for (var i = 0; i < styles.length; i++) {
        if (styles[i].status === 'active') { act++; if (styles[i].side === 'buy') buys++; else sells++; }
      }
      var lastAge = Math.max(0, now_() - ctx.lastT);
      var isSnap = !!r.snapshot;
      var payload = {
        ok: true, sym: S_STYLES.sym, symbolLabel: cfg.label, mono: cfg.mono,
        at: Date.now(), ctx: ctx, styles: styles,
        source: isSnap ? 'snapshot' : 'live',
        summary: { active: act, buys: buys, sells: sells, bias: act === 0 ? 'خنثی' : buys > sells ? 'خرید' : sells > buys ? 'فروش' : 'مخلوط' },
        freshness: {
          lastAgeSec: lastAge,
          stale: isSnap || lastAge > 2700,
          note: isSnap
            ? 'دریافت زندهٔ کندل‌ها ممکن نشد — محاسبه روی اسنپ‌شات داخل فایل (زمان ساخت: ' + faTime(new Date(r.snapAt)) + ' تهران). این دادهٔ به‌روز نیست؛ برای سیگنال تازه اتصال را بررسی و «بروزرسانی» را بزنید.'
            : lastAge > 2700 ? 'آخرین کندل منبع ' + faDigits(Math.round(lastAge / 60)) + ' دقیقه پیش است — بازار احتمالاً بسته است یا فید تأخیر دارد؛ سیگنال‌ها تا بازگشت فید به‌روز نمی‌شوند.' : null
        },
        feedNote: isSnap ? 'منبع این محاسبه: اسنپ‌شات زمان ساخت — سطوح حدودی‌اند.' : 'کندل‌های منبع: Yahoo Finance (~۱۰ دقیقه تأخیر) — همهٔ سطوح حدودی‌اند.'
      };
      STYLES_CACHE = { at: Date.now(), payload: payload };
      STYLES_BUSY = false;
      return payload;
    });
  }).catch(function (err) { STYLES_BUSY = false; throw err; });
  function now_() { return Math.floor(Date.now() / 1000); }
}

/* ---------- رندر ---------- */
function stStatusChip(r) {
  var cls = r.status === 'active' ? (r.side === 'buy' ? 'bull' : 'bear') : r.status === 'watch' ? 'cur' : r.status === 'wait' ? 'na' : 'st';
  return '<span class="chip ' + cls + '">' + ST_STATUS_FA[r.status] + '</span>';
}
function stCardHTML(r) {
  var h = '<div class="st-card ' + r.status + (r.side ? ' ' + r.side : '') + '">' +
    '<div class="st-top">' + icon(r.ic, 14) + '<span class="st-name">' + r.label + '</span>' + stStatusChip(r) +
    (r.side && (r.status === 'active' || r.status === 'watch') ? '<span class="st-side ' + r.side + '">' + (r.side === 'buy' ? 'خرید' : 'فروش') + '</span>' : '') +
    '</div>' +
    '<p class="st-reason">' + r.reason + '</p>';
  if (r.status === 'active' && r.side) {
    h += '<div class="st-nums">' +
      '<span>ناحیه ورود: <b dir="ltr">' + scPx(r.entryLo) + ' – ' + scPx(r.entryHi) + '</b></span>' +
      '<span>حد ضرر: <b class="r" dir="ltr">' + scPx(r.sl) + '</b></span>' +
      '<span>هدف ۱: <b class="g" dir="ltr">' + scPx(r.tp1) + '</b></span>' +
      '<span>هدف ۲: <b class="g" dir="ltr">' + scPx(r.tp2) + '</b></span></div>' +
      '<div class="st-conf"><span>اطمینان: ' + faDigits(r.conf) + '٪</span><span class="bar"><i style="width:' + r.conf + '%"></i></span></div>';
  }
  if (r.badge) h += '<p class="st-badge-line">' + r.badge + '</p>';
  return h + '</div>';
}
function stContentHTML(d) {
  var h = '<div class="sc-head">' + icon('layers', 15) + '<b>سبک‌های اسکلپ — سیگنال روزانه</b>' +
    '<span class="sc-sub">۵ سبک مستقل · بروزرسانی خودکار ساعتی</span></div>';
  h += '<div class="sc-chips" data-st-syms>';
  Object.keys(SCALP_SYMS).forEach(function (k) {
    h += '<button type="button" class="cchip' + (S_STYLES.sym === k ? ' on' : '') + '" data-st-sym="' + k + '">' + SCALP_SYMS[k].label.split(' — ')[0] + '</button>';
  });
  h += '<button type="button" class="iconbtn" data-st-refresh aria-label="بروزرسانی سبک‌ها"><span style="display:inline-flex">' + icon('refresh', 14) + '</span></button></div>';
  if (!d) return h + '<div class="bt-state"><span class="spin">' + icon('refresh', 18) + '</span>در حال محاسبه ۵ سبک…<span class="s">رنج آسیا، روند H1، سطوح روز قبل و رنج ۶ ساعته</span></div>';
  var s = d.summary, ctx = d.ctx;
  var order = { active: 0, watch: 1, wait: 2, off: 3 };
  var cards = d.styles.slice().sort(function (a, b) { return order[a.status] - order[b.status] || (b.conf || 0) - (a.conf || 0); });
  h += '<div class="st-sum">' +
    '<span class="chip ' + (s.active ? (s.bias === 'خرید' ? 'bull' : s.bias === 'فروش' ? 'bear' : 'neut') : 'na') + '">فعال: ' + faDigits(s.active) + ' از ۵</span>' +
    '<span class="chip ' + (s.active ? (s.bias === 'خرید' ? 'bull' : s.bias === 'فروش' ? 'bear' : 'neut') : 'na') + '">تمایل کلی: ' + s.bias + '</span>' +
    '<span class="chip na">' + ctx.session.label + '</span>' +
    '<span class="chip st">قیمت: <b dir="ltr">' + scPx(ctx.last) + '</b></span>' +
    '<span class="chip st" title="زمان محاسبه به وقت تهران">ساعت ' + faTime(new Date(d.at)) + '</span></div>';
  if (d.freshness.stale) h += '<div class="bt-warn red"><b>⚠ دادهٔ منبع به‌روز نیست</b><span>' + d.freshness.note + '</span></div>';
  if (ctx.basisNote) h += '<div class="sc-basis' + (ctx.basis ? ' ok' : '') + '"><b>' + (ctx.basis ? '✓ ' + ctx.basisNote : '⚠ ' + ctx.basisNote) + '</b></div>';
  h += '<div class="st-grid">';
  for (var i = 0; i < cards.length; i++) h += stCardHTML(cards[i]);
  h += '</div>';
  h += '<p class="ms-note">منطق هر سبک مستقل است و ممکن است هم‌زمان دو سبک جهت‌های متفاوت بدهند — در آن حالت بازار فاقد جهت شفاف است و ورود توصیه نمی‌شود. ' + d.feedNote + ' خروجی اطلاع‌رسانی تحلیلی است، سیگنال قطعی و توصیه خرید/فروش نیست؛ اجرا و مدیریت ریسک بر عهده خودتان است.</p>';
  return h;
}
function bindStylesControls(rerender) {
  var syms = appScroll.querySelectorAll('[data-st-sym]');
  for (var i = 0; i < syms.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (S_STYLES.sym === b.dataset.stSym) return;
        S_STYLES.sym = b.dataset.stSym; stSave();
        STYLES_CACHE = null;
        rerender(true);
      });
    })(syms[i]);
  }
  var rf = appScroll.querySelector('[data-st-refresh]');
  if (rf) rf.addEventListener('click', function () { rerender(true); });
}

/* ---------- اپ مستقل سبک‌های اسکلپ ---------- */
function stStopAuto() { if (STYLES_AUTO) { clearInterval(STYLES_AUTO); STYLES_AUTO = null; } }
function stRenderInner(force) {
  var box = appScroll.querySelector('[data-st-app]');
  if (!box) return;
  if (STYLES_BUSY && !force && STYLES_CACHE) box.innerHTML = stContentHTML(STYLES_CACHE.payload);
  else box.innerHTML = stContentHTML(null);
  stylesCompute(!!force).then(function (d) {
    var b2 = appScroll.querySelector('[data-st-app]');
    if (!b2) return;
    b2.innerHTML = stContentHTML(d);
    bindStylesControls(stRenderInner);
  }).catch(function () {
    var b3 = appScroll.querySelector('[data-st-app]');
    if (!b3) return;
    b3.innerHTML = stContentHTML(null) + '<div class="bt-state"><span style="color:var(--red)">' + icon('wifi', 20) + '</span>دریافت کندل‌ها ممکن نشد — اتصال اینترنت را بررسی کنید.<button type="button" class="btn" data-st-retry>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
    var rb = b3.querySelector('[data-st-retry]');
    if (rb) rb.addEventListener('click', function () { stRenderInner(true); });
  });
}
function renderStylesApp() {
  stStopAuto();
  appScroll.innerHTML = '<div class="app-pad" data-st-app></div>';
  stRenderInner(false);
  /* بروزرسانی ساعتی — فقط وقتی اپ باز است */
  STYLES_AUTO = setInterval(function () {
    if (!appScroll.querySelector('[data-st-app]')) { stStopAuto(); return; }
    if (STYLES_CACHE && Date.now() - STYLES_CACHE.at > STYLES_TTL) stRenderInner(true);
  }, 120000);
}
