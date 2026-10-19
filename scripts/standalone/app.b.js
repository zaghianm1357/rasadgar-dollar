/* ================= رندر رابط کاربری ================= */

/* خواندن ردیف یک تایم‌فریم از داده ساختار */
function row(symKey, tf) {
  var sym = ms[symKey];
  if (!sym || !sym.rows) return null;
  for (var i = 0; i < sym.rows.length; i++) if (sym.rows[i].tf === tf) return sym.rows[i];
  return null;
}

/* ---------- اجزای پایه ---------- */
function iconVisHTML(id, size) {
  var a = APPS[id];
  var px = size || 52;
  var isz = px >= 50 ? 24 : 20;
  return '<span class="icon-vis ' + a.cls + (px < 50 ? ' sm' : '') + '" style="width:' + px + 'px;height:' + px + 'px;border-radius:' + Math.round(px * 0.29) + 'px">' + icon(a.ic, isz) + '</span>';
}
function trendDotHTML(row) {
  var t = row && row.trend ? row.trend : null;
  var cls = t ? trendChipCls(t) : 'na';
  var ic = t ? trendIcon(t) : 'minus';
  return '<span class="tdot ' + cls + '">' + icon(ic, 10) + (t ? trendText(t) : '—') + '</span>';
}
function chgCls(ch) { return ch == null ? 'chg-none' : ch > 0 ? 'chg-up' : ch < 0 ? 'chg-down' : 'chg-flat'; }
function chgText(sym) {
  var ch = sym && sym.changePct;
  if (ch == null) return 'در انتظار داده';
  return (ch > 0 ? '+' : '') + faDigits(ch.toFixed(2)) + '٪ امروز';
}

/* ---------- بنر تغییر جهت ---------- */
function changesSignature(changes) {
  return (changes || []).map(function (c) { return c.symbol + ':' + c.tf + ':' + c.from + '>' + c.to + ':' + c.atISO; }).join('|');
}
function changeRowHTML(c) {
  return '<div class="crow">' +
    '<span class="crow-sym">' + SYMBOL_LABEL[c.symbol] + '</span>' +
    '<span class="crow-tf">' + TF_LONG[c.tf] + '</span>' +
    '<span class="chip ' + trendChipCls(c.from) + '">' + trendText(c.from) + '</span>' +
    '<span class="crow-arrow" aria-hidden="true">←</span>' +
    '<span class="chip ' + trendChipCls(c.to) + '">' + trendText(c.to) + '</span>' +
    '<span class="crow-time">ساعت ' + faTime(new Date(c.atISO)) + '</span>' +
    '</div>';
}
function bannerHTML() {
  var changes = ms && ms.changes ? ms.changes : [];
  if (!changes.length) return '';
  var sig = changesSignature(changes);
  if (lsGet(DISMISS_KEY) === sig) return '';
  var shown = changes.slice(0, 3);
  var extra = changes.length - shown.length;
  return '<div class="banner blink" role="alert" data-banner>' +
    '<div class="bnr-head">' +
    '<span class="bnr-ic soft-pulse">' + icon('bell', 16) + '</span>' +
    '<div style="min-width:0;flex:1">' +
    '<p class="bnr-t1">تغییر جهت بازار!</p>' +
    '<p class="bnr-t2">جهت روند ساختار در ' + faDigits(changes.length) + ' مورد تغییر کرد — ' + (changes.length > 1 ? 'موارد زیر جدیدترین‌اند' : 'جزئیات زیر') + '.</p>' +
    '</div>' +
    '<button type="button" class="bnr-x" data-banner-close aria-label="بستن اعلان تغییر جهت">' + icon('x', 14) + '</button>' +
    '</div>' +
    '<div class="bnr-rows">' + shown.map(changeRowHTML).join('') +
    (extra > 0 ? '<p class="bnr-extra">+ ' + faDigits(extra) + ' تغییر دیگر در ۶ ساعت گذشته</p>' : '') +
    '</div></div>';
}

