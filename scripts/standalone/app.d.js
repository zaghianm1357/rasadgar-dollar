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
    yahoo: 'GC=F', tv: 'OANDA:XAUUSD', name: 'طلا — XAUUSD', band: [0.7, 1.6], contract: 100, inv: true, label: 'XAUUSD',
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
    yahoo: '^DJI', tv: 'DJ:DJI', name: 'داوجونز — DJI', band: [0.5, 1.3], contract: 1, inv: false, label: 'DJI',
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
var BT_TABS = [['view', 'نمای بازار'], ['ai', 'تحلیل هوشمند'], ['factors', 'دماسنج'], ['news', 'اخبار']];

/* ---------- وضعیت اپ ---------- */
var BT = { tab: 'view', sym: 'xau', data: null, busy: false, err: null, changes: [], nudge: '', pmSide: null, checks: {}, plan: null, copied: false, pt: null, ptBusy: false, ptErr: null, ptTf: '1d' };
var BT_CACHE = { at: 0, data: null };

/* ---------- دریافت سری روزانه از Yahoo (پروکسی عمومی) ---------- */
function btFetchSeries(sym, range, interval) {
  var itv = interval || '1d';
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=' + itv + '&range=' + range + '&includePrePost=false';
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

/* ================= دماسنج فشار خرید/فروش — اجماع ۱۶ اندیکاتور (نسخه مستقل) ================= */
/* پورت موتور سرور (pressure-thermometer) به JS خالص — هر اندیکاتور یک رأی ‎−۱…+۱‎؛
   خروجی فقط «نتیجه» است: عدد دماسنج ۰…۱۰۰، ناحیه، اجماع و جمله راهنما. */

function thClamp(v) { return Math.max(-1, Math.min(1, v)); }

function thAtrLast(h, l, c) {
  var n = c.length, p = 14, i, tr, a = 0;
  if (n < p + 1) return c[n - 1] * 0.005;
  for (i = 1; i <= p; i++) {
    tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    a += tr;
  }
  a /= p;
  for (i = p + 1; i < n; i++) {
    tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    a = (a * (p - 1) + tr) / p;
  }
  return a > 0 ? a : c[n - 1] * 0.005;
}

function thRsiLast(c) {
  var n = c.length, p = 14, i, d;
  if (n < p + 1) return null;
  var g = 0, l = 0;
  for (i = 1; i <= p; i++) { d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  var ag = g / p, al = l / p;
  for (i = p + 1; i < n; i++) {
    d = c[i] - c[i - 1];
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
  }
  return al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
}

function thStochLast(h, l, c, p, smooth) {
  var n = c.length, i, j;
  if (n < p + smooth) return null;
  var raw = [];
  for (i = p - 1; i < n; i++) {
    var hh = -Infinity, ll = Infinity;
    for (j = i - p + 1; j <= i; j++) { if (h[j] > hh) hh = h[j]; if (l[j] < ll) ll = l[j]; }
    raw.push(hh === ll ? 50 : ((c[i] - ll) / (hh - ll)) * 100);
  }
  var m = raw.length;
  if (m < smooth) return null;
  var s = 0;
  for (i = m - smooth; i < m; i++) s += raw[i];
  return s / smooth;
}

function thStochRsiLast(c) {
  var r = thRsiLast(c);
  if (r === null) return null;
  var n = c.length, p = 14, i;
  var rs = [];
  /* بازسازی سری RSI کامل برای پنجره ۱۴تایی */
  var g = 0, l = 0, d, ag, al;
  if (n < 2 * p + 1) return null;
  var series = [];
  for (i = 1; i <= p; i++) { d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  ag = g / p; al = l / p;
  series.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (i = p + 1; i < n; i++) {
    d = c[i] - c[i - 1];
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
    series.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  var m = series.length;
  if (m < p) return null;
  var hh = -Infinity, ll = Infinity;
  for (i = m - p; i < m; i++) { if (series[i] > hh) hh = series[i]; if (series[i] < ll) ll = series[i]; }
  return hh === ll ? 50 : ((series[m - 1] - ll) / (hh - ll)) * 100;
}

function thCciLast(h, l, c) {
  var n = c.length, p = 20, i;
  if (n < p) return null;
  var tp = [];
  for (i = 0; i < n; i++) tp.push((h[i] + l[i] + c[i]) / 3);
  var m = 0;
  for (i = n - p; i < n; i++) m += tp[i];
  m /= p;
  var md = 0;
  for (i = n - p; i < n; i++) md += Math.abs(tp[i] - m);
  md /= p;
  return md > 0 ? (tp[n - 1] - m) / (0.015 * md) : 0;
}

function thWillrLast(h, l, c) {
  var n = c.length, p = 14, i;
  if (n < p) return null;
  var hh = -Infinity, ll = Infinity;
  for (i = n - p; i < n; i++) { if (h[i] > hh) hh = h[i]; if (l[i] < ll) ll = l[i]; }
  return hh === ll ? -50 : ((hh - c[n - 1]) / (hh - ll)) * 100;
}

function thMfiLast(h, l, c, v) {
  var n = c.length, p = 14, i;
  if (n < p + 1) return null;
  var pos = 0, neg = 0;
  for (i = n - p + 1; i < n; i++) {
    var tp0 = (h[i - 1] + l[i - 1] + c[i - 1]) / 3;
    var tp1 = (h[i] + l[i] + c[i]) / 3;
    if (tp1 > tp0) pos += tp1 * v[i];
    else if (tp1 < tp0) neg += tp1 * v[i];
  }
  return pos + neg > 0 ? 100 - 100 / (1 + pos / neg) : 50;
}

function thMacdHistLast(c) {
  var n = c.length, i;
  if (n < 35) return null;
  function emaSeries(src, p) {
    var out = [], k = 2 / (p + 1), prev = null, j, s;
    for (j = 0; j < src.length; j++) {
      if (j === p - 1) { s = 0; for (var q = 0; q < p; q++) s += src[q]; prev = s / p; out.push(prev); }
      else if (prev !== null) { prev = src[j] * k + prev * (1 - k); out.push(prev); }
      else out.push(null);
    }
    return out;
  }
  var e12 = emaSeries(c, 12), e26 = emaSeries(c, 26);
  var macd = [];
  for (i = 0; i < n; i++) macd.push(e12[i] !== null && e26[i] !== null ? e12[i] - e26[i] : 0);
  var sig = emaSeries(macd, 9);
  return macd[n - 1] - sig[n - 1];
}

function thDmiLast(h, l, c, p) {
  var n = c.length, i;
  if (n < 2 * p + 2) return { pdi: null, mdi: null, adx: null };
  var trs = [], pdms = [], mdms = [];
  for (i = 1; i < n; i++) {
    var up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    pdms.push(up > dn && up > 0 ? up : 0);
    mdms.push(dn > up && dn > 0 ? dn : 0);
    trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  }
  var trS = 0, pS = 0, mS = 0, k;
  for (i = 0; i < p; i++) { trS += trs[i]; pS += pdms[i]; mS += mdms[i]; }
  var dxs = [], pdi = null, mdi = null;
  for (i = p; i < trs.length; i++) {
    trS = trS - trS / p + trs[i];
    pS = pS - pS / p + pdms[i];
    mS = mS - mS / p + mdms[i];
    var pd = trS > 0 ? (pS / trS) * 100 : 0;
    var md = trS > 0 ? (mS / trS) * 100 : 0;
    pdi = pd; mdi = md;
    dxs.push(pd + md > 0 ? (Math.abs(pd - md) / (pd + md)) * 100 : 0);
  }
  if (dxs.length < p) return { pdi: pdi, mdi: mdi, adx: null };
  var adx = 0;
  for (k = dxs.length - p; k < dxs.length; k++) adx += dxs[k];
  return { pdi: pdi, mdi: mdi, adx: adx / p };
}

function thAroonLast(h, l, p) {
  var n = h.length, i;
  if (n < p + 1) return { up: null, down: null };
  var hi = -Infinity, lo = Infinity, hiIdx = 0, loIdx = 0;
  for (i = n - p; i < n; i++) {
    if (h[i] >= hi) { hi = h[i]; hiIdx = i; }
    if (l[i] <= lo) { lo = l[i]; loIdx = i; }
  }
  return { up: ((p - (n - 1 - hiIdx)) / p) * 100, down: ((p - (n - 1 - loIdx)) / p) * 100 };
}

function thUoLast(h, l, c) {
  var n = c.length, i;
  if (n < 29) return null;
  var bp = [], tr = [];
  for (i = 1; i < n; i++) {
    var tl = Math.min(l[i], c[i - 1]);
    bp.push(c[i] - tl);
    tr.push(Math.max(h[i], c[i - 1]) - tl);
  }
  function avg(len) {
    var b = 0, t = 0, j;
    for (j = bp.length - len; j < bp.length; j++) { b += bp[j]; t += tr[j]; }
    return t > 0 ? b / t : 0;
  }
  return ((4 * avg(7) + 2 * avg(14) + avg(28)) / 7) * 100;
}

function thTsiLast(c) {
  var n = c.length, i;
  if (n < 40) return null;
  var pc = [];
  for (i = 1; i < n; i++) pc.push(c[i] - c[i - 1]);
  function emaSeries(src, p) {
    var out = [], k = 2 / (p + 1), prev = null, j, s;
    for (j = 0; j < src.length; j++) {
      if (j === p - 1) { s = 0; for (var q = 0; q < p; q++) s += src[q]; prev = s / p; out.push(prev); }
      else if (prev !== null) { prev = src[j] * k + prev * (1 - k); out.push(prev); }
      else out.push(null);
    }
    return out;
  }
  var e1 = emaSeries(pc, 25), absPc = pc.map(Math.abs);
  var ea1 = emaSeries(absPc, 25);
  var d1 = e1.map(function (v) { return v === null ? 0 : v; });
  var da1 = ea1.map(function (v) { return v === null ? 0 : v; });
  var e2 = emaSeries(d1, 13), ea2 = emaSeries(da1, 13);
  var num = e2[e2.length - 1], den = ea2[ea2.length - 1];
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

function thEmaLast(src, p) {
  var n = src.length, i;
  if (n < p) return null;
  var s = 0;
  for (i = 0; i < p; i++) s += src[i];
  var prev = s / p, k = 2 / (p + 1);
  for (i = p; i < n; i++) prev = src[i] * k + prev * (1 - k);
  return prev;
}

/* محاسبه اصلی دماسنج — ser = {t,h,l,c,v|null} */
function thCompute(ser) {
  var h = ser.h, l = ser.l, c = ser.c, n = c.length, i;
  var hasVol = !!(ser.v && ser.v.length === n && ser.v.some(function (x) { return x != null && x > 0; }));
  var atr = thAtrLast(h, l, c);
  var atrPct = (atr / c[n - 1]) * 100;
  var ind = [];
  function add(id, nameFa, raw, needsVol) {
    if (raw === null || raw === undefined || !isFinite(raw)) return;
    var s = thClamp(raw);
    ind.push({ id: id, nameFa: nameFa, score: Math.round(s * 1000) / 1000, dir: s > 0.15 ? 'buy' : s < -0.15 ? 'sell' : 'neutral', needsVolume: !!needsVol });
  }

  var rsi = thRsiLast(c);
  add('rsi', 'RSI', rsi === null ? null : (rsi - 50) / 50);
  var st = thStochLast(h, l, c, 14, 3);
  add('stoch', 'استوکاستیک', st === null ? null : (st - 50) / 50);
  var sr = thStochRsiLast(c);
  add('stochrsi', 'استوکاستیک RSI', sr === null ? null : (sr - 50) / 50);
  var cci = thCciLast(h, l, c);
  add('cci', 'CCI', cci === null ? null : cci / 150);
  var wr = thWillrLast(h, l, c);
  add('willr', 'ویلیامز %R', wr === null ? null : (wr + 50) / 50);
  if (hasVol) add('mfi', 'MFI جریان پول', (function () { var m = thMfiLast(h, l, c, ser.v); return m === null ? null : (m - 50) / 50; })(), true);
  var mh = thMacdHistLast(c);
  add('macd', 'MACD', mh === null ? null : mh / (0.35 * atr));
  if (hasVol && n >= 25) {
    var obv = 0, obvs = [], vsum = 0;
    for (i = 1; i < n; i++) {
      obv += c[i] > c[i - 1] ? ser.v[i] : c[i] < c[i - 1] ? -ser.v[i] : 0;
      obvs.push(obv);
    }
    for (i = n - 20; i < n; i++) vsum += ser.v[i];
    var d = obvs[obvs.length - 1] - obvs[obvs.length - 1 - 20];
    add('obv', 'OBV حجم تعادلی', vsum > 0 ? thClamp(d / vsum * 1.2) : null, true);
  }
  var dmi = thDmiLast(h, l, c, 14);
  if (dmi.pdi !== null && dmi.mdi !== null && dmi.adx !== null && dmi.pdi + dmi.mdi > 0) {
    var dirW = (dmi.pdi - dmi.mdi) / (dmi.pdi + dmi.mdi);
    var strength = Math.max(0.3, Math.min(1, dmi.adx / 25));
    add('dmi', 'DMI / ADX', dirW * strength);
  }
  if (n >= 11 && atrPct > 0) {
    var roc = (c[n - 1] - c[n - 11]) / c[n - 11] * 100;
    add('roc', 'ROC سرعت قیمت', roc / (3 * atrPct));
  }
  if (n >= 15) {
    var g = 0, lo = 0;
    for (i = n - 14; i < n; i++) { var dd = c[i] - c[i - 1]; if (dd > 0) g += dd; else lo -= dd; }
    var cmo = g + lo > 0 ? ((g - lo) / (g + lo)) * 100 : 0;
    add('cmo', 'CMO مومنتوم', cmo / 100);
  }
  var uo = thUoLast(h, l, c);
  add('uo', 'اسیلاتور فراگیر', uo === null ? null : (uo - 50) / 50);
  if (n >= 34) {
    var med = [], j;
    for (j = 0; j < n; j++) med.push((h[j] + l[j]) / 2);
    var s5 = thEmaLast(med, 5) === null ? null : (function () { var s = 0, k; for (k = n - 5; k < n; k++) s += med[k]; return s / 5; })();
    var s34 = (function () { var s = 0, k; for (k = n - 34; k < n; k++) s += med[k]; return s / 34; })();
    add('ao', 'اسیلاتور شگفت‌انگیز', (s5 - s34) / (0.5 * atr));
  }
  var tsi = thTsiLast(c);
  add('tsi', 'TSI واقعی', tsi === null ? null : tsi / 40);
  if (n >= 20) {
    var win = c.slice(-20), m = 0, k2;
    for (k2 = 0; k2 < 20; k2++) m += win[k2];
    m /= 20;
    var sd = 0;
    for (k2 = 0; k2 < 20; k2++) sd += (win[k2] - m) * (win[k2] - m);
    sd = Math.sqrt(sd / 20);
    var pb = sd > 0 ? ((c[n - 1] - (m - 2 * sd)) / (4 * sd)) * 100 : 50;
    add('bb', 'بولینگر %B', (pb - 50) / 50);
  }
  var e20 = thEmaLast(c, 20), e50 = thEmaLast(c, 50);
  if (e20 !== null && e50 !== null) add('ema', 'میانگین‌های متحرک', ((e20 - e50) + (c[n - 1] - e50)) / 2 / (0.5 * atr));
  var ar = thAroonLast(h, l, 25);
  if (ar.up !== null && ar.down !== null) add('aroon', 'آرون', (ar.up - ar.down) / 100);
  var e13 = thEmaLast(c, 13);
  if (e13 !== null) add('elder', 'قدرت گاو/خرس', ((h[n - 1] - e13) + (l[n - 1] - e13)) / 2 / (0.5 * atr));

  var buy = 0, sell = 0;
  var sum = 0;
  for (i = 0; i < ind.length; i++) { sum += ind[i].score; if (ind[i].dir === 'buy') buy++; else if (ind[i].dir === 'sell') sell++; }
  var neutral = ind.length - buy - sell;
  var mean = ind.length ? sum / ind.length : 0;
  var score = Math.round(thClamp((mean + 1) / 2, 0, 1) * 100);
  var zone = score >= 80 ? 'heavy-buy' : score >= 60 ? 'buy' : score > 40 ? 'neutral' : score > 20 ? 'sell' : 'heavy-sell';
  var zoneFa = zone === 'heavy-buy' ? 'فشار خرید سنگین' : zone === 'buy' ? 'فشار خرید' : zone === 'neutral' ? 'خنثی / متعادل' : zone === 'sell' ? 'فشار فروش' : 'فشار فروش سنگین';
  var dir = score >= 60 ? 'buy' : score <= 40 ? 'sell' : 'neutral';
  var guidanceFa =
    zone === 'heavy-buy' ? 'بازار کاملاً در دست خریداران است — تعقیب قیمت در این ناحیه ریسک اصلاح تند دارد؛ منتظر پولبک بمانید.' :
    zone === 'buy' ? 'مومنتوم خرید غالب است — مسیر کوتاه‌مدت به سمت بالا متمایل است؛ پولبک‌ها به حمایت جای پایش ورود هستند.' :
    zone === 'neutral' ? 'فشار خرید و فروش تقریباً برابر است — جهت روشن نیست؛ معامله در میانه این ناحیه کم‌بازده و پرریسک است.' :
    zone === 'sell' ? 'مومنتوم فروش غالب است — مسیر کوتاه‌مدت به سمت پایین متمایل است؛ برگشت‌ها به مقاومت جای پایش فروش هستند.' :
    'بازار کاملاً در دست فروشندگان است — خرید ضدروند در این ناحیه پرریسک است؛ منتظر تثبیت بمانید.';
  var sentenceFa = ind.length === 0 ? 'هیچ اندیکاتوری قابل محاسبه نبود.' :
    'از ' + ind.length + ' اندیکاتور فعال: ' + buy + ' اندیکاتور فشار خرید، ' + sell + ' اندیکاتور فشار فروش و ' + neutral + ' اندیکاتور خنثی';
  return {
    score: score, zone: zone, zoneFa: zoneFa, dir: dir,
    consensus: { total: ind.length, buy: buy, sell: sell, neutral: neutral, sentenceFa: sentenceFa },
    indicators: ind, guidanceFa: guidanceFa, usedVolume: hasVol, bars: n,
    reliable: ind.length >= 8,
    disclaimer: 'دماسنج فشار، احتمال‌سنج مومنتوم لحظه بازار است — نه پیش‌بینی قطعی و نه توصیه خرید/فروش.'
  };
}

/* مرز کندل ۴ساعته بروکری (۱۷:۰۰ نیویورک) — مثل موتور اسکلپ */
function thH4Phase() {
  var ms = Date.now();
  var y = new Date(ms).getUTCFullYear();
  function dow(u) { return new Date(u).getUTCDay(); }
  var mar1 = Date.UTC(y, 2, 1), nov1 = Date.UTC(y, 10, 1);
  var dstStart = mar1 + ((7 - dow(mar1)) % 7) * 86400000 + 7 * 86400000;
  var dstEnd = nov1 + ((7 - dow(nov1)) % 7) * 86400000;
  return ms >= dstStart && ms < dstEnd ? 3600 : 7200;
}

/* تجمیع ۴ساعته سری {t,h,l,c,v} با فاز */
function thAggregate4h(ser, phase) {
  var BUCKET = 4 * 3600, map = {}, keys = [], i;
  for (i = 0; i < ser.t.length; i++) {
    var k = Math.floor((ser.t[i] - phase) / BUCKET) * BUCKET + phase;
    if (map[k] === undefined) { map[k] = { t: k, o: ser.c[i], h: ser.h[i], l: ser.l[i], c: ser.c[i], v: ser.v ? ser.v[i] : null }; keys.push(k); }
    else {
      if (ser.h[i] > map[k].h) map[k].h = ser.h[i];
      if (ser.l[i] < map[k].l) map[k].l = ser.l[i];
      map[k].c = ser.c[i];
    }
  }
  keys.sort(function (a, b) { return a - b; });
  var out = { t: [], h: [], l: [], c: [], v: [] };
  for (i = 0; i < keys.length; i++) {
    out.t.push(map[keys[i]].t); out.h.push(map[keys[i]].h); out.l.push(map[keys[i]].l); out.c.push(map[keys[i]].c); out.v.push(map[keys[i]].v);
  }
  return out;
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

/* ---------- بارگذاری تنبل دماسنج فشار — رأی فنی تریدینگ‌ویو اول، موتور محلی پشتیبان ---------- */
var BT_PT_CACHE = { at: 0, key: null, data: null };
var PT_TFS = { '1d': { interval: '1d', range: '2y', agg4h: false, label: 'روزانه' }, '4h': { interval: '1h', range: '3mo', agg4h: true, label: '۴ ساعته' }, '1h': { interval: '1h', range: '1mo', agg4h: false, label: '۱ ساعته' } };

function btLoadPressure(force, tfOverride) {
  if (BT.ptBusy) return;
  var tf = tfOverride || BT.ptTf || '1d';
  var key = BT.sym + ':' + tf;
  if (!force && BT_PT_CACHE.data && BT_PT_CACHE.key === key && Date.now() - BT_PT_CACHE.at < 15 * 60 * 1000) {
    BT.pt = BT_PT_CACHE.data;
    renderTraderApp(true);
    return;
  }
  BT.ptBusy = true; BT.ptErr = null;
  renderTraderApp(true);
  var conf = BT_SYMS[BT.sym];
  var def = PT_TFS[tf] || PT_TFS['1d'];
  var minBars = def.agg4h ? 60 : 200;

  function finish(data) {
    data.tf = tf;
    data.tfLabel = def.label;
    data.symName = conf.name;
    if (!data.atISO) data.atISO = new Date().toISOString();
    BT_PT_CACHE = { at: Date.now(), key: key, data: data };
    BT.pt = data;
    BT.ptBusy = false;
    renderTraderApp(true);
  }
  function localFallback() {
    btFetchSeries(conf.yahoo, def.range, def.interval).then(function (ser) {
      if (!ser || ser.c.length < minBars) throw new Error('thin');
      var out = ser;
      if (def.agg4h) out = thAggregate4h(ser, thH4Phase());
      var data = thCompute(out);
      data.source = 'local';
      data.sourceNoteFa = 'منبع رأی: موتور محلی ابزار (اجماع ۱۶ اندیکاتور روی کندل‌ها) — تریدینگ‌ویو در دسترس نبود';
      finish(data);
    }).catch(function () {
      BT.ptBusy = false;
      BT.pt = null;
      BT.ptErr = 'دریافت رأی تریدینگ‌ویو و کندل‌های محلی ناموفق بود — این نسخه به اتصال اینترنت باز نیاز دارد. عددی حدس زده نمی‌شود؛ دوباره تلاش کنید.';
      renderTraderApp(true);
    });
  }

  /* تلاش اول: اسکنر عمومی تریدینگ‌ویو (CORS باز — مستقیم بدون پروکسی) */
  if (conf.tv) {
    btTvTechnicals(conf.tv, tf).then(function (tv) {
      if (tv) finish(btThermoFromTv(conf, tv, tf, def.label));
      else localFallback();
    });
  } else localFallback();
}

/* ================= رأی فنی تریدینگ‌ویو (اسکنر عمومی — CORS باز) ================= */
/* منبع دماسنج طبق درخواست کاربر: همان Technicals صفحه نماد در تریدینگ‌ویو */

var TV_TF_SUFFIX = { '1h': '|60', '4h': '|240', '1d': '' };
var TV_CACHE = { at: 0, key: null, data: null };

function tvRatingDir(v) { return v >= 0.1 ? 'buy' : v <= -0.1 ? 'sell' : 'neutral'; }
function tvRatingStateFa(v) { var d = tvRatingDir(v); return d === 'buy' ? 'فشار خرید' : d === 'sell' ? 'فشار فروش' : 'خنثی'; }
function tvZoneOf(score) {
  if (score >= 80) return { zone: 'heavy-buy', zoneFa: 'فشار خرید بسیار قوی' };
  if (score >= 60) return { zone: 'buy', zoneFa: 'فشار خرید' };
  if (score > 40) return { zone: 'neutral', zoneFa: 'بازار خنثی' };
  if (score > 20) return { zone: 'sell', zoneFa: 'فشار فروش' };
  return { zone: 'heavy-sell', zoneFa: 'فشار فروش بسیار قوی' };
}
function tvGuidanceFa(zone, tfLabel) {
  switch (zone) {
    case 'heavy-buy': return 'تریدینگ‌ویو اجماع خرید سنگین در تایم‌فریم ' + tfLabel + ' نشان می‌دهد — مسیر کوتاه‌مدت متمایل به صعود است؛ برای ورود خرید، ورود در اصلاح به سمت سطوح حمایتی امن‌تر از تعقیب قیمت است.';
    case 'buy': return 'تریدینگ‌ویو به خرید متمایل است در تایم‌فریم ' + tfLabel + ' — فشار خرید مثبت اما نه سنگین؛ سیو سود پله‌ای و رعایت حد ضرر برای ادامه مسیر ضروری است.';
    case 'sell': return 'تریدینگ‌ویو به فروش متمایل است در تایم‌فریم ' + tfLabel + ' — فشار فروش مثبت اما نه سنگین؛ برای فروش، برگشت‌های قیمت به سمت مقاومت فرصت‌های کم‌ریسک‌تری هستند.';
    case 'heavy-sell': return 'تریدینگ‌ویو اجماع فروش سنگین در تایم‌فریم ' + tfLabel + ' نشان می‌دهد — مسیر کوتاه‌مدت متمایل به نزول است؛ تلاش برای خرید در برابر این فشار پرریسک است.';
    default: return 'تریدینگ‌ویو در تایم‌فریم ' + tfLabel + ' خنثی است — نه فشار خرید و نه فشار فروش غالب است؛ بازار در حال انتخاب مسیر است، معامله در مرزهای محدوده یا صبر برای شکست مشخص، منطقی‌تر است.';
  }
}
function btTvTechnicals(tvSym, tf) {
  var key = tvSym + ':' + tf;
  if (TV_CACHE.data && TV_CACHE.key === key && Date.now() - TV_CACHE.at < 10 * 60 * 1000) return Promise.resolve(TV_CACHE.data);
  var sfx = TV_TF_SUFFIX[tf] || '';
  var fields = ['close', 'Recommend.All' + sfx, 'Recommend.Other' + sfx, 'Recommend.MA' + sfx]
    .map(function (f) { return encodeURIComponent(f); }).join(',');
  var u = 'https://scanner.tradingview.com/symbol?symbol=' + encodeURIComponent(tvSym) + '&fields=' + fields + '&no_404=true';
  return fetchJSON(u, 9000).then(function (j) {
    var all = j['Recommend.All' + sfx];
    if (typeof all !== 'number' || !isFinite(all) || all < -1 || all > 1) throw new Error('bad');
    var out = {
      all: all,
      other: typeof j['Recommend.Other' + sfx] === 'number' ? j['Recommend.Other' + sfx] : 0,
      ma: typeof j['Recommend.MA' + sfx] === 'number' ? j['Recommend.MA' + sfx] : 0,
      atISO: new Date().toISOString()
    };
    TV_CACHE = { at: Date.now(), key: key, data: out };
    return out;
  }).catch(function () { return null; });
}
function btThermoFromTv(conf, tv, tf, tfLabel) {
  var score = Math.max(0, Math.min(100, Math.round((tv.all + 1) * 50)));
  var z = tvZoneOf(score);
  var dir = tvRatingDir(tv.all);
  var oscDir = tvRatingDir(tv.other);
  var maDir = tvRatingDir(tv.ma);
  var buy = (dir === 'buy' ? 1 : 0) + (oscDir === 'buy' ? 1 : 0) + (maDir === 'buy' ? 1 : 0);
  var sell = (dir === 'sell' ? 1 : 0) + (oscDir === 'sell' ? 1 : 0) + (maDir === 'sell' ? 1 : 0);
  return {
    score: score, zone: z.zone, zoneFa: z.zoneFa, dir: dir,
    consensus: {
      total: 3, buy: buy, sell: sell, neutral: 3 - buy - sell,
      sentenceFa: 'اجماع تریدینگ‌ویو: کل «' + tvRatingStateFa(tv.all) + '» · نوسانگرها «' + tvRatingStateFa(tv.other) + '» · میانگین‌های متحرک «' + tvRatingStateFa(tv.ma) + '»'
    },
    indicators: [
      { id: 'tv-osc', nameFa: 'نوسانگرها', score: tv.other, dir: oscDir },
      { id: 'tv-ma', nameFa: 'میانگین‌های متحرک', score: tv.ma, dir: maDir }
    ],
    guidanceFa: tvGuidanceFa(z.zone, tfLabel),
    reliable: true,
    source: 'tradingview',
    sourceNoteFa: 'منبع رأی: تریدینگ‌ویو (Technical Rating — نوسانگرها + میانگین‌های متحرک)',
    tvSymbol: conf.tv,
    atISO: tv.atISO,
    disclaimer: 'دماسنج فشار، احتمال‌سنج مومنتوم لحظه بازار است — نه پیش‌بینی قطعی و نه توصیه خرید/فروش.'
  };
}

/* ================= تحلیل و پیش‌بینی (LiteFinance + FXStreet) ================= */

function anStripTags(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
}
function anNum(v) {
  if (!v) return null;
  var n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) && n > 100 && n < 100000 ? n : null;
}
function anExtractRows(text) {
  var re = /(\d{2}\.\d{2}\.\d{4}(?:\s*[–—-]\s*\d{2}\.\d{2}\.\d{4})?)[^0-9]{0,40}([\d.,]{5,})[^0-9]{0,30}([\d.,]{5,})[^0-9]{0,30}([\d.,]{5,})/g;
  var rows = [], m;
  while ((m = re.exec(text)) !== null) {
    var low = anNum(m[2]), avg = anNum(m[3]), high = anNum(m[4]);
    if (low === null || avg === null || high === null) continue;
    rows.push({ date: m[1], low: low, avg: avg, high: high });
    if (rows.length >= 6) break;
  }
  return rows;
}
function anParseLite(html) {
  var text = anStripTags(html);
  if (!/XAU\s*\/?\s*USD|Gold/i.test(text)) throw new Error('no-content');
  var dateMatch = text.match(/([A-Z][a-z]+ \d{1,2},? 20\d{2})/);
  var NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
  var baseKind = text.match(/Base scenario[^.]{0,100}?\b(long|short)\b/i);
  var baseScenario = baseKind ? (baseKind[1].toLowerCase() === 'long' ? 'long' : 'short') : null;
  var longAbove = text.match(new RegExp('long positions[^.]{0,100}?above (?:the )?\\$?\\s*' + NUM, 'i'));
  var shortBelow = text.match(new RegExp('short positions[^.]{0,100}?below (?:the )?\\$?\\s*' + NUM, 'i'));
  var stopLoss = text.match(new RegExp('Stop Loss(?:\\s*\\(\\d+\\))?:?\\s*\\$?\\s*' + NUM, 'i'));
  var targets = [];
  var targetsSeg = text.match(/price targets (?:are )?at\s+([\s\S]{0,220})/i);
  if (targetsSeg) {
    var tre = /\d[\d,]*(?:\.\d+)?/g, tm;
    while ((tm = tre.exec(targetsSeg[1])) !== null) {
      var n = anNum(tm[0]);
      if (n !== null) targets.push(n);
      if (targets.length >= 3) break;
    }
  }
  var rows = anExtractRows(text);
  var dailyRows = [], weekRow = null, i;
  for (i = 0; i < rows.length; i++) {
    if (/[–—-]/.test(rows[i].date)) { if (!weekRow) weekRow = rows[i]; }
    else dailyRows.push(rows[i]);
  }
  var todayStr = anTehranDate(0), tomorrowStr = anTehranDate(1);
  var todayRow = null, tomorrowRow = null, j;
  for (j = 0; j < dailyRows.length; j++) { if (dailyRows[j].date === todayStr) todayRow = dailyRows[j]; }
  for (j = 0; j < dailyRows.length; j++) { if (dailyRows[j].date === tomorrowStr) tomorrowRow = dailyRows[j]; }
  if (!todayRow && dailyRows.length) todayRow = dailyRows[0];
  if (!tomorrowRow && dailyRows.length > 1 && dailyRows[1] !== todayRow) tomorrowRow = dailyRows[1];
  var rsiMatch = text.match(/RSI[^.]{0,80}?(?:is|at|of|around|=|:)\s*(\d{1,2}(?:\.\d+)?)/i);
  var rsiVal = rsiMatch ? Number(rsiMatch[1]) : null;
  if (!longAbove && !shortBelow && !tomorrowRow && !todayRow && !weekRow) throw new Error('no-numbers');
  return {
    ok: true, via: '',
    reportedAtFa: dateMatch ? dateMatch[1] : null,
    baseScenario: baseScenario,
    baseScenarioFa: baseScenario === 'long' ? 'سناریوی اصلی گزارش: خرید بالای سطح مشخص‌شده' : baseScenario === 'short' ? 'سناریوی اصلی گزارش: فروش زیر سطح مشخص‌شده' : null,
    longAbove: longAbove ? anNum(longAbove[1]) : null,
    shortBelow: shortBelow ? anNum(shortBelow[1]) : null,
    stopLoss: stopLoss ? anNum(stopLoss[1]) : null,
    targets: targets,
    tomorrow: { low: tomorrowRow ? tomorrowRow.low : null, avg: tomorrowRow ? tomorrowRow.avg : null, high: tomorrowRow ? tomorrowRow.high : null },
    week: { low: weekRow ? weekRow.low : null, avg: weekRow ? weekRow.avg : null, high: weekRow ? weekRow.high : null },
    rsi: rsiVal !== null && rsiVal >= 0 && rsiVal <= 100 ? rsiVal : null
  };
}
function anTehranDate(offsetDays) {
  var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', day: '2-digit', month: '2-digit', year: 'numeric' });
  return fmt.format(new Date(Date.now() + offsetDays * 86400000)).replace(/\//g, '.');
}
var FX_LINK_RE = /<a[^>]+href="(https?:\/\/www\.fxstreet\.com\/(?:analysis|news|markets|commodities|rates-charts)\/[^"#?][^"]*)"[^>]*>([\s\S]{20,220}?)<\/a>/gi;
function anParseFx(html) {
  if (!/FXStreet|Gold|XAU/i.test(html)) throw new Error('no-content');
  var poll = [];
  var periodDefs = [[/1 Week/i, 'هفته آینده'], [/1 Month/i, 'ماه آینده'], [/1 Quarter/i, 'سه‌ماه آینده']];
  for (var p = 0; p < periodDefs.length; p++) {
    var m0 = html.match(periodDefs[p][0]);
    if (!m0 || m0.index === undefined) continue;
    var seg = anStripTags(html.slice(m0.index, m0.index + 400));
    var avg = seg.match(/Average\s*([\d.,]+)/i);
    var parts = [], pm;
    var pre = /(\d{1,3})%\s*(Sideways|Bullish|Bearish)/gi;
    while ((pm = pre.exec(seg)) !== null) {
      parts.push(pm[1] + '٪ ' + (/sideways/i.test(pm[2]) ? 'رنج' : /bullish/i.test(pm[2]) ? 'صعودی' : 'نزولی'));
    }
    poll.push({ periodFa: periodDefs[p][1], avg: avg ? anNum(avg[1]) : null, mixFa: parts.length ? parts.join(' · ') : null });
  }
  var items = [], seen = {}, im;
  FX_LINK_RE.lastIndex = 0;
  while ((im = FX_LINK_RE.exec(html)) !== null) {
    var title = anStripTags(im[2]).trim();
    if (title.length < 25 || seen[title]) continue;
    seen[title] = 1;
    items.push({ title: title, titleFa: null, url: im[1] });
    if (items.length >= 5) break;
  }
  if (!items.length && !poll.length) throw new Error('no-items');
  return { ok: true, via: '', poll: poll, items: items };
}
function anChallenge(txt) { return /Just a moment|challenge-platform|Attention Required/i.test(String(txt).slice(0, 4000)); }
function anFetchText(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); reject(new Error('timeout')); }, timeoutMs || 11000);
    fetch(url, { signal: ctrl.signal }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function (txt) { clearTimeout(t); resolve(txt); }).catch(function (e) { clearTimeout(t); reject(e); });
  });
}
function anFetchChain(url) {
  var enc = encodeURIComponent(url);
  var steps = [
    { via: 'مستقیم', u: url },
    { via: 'پروکسی allorigins', u: 'https://api.allorigins.win/raw?url=' + enc },
    { via: 'پروکسی corsproxy', u: 'https://corsproxy.io/?url=' + enc },
    { via: 'پروکسی codetabs', u: 'https://api.codetabs.com/v1/proxy?quest=' + enc },
    { via: 'آرشیو Wayback', u: 'https://web.archive.org/web/2/' + url, archive: true }
  ];
  var i = 0;
  function attempt() {
    if (i >= steps.length) return Promise.reject(new Error('chain-fail'));
    var s = steps[i++];
    return anFetchText(s.u, s.archive ? 20000 : 11000).then(function (txt) {
      if (txt.length < 500 || anChallenge(txt)) throw new Error('bad');
      return { text: txt, via: s.via };
    }).catch(function () { return attempt(); });
  }
  return attempt();
}
function anFaNum(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return faDigits(Number(v.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 })).replace(/,/g, '٬');
}
function anSynthesize(lite, fx, tv) {
  var out = [];
  if (tv && tv.ok && tv.stateFa) out.push('رأی فنی تریدینگ‌ویو (روزانه): ' + tv.stateFa + '.');
  if (lite && lite.ok) {
    if (lite.tomorrow.avg !== null || lite.tomorrow.high !== null) {
      out.push('پیش‌بینی LiteFinance برای فردا: بازه ' + anFaNum(lite.tomorrow.low) + ' تا ' + anFaNum(lite.tomorrow.high) + ' با میانگین ' + anFaNum(lite.tomorrow.avg) + '.');
    }
    if (lite.baseScenario === 'long' && lite.longAbove !== null) {
      out.push('سناریوی اصلی گزارش: خرید بالای ' + anFaNum(lite.longAbove) + (lite.stopLoss ? ' با حد ضرر ' + anFaNum(lite.stopLoss) : '') + (lite.targets.length ? ' و هدف اول ' + anFaNum(lite.targets[0]) : '') + '.');
    } else if (lite.baseScenario === 'short' && lite.shortBelow !== null) {
      out.push('سناریوی اصلی گزارش: فروش زیر ' + anFaNum(lite.shortBelow) + (lite.stopLoss ? ' با حد ضرر ' + anFaNum(lite.stopLoss) : '') + (lite.targets.length ? ' و هدف اول ' + anFaNum(lite.targets[0]) : '') + '.');
    }
    if (lite.week.avg !== null) out.push('چشم‌انداز هفته: میانگین ' + anFaNum(lite.week.avg) + ' در بازه ' + anFaNum(lite.week.low) + ' تا ' + anFaNum(lite.week.high) + '.');
  } else {
    out.push('پیش‌بینی LiteFinance در دسترس نبود — برای اعداد به پنل دماسنج و ساختار بازار تکیه کنید.');
  }
  if (fx && fx.ok && fx.poll.length) {
    var p = fx.poll[0];
    if (p.avg !== null || p.mixFa) out.push('نظرسنجی FXStreet برای ' + p.periodFa + ': میانگین ' + anFaNum(p.avg) + (p.mixFa ? ' — ترکیب رأی‌ها: ' + p.mixFa : '') + '.');
  }
  var bullish = [], bearish = [];
  if (tv && tv.ok && tv.stateFa) {
    if (tv.stateFa.indexOf('خرید') >= 0) bullish.push('تریدینگ‌ویو');
    else if (tv.stateFa.indexOf('فروش') >= 0) bearish.push('تریدینگ‌ویو');
  }
  if (lite && lite.ok && lite.baseScenario === 'long') bullish.push('LiteFinance');
  else if (lite && lite.ok && lite.baseScenario === 'short') bearish.push('LiteFinance');
  if (fx && fx.ok && fx.poll.length > 1 && fx.poll[1].mixFa) {
    if (fx.poll[1].mixFa.indexOf('صعودی') >= 0 && fx.poll[1].mixFa.indexOf('نزولی') < 0) bullish.push('نظرسنجی FXStreet ماهانه');
    else if (fx.poll[1].mixFa.indexOf('نزولی') >= 0 && fx.poll[1].mixFa.indexOf('صعودی') < 0) bearish.push('نظرسنجی FXStreet ماهانه');
  }
  if (bullish.length && bearish.length) out.push('جمع‌بندی: منابع هم‌راستا با خرید (' + bullish.join('، ') + ') و هم‌راستا با فروش (' + bearish.join('، ') + ') در برابر هم هستند — مسیر تا شکست سطوح کلیدی دوپهلو است.');
  else if (bullish.length >= 2) out.push('جمع‌بندی: ' + bullish.join('، ') + ' هم‌جهت با مسیر صعودی هستند — مراقب برگشت از سطوح مقاومت باشید.');
  else if (bearish.length >= 2) out.push('جمع‌بندی: ' + bearish.join('، ') + ' هم‌جهت با مسیر نزولی هستند — مراقب برگشت از سطوح حمایت باشید.');
  else out.push('جمع‌بندی: هم‌راستایی روشن بین منابع نیست — انتظار بازار رنج یا تردید را داشته باشید؛ نقشه مسیر در تب بعدی جزئیات را نشان می‌دهد.');
  return out;
}

