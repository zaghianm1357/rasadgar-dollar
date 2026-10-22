/* ================= اپ‌های تمام‌صفحه ================= */

/* ---------- وضعیت اپ اخبار ---------- */
var NEWS_TAB_KEY = 'sd_news_tab_v1';
var S_NEWS = { tab: 'today', filter: 'all' };
try {
  var _t = lsGet(NEWS_TAB_KEY);
  if (_t && ['today', 'tomorrow', 'week', 'all'].indexOf(_t) >= 0) S_NEWS.tab = _t;
} catch (e) {}

var IMPACT_META = {
  High: { label: 'اهمیت بالا', cls: 'impH', ic: 'flame' },
  Medium: { label: 'اهمیت متوسط', cls: 'impM', ic: 'sigM' },
  Low: { label: 'اهمیت کم', cls: 'impL', ic: 'sigL' },
  Holiday: { label: 'تعطیلات', cls: 'impO', ic: 'calOff' }
};
var CURRENCY_FA = {
  USD: 'دلار آمریکا', EUR: 'یورو', GBP: 'پوند انگلیس', JPY: 'ین ژاپن',
  CAD: 'دلار کانادا', AUD: 'دلار استرالیا', NZD: 'دلار نیوزیلند',
  CHF: 'فرانک سوئیس', CNY: 'یوان چین', ALL: 'چند کشور'
};
function currencyFa(c) { return CURRENCY_FA[(c || '').toUpperCase()] || (c || ''); }
var DIR_META = {
  bullish: { label: 'افزایشی — تقویت دلار', cls: 'bull', ic: 'trendUp' },
  bearish: { label: 'کاهشی — تضعیف دلار', cls: 'bear', ic: 'trendDown' },
  mixed: { label: 'تأثیر دووجهی', cls: 'neut', ic: 'moveH' },
  neutral: { label: 'بدون تأثیر مستقیم', cls: 'na', ic: 'minus' }
};
var CMP_TEXT = {
  above: 'پیش‌بینی بالاتر از مقدار قبلی است → سناریوی «داده قوی‌تر» محتمل‌تر',
  below: 'پیش‌بینی پایین‌تر از مقدار قبلی است → سناریوی «داده ضعیف‌تر» محتمل‌تر',
  equal: 'پیش‌بینی برابر مقدار قبلی است → دو سناریو هم‌وزن'
};
function dirChipHTML(v) {
  if (v === 'bullish') return '<span class="chip bull">' + icon('trendUp', 12) + 'افزایش</span>';
  if (v === 'bearish') return '<span class="chip bear">' + icon('trendDown', 12) + 'کاهش</span>';
  if (v === 'mixed') return '<span class="chip neut">' + icon('moveH', 12) + 'دووجهی</span>';
  return '<span class="chip na">' + icon('minus', 12) + 'خنثی</span>';
}
function probLineHTML(label, up) {
  if (up == null) return '';
  var upPct = Math.round(up * 100), dn = 100 - upPct;
  if (upPct >= dn) {
    return '<p class="prob-l"><span class="prob-k">' + label + ':</span><b class="prob-up">افزایش ' + faDigits(upPct) + '٪</b><span class="prob-alt">/ کاهش ' + faDigits(dn) + '٪</span></p>';
  }
  return '<p class="prob-l"><span class="prob-k">' + label + ':</span><b class="prob-dn">کاهش ' + faDigits(dn) + '٪</b><span class="prob-alt">/ افزایش ' + faDigits(upPct) + '٪</span></p>';
}
function vchipHTML(label, value, hi) {
  return '<div class="vchip' + (hi ? ' hi' : '') + '"><span class="vchip-k">' + label + '</span><span class="vchip-v">' + faDigits(value) + '</span></div>';
}
function impactTableHTML(e) {
  var out = e.outlook;
  var prob = '';
  if (out && out.xauUp != null && out.djiUp != null) {
    prob = '<div class="aimp-prob">' +
      '<span class="prob-t">احتمال برآوردی (بر اساس پیش‌بینی)</span>' +
      probLineHTML('طلا', out.xauUp) +
      probLineHTML('داوجونز', out.djiUp) +
      (out.cmp ? '<span class="prob-note">' + CMP_TEXT[out.cmp] + ' — برآورد تقریبی، نه سیگنال معاملاتی.</span>' : '') +
      '</div>';
  } else {
    prob = '<div class="aimp-prob"><span class="prob-note">برای این خبر پیش‌بینی عددی ثبت نشده؛ احتمال‌دهی مقدور نیست.</span></div>';
  }
  return '<div class="aimp">' +
    '<div class="aimp-h">' + icon('table', 14) + '<span>تأثیر بر نمادها</span></div>' +
    '<table class="aimp-tbl"><thead><tr>' +
    '<th>نماد</th><th>خبر بالاتر از انتظار</th><th>خبر پایین‌تر از انتظار</th>' +
    '</tr></thead><tbody>' +
    '<tr><td><div class="a-name">طلا</div><div class="a-mono">XAUUSD</div></td><td>' + dirChipHTML(e.xauAbove) + '</td><td>' + dirChipHTML(e.xauBelow) + '</td></tr>' +
    '<tr><td><div class="a-name">داوجونز</div><div class="a-mono">DJ30</div></td><td>' + dirChipHTML(e.djiAbove) + '</td><td>' + dirChipHTML(e.djiBelow) + '</td></tr>' +
    '</tbody></table>' + prob + '</div>';
}
function eventCardHTML(e) {
  var impact = IMPACT_META[e.impact] || IMPACT_META.Low;
  var dir = e.direction ? DIR_META[e.direction] : null;
  var t = e.dateISO ? new Date(e.dateISO).getTime() : null;
  var isReleased = t != null && t <= Date.now();
  var warn = (!isReleased && t != null && (e.impact === 'High' || e.impact === 'Medium') && t - Date.now() < 3600000)
    ? '<p class="ev-warn">' + icon('alert', 14) + 'این خبر مهم کمتر از یک ساعت دیگر منتشر می‌شود؛ احتمال نوسان شدید در دلار، طلا و داو وجود دارد.</p>'
    : '';
  var vals = (e.previous || e.forecast || e.actual)
    ? '<div class="vchips">' + vchipHTML('قبلی', e.previous, false) + vchipHTML('پیش‌بینی', e.forecast, false) + vchipHTML('واقعی', e.actual, !!e.actual) + '</div>'
    : '';
  return '<article class="ev">' +
    '<div class="ev-top">' +
    '<span dir="ltr" class="ev-time">' + (e.dateISO ? faTime(new Date(e.dateISO)) : 'هم‌روز') + '</span>' +
    '<span class="chip ' + impact.cls + '">' + icon(impact.ic, 12) + impact.label + '</span>' +
    '<span class="chip cur">' + currencyFa(e.country) + '</span>' +
    (isReleased
      ? '<span class="chip st">' + icon('checkCircle', 12) + 'منتشر شد</span>'
      : (t != null ? '<span class="chip st">' + icon('hourglass', 12) + 'در انتظار انتشار</span>' : '')) +
    (dir ? '<span class="chip ' + dir.cls + ' ms-auto">' + icon(dir.ic, 14) + dir.label + '</span>' : '') +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;min-width:0">' +
    (e.titleFa
      ? '<h3 class="ev-title">' + e.titleFa + '</h3>'
      : '<h3 class="ev-title" style="color:var(--mutedfg)">' + icon('langs', 16) + ' در نوبت ترجمه هوشمند...</h3>') +
    '<p dir="ltr" class="ev-en">' + e.title + '</p>' +
    (e.explanationFa ? '<div class="ev-exp"><p>' + e.explanationFa + '</p></div>' : '') +
    vals +
    '</div>' +
    impactTableHTML(e) +
    warn +
    '</article>';
}
function statCardHTML(icname, accent, k, v, s) {
  return '<div class="card stat">' +
    '<span class="tile ' + accent + '">' + icon(icname, 16) + '</span>' +
    '<div style="min-width:0;flex:1"><p class="stat-k">' + k + '</p><p class="stat-v">' + v + '</p>' + (s ? '<p class="stat-s">' + s + '</p>' : '') + '</div>' +
    '</div>';
}
function cdLong(msLeft) {
  var totalMin = Math.max(0, Math.floor(msLeft / 60000));
  var h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return faDigits(m) + ' دقیقه دیگر';
  if (m === 0) return faDigits(h) + ' ساعت دیگر';
  return faDigits(h) + ' ساعت و ' + faDigits(m) + ' دقیقه دیگر';
}
function dayLabel(key) {
  var tKey = todayKeyInTehran();
  var p = key.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2], 12);
  if (key === tKey) return 'امروز — ' + faDateLong(d);
  if (key === addDaysToKey(tKey, 1)) return 'فردا — ' + faDateLong(d);
  return faDateLong(d);
}
function newsGroups() {
  var tKey = todayKeyInTehran();
  var map = {}, order = [];
  var evs = news.events || [];
  for (var i = 0; i < evs.length; i++) {
    var e = evs[i];
    var f = S_NEWS.filter;
    var ok = f === 'all' || (f === 'High' ? e.impact === 'High' : f === 'Medium' ? e.impact === 'Medium' : (e.impact === 'Low' || e.impact === 'Holiday'));
    if (!ok) continue;
    var k = e.dateISO ? dateKeyInTehran(new Date(e.dateISO)) : tKey;
    if (!map[k]) { map[k] = []; order.push(k); }
    map[k].push(e);
  }
  order.sort();
  if (S_NEWS.tab === 'today') order = order.filter(function (k) { return k === tKey; });
  else if (S_NEWS.tab === 'tomorrow') order = order.filter(function (k) { return k === addDaysToKey(tKey, 1); });
  else if (S_NEWS.tab === 'week') {
    var a = addDaysToKey(tKey, -6), b = addDaysToKey(tKey, 6);
    order = order.filter(function (k) { return k >= a && k <= b; });
  }
  order.forEach(function (k) {
    map[k].sort(function (x, y) {
      return (x.dateISO ? new Date(x.dateISO).getTime() : -1) - (y.dateISO ? new Date(y.dateISO).getTime() : -1);
    });
  });
  return order.map(function (k) { return [k, map[k]]; });
}
function renderNewsApp() {
  var groups = newsGroups();
  var c = todayCounts();
  var nx = nextHighEvent();
  var gen = GEN_ISO ? new Date(GEN_ISO) : new Date();
  var tabs = [['today', 'امروز'], ['tomorrow', 'فردا'], ['week', 'این هفته'], ['all', 'همه']];
  var chips = [['all', 'همه'], ['High', 'خیلی مهم'], ['Medium', 'متوسط'], ['low', 'کم‌اهمیت']];
  var html = '<div class="app-pad">';

  if (news.digest) {
    html += '<div class="card card-p digest">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' + icon('sparkles', 16) + '<h2 class="digest-t">خلاصه روزانه هوشمند</h2></div>' +
      '<p class="digest-p">' + news.digest + '</p></div>';
  }

  html += '<div class="stats">' +
    statCardHTML('calDays', 'p', 'اخبار امروز (دلار و ارزهای اصلی)', faDigits(c.count) + ' خبر', faDigits(c.high) + ' خبر با اهمیت بالا') +
    statCardHTML('flame', 'a', 'تا خبر مهم بعدی', nx ? cdLong(new Date(nx.dateISO).getTime() - Date.now()) : 'خبر مهمی نیست', nx ? (currencyFa(nx.country) + ' — ' + (nx.titleFa || nx.title)) : '') +
    statCardHTML('radio', 'n', 'وضعیت داده', 'اسنپ‌شات داخل فایل', 'تولید فایل: ' + faDateLong(gen) + ' — ' + faTime(gen)) +
    '</div>';

  html += '<div style="display:flex;flex-direction:column;gap:10px">' +
    '<div class="tabs-list">' + tabs.map(function (t) {
      return '<button type="button" class="tab' + (S_NEWS.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="fchips">' + chips.map(function (f) {
      var on = (settings.highOnly ? 'High' : S_NEWS.filter) === f[0];
      return '<button type="button" class="fchip' + (on ? ' on' : '') + '" data-filter="' + f[0] + '" aria-pressed="' + on + '">' + f[1] + '</button>';
    }).join('') + '</div></div>';

  if ((news.pendingTranslation || 0) > 0) {
    html += '<div class="pending-note">' + icon('langs', 16) + '<span>' + faDigits(news.pendingTranslation) + ' خبر در نوبت ترجمه هوشمند بود در لحظه تولید فایل.</span></div>';
  }

  if (!groups.length) {
    html += '<div class="empty">' + icon('inbox', 28) +
      '<p>' + (S_NEWS.tab === 'today' ? 'برای امروز خبری از دلار و ارزهای اصلی ثبت نشده است (مثلاً روزهای تعطیلی بازار).' : 'در این بازه خبری برای نمایش نیست. بازه یا فیلتر را تغییر دهید.') + '</p>' +
      (S_NEWS.tab === 'today' ? '<button type="button" class="btn" data-goweek>' + icon('calDays', 14) + 'مشاهده این هفته</button>' : '') +
      '</div>';
  } else {
    groups.forEach(function (g) {
      html += '<section style="display:flex;flex-direction:column;gap:10px">' +
        '<div class="day-h"><h2>' + dayLabel(g[0]) + '</h2><span class="day-line"></span><span class="day-n">' + faDigits(g[1].length) + ' خبر</span></div>' +
        g[1].map(eventCardHTML).join('') +
        '</section>';
    });
  }

  html += '<p style="text-align:center;font-size:9px;color:rgba(160,170,180,.7);margin:0">داده‌های خبری ثابت‌اند (اسنپ‌شات ' + faDateLong(gen) + ') — قیمت‌ها از مرکز کنترل قابل بروزرسانی زنده‌اند.</p>';
  html += '</div>';
  appScroll.innerHTML = html;

  var tabsEls = appScroll.querySelectorAll('[data-tab]');
  for (var i = 0; i < tabsEls.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        S_NEWS.tab = b.dataset.tab;
        lsSet(NEWS_TAB_KEY, S_NEWS.tab);
        renderNewsApp();
        appScroll.scrollTop = 0;
      });
    })(tabsEls[i]);
  }
  var chipEls = appScroll.querySelectorAll('[data-filter]');
  for (var j = 0; j < chipEls.length; j++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (settings.highOnly) { settings.highOnly = false; saveSettings(); }
        S_NEWS.filter = b.dataset.filter;
        renderNewsApp();
      });
    })(chipEls[j]);
  }
  var gw = appScroll.querySelector('[data-goweek]');
  if (gw) gw.addEventListener('click', function () { S_NEWS.tab = 'week'; lsSet(NEWS_TAB_KEY, 'week'); renderNewsApp(); });
}