/* ---------- ویجت‌های صفحه ۱ ---------- */
function priceWidgetHTML(key, title) {
  var sym = ms[key];
  var row1h = null, i;
  if (sym) for (i = 0; i < sym.rows.length; i++) if (sym.rows[i].tf === '1h') row1h = sym.rows[i];
  return '<div class="widget price-w" data-pw="' + key + '" style="min-height:86px;justify-content:space-between">' +
    '<div class="w-row"><span class="w-title">' + title + '</span>' + trendDotHTML(row1h) + '</div>' +
    '<span class="w-big" dir="ltr" style="text-align:start" data-pw-price>' + (sym && sym.price != null ? faNum(sym.price) : '—') + '</span>' +
    '<span class="w-chg ' + chgCls(sym && sym.changePct) + '" data-pw-chg>' + chgText(sym) + '</span>' +
    '</div>';
}
function cdFormat(msLeft) {
  var totalMin = Math.max(0, Math.floor(msLeft / 60000));
  var h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return faDigits(m) + ' دقیقه';
  if (m === 0) return faDigits(h) + ' ساعت';
  return faDigits(h) + ':' + faDigits(String(m).padStart(2, '0'));
}
function nextHighEvent() {
  var now = Date.now(), best = null;
  var evs = news.events || [];
  for (var i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (!e.dateISO) continue;
    var t = new Date(e.dateISO).getTime();
    if (t <= now) continue;
    if (e.impact !== 'High') continue;
    if (!best || t < new Date(best.dateISO).getTime()) best = e;
  }
  return best;
}
function countdownWidgetHTML() {
  var nx = nextHighEvent();
  var left = nx ? new Date(nx.dateISO).getTime() - Date.now() : null;
  return '<div class="widget" style="min-height:86px;justify-content:space-between">' +
    '<div class="w-row"><span class="w-title">تا خبر مهم</span>' + icon('flame', 14) + '</div>' +
    '<span class="w-big" data-cd-val>' + (left != null ? cdFormat(left) : '—') + '</span>' +
    '<span class="w-sub" data-cd-sub title="' + (nx ? (nx.titleFa || nx.title) : '') + '">' + (nx ? (nx.titleFa || nx.title) : 'خبر مهمی در صف نیست') + '</span>' +
    '</div>';
}
function todayCountWidgetHTML() {
  var c = todayCounts();
  return '<div class="widget" style="min-height:86px;justify-content:space-between">' +
    '<div class="w-row"><span class="w-title">اخبار امروز</span>' + icon('newspaper', 14) + '</div>' +
    '<span class="w-big" data-tc-count>' + faDigits(c.count) + ' <span style="font-size:12px;font-weight:700;color:var(--mutedfg)">خبر</span></span>' +
    '<span class="w-chg" style="color:rgba(251,191,36,.9)" data-tc-high>' + faDigits(c.high) + ' خبر با اهمیت بالا</span>' +
    '</div>';
}
function todayCounts() {
  var tKey = todayKeyInTehran();
  var count = 0, high = 0, evs = news.events || [];
  for (var i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (e.dateISO && e.dateISO.slice(0, 10) !== tKey) continue;
    count++;
    if (e.impact === 'High') high++;
  }
  return { count: count, high: high };
}
function digestWidgetHTML() {
  return '<div class="widget col2">' +
    '<div class="w-head">' + icon('sparkles', 14) + '<span class="w-head-t" style="color:var(--primary)">خلاصه روزانه هوشمند</span></div>' +
    '<p class="clamp3" style="font-size:11px;line-height:20px;color:rgba(232,236,240,.85);margin:0">' +
    (news.digest || 'برای این روز خلاصه هوشمندی تولید نشده است.') + '</p>' +
    '</div>';
}
function widgetPulse(el) {
  if (!el || !settings.anim) return;
  el.classList.remove('wpulse');
  void el.offsetWidth;
  el.classList.add('wpulse');
}

