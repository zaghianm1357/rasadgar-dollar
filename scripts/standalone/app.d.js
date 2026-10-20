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
  positions: 'bt_positions_v1',
  fqw: 'bt_fqw_v1'
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
var BT_TABS = [['view', 'نمای بازار'], ['ai', 'تحلیل هوشمند'], ['factors', 'عوامل'], ['news', 'اخبار']];

/* ---------- وضعیت اپ ---------- */
var BT = { tab: 'view', sym: 'xau', data: null, busy: false, err: null, changes: [], nudge: '', pmSide: null, checks: {}, plan: null, copied: false, fq: null, fqBusy: false, fqErr: null };
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

  /* هشدار رنج فشرده + نواحی ورود مبتنی بر ساختار */
  var rw = trRangeComp(h, l, c);
  var atrAbs = atr !== null ? (atr / 100) * price : null;
  var zones = trZones(structure4h, price, ll, hh, atrAbs, rw);

  return {
    conf: conf, price: price, changePct: changePct, dxyPrice: dc[dc.length - 1], dxyChangePct: dChg,
    tnxPrice: tnx.c[tnx.c.length - 1], tnxChangePct: tChg, corr: corr,
    dirs: dirs, structure4h: structure4h, tfF: tfF, summary: tfF.score >= 40 ? 'هم‌جهت' : tfF.score > 0 ? 'مختلط' : 'متضاد',
    atr: atr, regime: regime, rsi: rsi, hh: hh, ll: ll,
    nextHigh: nextHigh, mins: mins,
    total: total, verdict: total >= 75 ? 'strong' : total >= 50 ? 'moderate' : 'no-trade',
    factors: { tf: tfF, news: newsF, dxy: dxyF, atr: atrF },
    div: div, scenarios: scenarios, conflict: conflict, history: history, preMortem: preM,
    rangeWarning: rw, entryZones: zones
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
    preMortem: trPreMortem({ side: null, structure4h: structure4h, tfScore: tfF.score, newsMin: mins, div: 'unknown', regime: 'unknown', rsi: null }),
    rangeWarning: { active: false, severity: 'normal', message: '', advice: [], metrics: { atrPctile: null, er: null, boxPctOfAtr: null } },
    entryZones: { trend: structure4h, trendFa: structure4h === 'bullish' ? 'صعودی' : structure4h === 'bearish' ? 'نزولی' : 'نامشخص', zones: [], note: 'داده زنده در دسترس نیست — ناحیه ورود حدس زده نمی‌شود؛ با بروزرسانی موفق دوباره تلاش کنید.', rangeWarning: null }
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

/* ================= کمّی‌سازی اجباری اثر عوامل + رنج فشرده + نواحی ورود (نسخه مستقل) ================= */

function trOls(x, y, lag) {
  var n = Math.min(x.length, y.length), i;
  if (n < 25) return null;
  var sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; syy += y[i] * y[i]; }
  var mx = sx / n, my = sy / n;
  var vx = sxx / n - mx * mx, vy = syy / n - my * my;
  if (!(vx > 1e-12)) return null;
  var beta = (sxy / n - mx * my) / vx;
  var alpha = my - beta * mx;
  var u = new Array(n), ssr = 0;
  for (i = 0; i < n; i++) { u[i] = y[i] - (alpha + beta * x[i]); ssr += u[i] * u[i]; }
  var sxxC = 0;
  for (i = 0; i < n; i++) sxxC += (x[i] - mx) * (x[i] - mx);
  var long = 0;
  for (i = 0; i < n; i++) long += (x[i] - mx) * (x[i] - mx) * u[i] * u[i];
  var L = Math.min(lag || 0, n - 2), l, j;
  for (l = 1; l <= L; l++) for (j = l; j < n; j++) long += 2 * (x[j] - mx) * u[j] * (x[j - l] - mx) * u[j - l];
  var se = NaN;
  if (sxxC > 1e-12 && long >= 0) { var nwVar = long / (sxxC * sxxC); if (isFinite(nwVar) && nwVar > 0) se = Math.sqrt(nwVar); }
  if (!isFinite(se)) { var dof = n - 2; if (dof <= 0) return null; se = Math.sqrt((ssr / dof) / sxxC); }
  if (!isFinite(se) || se <= 0) return null;
  var t = beta / se, ci = 1.96 * se;
  return { beta: Math.round(beta * 1000) / 1000, se: Math.round(se * 10000) / 10000, t: Math.round(t * 100) / 100, ciLo: Math.round((beta - ci) * 1000) / 1000, ciHi: Math.round((beta + ci) * 1000) / 1000, n: n };
}
function trDayKey(t) { return new Date(t * 1000).toISOString().slice(0, 10); }
function trPairs(st, sc, ft, fc, h, mode) {
  var fm = {}, i;
  for (i = 0; i < ft.length; i++) fm[trDayKey(ft[i])] = fc[i];
  var x = [], y = [];
  for (i = 0; i + h < sc.length; i++) {
    var fa = fm[trDayKey(st[i])], fb = fm[trDayKey(st[i + h])];
    if (fa === undefined || fb === undefined || !(sc[i] > 0)) continue;
    var fx = mode === 'pct' ? (fb - fa) / fa * 100 : fb - fa;
    var fy = (sc[i + h] - sc[i]) / sc[i] * 100;
    if (!isFinite(fx) || !isFinite(fy)) continue;
    x.push(fx); y.push(fy);
  }
  return { x: x, y: y };
}
function trSplit(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 40) return null;
  var mid = Math.floor(n / 2);
  var b1 = trOls(x.slice(0, mid), y.slice(0, mid), 0), b2 = trOls(x.slice(mid), y.slice(mid), 0);
  if (!b1 || !b2) return null;
  return (b1.beta > 0) === (b2.beta > 0);
}
function trMeanStd(v) {
  var n = v.length, i;
  if (n < 30) return null;
  var s = 0;
  for (i = 0; i < n; i++) s += v[i];
  var m = s / n, ss = 0;
  for (i = 0; i < n; i++) ss += (v[i] - m) * (v[i] - m);
  var std = Math.sqrt(ss / n);
  if (!(std > 1e-12)) return null;
  return { mean: m, std: std };
}
function trZ(cur, hist) {
  var tail = hist.slice(-252), ms = trMeanStd(tail);
  if (!ms) return null;
  return Math.round((cur - ms.mean) / ms.std * 100) / 100;
}
function trPctile(cur, hist) {
  if (hist.length < 30) return null;
  var below = 0, i;
  for (i = 0; i < hist.length; i++) if (hist[i] <= cur) below++;
  return Math.round(below / hist.length * 100);
}
function trRel(n, t, signCons, split) {
  var dataScore = Math.min(n / 150, 1);
  var at = Math.abs(t);
  var sigScore = at >= 2 ? 1 : Math.max(0, (at - 0.5) / 1.5);
  var stability = 0.5 * signCons + 0.5 * (split === null ? 0.5 : split ? 1 : 0);
  var rel = (0.35 * dataScore + 0.35 * sigScore + 0.3 * stability) * 1;
  return Math.round(Math.max(0, Math.min(1, rel)) * 100) / 100;
}
function trComposite(items) {
  if (!items.length) return null;
  var sw = 0, num = 0, i;
  for (i = 0; i < items.length; i++) { sw += items[i].w; num += items[i].w * items[i].p; }
  if (!(sw > 0)) return null;
  return Math.round(100 * Math.tanh(num / sw) * 10) / 10;
}
var FQ_EFFECT_FA = { supportive: 'حمایتی', restrictive: 'بازدارنده', neutral: 'خنثی', conflict: 'متناقض', unknown: 'نامشخص' };
function trEffect(b1, b5, b20, z, chg5, std5) {
  if (!b5 || chg5 === null || chg5 === undefined) return 'unknown';
  var sig = [], i;
  var others = [b1, b20];
  for (i = 0; i < others.length; i++) if (others[i] && others[i].n >= 60 && Math.abs(others[i].t) >= 2) sig.push(others[i]);
  for (i = 0; i < sig.length; i++) if ((sig[i].beta > 0) !== (b5.beta > 0)) return 'conflict';
  var smallZ = z !== null && Math.abs(z) < 0.5;
  var smallMove = std5 !== null ? Math.abs(chg5) < 0.25 * std5 : Math.abs(chg5) < 1e-9;
  if (smallZ && smallMove) return 'neutral';
  var dir = (b5.beta > 0 ? 1 : -1) * (chg5 > 0 ? 1 : chg5 < 0 ? -1 : 0);
  if (dir === 0) return 'neutral';
  return dir > 0 ? 'supportive' : 'restrictive';
}