var AN = { tab: 'brief', busy: false, err: null, br: null, pathBusy: false, path: null, pathErr: null };
var AN_BR_CACHE = { at: 0, data: null };
var AN_SNAPSHOT = null;
try { AN_SNAPSHOT = JSON.parse(document.getElementById('sd-snapshot-analysis').textContent); } catch (e) { AN_SNAPSHOT = null; }

function btLoadBriefing(force) {
  if (AN.busy) return;
  if (!force && AN_BR_CACHE.data && Date.now() - AN_BR_CACHE.at < 30 * 60 * 1000) {
    AN.br = AN_BR_CACHE.data;
    renderAnalysisApp(true);
    return;
  }
  AN.busy = true; AN.err = null;
  renderAnalysisApp(true);
  var LITE_URL = 'https://www.litefinance.org/blog/analysts-opinions/gold-price-prediction-forecast/daily-and-weekly/';
  var FX_URL = 'https://www.fxstreet.com/commodities/gold';
  var conf = BT_SYMS[BT.sym];
  Promise.allSettled([
    anFetchChain(LITE_URL),
    anFetchChain(FX_URL),
    conf.tv ? btTvTechnicals(conf.tv, '1d') : Promise.resolve(null)
  ]).then(function (rs) {
    var lite = { ok: false, via: '', reportedAtFa: null, baseScenario: null, baseScenarioFa: null, longAbove: null, shortBelow: null, stopLoss: null, targets: [], tomorrow: { low: null, avg: null, high: null }, week: { low: null, avg: null, high: null }, rsi: null };
    if (rs[0].status === 'fulfilled') {
      try { var pl = anParseLite(rs[0].value.text); pl.via = rs[0].value.via; lite = pl; } catch (e) { lite.error = 'پارس ناموفق'; }
    }
    var fx = { ok: false, via: '', poll: [], items: [] };
    if (rs[1].status === 'fulfilled') {
      try { var pf = anParseFx(rs[1].value.text); pf.via = rs[1].value.via; fx = pf; } catch (e) { fx.error = 'پارس ناموفق'; }
    }
    var tv = { ok: false, stateFa: null };
    if (rs[2].status === 'fulfilled' && rs[2].value) tv = { ok: true, stateFa: tvRatingStateFa(rs[2].value.all) };
    /* fallback per-source: هر بخش قطع‌شده از اسنپ‌شات تاریخ‌دار داخلی پر می‌شود */
    if (!lite.ok && AN_SNAPSHOT && AN_SNAPSHOT.lite && AN_SNAPSHOT.lite.ok) {
      lite = JSON.parse(JSON.stringify(AN_SNAPSHOT.lite));
      lite.snapshot = true;
    }
    if (!fx.ok && AN_SNAPSHOT && AN_SNAPSHOT.fx && AN_SNAPSHOT.fx.ok) {
      fx = JSON.parse(JSON.stringify(AN_SNAPSHOT.fx));
      fx.snapshot = true;
    }
    var anything = lite.ok || fx.ok || tv.ok;
    if (!anything && AN_SNAPSHOT) {
      var snap = AN_SNAPSHOT;
      var brSnap = {
        ok: true, stale: true, ageMin: null, generatedAtISO: snap.generatedAtISO || new Date().toISOString(),
        lite: snap.lite, fx: snap.fx, tv: { ok: false, stateFa: null },
        summaryFa: anSynthesize(snap.lite, snap.fx, null),
        sourcesNoteFa: 'حالت اسنپ‌شات: دریافت زنده از منابع ناموفق بود و آخرین نسخه ذخیره‌شده هنگام ساخت ابزار نمایش داده می‌شود — تاریخ گزارش‌ها را ببینید.'
      };
      AN_BR_CACHE = { at: Date.now(), data: brSnap };
      AN.br = brSnap;
      AN.busy = false;
      renderAnalysisApp(true);
      if (AN.tab === 'path' && !AN.pathBusy) btPathCompute();
      return;
    }
    var br = {
      ok: anything, stale: false, ageMin: 0,
      generatedAtISO: new Date().toISOString(),
      lite: lite, fx: fx, tv: tv,
      summaryFa: anything ? anSynthesize(lite, fx, tv) : [],
      sourcesNoteFa: 'منابع: LiteFinance (پیش‌بینی روزانه/هفتگی طلا) · FXStreet (تحلیل‌ها و نظرسنجی) · تریدینگ‌ویو (رأی فنی روزانه). دریافت از مرورگر شما با کمک پروکسی عمومی/آرشیو انجام می‌شود؛ زمان هر بخش جداگانه ذکر شده است.'
    };
    if (anything) AN_BR_CACHE = { at: Date.now(), data: br };
    AN.br = br;
    AN.busy = false;
    renderAnalysisApp(true);
    /* اگر تب نقشه مسیر باز است و بریفینگ تازه رسیده، نقشه را با رأی TV/LiteFinance تازه ترسیم کن */
    if (AN.tab === 'path' && !AN.pathBusy) btPathCompute();
  });
}