/* ---------- لوگوی BIG TRADER ---------- */
function bigTraderHeaderHTML() {
  return '<div class="bt-hero" data-nogesture>' +
    '<span class="bt-logo-ic">' + icon('briefcase', 20) + '</span>' +
    '<div style="min-width:0;flex:1">' +
    '<p class="bt-logo-t" dir="ltr">BIG TRADER</p>' +
    '<p class="bt-logo-s">دستیار هوشمند معامله‌گری · رصدگر دلار</p>' +
    '</div>' +
    '<span class="bt-live">پایش زنده</span>' +
    '</div>';
}

/* ---------- صفحه ۱ ---------- */
var _lastCdId = null, _lastTcKey = '';
function renderPage1() {
  page1.innerHTML =
    bigTraderHeaderHTML() +
    bannerHTML() +
    '<div class="grid2">' +
    priceWidgetHTML('xau', 'طلا — XAUUSD') +
    priceWidgetHTML('dji', 'داوجونز — DJI') +
    countdownWidgetHTML() +
    todayCountWidgetHTML() +
    digestWidgetHTML() +
    '</div>' +
    '<div class="icongrid"></div>' +
    '<p class="page-note">صفحه ۱ از ۲ — برای صفحه بعد به چپ بکشید</p>';
  renderIconsGrid();
}
function renderIconsGrid() {
  var grid = page1.querySelector('.icongrid');
  if (!grid) return;
  grid.className = 'icongrid' + (S.wiggle ? ' wiggling-grid' : '');
  var h = '';
  for (var i = 0; i < S.gridOrder.length; i++) {
    var id = S.gridOrder[i];
    var dragging = S.drag && S.drag.id === id;
    h += '<button type="button" class="appbtn' + (S.wiggle ? ' wig-touch' : '') + (dragging ? ' dragging' : '') + '" data-icon="' + id + '" aria-label="' + APPS[id].label + '">' +
      '<span class="' + (S.wiggle && !dragging ? 'wiggling-icon' : '') + '">' + iconVisHTML(id, 52) + '</span>' +
      '<span class="icon-label">' + APPS[id].label + '</span>' +
      '</button>';
  }
  grid.innerHTML = h;
}

/* ---------- صفحه ۲ ---------- */
function glanceWidgetHTML() {
  var tfs = ['15m', '1h', '4h', '1d'], rows = '';
  for (var i = 0; i < tfs.length; i++) {
    var tf = tfs[i];
    rows += '<tr><td>' + TF_SHORT[tf] + '</td>' +
      '<td>' + trendDotHTML(row('xau', tf)) + '</td>' +
      '<td>' + trendDotHTML(row('dji', tf)) + '</td></tr>';
  }
  return '<div class="widget col2">' +
    '<div class="w-head">' + icon('activity', 14) + '<span class="w-head-t">نگاه اجمالی — ساختار بازار</span></div>' +
    '<table class="mini-tbl"><thead><tr><th>تایم‌فریم</th><th>طلا</th><th>داو</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="w-note">جزئیات کامل در اپ «ساختار بازار» — داده فایل تا لحظه تولید</p>' +
    '</div>';
}
function topNewsWidgetHTML() {
  var now = Date.now();
  var up = (news.events || []).filter(function (e) { return e.dateISO && new Date(e.dateISO).getTime() > now; })
    .sort(function (a, b) { return new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(); })
    .slice(0, 3);
  var rows = '';
  if (!up.length) rows = '<p style="font-size:11px;color:var(--mutedfg);margin:0">خبر آینده‌ای در فید نیست.</p>';
  else {
    rows = '<div style="display:flex;flex-direction:column;gap:6px">' + up.map(function (e) {
      return '<div style="display:flex;align-items:center;gap:8px">' +
        icon('clock', 12) +
        '<span dir="ltr" style="flex:none;font-size:10px;font-weight:700;color:var(--mutedfg);font-variant-numeric:tabular-nums">' +
        faTime(new Date(e.dateISO)) + '</span>' +
        '<span class="truncate" style="font-size:11px">' + (e.titleFa || e.title) + '</span>' +
        (e.impact === 'High' ? '<span style="flex:none;color:var(--amber)">' + icon('flame', 12) + '</span>' : '') +
        '</div>';
    }).join('') + '</div>';
  }
  return '<div class="widget col2">' +
    '<div class="w-head">' + icon('calDays', 14) + '<span class="w-head-t">خبرهای پیش‌رو</span></div>' + rows +
    '</div>';
}
function hintsWidgetHTML() {
  return '<div class="widget col2" style="gap:6px">' +
    '<div class="w-head">' + icon('dollar', 14) + '<span class="w-head-t">راهنمای حرکات و وضعیت</span></div>' +
    '<ul style="display:flex;flex-direction:column;gap:4px;font-size:10px;line-height:16px;color:var(--mutedfg);margin:0;padding:0;list-style:none">' +
    '<li>• نگه‌داشتن آیکون‌ها → حالت لرزش برای جابه‌جایی</li>' +
    '<li>• دکمه ☰ بالا-چپ → منوی جانبی | دکمه → در اپ‌ها → بازگشت</li>' +
    '<li>• کشیدن انگشت به چپ/راست → جابه‌جایی صفحات (کاغذدیواری پارالاکس)</li>' +
    '<li>• کشیدن از بالا → مرکز اعلان‌ها | از پایین → مرکز کنترل</li>' +
    '<li>• لمس آیکون اپ → باز شدن با انیمیشن بزرگ‌نمایی</li>' +
    '<li>• بروزرسانی زنده قیمت‌ها: مرکز کنترل (نیازمند اینترنت)</li>' +
    '</ul></div>';
}
function renderPage2() {
  page2.innerHTML = glanceWidgetHTML() + topNewsWidgetHTML() + hintsWidgetHTML();
}