/* تعریف عوامل هر نماد — همان ساختار سرور */
var FQ_DEFS = {
  xau: [
    { id: 'DXY', nameFa: 'شاخص دلار (DXY)', yahoo: 'DX-Y.NYB', unit: 'pct', unitFa: '٪', w: 0.4, roleFa: 'ارزش دلار — رابطه معمول با طلا معکوس است' },
    { id: 'US10Y', nameFa: 'بازده ۱۰ساله خزانه (US10Y)', yahoo: '^TNX', unit: 'pp', unitFa: 'واحد درصد بازده', w: 0.35, roleFa: 'هزینه فرصت نگهداری طلا — جانشین نرخ واقعی (اسمی)' },
    { id: 'SPX', nameFa: 'شاخص S&P 500', yahoo: '^GSPC', unit: 'pct', unitFa: '٪', w: 0.25, roleFa: 'اشتها به ریسک — جریان ریسک‌گریزی سرمایه' }
  ],
  dji: [
    { id: 'US10Y', nameFa: 'بازده ۱۰ساله خزانه (US10Y)', yahoo: '^TNX', unit: 'pp', unitFa: 'واحد درصد بازده', w: 0.35, roleFa: 'نرخ بهره و ارزش‌گذاری سهام' },
    { id: 'VIX', nameFa: 'شاخص نوسان (VIX)', yahoo: '^VIX', unit: 'pts', unitFa: 'امتیاز', w: 0.35, roleFa: 'سطح ترس/ریسک‌گریزی بازار' },
    { id: 'DXY', nameFa: 'شاخص دلار (DXY)', yahoo: 'DX-Y.NYB', unit: 'pct', unitFa: '٪', w: 0.3, roleFa: 'ارزش دلار و اثر بر درآمد ارزی شرکت‌ها' }
  ]
};