/* ---------- پیشنهاد معامله ---------- */
var SUG = { st: '1h', en: '5m' };
/* تایم‌فریم‌های ساختار قابل انتخاب توسط کاربر — ۵ دقیقه هم اضافه شد (داده در اسنپ‌شات موجود است) */
var SUG_ST_TFS = ['5m', '15m', '1h', '4h', '1d', '1wk', '1mo'];
function sugStOptions() {
  return SUG_ST_TFS.map(function (tf) { return '<option value="' + tf + '"' + (SUG.st === tf ? ' selected' : '') + '>' + TF_LONG[tf] + '</option>'; }).join('');
}
function validEntries(st) {
  return ['5m', '15m', '1h', '4h'].filter(function (tf) { return TF_MINUTES[tf] <= TF_MINUTES[st]; });
}
function effectiveEntry() {
  var v = validEntries(SUG.st);
  return v.indexOf(SUG.en) >= 0 ? SUG.en : v[v.length - 1];
}
function msRow(symKey, tf) { return row(symKey, tf); }
function getVerdict(stT, enT) {
  if (!stT || !enT) return { key: 'wait', reason: 'داده یکی از دو تایم‌فریم ناکافی است' };
  if (stT === 'bullish' && enT === 'bullish') return { key: 'buy', reason: 'ساختار و ورود هر دو صعودی‌اند' };
  if (stT === 'bearish' && enT === 'bearish') return { key: 'sell', reason: 'ساختار و ورود هر دو نزولی‌اند' };
  if (stT === 'neutral' || enT === 'neutral') return { key: 'wait', reason: 'یکی از دو تایم‌فریم خنثی است' };
  return { key: 'wait', reason: 'جهت ساختار و ورود مخالف هم است' };
}
function sugChipHTML(label, t) {
  var cls = t ? trendChipCls(t) : 'na';
  var ic = t ? trendIcon(t) : 'minus';
  var txt = t ? trendText(t) : 'ناکافی';
  return '<span class="chip ' + cls + '">' + icon(ic, 12) + label + ': ' + txt + '</span>';
}
function sugCardHTML(name, mono, symKey) {
  var enTf = effectiveEntry();
  var stRow = row(symKey, SUG.st), enRow = row(symKey, enTf);
  var v = getVerdict(stRow ? stRow.trend : null, enRow ? enRow.trend : null);
  var meta = v.key === 'buy'
    ? { label: 'پیشنهاد خرید', cls: 'sugB', ic: 'trendUp' }
    : v.key === 'sell'
      ? { label: 'پیشنهاد فروش', cls: 'sugS', ic: 'trendDown' }
      : { label: 'صبر کنید', cls: 'sugW', ic: 'hourglass' };
  return '<div class="sug-card">' +
    '<div class="sug-card-top"><div style="min-width:0"><div style="font-size:12px;font-weight:700">' + name + '</div><div class="sym-mono">' + mono + '</div></div>' +
    '<span class="chip ' + meta.cls + '">' + icon(meta.ic, 14) + meta.label + '</span></div>' +
    '<div class="sug-chips">' +
    sugChipHTML('ساختار ' + TF_LONG[SUG.st], stRow ? stRow.trend : null) +
    sugChipHTML('ورود ' + TF_LONG[enTf], enRow ? enRow.trend : null) +
    '</div>' +
    '<p class="sug-reason">' + v.reason + '</p>' +
    '</div>';
}
function sugBoxHTML() {
  var enTf = effectiveEntry();
  var stOpts = sugStOptions();
  var enOpts = validEntries(SUG.st).map(function (tf) { return '<option value="' + tf + '"' + (enTf === tf ? ' selected' : '') + '>' + TF_LONG[tf] + '</option>'; }).join('');
  return '<div class="sug">' +
    '<div class="sug-head">' + icon('crosshair', 16) + '<span class="sug-t">پیشنهاد معامله</span><span class="sug-s">ترکیب تایم‌فریم ساختار و تایم‌فریم ورود</span></div>' +
    '<div class="sug-sels">' +
    '<div><span class="sel-k">تایم‌فریم ساختار</span><select class="sel" data-sug-st aria-label="تایم‌فریم ساختار">' + stOpts + '</select></div>' +
    '<div><span class="sel-k">تایم‌فریم ورود</span><select class="sel" data-sug-en aria-label="تایم‌فریم ورود">' + enOpts + '</select></div>' +
    '</div>' +
    '<p class="sug-logic">هر دو هم‌جهت صعودی ← خرید | هر دو هم‌جهت نزولی ← فروش | مخالف یا خنثی ← صبر کنید</p>' +
    '<div class="sug-cards">' + sugCardHTML('طلا', 'XAUUSD', 'xau') + sugCardHTML('داوجونز', 'DJI', 'dji') + '</div>' +
    '</div>';
}
function bindSug() {
  var st = appScroll.querySelector('[data-sug-st]'), en = appScroll.querySelector('[data-sug-en]');
  if (st) st.addEventListener('change', function () {
    SUG.st = st.value;
    if (validEntries(SUG.st).indexOf(SUG.en) < 0) {
      var ok = validEntries(SUG.st);
      SUG.en = ok[ok.length - 1];
    }
    var slot = appScroll.querySelector('.sug-slot');
    if (slot) { slot.innerHTML = sugBoxHTML(); bindSug(); }
  });
  if (en) en.addEventListener('change', function () { SUG.en = en.value; var slot = appScroll.querySelector('.sug-slot'); if (slot) { slot.innerHTML = sugBoxHTML(); bindSug(); } });
}