/* ---------- داک ---------- */
function renderDock() {
  dockIn.innerHTML =
    '<button type="button" data-app="news" aria-label="اخبار دلار">' + iconVisHTML('news', 46) + '</button>' +
    '<button type="button" data-app="structure" aria-label="ساختار بازار">' + iconVisHTML('structure', 46) + '</button>' +
    '<button type="button" data-act="nc" aria-label="مرکز اعلان‌ها"><span class="icon-vis g-nc sm" style="width:46px;height:46px;border-radius:15px">' + icon('bell', 20) + '</span></button>' +
    '<button type="button" data-act="cc" aria-label="مرکز کنترل"><span class="icon-vis g-cc sm" style="width:46px;height:46px;border-radius:15px">' + icon('sliders', 20) + '</span></button>';
}

/* ---------- بروزرسانی‌های هدفمند ---------- */
function updatePriceWidgets(pulse) {
  var keys = ['xau', 'dji'];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], w = page1.querySelector('[data-pw="' + k + '"]');
    if (!w) continue;
    var sym = ms[k];
    var pe = w.querySelector('[data-pw-price]'), ce = w.querySelector('[data-pw-chg]');
    if (pe) pe.textContent = sym && sym.price != null ? faNum(sym.price) : '—';
    if (ce) { ce.textContent = chgText(sym); ce.className = 'w-chg ' + chgCls(sym && sym.changePct); }
    if (pulse) widgetPulse(w);
  }
}
function updateCountdown() {
  var nx = nextHighEvent();
  var left = nx ? new Date(nx.dateISO).getTime() - Date.now() : null;
  var ve = page1.querySelector('[data-cd-val]'), se = page1.querySelector('[data-cd-sub]');
  if (ve) ve.textContent = left != null ? cdFormat(left) : '—';
  if (se) { se.textContent = nx ? (nx.titleFa || nx.title) : 'خبر مهمی در صف نیست'; se.title = se.textContent; }
  var id = nx ? nx.id : 'none';
  if (id !== _lastCdId) { _lastCdId = id; widgetPulse(ve && ve.closest('.widget')); }
}
function updateTodayCount() {
  var c = todayCounts();
  var key = c.count + ':' + c.high;
  var ce = page1.querySelector('[data-tc-count]'), he = page1.querySelector('[data-tc-high]');
  if (ce) ce.innerHTML = faDigits(c.count) + ' <span style="font-size:12px;font-weight:700;color:var(--mutedfg)">خبر</span>';
  if (he) he.textContent = faDigits(c.high) + ' خبر با اهمیت بالا';
  if (key !== _lastTcKey) { _lastTcKey = key; widgetPulse(ce && ce.closest('.widget')); }
}
function updateMsBadge() {
  var b = appScroll.querySelector('[data-ms-badge]');
  if (!b) return;
  if (priceState.mode === 'live') { b.className = 'badge live'; b.textContent = 'قیمت زنده — ' + faTime(priceState.okAt || new Date()); }
  else if (priceState.mode === 'offline') { b.className = 'badge snap'; b.textContent = 'بروزرسانی ناموفق — اسنپ‌شات'; }
  else { b.className = 'badge snap'; b.textContent = 'اسنپ‌شات فایل'; }
}
function updateStatusUI() {
  if (S.drawerOpen) renderDrawer();
  if (S.ncOpen) renderNC();
  if (S.ccOpen) renderCC();
  if (S.app && S.app.id === 'structure' && S.appPhase === 'open') updateMsBadge();
}