/* ================= نقشهٔ مسیر امروز (تلفیق منابع) ================= */

var PM_DIR_FA = { buy: 'خرید', sell: 'فروش', neutral: 'خنثی' };
function pmTrendDir(t) { return t === 'bullish' ? 'buy' : t === 'bearish' ? 'sell' : 'neutral'; }

function pmBuildPathMap(inp) {
  var sources = [];
  function push(id, labelFa, dir, detailFa, available) {
    sources.push({ id: id, labelFa: labelFa, dir: dir, detailFa: detailFa, available: available });
  }
  if (inp.thermo1d) push('thermo1d', 'دماسنج فشار — روزانه (' + (inp.thermo1d.source === 'tradingview' ? 'تریدینگ‌ویو' : 'محلی') + ')', inp.thermo1d.dir, inp.thermo1d.zoneFa + ' · عدد ' + anFaNum(inp.thermo1d.score), true);
  else push('thermo1d', 'دماسنج فشار — روزانه (تریدینگ‌ویو)', 'neutral', 'در دسترس نبود', false);
  if (inp.thermo4h) push('thermo4h', 'دماسنج فشار — ۴ ساعته (' + (inp.thermo4h.source === 'tradingview' ? 'تریدینگ‌ویو' : 'محلی') + ')', inp.thermo4h.dir, inp.thermo4h.zoneFa + ' · عدد ' + anFaNum(inp.thermo4h.score), true);
  else push('thermo4h', 'دماسنج فشار — ۴ ساعته (تریدینگ‌ویو)', 'neutral', 'در دسترس نبود', false);
  if (inp.structure4h) push('struct4h', 'ساختار بازار — ۴ ساعته', pmTrendDir(inp.structure4h), 'روند ' + BT_TREND_FA[inp.structure4h], true);
  else push('struct4h', 'ساختار بازار — ۴ ساعته', 'neutral', 'در دسترس نبود', false);
  if (inp.structure1d) push('struct1d', 'ساختار بازار — روزانه', pmTrendDir(inp.structure1d), 'روند ' + BT_TREND_FA[inp.structure1d], true);
  else push('struct1d', 'ساختار بازار — روزانه', 'neutral', 'در دسترس نبود', false);
  if (inp.tvDailyStateFa) {
    var tvd = inp.tvDailyStateFa.indexOf('خرید') >= 0 ? 'buy' : inp.tvDailyStateFa.indexOf('فروش') >= 0 ? 'sell' : 'neutral';
    push('tv', 'رأی فنی تریدینگ‌ویو — روزانه', tvd, inp.tvDailyStateFa, true);
  } else push('tv', 'رأی فنی تریدینگ‌ویو — روزانه', 'neutral', 'در دسترس نبود', false);
  if (inp.lite && inp.lite.baseScenario) push('lite', 'پیش‌بینی LiteFinance', inp.lite.baseScenario === 'long' ? 'buy' : 'sell', inp.lite.baseScenario === 'long' ? 'سناریوی اصلی گزارش: خرید' : 'سناریوی اصلی گزارش: فروش', true);
  else push('lite', 'پیش‌بینی LiteFinance', 'neutral', 'در دسترس نبود', false);
  if (inp.newsResolved) push('news', 'اخبار مهم امروز/فردا', inp.newsResolved.dir, inp.newsResolved.detailFa, true);
  else push('news', 'اخبار مهم امروز/فردا', 'neutral', 'خبر حل‌شده‌ای که جهت طلا را روشن کند نبود', false);

  var buy = 0, sell = 0, neutral = 0, i;
  for (i = 0; i < sources.length; i++) {
    if (!sources[i].available) continue;
    if (sources[i].dir === 'buy') buy++;
    else if (sources[i].dir === 'sell') sell++;
    else neutral++;
  }
  var total = sources.length;
  var dominant;
  if (inp.rangeActive || (neutral >= buy && neutral >= sell && buy === sell)) dominant = 'range';
  else if (buy > sell) dominant = 'bull';
  else if (sell > buy) dominant = 'bear';
  else dominant = 'range';
  var dominantVotes = dominant === 'bull' ? buy : dominant === 'bear' ? sell : neutral;
  var confidenceFa = dominantVotes >= 5 ? 'هم‌راستایی قوی' : dominantVotes >= 4 ? 'هم‌راستایی متوسط' : 'هم‌راستایی ضعیف — مسیر دوپهلوست';
  var dominantFa = dominant === 'bull' ? 'مسیر غالب: صعودی' : dominant === 'bear' ? 'مسیر غالب: نزولی' : 'مسیر غالب: رنج/انتظار';

  var res = inp.resistance, sup = inp.support;
  var liteHigh = inp.lite && inp.lite.tomorrowHigh !== undefined ? inp.lite.tomorrowHigh : null;
  var liteLow = inp.lite && inp.lite.tomorrowLow !== undefined ? inp.lite.tomorrowLow : null;
  var bullStrength = dominant === 'bull' ? confidenceFa + ' (' + faDigits(buy) + ' از ' + faDigits(total) + ' منبع با خرید هم‌راستا)' : 'هم‌راستایی ضعیف (' + faDigits(buy) + ' از ' + faDigits(total) + ' منبع)';
  var bearStrength = dominant === 'bear' ? confidenceFa + ' (' + faDigits(sell) + ' از ' + faDigits(total) + ' منبع با فروش هم‌راستا)' : 'هم‌راستایی ضعیف (' + faDigits(sell) + ' از ' + faDigits(total) + ' منبع)';
  var rangeStrength = inp.rangeActive && inp.rangeSeverity === 'tight' ? 'هشدار رنج فشرده فعال است — آمار نوسان پایین است' : faDigits(neutral + (inp.rangeActive ? 0 : 1)) + ' نشانهٔ خنثی/رنج از ' + faDigits(total) + ' منبع';

  var scenarios = [
    {
      id: 'bull', titleFa: 'مسیر صعودی', strengthFa: bullStrength,
      triggerFa: res !== null ? 'تثبیت یک کندل بالای مقاومت ' + anFaNum(res) : 'تثبیت بالای سقف محدودهٔ اخیر',
      invalidateFa: sup !== null ? 'شکست و تثبیت زیر حمایت ' + anFaNum(sup) : 'شکست کف محدودهٔ اخیر',
      targetsFa: liteHigh !== null ? 'هدف مسیر (پیش‌بینی LiteFinance برای فردا): ' + anFaNum(liteHigh) : null,
      noteFa: dominant === 'bull' ? 'بیشتر منابع با خرید هم‌راستا هستند — در این سناریو خرید در اصلاح به سمت حمایت/ناحیهٔ ورود، کم‌ریسک‌تر از تعقیب قیمت است.' : 'این سناریو فعال می‌شود فقط اگر محرک بالا رخ دهد — پیش از تثبیت، پیش‌دستی نکنید.'
    },
    {
      id: 'bear', titleFa: 'مسیر نزولی', strengthFa: bearStrength,
      triggerFa: sup !== null ? 'شکست و تثبیت زیر حمایت ' + anFaNum(sup) : 'شکست کف محدودهٔ اخیر',
      invalidateFa: res !== null ? 'برگشت و تثبیت بالای مقاومت ' + anFaNum(res) : 'برگشت بالای سقف محدودهٔ اخیر',
      targetsFa: liteLow !== null ? 'هدف مسیر (پیش‌بینی LiteFinance برای فردا): ' + anFaNum(liteLow) : null,
      noteFa: dominant === 'bear' ? 'بیشتر منابع با فروش هم‌راستا هستند — در این سناریو فروش در برگشت به سمت مقاومت، کم‌ریسک‌تر از فروش در کف است.' : 'این سناریو فعال می‌شود فقط اگر محرک بالا رخ دهد — پیش از شکست واقعی، فروش نکنید.'
    },
    {
      id: 'range', titleFa: 'مسیر رنج / تردید', strengthFa: rangeStrength,
      triggerFa: sup !== null && res !== null ? 'نوسان بین ' + anFaNum(sup) + ' و ' + anFaNum(res) + ' ادامه یابد' : 'بازار در محدودهٔ اخیر بماند',
      invalidateFa: sup !== null && res !== null ? 'شکست هر یک از دو مرز ' + anFaNum(sup) + ' یا ' + anFaNum(res) + ' با کندل قوی' : 'خروج قوی از محدودهٔ اخیر',
      targetsFa: sup !== null && res !== null ? 'لبه‌های محدوده: کف ' + anFaNum(sup) + ' — سقف ' + anFaNum(res) : null,
      noteFa: inp.rangeActive && inp.rangeSeverity === 'tight' ? 'رنج فشرده معمولاً پیش از حرکت بزرگ است — ورود وسط محدوده توصیه نمی‌شود؛ صبر کنید بازار مسیر را انتخاب کند.' : 'در رنج، خرید نزدیک کف و فروش نزدیک سقف (با تثبیت برگشتی) منطقی است؛ وسط محدوده معامله نکنید.'
    }
  ];
  return {
    sources: sources,
    alignment: { buy: buy, sell: sell, neutral: neutral, total: total },
    dominant: dominant, dominantFa: dominantFa, confidenceFa: confidenceFa,
    scenarios: scenarios,
    noteFa: 'نقشهٔ مسیر، هم‌راستایی منابع ابزار را در سه سناریو خلاصه می‌کند — پیش‌بینی قطعی نیست و توصیهٔ خرید/فروش نیست؛ محرک و ابطال هر سناریو را در چارت خودتان بررسی کنید.'
  };
}