/* ---------- اپ ساختار بازار ---------- */
function symHeadHTML(key, title, mono) {
  var sym = ms[key];
  var ch = sym ? sym.changePct : null;
  return '<div class="sym-head"><div style="min-width:0"><div class="sym-n">' + title + '</div><div class="sym-mono">' + mono + '</div></div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end">' +
    (sym && sym.price != null ? '<span class="sym-p">' + faNum(sym.price) + '</span>' : '<span style="font-size:10px;color:var(--mutedfg)">—</span>') +
    (ch != null && sym && sym.price != null ? '<span class="sym-c ' + chgCls(ch) + '">' + faDigits((ch > 0 ? '+' : '') + ch.toFixed(2) + '%') + '</span>' : '') +
    '</div></div>';
}
function tfPillHTML(t) {
  if (!t) return '<span class="tf-pill na">' + icon('minus', 14) + 'ناکافی</span>';
  return '<span class="tf-pill ' + trendChipCls(t) + '">' + icon(trendIcon(t), 14) + trendText(t) + '</span>';
}
function tfCellHTML(r) {
  var strength = r && r.trend && r.trend !== 'neutral' && r.strength > 0
    ? '<span class="tf-str">قدرت ' + faDigits(r.strength) + '٪</span>' : '';
  var desc = r && r.trend != null
    ? '<span class="tf-desc">' + (r.ma === 'bullish' ? 'EMA صعودی' : r.ma === 'bearish' ? 'EMA نزولی' : r.ma === 'neutral' ? 'EMA خنثی' : '—') + ' · ' +
      (r.swing === 'bullish' ? 'سقف/کف بالاتر' : r.swing === 'bearish' ? 'سقف/کف پایین‌تر' : r.swing === 'neutral' ? 'ساختار مخلوط' : '—') + '</span>'
    : '';
  return '<td><div class="tf-cell">' + tfPillHTML(r ? r.trend : null) + strength + desc + '</div></td>';
}
function summaryHTML(symKey) {
  var sym = ms[symKey];
  if (!sym) return '';
  var b = 0, s = 0, n = 0;
  sym.rows.forEach(function (r) {
    if (r.trend === 'bullish') b++; else if (r.trend === 'bearish') s++; else if (r.trend === 'neutral') n++;
  });
  if (b + s + n === 0) return '';
  var dominant = b + s === 0 ? 'بدون روند غالب' : b === s ? 'روند مخلوط' : b > s ? 'غالب: صعودی' : 'غالب: نزولی';
  return '<p class="sum-line">جمع‌بندی: <b class="b">' + faDigits(b) + ' صعودی</b> · <b class="s">' + faDigits(s) + ' نزولی</b> · <b class="n">' + faDigits(n) + ' خنثی</b> — ' + dominant + '</p>';
}
function renderStructureApp() {
  var rows = '';
  for (var i = 0; i < TF_ORDER.length; i++) {
    var tf = TF_ORDER[i];
    rows += '<tr><td class="tf">' + TF_LONG[tf] + '</td>' + tfCellHTML(row('xau', tf)) + tfCellHTML(row('dji', tf)) + '</tr>';
  }
  var gen = GEN_ISO ? new Date(GEN_ISO) : new Date();
  appScroll.innerHTML = '<div class="app-pad">' +
    '<div class="card card-p" style="padding:12px 14px"><div class="ms-head">' +
    '<span class="tile p">' + icon('activity', 18) + '</span>' +
    '<div style="min-width:0;flex:1"><h2 class="ms-head-t">ساختار بازار (چند تایم‌فریمی)</h2><p class="ms-head-s">ترکیب میانگین متحرک EMA۲۰/۵۰ و سقف/کف‌های سوئینگ — ۶ تایم‌فریم</p></div>' +
    '<span class="badge snap" data-ms-badge>' + (priceState.mode === 'live' ? 'قیمت زنده' : 'اسنپ‌شات فایل') + '</span>' +
    '<button type="button" class="iconbtn" data-act="refresh-prices" aria-label="بروزرسانی قیمت‌ها"><span data-price-spin style="display:inline-flex">' + icon('refresh', 16) + '</span></button>' +
    '</div></div>' +
    '<div class="sym-heads">' + symHeadHTML('xau', 'طلا', 'XAUUSD · GC=F') + symHeadHTML('dji', 'داوجونز', 'DJI · ^DJI') + '</div>' +
    '<table class="ms-tbl"><thead><tr><th>تایم‌فریم</th><th>طلا — XAUUSD</th><th>داوجونز — DJI</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="display:flex;flex-direction:column;gap:4px">' + summaryHTML('xau') + summaryHTML('dji') + '</div>' +
    '<div class="sug-slot">' + sugBoxHTML() + '</div>' +
    '<p class="ms-note">روش تحلیل: رابطه EMA۲۰ و EMA۵۰ + موقعیت قیمت (امتیاز میانگین متحرک) به‌همراه مقایسه آخرین سقف‌ها و کف‌های سوئینگ HH/HL در برابر LH/LL (امتیاز ساختار) — مجموع ≥۲ صعودی، ≤−۲ نزولی، بین این دو خنثی. داده ساختار تا لحظه تولید فایل (' + faDateLong(gen) + ' — ' + faTime(gen) + ') است؛ دکمه بروزرسانی فقط قیمت‌های لحظه‌ای را تازه می‌کند. پیشنهاد معامله صرفاً ترکیب ساده جهت دو تایم‌فریم است و به هیچ عنوان سیگنال معاملاتی یا توصیه سرمایه‌گذاری نیست.</p>' +
    '</div>';
  bindSug();
  var rb = appScroll.querySelector('[data-act="refresh-prices"]');
  if (rb) rb.addEventListener('click', function () { refreshPrices(); });
}