/* ---------- مرکز اعلان‌ها ---------- */
function feedLabel() {
  if (news.feedStatus === 'live') return 'بروزرسانی زنده در لحظه تولید فایل';
  if (news.feedStatus === 'cached') return 'داده کش‌شده در لحظه تولید فایل';
  if (news.feedStatus === 'error') return 'خطای فید در لحظه تولید فایل';
  return 'در انتظار داده';
}
function renderNC() {
  var changes = ms && ms.changes ? ms.changes : [];
  var changesHTML = changes.length
    ? '<div class="bnr-rows">' + changes.slice(0, 6).map(changeRowHTML).join('') + '</div>'
    : '<p class="nc-sec-p">تغییر جهت جدیدی تا لحظه تولید فایل ثبت نشده است. این فایل داده‌های لحظه تولید را نمایش می‌دهد.</p>';
  var gen = GEN_ISO ? new Date(GEN_ISO) : new Date();
  ncSheet.innerHTML =
    '<div class="grabber"></div>' +
    '<div class="nc-head">' +
    '<div><p class="nc-clock" data-nc-clock>' + faTime(new Date()) + '</p><p class="nc-date">' + faDateLong(new Date()) + '</p></div>' +
    '<button type="button" class="nc-close" data-nc-close aria-label="بستن مرکز اعلان‌ها">' + icon('x', 16) + '</button>' +
    '</div>' +
    '<section class="nc-sec">' +
    '<div class="nc-sec-h"><span style="color:var(--amber)">' + icon('moveH', 14) + '</span><h3 class="nc-sec-t">تغییر جهت بازار</h3><span class="ms-auto" style="color:var(--mutedfg)">' + icon('bell', 12) + '</span></div>' +
    changesHTML +
    '</section>' +
    '<section class="nc-sec">' +
    '<div class="nc-sec-h"><span style="color:var(--primary)">' + icon('radio', 14) + '</span><h3 class="nc-sec-t">وضعیت سامانه</h3></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;font-size:11px;line-height:20px">' +
    '<div class="st-row"><span style="color:var(--mutedfg)">' + icon('radio', 12) + '</span><span class="st-k">فید اخبار:</span><span class="st-v">' + feedLabel() + '</span></div>' +
    ((news.pendingTranslation || 0) > 0
      ? '<div class="st-row"><span style="color:var(--amber)">' + icon('langs', 12) + '</span><span class="st-k">در نوبت ترجمه:</span><span class="st-v" style="color:var(--amber)">' + faDigits(news.pendingTranslation) + ' خبر</span></div>'
      : '') +
    '<div class="st-row"><span style="color:var(--mutedfg)">' + icon('activity', 12) + '</span><span class="st-k">قیمت‌ها:</span><span class="st-v">' + priceModeLabel() + (priceState.lastTry ? ' — آخرین تلاش ' + faTime(priceState.lastTry) : '') + '</span></div>' +
    '<div class="st-row"><span style="color:var(--mutedfg)">' + icon('calDays', 12) + '</span><span class="st-k">تولید فایل:</span><span class="st-v">' + faDateLong(gen) + ' — ' + faTime(gen) + '</span></div>' +
    '</div></section>' +
    '<p class="cc-note">برای بستن، به بالا بکشید یا پس‌زمینه را لمس کنید</p>';
  var c = ncSheet.querySelector('[data-nc-close]');
  if (c) c.addEventListener('click', closeNC);
}