function btThermoLocalFor(tf) {
  var key = BT.sym + ':' + tf;
  if (BT_PT_CACHE.data && BT_PT_CACHE.key === key) return Promise.resolve(BT_PT_CACHE.data);
  var conf = BT_SYMS[BT.sym];
  var def = PT_TFS[tf] || PT_TFS['1d'];
  function localCompute() {
    var minBars = def.agg4h ? 60 : 200;
    return btFetchSeries(conf.yahoo, def.range, def.interval).then(function (ser) {
      if (!ser || ser.c.length < minBars) throw new Error('thin');
      var out = ser;
      if (def.agg4h) out = thAggregate4h(ser, thH4Phase());
      var d = thCompute(out);
      d.tf = tf; d.tfLabel = def.label; d.symName = conf.name; d.atISO = new Date().toISOString();
      d.source = 'local'; d.sourceNoteFa = 'منبع رأی: موتور محلی (تریدینگ‌ویو در دسترس نبود)';
      BT_PT_CACHE = { at: Date.now(), key: key, data: d };
      return d;
    }).catch(function () { return null; });
  }
  /* اول تریدینگ‌ویو (CORS باز — مستقیم)؛ در نبود آن، موتور محلی روی کندل‌های پروکسی */
  if (!conf.tv) return localCompute();
  return btTvTechnicals(conf.tv, tf).then(function (tv) {
    if (tv) return btThermoFromTv(conf, tv, tf, def.label);
    return localCompute();
  }).catch(function () { return localCompute(); });
}