/* ---------- اپ پیشنهاد معامله (مستقل) ---------- */
function renderSuggestionApp() {
  appScroll.innerHTML = '<div class="app-pad">' +
    '<div class="sug-slot">' + sugBoxHTML() + '</div>' +
    '<div data-sc-slot>' + scContentHTML(false, null) + '</div>' +
    '<p class="ms-note">بخش اول: ترکیب جهت تایم‌فریم ساختار و تایم‌فریم ورود (هر دو قابل انتخاب توسط شما). بخش دوم «پیشنهاد اسکلپ»: پورت اندیکاتور SBW + اوردر بلاک + ستاپ ۴ساعته + واگرایی روی کندل‌های زنده Yahoo — نماد و تایم‌فریم دلخواه را انتخاب کنید. داده بخش اول اسنپ‌شات لحظه تولید فایل است؛ پیشنهاد معامله سیگنال معاملاتی نیست.</p>' +
    '</div>';
  bindSug();
  renderScalpBox(false);
}

/* ---------- اپ چارت TradingView ---------- */
var CHART_KEY = 'sd_chart_v1';
var CHART_SYMS = [
  ['OANDA:XAUUSD', 'طلا — XAUUSD'],
  ['OANDA:XAGUSD', 'نقره — XAGUSD'],
  ['OANDA:EURUSD', 'یورو/دلار — EURUSD'],
  ['BINANCE:BTCUSDT', 'بیت‌کوین — BTC']
];
var CHART_TFS = [['5', '۵ دقیقه'], ['15', '۱۵ دقیقه'], ['60', '۱ ساعته'], ['240', '۴ ساعته'], ['D', 'روزانه']];
var S_CHART = { sym: 'OANDA:XAUUSD', tf: '15' };
try {
  var _c = JSON.parse(lsGet(CHART_KEY) || 'null');
  if (_c && typeof _c.sym === 'string' && _c.sym && typeof _c.tf === 'string') S_CHART = { sym: _c.sym, tf: _c.tf };
} catch (e) {}
function validChartTf(t) {
  for (var i = 0; i < CHART_TFS.length; i++) if (CHART_TFS[i][0] === t) return t;
  return '15';
}
S_CHART.tf = validChartTf(S_CHART.tf);

var TV_JS_SRC = 'https://s3.tradingview.com/tv.js';
var _tvPromise = null;
var chartLoaded = { key: null };
function tvReady() { return !!(window.TradingView && window.TradingView.widget); }
function ensureTVScript() {
  if (tvReady()) return Promise.resolve();
  if (_tvPromise) return _tvPromise;
  _tvPromise = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = TV_JS_SRC;
    s.async = true;
    s.onload = function () { tvReady() ? resolve() : reject(new Error('tv-broken')); };
    s.onerror = function () { reject(new Error('tv-network')); };
    document.head.appendChild(s);
    setTimeout(function () { if (!tvReady()) reject(new Error('tv-timeout')); }, 15000);
  });
  _tvPromise.catch(function () { _tvPromise = null; }); /* اجازه تلاش مجدد */
  return _tvPromise;
}
function chartShowError(el) {
  chartLoaded.key = null;
  el.innerHTML = '<div class="tv-state tv-error">' +
    '<span class="tv-err-ic">' + icon('wifi', 24) + '</span>' +
    '<p class="tv-err-t">اتصال به TradingView برقرار نشد</p>' +
    '<p class="tv-err-s">چارت به سرورهای TradingView وصل نمی‌شود؛ اتصال اینترنت یا VPN را بررسی کنید و دوباره تلاش کنید.</p>' +
    '<button type="button" class="btn" data-tv-retry>' + icon('refresh', 14) + 'تلاش مجدد</button>' +
    '</div>';
  var rb = el.querySelector('[data-tv-retry]');
  if (rb) rb.addEventListener('click', function () { window.loadChart(S_CHART.sym, S_CHART.tf); });
}
/* ساخت مجدد ویجت با نماد/تایم‌فریم جدید — از هر جای ابزار قابل صدازدن است: loadChart('OANDA:XAUUSD','60') */
function loadChart(symbol, interval) {
  var el = document.getElementById('tv_chart');
  if (!el) return; /* صفحه چارت باز نیست */
  S_CHART.sym = symbol || 'OANDA:XAUUSD';
  S_CHART.tf = validChartTf(interval || '15');
  lsSet(CHART_KEY, JSON.stringify(S_CHART));
  syncChartChips();
  aiSyncStale();
  var frame = S_CHART.sym + '@' + S_CHART.tf;
  if (chartLoaded.key === frame && el.querySelector('iframe')) return;
  chartLoaded.key = null;
  el.innerHTML = '<div class="tv-state tv-loading">در حال بارگذاری چارت TradingView…</div>';
  ensureTVScript().then(function () {
    el = document.getElementById('tv_chart');
    if (!el) return;
    el.innerHTML = ''; /* پاک کردن محتوای قبلی */
    new window.TradingView.widget({
      container_id: 'tv_chart',
      autosize: true,
      symbol: S_CHART.sym,
      interval: S_CHART.tf,
      theme: 'dark',
      timezone: 'Asia/Tehran',
      locale: 'en',
      allow_symbol_change: true,
      hide_side_toolbar: false
    });
    chartLoaded.key = S_CHART.sym + '@' + S_CHART.tf;
  }).catch(function () {
    el = document.getElementById('tv_chart');
    if (el) chartShowError(el);
  });
}
window.loadChart = loadChart;
function chartChipRowHTML(list, kind) {
  var cur = kind === 'sym' ? S_CHART.sym : S_CHART.tf;
  return list.map(function (it) {
    return '<button type="button" class="cchip' + (it[0] === cur ? ' on' : '') + '" data-ckind="' + kind + '" data-cval="' + it[0] + '">' + it[1] + '</button>';
  }).join('');
}
function syncChartChips() {
  var chips = appScroll.querySelectorAll('.cchip');
  for (var i = 0; i < chips.length; i++) {
    var c = chips[i];
    var on = c.dataset.cval === (c.dataset.ckind === 'sym' ? S_CHART.sym : S_CHART.tf);
    c.classList.toggle('on', on);
  }
}
function bindChartChips() {
  var chips = appScroll.querySelectorAll('.cchip');
  for (var i = 0; i < chips.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.ckind === 'sym') S_CHART.sym = b.dataset.cval;
        else S_CHART.tf = b.dataset.cval;
        window.loadChart(S_CHART.sym, S_CHART.tf);
      });
    })(chips[i]);
  }
}
function chartEnsureAuto() {
  if (chartLoaded.key === S_CHART.sym + '@' + S_CHART.tf && appScroll.querySelector('#tv_chart iframe')) return;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { window.loadChart(S_CHART.sym, S_CHART.tf); });
  });
}