/* محاسبه فاکتورها از سری‌های ۲ساله — خروجی هم‌ساختار با API سرور */
function btComputeFactors(symKey, symSer, facSers) {
  var defs = FQ_DEFS[symKey], rows = [], i, k;
  for (i = 0; i < defs.length; i++) {
    var def = defs[i], ser = facSers[i];
    if (!ser || ser.c.length < 100) {
      rows.push({ id: def.id, nameFa: def.nameFa, roleFa: def.roleFa, sourceYahoo: def.yahoo, unitFa: def.unitFa, current: null, currentZPctile: null, change5: null, z: null, beta: { h1: null, h5: null, h20: null }, reliable5: false, unreliableReason: 'سری ۲ساله این عامل از پروکسی دریافت نشد — داده ناکافی و عدد حدس زده نمی‌شود.', pressure: null, reliability: null, effect: 'unknown', effectFa: 'نامشخص', w: def.w, interpFa: null });
      continue;
    }
    var closes = ser.c;
    /* مقیاس TNX ×۱۰ */
    if (def.unit === 'pp') {
      var sorted = closes.slice().sort(function (a, b) { return a - b; });
      if (sorted[Math.floor(sorted.length / 2)] > 20) closes = closes.map(function (v) { return v / 10; });
    }
    var mode = def.unit === 'pct' ? 'pct' : 'delta';
    var p1 = trPairs(symSer.t, symSer.c, ser.t, closes, 1, mode);
    var p5 = trPairs(symSer.t, symSer.c, ser.t, closes, 5, mode);
    var p20 = trPairs(symSer.t, symSer.c, ser.t, closes, 20, mode);
    var b1 = trOls(p1.x, p1.y, 0), b5 = trOls(p5.x, p5.y, 4), b20 = trOls(p20.x, p20.y, 19);
    var split = trSplit(p5.x, p5.y);
    var cur = closes[closes.length - 1];
    var z = trZ(cur, closes), pctile = trPctile(cur, closes);
    var chg5 = p5.x.length ? Math.round(p5.x[p5.x.length - 1] * 100) / 100 : null;
    var ms5 = trMeanStd(p5.x);
    var reliable5 = b5 !== null && b5.n >= 60 && Math.abs(b5.t) >= 2;
    var reason = null;
    if (b5 === null) reason = 'نمونه کافی نیست — β برآورد نشد.';
    else if (b5.n < 60) reason = 'نمونه کافی نیست (' + b5.n + ' مشاهده — کمتر از ۶۰).';
    else if (Math.abs(b5.t) < 2) reason = 'از نظر آماری معنادار نیست (|t|=' + b5.t + ' < ۲) — عدد اثر قابل اتکا نیست.';
    var signCons = 1;
    if (b5) {
      var oth = [], oo = [b1, b20];
      for (k = 0; k < oo.length; k++) if (oo[k] && oo[k].n >= 60 && Math.abs(oo[k].t) >= 2) oth.push(oo[k]);
      if (oth.length) {
        var match = 0;
        for (k = 0; k < oth.length; k++) if ((oth[k].beta > 0) === (b5.beta > 0)) match++;
        var ratio = match / oth.length;
        signCons = ratio === 1 ? 1 : ratio === 0 ? 0.3 : 0.6;
      }
    }
    var rel = reliable5 && b5 ? trRel(b5.n, b5.t, signCons, split) : null;
    var press = reliable5 && b5 && z !== null && rel !== null ? Math.round((b5.beta > 0 ? 1 : -1) * z * rel * 1000) / 1000 : null;
    var effect = trEffect(b1, b5, b20, z, chg5, ms5 ? ms5.std : null);
    var interp = null;
    if (b5 && reliable5) {
      var unitTxt = def.unit === 'pct' ? '۱٪ تغییر' : def.unit === 'pp' ? '۱ واحد درصد تغییر' : '۱ امتیاز تغییر';
      interp = 'در نمونه ' + b5.n + ' روزه، ' + unitTxt + ' در ' + def.nameFa + ' به‌طور متوسط با ' + (b5.beta >= 0 ? '+' : '') + b5.beta + '٪ تغییر در نماد طی افق ۵روزه همراه بوده است (فاصله اطمینان ۹۵٪: ' + b5.ciLo + ' تا ' + b5.ciHi + ').';
    }
    rows.push({ id: def.id, nameFa: def.nameFa, roleFa: def.roleFa, sourceYahoo: def.yahoo, unitFa: def.unitFa, current: Math.round(cur * 100) / 100, currentZPctile: pctile, change5: chg5, z: z, beta: { h1: b1, h5: b5, h20: b20 }, reliable5: reliable5, unreliableReason: reason, pressure: press, reliability: rel, effect: effect, effectFa: FQ_EFFECT_FA[effect], w: def.w, interpFa: interp });
  }
  var used = [], skipped = [], i2;
  for (i2 = 0; i2 < rows.length; i2++) {
    if (rows[i2].pressure !== null) used.push({ id: rows[i2].id, nameFa: rows[i2].nameFa, w: rows[i2].w, p: rows[i2].pressure });
    else skipped.push({ id: rows[i2].id, nameFa: rows[i2].nameFa, reason: rows[i2].unreliableReason || 'β قابل اتکا نیست' });
  }
  return { ok: true, rows: rows, used: used, skipped: skipped, score: trComposite(used), generatedAtISO: new Date().toISOString(),
    notes: [
      'β = تغییر درصدی نماد به‌ازای ۱ واحد تغییر عامل در همان افق — رابطه تاریخی/آماری است، نه اثر علّی.',
      'خطای استاندارد با تصحیح Newey-West (نمونه‌های افق ۵ و ۲۰ روزه هم‌پوشان‌اند)؛ فاصله اطمینان ۹۵٪ تقریبی است.',
      'Z = (مقدار جاری − میانگین ۲۵۲روزه) ÷ انحراف معیار همان دوره.',
      'Pressure بر اساس «سطح غیرعادی» عامل (Z) است ولی ستون «اثر فعلی» بر اساس «جهت حرکت اخیر» — این دو می‌توانند متفاوت باشند.',
      'اگر β معنادار نباشد، Pressure محاسبه نمی‌شود و عامل با وزن بازتنظیم‌شده از امتیاز کنار گذاشته می‌شود.',
      'غافلگیری استانداردشده خبری (Surprise Z) در نسخه مستقل در دسترس نیست — نیازمند تاریخچه پایگاه داده سرور است.',
      'شاخص فشار مدل، احتمال صعود یا بازده مورد انتظار نیست و حرکت قیمت را تضمین نمی‌کند.'
    ] };
}

