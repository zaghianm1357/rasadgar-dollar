/* ============================================================
   لایه دسکتاپ «رصدگر دلار» — داخل همان IIFE موبایل اجرا می‌شود
   و به همه توابع و وضعیت‌ها دسترسی دارد
   ============================================================ */
window.__SD_DESKTOP__ = true;

var DT_TABS = [
  { id: 'home', label: 'خانه', ic: 'gauge' },
  { id: 'news', label: 'اخبار دلار', ic: 'newspaper' },
  { id: 'structure', label: 'ساختار بازار', ic: 'activity' },
  { id: 'suggestion', label: 'پیشنهاد معامله', ic: 'crosshair' },
  { id: 'scalp', label: 'سیگنال اسکلپ', ic: 'zap' },
  { id: 'chart', label: 'چارت تریدینگ‌ویو', ic: 'candles' },
  { id: 'trader', label: 'دستیار معامله‌گر', ic: 'briefcase' },
  { id: 'analysis', label: 'تحلیل و پیش‌بینی', ic: 'radar' },
  { id: 'about', label: 'درباره', ic: 'info' }
];
var DT = { tab: null };
var dtTabsEl = document.getElementById('dt-tabs');
var dtClockEl = document.getElementById('dt-clock');
var dtChipsEl = document.getElementById('dt-chips');

/* ---------- تب‌ها ---------- */
function dtRenderTabs() {
  var h = '';
  for (var i = 0; i < DT_TABS.length; i++) {
    var t = DT_TABS[i];
    h += '<button type="button" class="dt-tab' + (DT.tab === t.id ? ' on' : '') + '" data-dt-tab="' + t.id + '">' +
      icon(t.ic, 14) + '<span>' + t.label + '</span>' +
      '<span class="dt-kbd">' + faDigits(i + 1) + '</span></button>';
  }
  dtTabsEl.innerHTML = h;
}

/* ---------- خانه (داشبورد ویجت‌ها) ---------- */
function dtRenderHome() {
  if (appTitle) appTitle.textContent = 'خانه — نمای کلی بازار';
  appScroll.innerHTML =
    '<div class="dt-home">' +
    bannerHTML() +
    '<div class="dt-home-grid">' +
    priceWidgetHTML('xau', 'طلا — XAUUSD') +
    priceWidgetHTML('dji', 'داوجونز — DJI') +
    countdownWidgetHTML() +
    todayCountWidgetHTML() +
    digestWidgetHTML() +
    '</div></div>';
  dtPatchHome();
}

function dtPatchHome() {
  var root = appScroll.querySelector('.dt-home');
  if (!root) return;
  var keys = ['xau', 'dji'];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var w = root.querySelector('[data-pw="' + k + '"]');
    if (!w) continue;
    var sym = ms[k];
    var pe = w.querySelector('[data-pw-price]'), ce = w.querySelector('[data-pw-chg]');
    if (pe) pe.textContent = sym && sym.price != null ? faNum(sym.price) : '—';
    if (ce) { ce.textContent = chgText(sym); ce.className = 'w-chg ' + chgCls(sym && sym.changePct); }
  }
  var nx = nextHighEvent();
  var left = nx ? new Date(nx.dateISO).getTime() - Date.now() : null;
  var ve = root.querySelector('[data-cd-val]'), se = root.querySelector('[data-cd-sub]');
  if (ve) ve.textContent = left != null ? cdFormat(left) : '—';
  if (se) { se.textContent = nx ? (nx.titleFa || nx.title) : 'خبر مهمی در صف نیست'; se.title = se.textContent; }
  var c = todayCounts();
  var tc = root.querySelector('[data-tc-count]'), th = root.querySelector('[data-tc-high]');
  if (tc) tc.innerHTML = faDigits(c.count) + ' <span style="font-size:12px;font-weight:700;color:var(--mutedfg)">خبر</span>';
  if (th) th.textContent = faDigits(c.high) + ' خبر با اهمیت بالا';
}