function anNewsResolved() {
  var evs = (typeof news !== 'undefined' && news && news.events) ? news.events : [];
  var now = Date.now(), buy = 0, sell = 0, resolved = 0;
  for (var i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (e.impact !== 'High' || !e.dateISO || !e.actual || !e.forecast) continue;
    var t = new Date(e.dateISO).getTime();
    if (!isFinite(t) || t < now - 36 * 3600000 || t > now + 36 * 3600000) continue;
    function numFrom(s) { var n = Number(String(s).replace(/[,%\s]/g, '')); return isFinite(n) ? n : null; }
    var a = numFrom(e.actual), f = numFrom(e.forecast);
    if (a === null || f === null || a === f) continue;
    var d = a > f ? e.xauAbove : e.xauBelow;
    if (!d) continue;
    resolved++;
    if (d === 'bullish') buy++;
    else if (d === 'bearish') sell++;
  }
  if (!resolved) return null;
  var dir = buy > sell ? 'buy' : sell > buy ? 'sell' : 'neutral';
  var detailFa = dir === 'neutral'
    ? faDigits(resolved) + ' خبر مهم امروز/فردا منتشر شد — اثر خنثی یا دووجهی بر طلا'
    : faDigits(resolved) + ' خبر مهم حل‌شده — بیشترشان متمایل به ' + (dir === 'buy' ? 'تقویت' : 'تضعیف') + ' طلا بود';
  return { dir: dir, detailFa: detailFa };
}