/* ---------- رنج فشرده ---------- */
function trRangeComp(h, l, c) {
  var n = c.length, i;
  if (n < 60) return { active: false, severity: 'normal', message: '', advice: [], metrics: { atrPctile: null, er: null, boxPctOfAtr: null } };
  var trs = [];
  for (i = 1; i < n; i++) trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  var atrSeries = [], period = 14;
  for (i = period; i < trs.length; i++) { var s = 0, j; for (j = i - period + 1; j <= i; j++) s += trs[j]; atrSeries.push(s / period); }
  if (atrSeries.length < 60) return { active: false, severity: 'normal', message: '', advice: [], metrics: { atrPctile: null, er: trER(c), boxPctOfAtr: null } };
  var atrNow = atrSeries[atrSeries.length - 1], below = 0;
  for (i = 0; i < atrSeries.length; i++) if (atrSeries[i] <= atrNow) below++;
  var atrPctile = Math.round(below / atrSeries.length * 100);
  var er = trER(c);
  var hh = -Infinity, ll = Infinity;
  for (i = Math.max(0, n - 20); i < n; i++) { if (h[i] > hh) hh = h[i]; if (l[i] < ll) ll = l[i]; }
  var boxPctOfAtr = atrNow > 0 ? Math.round((hh - ll) / atrNow * 10) / 10 : null;
  var advice = [
    'تا شکست معتبر صبر کنید: بسته‌شدن کندل خارج از محدوده + پولبک موفق، نه یک کندل شانه‌ای.',
    'شکست‌های کاذب در رنج فشرده شایع‌اند — ورود زودهنگام روی شکست، بالاترین ریسک را دارد.',
    'حد ضرر خیلی نزدیک در این شرایط با کوچک‌ترین نوسان حذف می‌شود — فاصله استاپ را واقع‌بینانه بگیرید.',
    'معامله در میانه رنج نکنید — فقط واکنش به لبه‌ها با تأیید، یا پرهیز کامل تا روشن‌شدن جهت.'
  ];
  if (atrPctile <= 20 && (er === null || er <= 0.3)) {
    return { active: true, severity: 'tight', message: 'هشدار جدی: بازار در رنج فشرده قرار دارد — دامنه نوسان (ATR) در صدک ' + atrPctile + ' توزیع تاریخی خودش است و ارتفاع محدوده معاملاتی فقط ' + boxPctOfAtr + ' برابر ATR است. احتمال انفجار قیمتی ناگهانی یا اسپاسم‌های کاذب بالا می‌رود.', advice: advice, metrics: { atrPctile: atrPctile, er: er === null ? null : Math.round(er * 100) / 100, boxPctOfAtr: boxPctOfAtr } };
  }
  if (er !== null && er <= 0.15) {
    return { active: true, severity: 'normal', message: 'بازار در رنج است — نسبت کارایی ' + Math.round(er * 100) + '٪ و صدک ATR روی ' + atrPctile + ' است؛ سطوح افقی غالب‌اند و شکست‌ها اغلب برمی‌گردند.', advice: advice, metrics: { atrPctile: atrPctile, er: Math.round(er * 100) / 100, boxPctOfAtr: boxPctOfAtr } };
  }
  return { active: false, severity: 'normal', message: '', advice: [], metrics: { atrPctile: atrPctile, er: er === null ? null : Math.round(er * 100) / 100, boxPctOfAtr: boxPctOfAtr } };
}