/* ---------- چیپ‌های قیمت هدر ---------- */
function dtChipsHTML() {
  function chip(k, cls, label, letter) {
    var sym = ms[k];
    var v = sym && sym.price != null ? faNum(sym.price) : '—';
    var ch = sym ? sym.changePct : null;
    var cc = ch == null ? 'neut' : (ch > 0.05 ? 'bull' : ch < -0.05 ? 'bear' : 'neut');
    var ct = ch == null ? '' : (ch > 0 ? '+' : '') + faDigits(ch.toFixed(2)) + '٪';
    return '<div class="dt-chip ' + cls + '" title="' + label + '">' +
      '<span class="dt-chip-ic">' + letter + '</span>' +
      '<span class="dt-chip-t"><span class="dt-chip-l">' + label + '</span>' +
      '<span class="dt-chip-v">' + v + '</span>' +
      '<span class="dt-chip-c ' + cc + '">' + ct + '</span></span></div>';
  }
  return chip('xau', 'gold', 'طلا — XAU', 'Au') + chip('dji', 'dji', 'داوجونز', 'DJ');
}
function dtUpdateChips() { dtChipsEl.innerHTML = dtChipsHTML(); }

/* ---------- فعال‌سازی تب ---------- */
function dtPanelRect() {
  var d = device.getBoundingClientRect();
  return { x: d.left, y: d.top, w: d.width, h: d.height, dw: d.width, dh: d.height };
}
function dtActivate(id, srcEl) {
  var t = null;
  for (var i = 0; i < DT_TABS.length; i++) if (DT_TABS[i].id === id) t = DT_TABS[i];
  if (!t) return;
  DT.tab = id;
  dtRenderTabs();
  if (id === 'home') {
    S.app = { id: 'home', rect: dtPanelRect() };
    S.appPhase = 'open';
    sheet.hidden = false;
    applySheetGeom(false);
    dtRenderHome();
  } else {
    openApp(id, srcEl || null, true);
  }
}

/* ریدایرکت renderApp برای پشتیبانی از تب «خانه» (مثلاً از applySnapshot) */
var _dtBaseRenderApp = renderApp;
renderApp = function (id, keep) {
  if (id === 'home') { dtRenderHome(); return; }
  return _dtBaseRenderApp(id, keep);
};

/* ---------- رویدادها ---------- */
dtTabsEl.addEventListener('click', function (e) {
  var b = e.target.closest('[data-dt-tab]');
  if (!b) return;
  buzz();
  dtActivate(b.dataset.dtTab, b);
});
document.getElementById('dt-menu').addEventListener('click', function () { openDrawer(); });

/* میانبرهای کیبورد: ۱-۹ تب‌ها | ←/→ جابه‌جایی تب‌ها */
window.addEventListener('keydown', function (e) {
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (S.drawerOpen) return;
  var n = parseInt(e.key, 10);
  if (n >= 1 && n <= DT_TABS.length) {
    var cur = DT_TABS.map(function (t) { return t.id; }).indexOf(DT.tab);
    if (n - 1 !== cur) { buzz(); dtActivate(DT_TABS[n - 1].id); }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    var idx = -1;
    for (var j = 0; j < DT_TABS.length; j++) if (DT_TABS[j].id === DT.tab) idx = j;
    if (idx < 0) idx = 0;
    /* در چیدمان راست‌به‌چپ: چپ = تب بعدی */
    var next = (idx + (e.key === 'ArrowLeft' ? 1 : DT_TABS.length - 1)) % DT_TABS.length;
    buzz();
    dtActivate(DT_TABS[next].id);
  }
});

/* ---------- ساعت و بروزرسانی دوره‌ای ---------- */
function dtTick() { dtClockEl.textContent = faTime(new Date()); }
dtTick();
setInterval(dtTick, 1000);
dtUpdateChips();
setInterval(function () {
  dtUpdateChips();
  if (DT.tab === 'home') dtPatchHome();
}, 15000);

/* ---------- لوگو و نسخه هدر ---------- */
(function () {
  var el = document.getElementById('dt-logo');
  if (el) {
    var probe = document.querySelector('.bt-logo-img');
    if (probe && probe.src) el.style.backgroundImage = 'url("' + probe.src + '")';
  }
  var v = document.getElementById('dt-ver');
  if (v) v.textContent = 'v__DT_VERSION__';
})();

/* ---------- شروع: تب خانه ---------- */
dtActivate('home');