function anHotHours() {
  var evs = (typeof news !== 'undefined' && news && news.events) ? news.events : [];
  var now = Date.now(), out = [];
  var withT = [];
  for (var i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (e.impact !== 'High' || !e.dateISO) continue;
    var t = new Date(e.dateISO).getTime();
    if (!isFinite(t) || t < now - 6 * 3600000 || t > now + 36 * 3600000) continue;
    withT.push({ e: e, t: t });
  }
  withT.sort(function (a, b) { return a.t - b.t; });
  for (var k = 0; k < withT.length && k < 4; k++) {
    out.push({ timeFa: faTime(new Date(withT[k].t)), titleFa: withT[k].e.titleFa || withT[k].e.title });
  }
  return out;
}

function btPathCompute() {
  if (AN.pathBusy) return;
  AN.pathBusy = true; AN.pathErr = null;
  renderAnalysisApp(true);
  var conf = BT_SYMS[BT.sym];
  var symRow = typeof ms !== 'undefined' && ms && ms[BT.sym] ? ms[BT.sym] : null;
  var row4h = btRowOf(BT.sym, '4h'), row1d = btRowOf(BT.sym, '1d');
  var structure4h = BT.data && BT.data.structure4h ? BT.data.structure4h : (row4h && row4h.trend ? row4h.trend : null);
  var structure1d = row1d && row1d.trend ? row1d.trend : null;
  var price = BT.data && BT.data.price ? BT.data.price : (symRow && symRow.price ? symRow.price : null);
  var support = BT.data && BT.data.ll ? BT.data.ll : null;
  var resistance = BT.data && BT.data.hh ? BT.data.hh : null;
  var rangeActive = !!(BT.data && BT.data.rangeWarning && BT.data.rangeWarning.active);
  var rangeSeverity = BT.data && BT.data.rangeWarning ? BT.data.rangeWarning.severity : null;
  var newsResolved = anNewsResolved();
  if (!AN.br && !AN.busy) btLoadBriefing(false);
  Promise.all([
    btThermoLocalFor('1d'),
    btThermoLocalFor('4h'),
    AN.br ? Promise.resolve(AN.br) : Promise.resolve(null)
  ]).then(function (rs) {
    var br = rs[2];
    var inp = {
      price: price, support: support, resistance: resistance,
      structure4h: structure4h, structure1d: structure1d,
      rangeActive: rangeActive, rangeSeverity: rangeSeverity,
      thermo1d: rs[0] ? { dir: rs[0].dir, zoneFa: rs[0].zoneFa, score: rs[0].score, source: rs[0].source } : null,
      thermo4h: rs[1] ? { dir: rs[1].dir, zoneFa: rs[1].zoneFa, score: rs[1].score, source: rs[1].source } : null,
      tvDailyStateFa: br && br.tv && br.tv.ok ? br.tv.stateFa : null,
      lite: br && br.lite && br.lite.ok && br.lite.baseScenario ? { baseScenario: br.lite.baseScenario, tomorrowHigh: br.lite.tomorrow.high, tomorrowLow: br.lite.tomorrow.low } : null,
      newsResolved: newsResolved
    };
    AN.path = pmBuildPathMap(inp);
    AN.path.hotHours = anHotHours();
    AN.pathBusy = false;
    renderAnalysisApp(true);
  });
}