/* ---------- نواحی ورود مبتنی بر ساختار ---------- */
function trZones(trend, price, sup, res, atrAbs, rw) {
  var trendFa = trend === 'bullish' ? 'صعودی' : trend === 'bearish' ? 'نزولی' : trend === 'neutral' ? 'خنثی' : 'نامشخص';
  var out = { trend: trend, trendFa: trendFa, zones: [], note: '', rangeWarning: rw && rw.active ? rw : null };
  var rp = function (v) { return Math.round(v * 100) / 100; };
  if (rw && rw.active && rw.severity === 'tight') {
    out.note = 'به دلیل رنج فشرده، ناحیه ورودی پیشنهاد نمی‌شود — ورود در این شرایط قمار است، نه تحلیل. منتظر شکست معتبر و تثبیت بمانید.';
    return out;
  }
  if (!price || !atrAbs || atrAbs <= 0) {
    out.note = 'داده کافی (قیمت یا ATR) برای پیشنهاد ناحیه ورود موجود نیست.';
    return out;
  }
  var pad = 0.25 * atrAbs, buf = 0.5 * atrAbs;
  var buyZone = function (lo, hi, basis) {
    var entry = (lo + hi) / 2, sl = lo - buf, risk = entry - sl;
    return { side: 'buy', zoneLo: rp(lo), zoneHi: rp(hi), sl: rp(sl), tp1: rp(entry + 2 * risk), tp2: rp(entry + 3 * risk), activeNow: price >= lo && price <= hi, basis: basis, invalidate: 'بسته‌شدن کندل زیر ' + rp(sl) + ' ساختار خرید را باطل می‌کند.' };
  };
  var sellZone = function (lo, hi, basis) {
    var entry = (lo + hi) / 2, sl = hi + buf, risk = sl - entry;
    return { side: 'sell', zoneLo: rp(lo), zoneHi: rp(hi), sl: rp(sl), tp1: rp(entry - 2 * risk), tp2: rp(entry - 3 * risk), activeNow: price >= lo && price <= hi, basis: basis, invalidate: 'بسته‌شدن کندل بالای ' + rp(sl) + ' ساختار فروش را باطل می‌کند.' };
  };
  if (trend === 'bullish' && sup && sup < price) {
    var hiB = Math.min(sup + pad, price);
    out.zones.push(buyZone(sup, Math.max(hiB, sup + 0.05 * atrAbs), 'پولبک به حمایت/کف سوئینگ در ساختار صعودی — خرید در محدوده سبک‌گیری، نه تعقیب قیمت'));
    out.note = 'ساختار صعودی است؛ ناحیه زیر «انتظار پولبک» است — اگر قیمت بدون اصلاح برود بالا، تعقیب نکنید.';
    return out;
  }
  if (trend === 'bearish' && res && res > price) {
    var loB = Math.max(res - pad, price);
    out.zones.push(sellZone(Math.min(loB, res - 0.05 * atrAbs), res, 'پولبک به مقاومت/سقف سوئینگ در ساختار نزولی — فروش در محدوده اصلاح، نه تعقیب سقوط'));
    out.note = 'ساختار نزولی است؛ ناحیه بالا «انتظار اصلاح» است — اگر قیمت بدون اصلاح سقوط کرد، فروش در کف نکنید.';
    return out;
  }
  if (rw && rw.active && rw.severity === 'normal' && sup && res && res > sup) {
    out.zones.push(buyZone(sup, sup + pad, 'لبه پایینی رنج پهن — فقط با تأیید کندل بازگشتی؛ هدف اول میانه رنج'));
    out.zones.push(sellZone(res - pad, res, 'لبه بالایی رنج پهن — فقط با تأیید کندل بازگشتی؛ هدف اول میانه رنج'));
    out.note = 'بازار رنج است؛ معامله فقط از لبه‌ها با تأیید، و هدف‌گیری میانه رنج — نه انتظار شکست.';
    return out;
  }
  out.note = 'ساختار فعلی جهت‌گیری روشن ندارد (خنثی/داده ناکافی) — ناحیه ورود قابل استخراج نیست و حدس زده نمی‌شود.';
  return out;
}