/* ---------- مرکز کنترل ---------- */
function swHTML(key, icname, accent, label) {
  return '<button type="button" class="cc-tile" data-toggle="' + key + '" role="switch" aria-checked="' + !!settings[key] + '" aria-label="' + label + '">' +
    '<span class="cc-ic ' + accent + '">' + icon(icname, 16) + '</span>' +
    '<span class="cc-label">' + label + '</span>' +
    '<span class="sw' + (settings[key] ? ' on' : '') + '" data-sw></span>' +
    '</button>';
}
function actionHTML(id, icname, accent, label, busyAttr) {
  return '<button type="button" class="cc-tile" data-action="' + id + '"' + (busyAttr ? ' id="' + busyAttr + '"' : '') + '>' +
    '<span class="cc-ic ' + accent + '"><span data-price-spin' + (id === 'refresh-prices' ? '' : ' style="display:contents"') + '>' + icon(icname, 16) + '</span></span>' +
    '<span class="cc-label">' + label + '</span>' +
    '</button>';
}
function renderCC() {
  var pm = priceState.mode;
  var chips =
    '<span class="stat-chip">قیمت‌ها: ' + priceModeLabel() + '</span>' +
    '<span class="stat-chip">' + (priceState.lastTry ? 'آخرین تلاش: ' + faTime(priceState.lastTry) : 'بدون تلاش اخیر') + '</span>' +
    '<span class="stat-chip">اخبار: اسنپ‌شات فایل</span>';
  ccSheet.innerHTML =
    '<div class="grabber"></div>' +
    '<div class="cc-head"><h3 class="cc-title">مرکز کنترل</h3><div style="display:flex;align-items:center;gap:8px;color:var(--mutedfg)">' + icon('signal', 14) + icon('wifi', 14) + icon('battery', 18) + '</div></div>' +
    '<div class="stat-chips">' + chips + '</div>' +
    '<div class="cc-grid">' +
    swHTML('highOnly', 'flame', 'cc-a-amber', 'تمرکز روی اخبار خیلی مهم') +
    swHTML('autoPrice', 'refresh', 'cc-a-sky', 'تلاش خودکار قیمت‌ها (هر ۱۵ دقیقه)') +
    swHTML('anim', 'sparkles', 'cc-a-violet', 'انیمیشن‌ها و پالس ویجت‌ها') +
    actionHTML('refresh-prices', 'refresh', 'cc-a-emerald', 'بروزرسانی زنده قیمت‌ها (نیازمند اینترنت)', 'cc-refresh-prices') +
    actionHTML('restore', 'db', 'cc-a-rose', 'بازنشانی به داده داخل فایل', '') +
    '<div class="cc-tile" style="cursor:default">' +
    '<span class="cc-ic cc-a-muted">' + icon('db', 16) + '</span>' +
    '<span style="min-width:0;flex:1"><span style="display:flex;align-items:center;gap:8px;font-size:10px;font-weight:700">منابع داده</span>' +
    '<span class="cc-src">اخبار: ForexFactory — قیمت: Yahoo Finance — ترجمه و تحلیل: هوش مصنوعی (در لحظه تولید فایل)</span></span>' +
    '</div>' +
    '</div>' +
    '<p class="cc-note">برای بستن، به پایین بکشید یا پس‌زمینه را لمس کنید</p>';
  var tiles = ccSheet.querySelectorAll('[data-toggle]');
  for (var i = 0; i < tiles.length; i++) {
    (function (t) {
      t.addEventListener('click', function () {
        var k = t.dataset.toggle;
        settings[k] = !settings[k];
        saveSettings();
        t.setAttribute('aria-checked', !!settings[k]);
        var sw = t.querySelector('[data-sw]');
        if (sw) sw.classList.toggle('on', settings[k]);
        if (k === 'autoPrice') applyAutoPrice();
        if (k === 'anim') applyAnim();
        if (k === 'highOnly' && S.app && S.app.id === 'news' && S.appPhase === 'open') renderApp('news', true);
        buzz();
      });
    })(tiles[i]);
  }
  var acts = ccSheet.querySelectorAll('[data-action]');
  for (var j = 0; j < acts.length; j++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.action === 'refresh-prices') refreshPrices();
        else if (b.dataset.action === 'restore') { restoreSnapshot(); renderCC(); }
      });
    })(acts[j]);
  }
}

