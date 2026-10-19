/* ================= اپ دستیار معامله‌گر (BIG TRADER) — نسخه مستقل =================
 * موتور محاسباتی محلی: امتیاز اطمینان (کانفلونس)، پلن معامله، واگرایی DXY،
 * رژیم بازار، سناریوهای خبری، پیش‌مرگ و ژورنال رفتاری.
 * منبع داده: ساختار بازار و اخبار از اسنپ‌شات فایل + سری روزانه Yahoo از طریق پروکسی.
 * ================================================================================ */

/* ---------- کلیدهای ذخیره‌سازی ---------- */
var BT_KEYS = {
  journal: 'bt_journal_v1',
  visit: 'bt_visit_v1',
  refresh: 'bt_refresh_v1',
  lastloss: 'bt_last_loss_v1',
  positions: 'bt_positions_v1'
};
function btGet(k, fb) {
  try {
    var raw = lsGet(k);
    if (!raw) return fb;
    return JSON.parse(raw);
  } catch (e) { return fb; }
}
function btSet(k, v) { lsSet(k, JSON.stringify(v)); }

/* ---------- موتور محاسباتی (نسخه JS از trader-engine) ---------- */
function trReturns(c) {
  var out = [], i;
  for (i = 1; i < c.length; i++) if (c[i - 1] !== 0) out.push((c[i] - c[i - 1]) / c[i - 1]);
  return out;
}
function trPearson(a, b) {
  var n = Math.min(a.length, b.length);
  if (n < 20) return null;
  var sa = 0, sb = 0, i;
  for (i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  var ma = sa / n, mb = sb / n, num = 0, da = 0, db = 0;
  for (i = 0; i < n; i++) {
    var x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}
function trAtrPct(h, l, c) {
  var n = c.length;
  if (n < 15) return null;
  var trs = [], i;
  for (i = 1; i < n; i++) trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  var a = 0;
  for (i = trs.length - 14; i < trs.length; i++) a += trs[i];
  return (a / 14) / c[n - 1] * 100;
}
function trER(c, win) {
  if (c.length < win + 1) return null;
  var s = c.slice(-(win + 1)), net = Math.abs(s[s.length - 1] - s[0]), path = 0, i;
  for (i = 1; i < s.length; i++) path += Math.abs(s[i] - s[i - 1]);
  return path === 0 ? null : net / path;
}
function trTfFactor(dirs) {
  var valid = [], i;
  for (i = 0; i < dirs.length; i++) if (dirs[i] !== 'neutral') valid.push(dirs[i]);
  var bulls = valid.filter(function (d) { return d === 'bullish'; }).length;
  var bears = valid.filter(function (d) { return d === 'bearish'; }).length;
  var neu = dirs.filter(function (d) { return d === 'neutral'; }).length;
  if (valid.length === 3 && (bulls === 3 || bears === 3))
    return { score: 40, label: 'هم‌جهت کامل', detail: 'هر سه تایم‌فریم ۱۵ دقیقه، ۱ ساعته و ۴ ساعته هم‌جهت‌اند.' };
  if (bulls === 0 || bears === 0)
    return { score: 20, label: 'هم‌جهت نسبی', detail: 'دو تایم‌فریم هم‌جهت و ' + (neu > 0 ? 'یک تایم‌فریم خنثی' : 'یک تایم‌فریم بی‌جهت') + ' است.' };
  return { score: 0, label: 'تضاد تایم‌فریم‌ها', detail: 'تایم‌فریم‌ها در تضادند — ساختار کوتاه‌مدت و میان‌مدت هم‌جهت نیستند.' };
}
function trNewsGap(min) {
  if (min === null) return { score: 30, label: 'بدون خبر مهم', detail: 'خبر High Impact در صف پیش‌رو نیست.' };
  if (min < 120) return { score: 0, label: 'خبر نزدیک', detail: 'خبر مهم تا کمتر از ۲ ساعت دیگر (' + faDigits(Math.round(min)) + ' دقیقه) منتشر می‌شود.' };
  if (min <= 240) return { score: 15, label: 'خبر میان‌نزدیک', detail: 'خبر مهم حدود ' + faDigits(Math.round(min / 60)) + ' ساعت بعد منتشر می‌شود.' };
  return { score: 30, label: 'خلأ خبری', detail: 'نزدیک‌ترین خبر مهم بیش از ۴ ساعت فاصله دارد (' + faDigits(Math.round(min / 60)) + ' ساعت).' };
}
function trDxyFactor(r, inv) {
  if (r === null) return { score: 0, label: 'داده ناکافی', detail: 'داده کافی برای محاسبه همبستگی با DXY موجود نیست.' };
  var rr = Math.round(r * 100) / 100;
  if (inv) {
    if (r <= -0.6) return { score: 20, label: 'معکوس سالم', detail: 'همبستگی ۳۰ روزه با DXY برابر ' + faDigits(rr) + ' است — رابطه معکوس معمول برقرار است.' };
    if (r < 0.6) return { score: 10, label: 'خنثی', detail: 'همبستگی ۳۰ روزه با DXY برابر ' + faDigits(rr) + ' است — رابطه ضعیف یا مبهم است.' };
    return { score: 0, label: 'واگرایی', detail: 'همبستگی ۳۰ روزه با DXY برابر ' + faDigits(rr) + ' است — رابطه معکوس معمول شکسته شده است.' };
  }
  return Math.abs(r) >= 0.6
    ? { score: 20, label: 'همبستگی مشخص', detail: 'همبستگی ۳۰ روزه با DXY برابر ' + faDigits(rr) + ' است.' }
    : { score: 10, label: 'همبستگی ضعیف', detail: 'همبستگی ۳۰ روزه با DXY برابر ' + faDigits(rr) + ' است.' };
}
function trAtrFactor(v, band) {
  if (v === null) return { score: 5, label: 'داده ناکافی', detail: 'ATR محاسبه نشد.' };
  var t = faDigits(Math.round(v * 100) / 100) + '٪';
  if (v < band[0] * 0.5) return { score: 5, label: 'بازار رنج', detail: 'ATR روزانه ' + t + ' است — نوسان بسیار کم و بازار راکد.' };
  if (v > band[1] * 1.5) return { score: 0, label: 'نوسان افراطی', detail: 'ATR روزانه ' + t + ' است — نوسان به‌شدت بالاتر از حالت معمول.' };
  if (v < band[0]) return { score: 5, label: 'نوسان کم', detail: 'ATR روزانه ' + t + ' است — پایین‌تر از نوار سالم.' };
  if (v > band[1]) return { score: 5, label: 'نوسان بالا', detail: 'ATR روزانه ' + t + ' است — بالاتر از نوار سالم ولی افراطی نیست.' };
  return { score: 10, label: 'نوسان سالم', detail: 'ATR روزانه ' + t + ' است — داخل نوار سالم.' };
}
function trVerdictLabel(v) { return v === 'strong' ? 'شرایط قوی' : v === 'moderate' ? 'شرایط متوسط' : 'بدون معامله'; }
function trRegime(c, atr, band) {
  var er = trER(c, 20);
  var pct = function (v) { return faDigits(Math.round(v * 100) / 100) + '٪'; };
  if (atr === null || er === null) return { type: 'unknown', label: 'قابل‌تشخیص نیست', reason: 'داده کافی برای دسته‌بندی رژیم بازار موجود نیست.' };
  if (atr > band[1] * 1.5) return { type: 'volatile', label: 'پرنوسان', reason: 'ATR روزانه ' + pct(atr) + ' است — دامنه نوسان به‌شدت بزرگ‌تر از معمول؛ کنترل ریسک اولویت دارد.' };
  if (atr < band[0] * 0.5) return { type: 'illiquid', label: 'کم‌نوسان/کم‌نقدشونده', reason: 'ATR روزانه ' + pct(atr) + ' است — حرکت‌ها کوچک و بازار بی‌رمق است.' };
  if (er >= 0.35) return { type: 'trending', label: 'رونددار', reason: 'نسبت کارایی ' + faDigits(Math.round(er * 100)) + '٪ است — قیمت با مسیر نسبتاً یکنواخت حرکت می‌کند.' };
  if (er <= 0.15) return { type: 'range', label: 'رنج', reason: 'نسبت کارایی ' + faDigits(Math.round(er * 100)) + '٪ است — قیمت رفت‌وبرگشتی است و سطوح افقی غالب‌اند.' };
  return { type: 'range', label: 'رنج با گرایش', reason: 'نسبت کارایی ' + faDigits(Math.round(er * 100)) + '٪ است — بین رفت‌وبرگشت و روند؛ جهت‌گیری مشخص نیست.' };
}
function trDivergence(sc, dc, corr) {
  if (sc === null || dc === null) return { level: 'unknown', color: 'gray', text: 'داده لحظه‌ای کامل نیست', reason: 'قیمت امروز نماد یا DXY در دسترس نیست.' };
  var s = sc > 0.05 ? 1 : sc < -0.05 ? -1 : 0;
  var d = dc > 0.05 ? 1 : dc < -0.05 ? -1 : 0;
  var ct = corr === null ? '—' : faDigits(Math.round(corr * 100) / 100);
  var broken = corr !== null && corr > 0.6;
  if (s !== 0 && d !== 0 && s === d)
    return { level: broken ? 'broken' : 'weak', color: broken ? 'red' : 'amber', text: broken ? 'هشدار: همبستگی شکسته شده!' : 'همبستگی ضعیف: احتیاط کنید', reason: 'نماد و DXY هم‌جهت حرکت کرده‌اند (همبستگی ۳۰ روزه: ' + ct + ') — خلاف رابطه معمول؛ احتمال حرکت فریبنده بالاتر می‌رود.' };
  if (s !== 0 && d !== 0)
    return { level: 'normal', color: 'green', text: 'همبستگی نرمال: نماد ' + (sc > 0 ? '↑' : '↓') + ' و DXY ' + (dc > 0 ? '↑' : '↓'), reason: 'رابطه معمول برقرار است (همبستگی ۳۰ روزه: ' + ct + ') — حرکت‌ها با الگوی تاریخی هم‌خوان‌اند.' };
  return { level: 'weak', color: 'amber', text: 'همبستگی ضعیف: احتیاط کنید', reason: 'یکی از دو طرف حرکت معنادار ندارد (همبستگی ۳۰ روزه: ' + ct + ') — تأییدی از DXY دریافت نمی‌شود.' };
}
function trPlan(inp) {
  var w = [];
  if (!(inp.entry > 0)) return { ok: false, error: 'قیمت ورود معتبر نیست.' };
  if (!(inp.balance > 0)) return { ok: false, error: 'موجودی حساب معتبر نیست.' };
  if (!(inp.riskPct > 0 && inp.riskPct <= 10)) return { ok: false, error: 'درصد ریسک باید بین صفر و ۱۰ باشد.' };
  var slDist = null;
  if (inp.slMode === 'swing') {
    if (inp.swingLevel === null || !(inp.swingLevel > 0)) w.push('سطح سوئینگ در دسترس نیست — حد ضرر بر اساس ATR پیشنهاد شد.');
    else slDist = Math.abs(inp.entry - inp.swingLevel);
  }
  if (slDist === null) {
    if (inp.atr === null || !(inp.atr > 0)) return { ok: false, error: 'ATR در دسترس نیست — حد ضرر قابل محاسبه نیست.' };
    slDist = inp.atr * 1.5;
  }
  var riskAmount = inp.balance * inp.riskPct / 100;
  var lots = Math.max(0.01, Math.floor((riskAmount / (slDist * inp.contractSize)) * 100) / 100);
  var lossAtSL = lots * slDist * inp.contractSize;
  var tpDist = slDist * inp.rr;
  var sl = inp.side === 'buy' ? inp.entry - slDist : inp.entry + slDist;
  var tp = inp.side === 'buy' ? inp.entry + tpDist : inp.entry - tpDist;
  w.push('اندازه قرارداد و ارزش پیپ به کارگزاری بستگی دارد — پیش از استفاده تأیید کنید.');
  w.push('این محاسبه تضمین نتیجه یا توصیه معامله نیست.');
  return {
    ok: true,
    sl: Math.round(sl * 100) / 100,
    tp: Math.round(tp * 100) / 100,
    riskAmount: Math.round(riskAmount * 100) / 100,
    lots: lots,
    lossAtSL: Math.round(lossAtSL * 100) / 100,
    profitAtTP: Math.round(lossAtSL * inp.rr * 100) / 100,
    copyText: (inp.side === 'buy' ? 'Buy ' : 'Sell ') + inp.symbolLabel + ' @ ' + inp.entry + ' | SL: ' + (Math.round(sl * 100) / 100) + ' | TP: ' + (Math.round(tp * 100) / 100) + ' | Lot: ' + lots + ' (Risk ' + inp.riskPct + '%)',
    warnings: w
  };
}
/* ---------- مربی رفتاری ---------- */
function trRefreshNudge(ts) {
  var now = Date.now(), recent = [], i;
  for (i = 0; i < ts.length; i++) if (now - ts[i] < 5 * 60 * 1000) recent.push(ts[i]);
  if (recent.length > 10) return { warn: true, message: 'بازار پرنوسان است، صبر کنید — بروزرسانی پیاپی تصمیم را بهتر نمی‌کند.' };
  return { warn: false, message: '' };
}
function trLock(lastLossISO) {
  if (!lastLossISO) return { locked: false, minutesLeft: 0 };
  var t = new Date(lastLossISO).getTime();
  if (!isFinite(t)) return { locked: false, minutesLeft: 0 };
  var left = Math.ceil((t + 15 * 60 * 1000 - Date.now()) / 60000);
  return left > 0 ? { locked: true, minutesLeft: left } : { locked: false, minutesLeft: 0 };
}
function trRest(lossesToday) {
  if (lossesToday >= 3) return { suggest: true, message: 'امروز ۳ معامله ضررده ثبت شده است — پیشنهاد می‌کنیم تا فردا استراحت کنید و بازار را فقط تماشا کنید.' };
  return { suggest: false, message: '' };
}
function trDQ(r, res) {
  if (r.followedPlan && r.riskRespected && res === 'win') return { grade: 'good', label: 'تصمیم خوب + نتیجه مثبت', note: 'فرآیند و نتیجه هر دو درست بودند — الگوی قابل تکرار.' };
  if (r.followedPlan && r.riskRespected && res === 'loss') return { grade: 'neutral', label: 'تصمیم سالم + نتیجه منفی', note: 'ضرر بخش طبیعی معامله است؛ نتیجه یک معامله اثبات بدبودن روش نیست.' };
  if ((!r.followedPlan || !r.riskRespected) && res === 'win') return { grade: 'lucky', label: 'نتیجه مثبت با فرآیند ناسالم', note: 'این سود قابل اتکا نیست — قانون‌شکنی جایزه نمی‌گیرد.' };
  if (!r.followedPlan || !r.riskRespected) return { grade: 'bad-execution', label: 'اجرای ناسالم', note: r.slMovedBadly ? 'جابه‌جایی نامناسب حد ضرر — اول اجرای برنامه را درست کنید.' : 'خارج از برنامه معامله شده است.' };
  if (r.assumptionViolated) return { grade: 'neutral', label: 'فرض اولیه نقض شد', note: 'بررسی کنید آیا شرط ابطال به‌موقع فعال شد.' };
  return { grade: 'neutral', label: 'نیازمند بررسی', note: 'ترکیب نتیجه و اجرا نیاز به بررسی بیشتری دارد.' };
}
function trPreMortem(o) {
  var out = [];
  if (o.side) {
    var wanted = o.side === 'buy' ? 'bullish' : 'bearish';
    if (o.structure4h && o.structure4h !== wanted && o.structure4h !== 'neutral')
      out.push('ساختار ۴ ساعته ' + (o.structure4h === 'bullish' ? 'صعودی' : 'نزولی') + ' است و با جهت معامله شما (' + (o.side === 'buy' ? 'خرید' : 'فروش') + ') مخالف — معامله خلاف جهت روند میان‌مدت است.');
    if (o.tfScore === 0) out.push('تایم‌فریم‌ها در تضادند — محتمل‌ترین دلیل شکست: ناهماهنگی ساختار کوتاه‌مدت و میان‌مدت.');
  }
  if (o.newsMin !== null && o.newsMin < 240) out.push('خبر مهم کمتر از ۴ ساعت دیگر منتشر می‌شود — اسپرد و لغزش ممکن است چند برابر شود و حد ضرر با گپ اجرا شود.');
  if (o.div === 'broken' || o.div === 'weak') out.push('رابطه معمول با DXY به‌هم ریخته یا ضعیف است — حرکت ممکن است فریبنده (Fake Breakout) باشد.');
  if (o.regime === 'range' && o.side) out.push('بازار در رژیم رنج است — شکست‌ها در رنج اغلب برمی‌گردند و استاپ‌خوردن متوالی شایع است.');
  if (o.regime === 'volatile') out.push('نوسان افراطی است — حد ضرر کوتاه با نوسان معمول بازار حذف می‌شود.');
  if (o.rsi !== null && o.side === 'buy' && o.rsi >= 70) out.push('RSI روی ' + faDigits(Math.round(o.rsi)) + ' است (اشباع خرید) — ورود خرید در سقف محلی ریسک بالایی دارد.');
  if (o.rsi !== null && o.side === 'sell' && o.rsi <= 30) out.push('RSI روی ' + faDigits(Math.round(o.rsi)) + ' است (اشباع فروش) — ورود فروش در کف محلی ریسک بالایی دارد.');
  if (!out.length) out.push('در داده‌های فعلی عامل مخالف برجسته‌ای یافت نشد — شواهد موافق، تضمین موفقیت نیستند.');
  return out;
}

/* ---------- پیکربندی نمادها ---------- */
var BT_SYMS = {
  xau: {
    yahoo: 'GC=F', name: 'طلا — XAUUSD', band: [0.7, 1.6], contract: 100, inv: true, label: 'XAUUSD',
    specs: [
      ['بازار', 'فارکس/فلزات گران‌بها (اسپات یا CFD)', 0],
      ['نوع دارایی', 'جفت‌ارز فلز — XAU/USD', 0],
      ['ساعات معامله', 'حدود ۲۳ ساعت در روز، ۵ روز در هفته (بسته به کارگزاری)', 1],
      ['اندازه قرارداد', '۱ لات استاندارد = ۱۰۰ اونس (معمول)', 1],
      ['ارزش هر پیپ (۰.۱ دلار حرکت)', '۱ دلار به ازای هر ۰.۱ لات', 1],
      ['حداقل حجم', 'معمولاً ۰.۰۱ لات', 1],
      ['اسپرد معمول', '۱.۵ تا ۳.۵ سنت (وابسته به کارگزاری)', 1]
    ]
  },
  dji: {
    yahoo: '^DJI', name: 'داوجونز — DJI', band: [0.5, 1.3], contract: 1, inv: false, label: 'DJI',
    specs: [
      ['بازار', 'شاخص سهام آمریکا (CFD یا فیوچرز YM)', 0],
      ['نوع دارایی', 'شاخص — داوجونز صنعتی', 0],
      ['ساعات معامله', 'CFD حدود ۲۳ ساعته | فیوچرز با وقفه', 1],
      ['ارزش هر امتیاز', 'معمول: ۱ دلار به ازای هر امتیاز به ازای هر ۱ لات', 1],
      ['حداقل حجم', 'معمولاً ۰.۱ لات', 1]
    ]
  }
};
var BT_TF_FA = { '15m': '۱۵ دقیقه', '1h': '۱ ساعته', '4h': '۴ ساعته', '1d': 'روزانه' };
var BT_TREND_FA = { bullish: 'صعودی', bearish: 'نزولی', neutral: 'خنثی' };
var BT_TABS = [['view', 'نمای بازار'], ['plan', 'پلن و ریسک'], ['news', 'اخبار و سناریو'], ['journal', 'ژورنال']];

/* ---------- وضعیت اپ ---------- */
var BT = { tab: 'view', sym: 'xau', data: null, busy: false, err: null, changes: [], nudge: '', pmSide: null, checks: {}, plan: null, copied: false };
var BT_CACHE = { at: 0, data: null };

/* ---------- دریافت سری روزانه از Yahoo (پروکسی عمومی) ---------- */
function btFetchSeries(sym, range) {
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=' + range + '&includePrePost=false';
  var i = 0;
  function attempt() {
    if (i >= PROXIES.length) return Promise.reject(new Error('proxy-fail'));
    var p = PROXIES[i++];
    return fetchJSON(p(u), 11000).then(function (j) {
      var r = j && j.chart && j.chart.result && j.chart.result[0];
      var q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
      if (!r || !q || !q.close || !r.timestamp) throw new Error('bad');
      var out = { t: [], h: [], l: [], c: [] }, k;
      for (k = 0; k < q.close.length; k++) {
        if (q.close[k] == null || q.high[k] == null || q.low[k] == null) continue;
        out.t.push(r.timestamp[k]); out.h.push(q.high[k]); out.l.push(q.low[k]); out.c.push(q.close[k]);
      }
      if (out.c.length < 30) throw new Error('thin');
      return out;
    }).catch(function () { return attempt(); });
  }
  return attempt();
}
function btRsi(c) {
  var n = c.length, i;
  if (n < 15) return null;
  var g = 0, l = 0, d;
  for (i = 1; i <= 14; i++) { d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  var ag = g / 14, al = l / 14;
  for (i = 15; i < n; i++) {
    d = c[i] - c[i - 1];
    ag = (ag * 13 + (d > 0 ? d : 0)) / 14;
    al = (al * 13 + (d < 0 ? -d : 0)) / 14;
  }
  return al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
}

/* ---------- محاسبه وضعیت ---------- */
function btRowOf(symKey, tf) {
  var sym = ms[symKey];
  if (!sym || !sym.rows) return null;
  for (var i = 0; i < sym.rows.length; i++) if (sym.rows[i].tf === tf) return sym.rows[i];
  return null;
}
function btCompute(symKey, series, dxy, tnx) {
  var conf = BT_SYMS[symKey];
  var c = series.c, h = series.h, l = series.l, n = c.length;
  var symRow = ms[symKey];
  var price = c[n - 1];
  var prevClose = n > 1 ? c[n - 2] : null;
  var changePct = prevClose ? (price - prevClose) / prevClose * 100 : (symRow && symRow.changePct != null ? symRow.changePct : null);

  /* DXY */
  var dc = dxy.c, dChg = dc.length > 1 ? (dc[dc.length - 1] - dc[dc.length - 2]) / dc[dc.length - 2] * 100 : null;
  var tChg = tnx.c.length > 1 ? (tnx.c[tnx.c.length - 1] - tnx.c[tnx.c.length - 2]) / tnx.c[tnx.c.length - 2] * 100 : null;

  /* همبستگی ۳۰ بازده با تراز تاریخ */
  var byDate = {}, i;
  for (i = 0; i < dxy.t.length; i++) byDate[new Date(dxy.t[i] * 1000).toISOString().slice(0, 10)] = dc[i];
  var a = [], b = [];
  for (i = 1; i < series.t.length; i++) {
    var d0 = new Date(series.t[i - 1] * 1000).toISOString().slice(0, 10);
    var d1 = new Date(series.t[i] * 1000).toISOString().slice(0, 10);
    if (byDate[d0] === undefined || byDate[d1] === undefined) continue;
    a.push((c[i] - c[i - 1]) / c[i - 1]);
    b.push((byDate[d1] - byDate[d0]) / byDate[d0]);
  }
  var corr = trPearson(a, b);

  /* ساختار از اسنپ‌شات فایل */
  var dirs = [], tfs = ['15m', '1h', '4h'];
  for (i = 0; i < tfs.length; i++) { var r = btRowOf(symKey, tfs[i]); dirs.push(r && r.trend ? r.trend : 'neutral'); }
  var tfF = trTfFactor(dirs);
  var structure4h = (btRowOf(symKey, '4h') || {}).trend || null;

  /* اندیکاتورها و رژیم */
  var atr = trAtrPct(h, l, c);
  var regime = trRegime(c.slice(-60), atr, conf.band);
  var rsi = btRsi(c);
  var hh = -Infinity, ll = Infinity;
  for (i = Math.max(0, n - 20); i < n; i++) { if (h[i] > hh) hh = h[i]; if (l[i] < ll) ll = l[i]; }

  /* خبر و خلأ خبری */
  var now = Date.now(), nextHigh = null;
  var evs = news.events || [];
  for (i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (!e.dateISO || e.impact !== 'High') continue;
    var t = new Date(e.dateISO).getTime();
    if (t <= now) continue;
    if (!nextHigh || t < new Date(nextHigh.dateISO).getTime()) nextHigh = e;
  }
  var mins = nextHigh ? (new Date(nextHigh.dateISO).getTime() - now) / 60000 : null;
  var newsF = trNewsGap(mins);
  var dxyF = trDxyFactor(corr, conf.inv);
  var atrF = trAtrFactor(atr, conf.band);
  var total = tfF.score + newsF.score + dxyF.score + atrF.score;

  var div = trDivergence(changePct, dChg, corr);

  /* سناریوها */
  var scenarios = [], conflict = null;
  if (nextHigh) {
    var dirFa = { bullish: 'افزایشی', bearish: 'کاهشی', neutral: 'خنثی', mixed: 'دووجهی' };
    var limits = 'واکنش بازار به اندازه اختلاف عدد واقعی با پیش‌بینی و شرایط لحظه انتشار هم بستگی دارد؛ این سناریوها پیش‌بینی قطعی نیستند.';
    var xA = nextHigh.xauAbove, xB = nextHigh.xauBelow;
    if (xA === null && xB === null) {
      scenarios.push({ id: 'unknown', title: 'داده جهت‌دار موجود نیست', trigger: 'برای این خبر تحلیل جهت‌دار ذخیره نشده است.', xauDir: null, djiDir: null, confirm: '—', invalidate: '—', limits: 'تحلیل فقط مشروط و کیفی نگه داشته می‌شود؛ داده ناقص را با حدس پر نمی‌کنیم.' });
    } else {
      var aD = xA || 'neutral', bD = xB || 'neutral';
      scenarios.push({ id: 'better', title: 'سناریوی اول — داده بهتر از انتظار', trigger: 'اگر عدد واقعی بالاتر از پیش‌بینی (' + (nextHigh.forecast || '—') + ') منتشر شود (قبلی: ' + (nextHigh.previous || '—') + ')', xauDir: dirFa[aD], djiDir: nextHigh.djiAbove ? dirFa[nextHigh.djiAbove] : null, confirm: 'تأیید رفتاری: پایداری قیمت بالای مقاومت ' + faDigits(Math.round(hh * 100) / 100) + ' و تداوم کندل‌های صعودی در ۱۵ دقیقه.', invalidate: 'ابطال: بازگشت زیر کف ' + faDigits(Math.round(ll * 100) / 100) + '.', limits: limits });
      scenarios.push({ id: 'worse', title: 'سناریوی دوم — داده بدتر از انتظار', trigger: 'اگر عدد واقعی پایین‌تر از پیش‌بینی (' + (nextHigh.forecast || '—') + ') منتشر شود (قبلی: ' + (nextHigh.previous || '—') + ')', xauDir: dirFa[bD], djiDir: nextHigh.djiBelow ? dirFa[nextHigh.djiBelow] : null, confirm: 'تأیید رفتاری: شکست کف ' + faDigits(Math.round(ll * 100) / 100) + ' و تداوم کندل‌های نزولی در ۱۵ دقیقه.', invalidate: 'ابطال: تثبیت مجدد بالای مقاومت ' + faDigits(Math.round(hh * 100) / 100) + '.', limits: limits });
      if (structure4h === 'bullish' && aD === 'bearish') conflict = 'ساختار ۴ ساعته فعلی صعودی است اما سناریوی «بهتر از انتظار» برای طلا کاهشی است — تضاد ریسکی؛ ورود پیش از خبر ریسک بالا دارد.';
      else if (structure4h === 'bearish' && bD === 'bullish') conflict = 'ساختار ۴ ساعته فعلی نزولی است اما سناریوی «بدتر از انتظار» برای طلا افزایشی است — تضاد ریسکی؛ ورود پیش از خبر ریسک بالا دارد.';
    }
  }

  /* واکنش تاریخی — فقط از رویدادهای گذشته با عدد واقعی داخل فید */
  var history = { available: false, reason: 'نمونه تاریخی کافی نیست — تحلیل صرفاً کیفی و مشروط نگه داشته می‌شود.', n: 0 };
  if (nextHigh) {
    var pastMoves = [];
    for (i = 0; i < evs.length; i++) {
      var pe = evs[i];
      if (!pe.dateISO || pe.title !== nextHigh.title || !pe.actual) continue;
      var pt = new Date(pe.dateISO).getTime();
      if (pt >= now || now - pt > 30 * 86400000) continue;
      var key = new Date(pe.dateISO).toISOString().slice(0, 10);
      var dates = [], m;
      for (m = 0; m < series.t.length; m++) dates.push(new Date(series.t[m] * 1000).toISOString().slice(0, 10));
      var idx = dates.indexOf(key);
      if (idx >= 1 && idx + 1 < n) pastMoves.push((c[idx + 1] - c[idx - 1]) / c[idx - 1] * 100);
    }
    if (pastMoves.length >= 3) {
      var avg = pastMoves.reduce(function (s, v) { return s + v; }, 0) / pastMoves.length;
      var up = pastMoves.filter(function (v) { return v > 0; }).length;
      history = { available: true, n: pastMoves.length, avg: Math.round(avg * 100) / 100, up: Math.round(up / pastMoves.length * 100) };
    } else history.n = pastMoves.length;
  }

  var preM = trPreMortem({ side: null, structure4h: structure4h, tfScore: tfF.score, newsMin: mins, div: div.level, regime: regime.type, rsi: rsi });

  return {
    conf: conf, price: price, changePct: changePct, dxyPrice: dc[dc.length - 1], dxyChangePct: dChg,
    tnxPrice: tnx.c[tnx.c.length - 1], tnxChangePct: tChg, corr: corr,
    dirs: dirs, structure4h: structure4h, tfF: tfF, summary: tfF.score >= 40 ? 'هم‌جهت' : tfF.score > 0 ? 'مختلط' : 'متضاد',
    atr: atr, regime: regime, rsi: rsi, hh: hh, ll: ll,
    nextHigh: nextHigh, mins: mins,
    total: total, verdict: total >= 75 ? 'strong' : total >= 50 ? 'moderate' : 'no-trade',
    factors: { tf: tfF, news: newsF, dxy: dxyF, atr: atrF },
    div: div, scenarios: scenarios, conflict: conflict, history: history, preMortem: preM
  };
}
/* محاسبه کاهش‌یافته — وقتی سری زنده Yahoo در دسترس نیست: فقط اسنپ‌شات فایل با برچسب صادقانه */
function btComputeDegraded(symKey) {
  var conf = BT_SYMS[symKey];
  var symRow = ms[symKey];
  var dirs = [], tfs = ['15m', '1h', '4h'], i;
  for (i = 0; i < tfs.length; i++) { var r = btRowOf(symKey, tfs[i]); dirs.push(r && r.trend ? r.trend : 'neutral'); }
  var tfF = trTfFactor(dirs);
  var structure4h = (btRowOf(symKey, '4h') || {}).trend || null;
  var now = Date.now(), nextHigh = null;
  var evs = news.events || [];
  for (i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (!e.dateISO || e.impact !== 'High') continue;
    var t = new Date(e.dateISO).getTime();
    if (t <= now) continue;
    if (!nextHigh || t < new Date(nextHigh.dateISO).getTime()) nextHigh = e;
  }
  var mins = nextHigh ? (new Date(nextHigh.dateISO).getTime() - now) / 60000 : null;
  var newsF = trNewsGap(mins);
  var noData = { score: 0, label: 'داده ناکافی', detail: 'داده کافی برای این عامل موجود نیست — سری زنده Yahoo دریافت نشد.' };
  var atrNo = { score: 5, label: 'داده ناکافی', detail: 'ATR محاسبه نشد — سری زنده در دسترس نبود.' };
  var total = tfF.score + newsF.score;
  var scenarios = [], conflict = null;
  if (nextHigh) {
    var dirFa = { bullish: 'افزایشی', bearish: 'کاهشی', neutral: 'خنثی', mixed: 'دووجهی' };
    var limits = 'واکنش بازار به شرایط لحظه انتشار هم بستگی دارد؛ این سناریوها پیش‌بینی قطعی نیستند.';
    var xA = nextHigh.xauAbove, xB = nextHigh.xauBelow;
    if (xA !== null || xB !== null) {
      scenarios.push({ id: 'better', title: 'سناریوی اول — داده بهتر از انتظار', trigger: 'اگر عدد واقعی بالاتر از پیش‌بینی (' + (nextHigh.forecast || '—') + ') منتشر شود', xauDir: dirFa[xA || 'neutral'], djiDir: nextHigh.djiAbove ? dirFa[nextHigh.djiAbove] : null, confirm: 'تأیید رفتاری: پایداری بالای مقاومت نزدیک (سطح زنده در دسترس نیست).', invalidate: 'ابطال: شکست کف نزدیک.', limits: limits });
      scenarios.push({ id: 'worse', title: 'سناریوی دوم — داده بدتر از انتظار', trigger: 'اگر عدد واقعی پایین‌تر از پیش‌بینی (' + (nextHigh.forecast || '—') + ') منتشر شود', xauDir: dirFa[xB || 'neutral'], djiDir: nextHigh.djiBelow ? dirFa[nextHigh.djiBelow] : null, confirm: 'تأیید رفتاری: شکست کف نزدیک.', invalidate: 'ابطال: تثبیت مجدد بالای مقاومت.', limits: limits });
      if (structure4h === 'bullish' && (xA || 'neutral') === 'bearish') conflict = 'ساختار ۴ ساعته فعلی صعودی است اما سناریوی «بهتر از انتظار» برای طلا کاهشی است — تضاد ریسکی.';
      else if (structure4h === 'bearish' && (xB || 'neutral') === 'bullish') conflict = 'ساختار ۴ ساعته فعلی نزولی است اما سناریوی «بدتر از انتظار» برای طلا افزایشی است — تضاد ریسکی.';
    }
  }
  return {
    degraded: true,
    conf: conf,
    price: symRow ? symRow.price : null,
    changePct: symRow ? symRow.changePct : null,
    dxyPrice: null, dxyChangePct: null, tnxPrice: null, tnxChangePct: null, corr: null,
    dirs: dirs, structure4h: structure4h, tfF: tfF, summary: tfF.score >= 40 ? 'هم‌جهت' : tfF.score > 0 ? 'مختلط' : 'متضاد',
    atr: null,
    regime: { type: 'unknown', label: 'قابل‌تشخیص نیست', reason: 'داده کافی برای دسته‌بندی رژیم بازار موجود نیست — سری زنده دریافت نشد.' },
    rsi: null, hh: null, ll: null,
    nextHigh: nextHigh, mins: mins,
    total: total, verdict: total >= 75 ? 'strong' : total >= 50 ? 'moderate' : 'no-trade',
    factors: { tf: tfF, news: newsF, dxy: noData, atr: atrNo },
    div: { level: 'unknown', color: 'gray', text: 'داده لحظه‌ای کامل نیست', reason: 'دریافت سری زنده Yahoo ناموفق بود — وضعیت واگرایی با اسنپ‌شات ارزیابی نمی‌شود.' },
    scenarios: scenarios, conflict: conflict,
    history: { available: false, reason: 'داده قیمت تاریخی نماد در دسترس نیست — سری زنده دریافت نشد.', n: 0 },
    preMortem: trPreMortem({ side: null, structure4h: structure4h, tfScore: tfF.score, newsMin: mins, div: 'unknown', regime: 'unknown', rsi: null })
  };
}
function btLoadData(force) {
  var now = Date.now();
  if (!force && BT_CACHE.data && now - BT_CACHE.at < 10 * 60 * 1000) {
    BT.data = BT_CACHE.data;
    renderTraderApp(true);
    return;
  }
  if (BT.busy) return;
  BT.busy = true; BT.err = null;
  renderTraderApp(true);
  var conf = BT_SYMS[BT.sym];
  Promise.all([
    btFetchSeries(conf.yahoo, '1y'),
    btFetchSeries('DX-Y.NYB', '3mo').catch(function () { return null; }),
    btFetchSeries('^TNX', '1mo').catch(function () { return null; })
  ]).then(function (rs) {
    var series = rs[0], dxy = rs[1], tnx = rs[2];
    if (!dxy) dxy = { t: [series.t[series.t.length - 1]], c: [0], h: [0], l: [0] };
    if (!tnx) tnx = { t: [series.t[series.t.length - 1]], c: [0], h: [0], l: [0] };
    var data = btCompute(BT.sym, series, dxy, tnx);
    BT_CACHE = { at: Date.now(), data: data };
    BT.data = data;
    BT.busy = false;
    btVisitDiff();
    renderTraderApp(true);
  }).catch(function () {
    /* حالت کاهش‌یافته: ادامه با اسنپ‌شات فایل و برچسب صادقانه */
    BT.data = btComputeDegraded(BT.sym);
    BT.busy = false;
    btVisitDiff();
    renderTraderApp(true);
  });
}
function btVisitDiff() {
  try {
    var prev = btGet(BT_KEYS.visit, null);
    var d = BT.data;
    var trends = {}, tfs = ['15m', '1h', '4h', '1d'], i;
    for (i = 0; i < tfs.length; i++) { var r = btRowOf(BT.sym, tfs[i]); if (r && r.trend) trends[r.tf] = r.trend; }
    var cur = { atISO: new Date().toISOString(), trends: trends, score: d.total, divergence: d.div.level, highEventId: d.nextHigh ? d.nextHigh.id : null, price: d.price };
    if (prev) {
      var changes = [], tf;
      for (tf in cur.trends) {
        if (prev.trends && prev.trends[tf] && prev.trends[tf] !== cur.trends[tf])
          changes.push('جهت ساختار ' + (BT.sym === 'xau' ? 'طلا' : 'داوجونز') + ' در تایم‌فریم ' + BT_TF_FA[tf] + ' از «' + BT_TREND_FA[prev.trends[tf]] + '» به «' + BT_TREND_FA[cur.trends[tf]] + '» تغییر کرد.');
      }
      if (prev.score !== null && Math.abs(cur.score - prev.score) >= 10) changes.push('امتیاز اطمینان از ' + faDigits(prev.score) + ' به ' + faDigits(cur.score) + ' تغییر کرد.');
      if (prev.divergence && prev.divergence !== cur.divergence) changes.push(cur.divergence === 'normal' ? 'رابطه معمول با DXY دوباره برقرار شد.' : 'وضعیت همبستگی با DXY تغییر کرد — پنل واگرایی را ببینید.');
      if (prev.highEventId && cur.highEventId && prev.highEventId !== cur.highEventId) changes.push('خبر مهم جدیدی به تقویم اضافه شد.');
      if (prev.price && Math.abs((cur.price - prev.price) / prev.price * 100) >= 0.5)
        changes.push('قیمت نسبت به آخرین بازدید ' + (cur.price - prev.price > 0 ? '+' : '') + faDigits(Math.round((cur.price - prev.price) / prev.price * 10000) / 100) + '٪ تغییر کرده است.');
      BT.changes = changes;
    }
    btSet(BT_KEYS.visit, cur);
  } catch (e) {}
}