/* ---------- بارگذاری تنبل عوامل کمّی (۴ سری ۲ساله از پروکسی) ---------- */
var BT_FQ_CACHE = { at: 0, sym: null, data: null };
function btLoadFactors(force) {
  if (BT.fqBusy) return;
  if (!force && BT_FQ_CACHE.data && BT_FQ_CACHE.sym === BT.sym && Date.now() - BT_FQ_CACHE.at < 15 * 60 * 1000) {
    BT.fq = BT_FQ_CACHE.data;
    renderTraderApp(true);
    return;
  }
  BT.fqBusy = true; BT.fqErr = null;
  renderTraderApp(true);
  var symKey = BT.sym;
  var conf = BT_SYMS[symKey];
  var defs = FQ_DEFS[symKey];
  Promise.all([
    btFetchSeries(conf.yahoo, '2y'),
    btFetchSeries(defs[0].yahoo, '2y').catch(function () { return null; }),
    btFetchSeries(defs[1].yahoo, '2y').catch(function () { return null; }),
    btFetchSeries(defs[2].yahoo, '2y').catch(function () { return null; })
  ]).then(function (rs) {
    var symSer = rs[0];
    if (!symSer || symSer.c.length < 100) throw new Error('sym-thin');
    var facSers = [rs[1], rs[2], rs[3]];
    var data = btComputeFactors(symKey, symSer, facSers);
    data.sym = symKey;
    data.sampleBars = symSer.c.length;
    BT_FQ_CACHE = { at: Date.now(), sym: symKey, data: data };
    BT.fq = data;
    BT.fqBusy = false;
    renderTraderApp(true);
  }).catch(function () {
    BT.fqBusy = false;
    BT.fq = null;
    BT.fqErr = 'دریافت سری ۲ساله نماد و عوامل از پروکسی‌های عمومی ناموفق بود — این نسخه به اتصال اینترنت باز شما نیاز دارد. عددی حدس زده نمی‌شود؛ دوباره تلاش کنید.';
    renderTraderApp(true);
  });
}
/* وزن‌های کاربر برای عوامل — per symbol */
function btFqWeights() {
  var all = btGet(BT_KEYS.fqw, {});
  return all[BT.sym] || {};
}
function btFqSetWeight(id, v) {
  var all = btGet(BT_KEYS.fqw, {});
  all[BT.sym] = all[BT.sym] || {};
  all[BT.sym][id] = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  btSet(BT_KEYS.fqw, all);
}
function btFqLocalScore(fq) {
  if (!fq) return null;
  var w = btFqWeights(), items = [], i;
  for (i = 0; i < fq.rows.length; i++) {
    var r = fq.rows[i];
    if (r.pressure !== null) items.push({ id: r.id, w: w[r.id] !== undefined ? w[r.id] : r.w, p: r.pressure });
  }
  return trComposite(items);
}
function btFqSumValidW(fq) {
  if (!fq) return 0;
  var w = btFqWeights(), s = 0, i;
  for (i = 0; i < fq.rows.length; i++) {
    var r = fq.rows[i];
    if (r.pressure !== null) s += (w[r.id] !== undefined ? w[r.id] : r.w);
  }
  return Math.round(s * 100) / 100;
}