/* ---------- منوی جانبی ---------- */
function drawerItemHTML(iconCls, icname, label, attrs) {
  return '<button type="button" class="drawer-item" ' + attrs + '>' +
    '<span class="icon-vis ' + iconCls + '" style="width:38px;height:38px;border-radius:12px">' + icon(icname, 18) + '</span>' +
    '<span class="drawer-item-t">' + label + '</span>' +
    icon('chevL', 15) + '</button>';
}
function renderDrawer() {
  var gen = GEN_ISO ? new Date(GEN_ISO) : new Date();
  var apps = S.gridOrder.map(function (id) {
    return drawerItemHTML(APPS[id].cls, APPS[id].ic, APPS[id].label, 'data-dnav="app" data-id="' + id + '"');
  }).join('');
  drawerPanel.innerHTML =
    '<div class="grabber"></div>' +
    '<div class="drawer-head">' +
    '<span class="drawer-logo bt-drawer-logo">' + icon('briefcase', 22) + '</span>' +
    '<div style="min-width:0;flex:1"><p class="drawer-t" dir="ltr">BIG TRADER</p><p class="drawer-s">رصدگر دلار — منوی دسترسی سریع</p></div>' +
    '<button type="button" class="nc-close" data-drawer-close aria-label="بستن منو">' + icon('x', 16) + '</button>' +
    '</div>' +
    '<div class="drawer-sec-t">اپ‌ها</div>' + apps +
    '<div class="drawer-sec-t">مراکز</div>' +
    drawerItemHTML('g-nc', 'bell', 'مرکز اعلان‌ها', 'data-dnav="nc"') +
    drawerItemHTML('g-cc', 'sliders', 'مرکز کنترل', 'data-dnav="cc"') +
    '<div class="drawer-sec-t">دسترسی سریع</div>' +
    '<button type="button" class="drawer-item" data-dact="refresh-prices">' +
    '<span class="cc-ic cc-a-emerald"><span data-price-spin style="display:inline-flex">' + icon('refresh', 16) + '</span></span>' +
    '<span class="drawer-item-t">بروزرسانی زنده قیمت‌ها</span>' + icon('chevL', 15) + '</button>' +
    '<p class="drawer-status">' + icon('activity', 12) + '<span>قیمت‌ها: <b>' + priceModeLabel() + '</b></span></p>' +
    '<p class="drawer-status">' + icon('calDays', 12) + '<span>تولید فایل: <b>' + faDateLong(gen) + ' — ' + faTime(gen) + '</b></span></p>' +
    '<p class="drawer-foot">این ابزار صرفاً اطلاع‌رسانی است و توصیه سرمایه‌گذاری محسوب نمی‌شود.</p>';
}

/* رنگ آیکون‌های مرکز کنترل (تزریق یک‌باره) */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '.cc-a-amber{border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.15);color:var(--amber)}' +
    '.cc-a-sky{border-color:rgba(56,189,248,.3);background:rgba(56,189,248,.15);color:var(--sky)}' +
    '.cc-a-violet{border-color:rgba(167,139,250,.3);background:rgba(167,139,250,.15);color:var(--violet)}' +
    '.cc-a-emerald{border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.15);color:var(--emerald)}' +
    '.cc-a-rose{border-color:rgba(251,113,133,.3);background:rgba(251,113,133,.15);color:var(--rose)}' +
    '.cc-a-muted{border-color:var(--border);background:rgba(255,255,255,.06);color:var(--mutedfg)}';
  document.head.appendChild(st);
})();