/* ---------- تحلیل هوشمند (تب دستیار معامله‌گر — مستقل از چارت) ---------- */
var AI_KEY_STORE = 'sd_ai_v1';
var S_AI = { sym: 'OANDA:XAUUSD', tf: '15' };
function aiApply(sym, tf) {
  if (CHART_YAHOO[sym]) S_AI.sym = sym;
  if (CHART_ITV[tf]) S_AI.tf = tf;
  lsSet(AI_KEY_STORE, JSON.stringify(S_AI));
  aiSyncStale();
}
var CHART_YAHOO = {
  'OANDA:XAUUSD': { y: 'GC=F', name: 'طلا — XAUUSD' },
  'OANDA:XAGUSD': { y: 'SI=F', name: 'نقره — XAGUSD' },
  'OANDA:EURUSD': { y: 'EURUSD=X', name: 'یورو/دلار' },
  'BINANCE:BTCUSDT': { y: 'BTC-USD', name: 'بیت‌کوین' }
};
var CHART_ITV = {
  '5': { i: '5m', r: '5d', label: '۵ دقیقه', lb: 3, atr: [0.06, 0.15] },
  '15': { i: '15m', r: '5d', label: '۱۵ دقیقه', lb: 3, atr: [0.1, 0.25] },
  '60': { i: '1h', r: '3mo', label: '۱ ساعته', lb: 3, atr: [0.18, 0.45] },
  '240': { i: '1h', r: '6mo', label: '۴ ساعته', lb: 3, agg: 4, atr: [0.3, 0.8] },
  'D': { i: '1d', r: '1y', label: 'روزانه', lb: 2, atr: [0.7, 1.6] }
};
try {
  var _aiS = JSON.parse(lsGet(AI_KEY_STORE) || 'null');
  if (_aiS && CHART_YAHOO[_aiS.sym] && CHART_ITV[_aiS.tf]) S_AI = { sym: _aiS.sym, tf: _aiS.tf };
} catch (e) {}
var AI_TTL = 15 * 60 * 1000;
var AI_CACHE = {};
var AI_BUSY = false;
var AI_STATE = { key: null, text: '', at: null };
function aiKey() { return S_AI.sym + '@' + S_AI.tf; }
function aiTfLabel() { var c = CHART_ITV[S_AI.tf]; return c ? c.label : S_AI.tf; }
function aiPx(v) {
  var d = v >= 10 ? 2 : 4;
  return faDigits(Number(v).toLocaleString('en-US', { maximumFractionDigits: d })).replace(/,/g, '٬');
}
function fetchYahooOHLC(cfg, itv) {
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(cfg.y) + '?interval=' + itv.i + '&range=' + itv.r;
  var i = 0;
  function attempt() {
    if (i >= PROXIES.length) return Promise.reject(new Error('proxy-fail'));
    var p = PROXIES[i++];
    return fetchJSON(p(u), 11000).then(function (j) {
      var r = j && j.chart && j.chart.result && j.chart.result[0];
      var q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
      if (!r || !q || !q.close || !r.timestamp || q.close.length < 60) throw new Error('bad-payload');
      var px = { t: [], o: [], h: [], l: [], c: [] };
      for (var k = 0; k < q.close.length; k++) {
        if (q.close[k] == null || q.open[k] == null || q.high[k] == null || q.low[k] == null) continue;
        px.t.push(r.timestamp[k]); px.o.push(q.open[k]); px.h.push(q.high[k]); px.l.push(q.low[k]); px.c.push(q.close[k]);
      }
      if (px.c.length < 60) throw new Error('thin');
      return px;
    }).catch(function () { return attempt(); });
  }
  return attempt();
}
function aggBars(px, n) {
  var out = { t: [], o: [], h: [], l: [], c: [] }, key = null;
  for (var i = 0; i < px.c.length; i++) {
    var d = new Date(px.t[i] * 1000);
    var b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(d.getUTCHours() / n));
    if (b !== key) {
      key = b;
      out.t.push(px.t[i]); out.o.push(px.o[i]); out.h.push(px.h[i]); out.l.push(px.l[i]); out.c.push(px.c[i]);
    } else {
      var j = out.c.length - 1;
      out.h[j] = Math.max(out.h[j], px.h[i]);
      out.l[j] = Math.min(out.l[j], px.l[i]);
      out.c[j] = px.c[i];
    }
  }
  return out;
}
function emaLast(vals, n) {
  if (!vals || vals.length < n + 5) return null;
  var k = 2 / (n + 1), sum = 0;
  for (var i = 0; i < n; i++) sum += vals[i];
  var e = sum / n;
  for (var i = n; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}
function rsiLast(c, n) {
  if (!c || c.length < n + 1) return null;
  var g = 0, l = 0, d, i;
  for (i = 1; i <= n; i++) { d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  var ag = g / n, al = l / n;
  for (i = n + 1; i < c.length; i++) {
    d = c[i] - c[i - 1];
    ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n;
    al = (al * (n - 1) + (d < 0 ? -d : 0)) / n;
  }
  if (al === 0) return ag === 0 ? 50 : 100;
  return 100 - 100 / (1 + ag / al);
}
function atrPct(h, l, c, n) {
  if (!c || c.length < n + 1) return null;
  var trs = [], i;
  for (i = 1; i < c.length; i++) trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  var a = 0;
  for (i = 0; i < n; i++) a += trs[i];
  a /= n;
  for (i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n;
  return a / c[c.length - 1] * 100;
}
function findSwings(h, l, lb) {
  var hs = [], ls = [], i, k, ph, pl;
  for (i = lb; i < h.length - lb; i++) {
    ph = true; pl = true;
    for (k = 1; k <= lb; k++) {
      if (h[i] < h[i - k] || h[i] < h[i + k]) ph = false;
      if (l[i] > l[i - k] || l[i] > l[i + k]) pl = false;
      if (!ph && !pl) break;
    }
    if (ph) hs.push({ i: i, v: h[i] });
    if (pl) ls.push({ i: i, v: l[i] });
  }
  return { hs: hs, ls: ls };
}
function buildAiText(px, itv) {
  var c = px.c, n = c.length, last = c[n - 1], i;
  var e20 = emaLast(c, 20), e50 = emaLast(c, 50);
  var rsi = rsiLast(c, 14);
  var atr = atrPct(px.h, px.l, c, 14);
  var sw = findSwings(px.h, px.l, itv.lb);
  var sh = sw.hs.length ? sw.hs[sw.hs.length - 1] : null;
  var shp = sw.hs.length > 1 ? sw.hs[sw.hs.length - 2] : null;
  var sl = sw.ls.length ? sw.ls[sw.ls.length - 1] : null;
  var slp = sw.ls.length > 1 ? sw.ls[sw.ls.length - 2] : null;
  var look = Math.min(20, n), hh = -Infinity, ll = Infinity, bull = 0;
  for (i = n - look; i < n; i++) {
    if (px.h[i] > hh) hh = px.h[i];
    if (px.l[i] < ll) ll = px.l[i];
    if (c[i] >= px.o[i]) bull++;
  }
  var ratio = Math.round(bull / look * 100);
  var maScore = 0;
  if (e20 != null) maScore += last > e20 ? 1 : -1;
  if (e20 != null && e50 != null) maScore += e20 > e50 ? 1 : -1;
  var swScore = 0;
  if (sh && shp) swScore += sh.v > shp.v ? 1 : -1;
  if (sl && slp) swScore += sl.v > slp.v ? 1 : -1;
  var total = maScore + swScore;
  var dir = total >= 2 ? 'صعودی' : total <= -2 ? 'نزولی' : 'خنثی';
  var strg = Math.round(Math.abs(total) / 4 * 100);
  var e20txt = e20 == null ? '' : 'قیمت ' + (last > e20 ? 'بالای' : 'زیرِ') + ' EMA۲۰' + (e50 == null ? '' : ' و ' + (last > e50 ? 'بالای' : 'زیرِ') + ' EMA۵۰') + ' معامله می‌شود؛';
  var rsiTxt = rsi == null ? '' : ' شاخص قدرت نسبی (RSI۱۴) روی ' + faDigits(String(Math.round(rsi))) + ' است' + (rsi >= 70 ? ' — ناحیه اشباع خرید؛ احتمال تعدیل کوتاه‌مدت بیشتر می‌شود.' : rsi <= 30 ? ' — ناحیه اشباع فروش؛ احتمال واکنش صعودی بیشتر می‌شود.' : ' — ناحیه نرمال؛ فشار یک‌طرفه شدید نیست.');
  var bosTxt = 'شکست ساختاری (BOS) جدیدی ثبت نشده است؛ رفتار قیمت داخل محدوده سقف/کف سوئینگ است.';
  if (sh && last > sh.v) bosTxt = 'قیمت بالای آخرین سقف سوئینگ (' + aiPx(sh.v) + ') معامله می‌شود — BOS صعودی؛ تا زمانی که زیر آن برنگردد، ساختار صعودی معتبر است.';
  else if (sl && last < sl.v) bosTxt = 'قیمت زیر آخرین کف سوئینگ (' + aiPx(sl.v) + ') معامله می‌شود — BOS نزولی؛ تا بازگشت بالای آن، ساختار نزولی معتبر است.';
  var stTxt = 'ترکیب سقف/کف‌های سوئینگ بی‌جهت است.';
  if (sh && shp && sl && slp) {
    if (sh.v > shp.v && sl.v > slp.v) stTxt = 'سقف‌ها و کف‌های بالاتر (HH/HL) — ساختار تداومی صعودی.';
    else if (sh.v < shp.v && sl.v < slp.v) stTxt = 'سقف‌ها و کف‌های پایین‌تر (LH/LL) — ساختار تداومی نزولی.';
    else if (sh.v > shp.v) stTxt = 'سقف بالاتر ولی کف پایین‌تر — انبساط دامنه و بی‌تصمیمی.';
    else stTxt = 'سقف پایین‌تر ولی کف بالاتر — فشردگی و آماده شدن برای حرکت جهت‌دار.';
  }
  var res = aiPx(hh), sup = aiPx(ll);
  var sec1 = '<p class="ai-sec"><b>جمع‌بندی:</b> چارچوب روند در تایم‌فریم ' + aiTfLabel() + ' ' + dir + ' است (قدرت ساختار ' + faDigits(String(strg)) + '٪). ' + e20txt + rsiTxt + ' ' + bosTxt + '</p>';
  var sec2 = '<p class="ai-sec"><b>سطوح کلیدی:</b> مقاومت‌های نزدیک: ' + (sh ? aiPx(sh.v) + ' (آخرین سقف سوئینگ) و ' : '') + res + ' (سقف ۲۰ کندل اخیر) — حمایت‌های نزدیک: ' + (sl ? aiPx(sl.v) + ' (آخرین کف سوئینگ) و ' : '') + sup + ' (کف ۲۰ کندل اخیر). ' + stTxt + '</p>';
  var sec3 = '<p class="ai-sec"><b>سناریوها:</b> تثبیت بالای ' + res + ' → تداوم مسیر صعودی و باز شدن سمت قیمت‌های بالاتر؛ از دست رفتن ' + sup + ' → تداوم فشار فروش و ورود به عمق رِنج. بین این دو سطح، رفتار دوطرفه و رِنجی محتمل‌ترین حالت است.</p>';
  var volTxt = 'معمولی';
  if (atr != null && itv.atr) volTxt = atr < itv.atr[0] ? 'پایین' : atr > itv.atr[1] ? 'بالا' : 'معمولی';
  var sec4 = '<p class="ai-sec"><b>ریسک:</b> میانگین دامنه نوسان (ATR۱۴) حدود ' + (atr == null ? '—' : faDigits(atr.toFixed(2)) + '٪') + ' قیمت است — نوسان ' + volTxt + '؛ ' + faDigits(String(ratio)) + '٪ از ۲۰ کندل اخیر صعودی بسته شده‌اند. در تایم‌فریم‌های کوچک‌تر سیگنال‌ها نویز بیشتری دارند؛ تایید با تایم‌فریم بالاتر توصیه می‌شود.</p>';
  /* هشدار رنج فشرده + نواحی ورود الگوریتمی (موتور مشترک — از app.d) */
  var sec0 = '', sec5 = '';
  try {
    var rwz = trRangeComp(px.h, px.l, c);
    var trendKey = total >= 2 ? 'bullish' : total <= -2 ? 'bearish' : 'neutral';
    var ez = trZones(trendKey, last, ll, hh, atr != null ? (atr / 100) * last : null, rwz);
    if (rwz.active) {
      sec0 = '<div class="ai-range' + (rwz.severity === 'tight' ? ' red' : '') + '"><b>' + (rwz.severity === 'tight' ? 'هشدار جدی: رنج فشرده' : 'هشدار: بازار رنج است') + '</b><span>' + rwz.message + '</span>' +
        (rwz.severity === 'tight' ? '<ul>' + rwz.advice.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }
    sec5 = '<p class="ai-sec"><b>نواحی ورود مبتنی بر ساختار (الگوریتمی):</b> ساختار این تایم‌فریم ' + ez.trendFa + ' است — ' + ez.note;
    if (ez.zones.length) {
      sec5 += '</p>';
      for (var zi = 0; zi < ez.zones.length; zi++) {
        var z = ez.zones[zi];
        sec5 += '<div class="ai-zone"><b class="' + (z.side === 'buy' ? 'g' : 'r') + '">' + (z.side === 'buy' ? 'ناحیه خرید' : 'ناحیه فروش') + (z.activeNow ? ' — فعال (قیمت داخل ناحیه)' : ' — انتظار پولبک') + '</b>' +
          '<span>ناحیه: ' + aiPx(z.zoneLo) + ' تا ' + aiPx(z.zoneHi) + ' · حد ضرر: ' + aiPx(z.sl) + ' · هدف ۱ (RR۲): ' + aiPx(z.tp1) + ' · هدف ۲ (RR۳): ' + aiPx(z.tp2) + '</span>' +
          '<span class="m">' + z.basis + ' — ' + z.invalidate + '</span></div>';
      }
      sec5 += '<p class="ai-sec"><span class="m">نواحی آموزشی مبتنی بر سوئینگ/ATR هستند — سیگنال قطعی نیستند؛ تأیید کندل داخل ناحیه شرط اجراست.</span></p>';
    } else {
      sec5 += '</p>';
    }
  } catch (e) { /* موتور مشترک در دسترس نبود — بخش‌های اصلی تحلیل مستقل‌اند */ }
  return sec0 + sec1 + sec2 + sec3 + sec4 + sec5;
}
function aiBody() { var p = document.getElementById('ai_panel'); return p ? p.querySelector('.ai-body') : null; }
function aiSyncHeader() {
  var p = document.getElementById('ai_panel');
  if (!p) return;
  var t = p.querySelector('.ai-head .t');
  var cfg = CHART_YAHOO[S_AI.sym];
  if (t) t.textContent = 'تحلیل هوشمند — ' + (cfg ? cfg.name : S_AI.sym) + ' · ' + aiTfLabel();
}
function aiRenderLoading() {
  var b = aiBody();
  if (!b) return;
  b.innerHTML = '<div class="ai-state"><span class="spin" style="display:inline-flex">' + icon('refresh', 18) + '</span>در حال دریافت کندل‌ها و محاسبه تحلیل…<span style="font-size:9px;font-weight:400">معمولاً ۳ تا ۱۰ ثانیه — منبع داده: Yahoo Finance</span></div>';
  var at = document.getElementById('ai_at');
  if (at) at.textContent = '';
}
function aiRenderError(msg) {
  var b = aiBody();
  if (!b) return;
  b.innerHTML = '<div class="ai-state"><span style="display:inline-flex;color:var(--red)">' + icon('wifi', 20) + '</span>' + msg + '<button type="button" class="btn" data-ai-retry>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
  var rb = b.querySelector('[data-ai-retry]');
  if (rb) rb.addEventListener('click', function () { runAi(true); });
}
function aiRenderText() {
  var b = aiBody();
  if (!b || !AI_STATE.text) return;
  var cur = aiKey();
  var stale = AI_STATE.key !== cur;
  var at = document.getElementById('ai_at');
  if (at) at.textContent = !stale && AI_STATE.at ? faTime(new Date(AI_STATE.at)) : '';
  b.innerHTML = (stale ? '<p class="ai-stale">این تحلیل مربوط به نماد/تایم‌فریم قبلی است — دکمه «تحلیل هوشمند» را دوباره بزنید</p>' : '') + AI_STATE.text;
  b.scrollTop = 0;
}
function setAiBusy(b) {
  var btn = document.getElementById('ai_btn');
  if (!btn) return;
  btn.disabled = b;
  var ic = btn.querySelector('svg');
  if (ic) ic.classList.toggle('spin', b);
}
function runAi(force) {
  var p = document.getElementById('ai_panel');
  if (!p || AI_BUSY) return;
  var key = aiKey();
  var cached = AI_CACHE[key];
  if (!force && cached && (Date.now() - cached.at) < AI_TTL) {
    AI_STATE = { key: key, text: cached.text, at: cached.at };
    aiRenderText();
    return;
  }
  var cfg = CHART_YAHOO[S_AI.sym];
  var itv = CHART_ITV[S_AI.tf];
  if (!cfg || !itv) { aiRenderError('این نماد در موتور تحلیل پشتیبانی نمی‌شود.'); return; }
  AI_BUSY = true;
  setAiBusy(true);
  aiRenderLoading();
  fetchYahooOHLC(cfg, itv).then(function (px) {
    if (itv.agg) px = aggBars(px, itv.agg);
    var text = buildAiText(px, itv);
    AI_CACHE[key] = { at: Date.now(), text: text };
    AI_BUSY = false;
    setAiBusy(false);
    AI_STATE = { key: key, text: text, at: Date.now() };
    aiRenderText();
  }).catch(function () {
    AI_BUSY = false;
    setAiBusy(false);
    aiRenderError('دریافت کندل‌ها از Yahoo Finance ممکن نشد — اتصال اینترنت را بررسی کنید و دوباره تلاش کنید (پروکسی‌های عمومی گاهی موقتاً محدود می‌شوند).');
  });
}
function aiSyncStale() {
  var p = document.getElementById('ai_panel');
  if (!p || p.hidden) return;
  aiSyncHeader();
  if (AI_BUSY) return;
  aiRenderText();
}
function renderChartApp() {
  if (appScroll.querySelector('#tv_chart')) { /* باز شدن مجدد — ویجت قبلی حفظ شود */
    syncChartChips();
    chartEnsureAuto();
    return;
  }
  appScroll.innerHTML = '<div class="chart-wrap">' +
    '<div class="chart-chips no-scrollbar" data-chart-syms>' + chartChipRowHTML(CHART_SYMS, 'sym') + '</div>' +
    '<div class="chart-tfrow">' +
      '<div class="chart-chips no-scrollbar" data-chart-tfs>' + chartChipRowHTML(CHART_TFS, 'tf') + '</div>' +
      '<button type="button" class="cchip tv-login" id="tv_login_btn" title="ویجت داخلی لاگین ندارد — با حساب خودتان در سایت اصلی وارد شوید">' + icon('ext', 12) + 'ورود به حساب</button>' +
      '<span class="cchip ai-here" title="تحلیل هوشمند به دستیار معامله‌گر منتقل شد">' + icon('sparkles', 12) + 'تحلیل هوشمند → دستیار</span>' +
    '</div>' +
    '<div id="tv_chart"><div class="tv-state tv-loading">در حال بارگذاری چارت TradingView…</div></div>' +
    '<p class="chart-note">رسم‌ها و اندیکاتورهای داخل ویجت ذخیره نمی‌شوند — برای ذخیره با حساب خودتان از دکمه «ورود به حساب» استفاده کنید. «تحلیل هوشمند» به تب تحلیل هوشمند دستیار معامله‌گر منتقل شده است (نماد و تایم‌فریم دلخواه خودتان را آنجا انتخاب کنید).</p>' +
    '</div>';
  bindChartChips();
  var lb = appScroll.querySelector('#tv_login_btn');
  if (lb) lb.addEventListener('click', function () {
    try { window.open('https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(S_CHART.sym), '_blank', 'noopener'); } catch (e) {}
  });
  chartEnsureAuto();
}

/* ---------- اپ درباره ---------- */
function renderAboutApp() {
  var gen = GEN_ISO ? new Date(GEN_ISO) : new Date();
  appScroll.innerHTML = '<div class="app-pad">' +
    '<section class="about-sec"><div class="about-h"><span style="color:var(--primary)">' + icon('info', 16) + '</span><h2 class="about-t">رصدگر دلار — نسخه فایل مستقل</h2></div>' +
    '<p class="about-p">این فایل، خروجی تک‌فایلیِ ابزار پایش اخبار اقتصادی USD و ساختار بازار طلا و داو جونز است؛ بدون نیاز به نصب یا سرور. داده‌های اخبار، ترجمه‌ها، تحلیل تأثیر و ساختار بازار تا لحظه تولید فایل داخل آن ذخیره شده و قیمت‌ها (در صورت اتصال اینترنت) از طریق مراکز کنترل قابل بروزرسانی زنده‌اند.</p></section>' +
    '<section class="about-sec"><div class="about-h"><span style="color:var(--amber)">' + icon('hand', 16) + '</span><h2 class="about-t">حرکات لمسی</h2></div>' +
    '<ul style="display:flex;flex-direction:column;gap:6px;font-size:11px;line-height:20px;color:var(--mutedfg);margin:0;padding:0;list-style:none">' +
    '<li>• نگه‌داشتن هر آیکون (حدود نیم ثانیه) → حالت لرزش؛ سپس آیکون‌ها را بکشید تا جابه‌جا شوند و «پایان» را بزنید.</li>' +
    '<li>• دکمه ☰ در گوشه بالا-چپ (یا داخل هر اپ) → منوی جانبی دسترسی سریع به همه اپ‌ها و مراکز.</li>' +
    '<li>• دکمه برگشت (→) در بالای هر اپ، نوار پایین، یا دکمه برگشت خود گوشی → بازگشت به صفحه قبل.</li>' +
    '<li>• کشیدن به چپ/راست → جابه‌جایی بین صفحات با پارالاکس کاغذدیواری.</li>' +
    '<li>• کشیدن از بالای صفحه → مرکز اعلان‌ها (تغییر جهت بازار و وضعیت سامانه).</li>' +
    '<li>• کشیدن از پایین صفحه → مرکز کنترل (کلیدها و بروزرسانی قیمت‌ها).</li>' +
    '<li>• لمس آیکون اپ → باز شدن با انیمیشن بزرگ‌نمایی از همان آیکون؛ نوار پایین → بازگشت.</li>' +
    '</ul></section>' +
    '<section class="about-sec"><div class="about-h"><span style="color:var(--sky)">' + icon('layers', 16) + '</span><h2 class="about-t">منابع داده و روش تحلیل</h2></div>' +
    '<ul style="display:flex;flex-direction:column;gap:6px;font-size:11px;line-height:20px;color:var(--mutedfg);margin:0;padding:0;list-style:none">' +
    '<li>• اخبار اقتصادی USD: ForexFactory با ترجمه و تحلیل تأثیر هوش مصنوعی (در لحظه تولید فایل).</li>' +
    '<li>• قیمت طلا/نقره/داوجونز: Yahoo Finance از «لایه داده واحد» ابزار — همه صفحات از یک منبع تغذیه می‌شوند و برای طلا/نقره با اسپات gold-api کالیبره می‌شوند تا عدد همه صفحات یکی باشد.</li>' +
    '<li>• ساختار بازار: ترکیب EMA۲۰/۵۰ و سقف/کف‌های سوئینگ در ۶ تایم‌فریم + تایم‌فریم ورود ۵ دقیقه.</li>' +
    '<li>• دماسنج فشار: رأی فنی تریدینگ‌ویو (صفحه Technicals نماد — نوسانگرها + میانگین‌های متحرک) — فقط سه حالت فشار خرید/خنثی/فشار فروش؛ در نبود تریدینگ‌ویو، اجماع ۱۶ اندیکاتور محلی روی کندل‌ها جایگزین می‌شود.</li>' +
    '<li>• تحلیل و پیش‌بینی طلا (پنجرهٔ مجزا): LiteFinance (پیش‌بینی فردا و هفته) + FXStreet (تحلیل‌ها و نظرسنجی) + رأی فنی تریدینگ‌ویو — دریافت با پروکسی عمومی/آرشیو و در نبود اینترنت، اسنپ‌شات تاریخ‌دار هنگام ساخت فایل.</li>' +
    '<li>• نقشهٔ مسیر امروز: تلفیق رأی همهٔ منابع ابزار (دماسنج دو تایم‌فریم، ساختار بازار، تریدینگ‌ویو، LiteFinance، اخبار حل‌شده) در سه سناریو با محرک و ابطال — بدون فرمول و عدد ساختگی.</li>' +
    '<li>• چارت تریدینگ‌ویو + دستیار معامله‌گر (BIG TRADER): امتیاز اطمینان، ماشین‌حساب حجم/حد ضرر و حد سود، تحلیل هوشمند، سناریوی خبری و دماسنج فشار.</li>' +
    '<li>• پیشنهاد اسکلپ و سیگنال اسکلپ اونس: پورت اندیکاتور SBW + اوردر بلاک FVG + ستاپ ۴ساعته + واگرایی روی کندل‌های زنده Yahoo Finance.</li>' +
    '</ul></section>' +
    '<section class="about-sec"><div class="about-h"><span style="color:var(--violet)">' + icon('sliders', 16) + '</span><h2 class="about-t">این فایل — نسخه v__APP_VERSION__</h2></div>' +
    '<p class="about-p">تولید: ' + faDateLong(gen) + ' — ' + faTime(gen) + ' تهران. این فایل را می‌توانید با ایمیل یا پیام‌رسان برای خودتان یا دیگران بفرستید و روی هر گوشی با مرورگر باز کنید. انتخاب‌ها (ترتیب آیکون‌ها، فیلترها) در همان دستگاه ذخیره می‌شود.</p></section>' +
    '<p class="about-foot">این ابزار صرفاً اطلاع‌رسانی است و توصیه سرمایه‌گذاری محسوب نمی‌شود.</p>' +
    '</div>';
}

/* ---------- مسیریاب اپ‌ها ---------- */
function renderApp(id, keep) {
  if (appTitle) appTitle.textContent = APPS[id] ? APPS[id].label : 'رصدگر دلار';
  if (id === 'news') renderNewsApp();
  else if (id === 'structure') renderStructureApp();
  else if (id === 'suggestion') renderSuggestionApp();
  else if (id === 'scalp') renderScalpApp();
  else if (id === 'styles') renderStylesApp();
  else if (id === 'chart') renderChartApp();
  else if (id === 'trader') renderTraderApp();
  else if (id === 'analysis') renderAnalysisApp();
  else renderAboutApp();
  appScroll.scrollTop = 0;
}

/* ---------- رویدادهای مشترک ---------- */
page1.addEventListener('pointerdown', function (e) {
  var btn = e.target.closest('[data-icon]');
  if (!btn) return;
  page1IconPointerDown(btn.dataset.icon, e);
});
page1.addEventListener('pointermove', function (e) {
  if (!S.wiggle && !S.press) return;
  var id = S.drag ? S.drag.id : (S.press ? S.press.id : null);
  if (!id) return;
  page1IconPointerMove(id, e);
});
page1.addEventListener('pointerup', function (e) {
  if (S.drag) page1IconPointerUp(S.drag.id);
  else if (S.press) page1IconPointerUp(S.press.id);
});
page1.addEventListener('pointercancel', function () {
  if (S.drag) page1IconPointerUp(S.drag.id);
  cancelLongPress();
});
page1.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-icon]');
  if (btn) { page1IconClick(btn.dataset.icon); return; }
  var bc = e.target.closest('[data-banner-close]');
  if (bc) {
    var changes = ms && ms.changes ? ms.changes : [];
    lsSet(DISMISS_KEY, changesSignature(changes));
    var b = page1.querySelector('[data-banner]');
    if (b) b.remove();
  }
});
dockIn.addEventListener('click', function (e) {
  var b = e.target.closest('[data-app]');
  if (b) { openApp(b.dataset.app, b); return; }
  var a = e.target.closest('[data-act]');
  if (a) { if (a.dataset.act === 'nc') openNC(); else if (a.dataset.act === 'cc') openCC(); }
});

/* ---------- تنظیم انیمیشن‌ها ---------- */
function applyAnim() { device.classList.toggle('no-anim', !settings.anim); }

/* ---------- راه‌اندازی ---------- */
function homeTick() {
  updateCountdown();
  updateTodayCount();
}
function boot() {
  try { if (history.state && history.state.sd) history.replaceState(null, ''); } catch (e) {}
  renderStatusRight();
  tickClock();
  setInterval(tickClock, 1000);
  renderPage1();
  renderPage2();
  renderDock();
  renderDots();
  onPageScroll();
  applyAnim();
  _lastCdId = (nextHighEvent() || {}).id || 'none';
  _lastTcKey = (function () { var c = todayCounts(); return c.count + ':' + c.high; })();
  setInterval(homeTick, 30000);
  applyAutoPrice();
  if (!lsGet(HINT_KEY)) {
    var hint = $('#hint');
    hint.hidden = false;
    lsSet(HINT_KEY, '1');
    setTimeout(function () { hint.hidden = true; }, 9200);
  }
  window.addEventListener('resize', onPageScroll);
}
boot();
