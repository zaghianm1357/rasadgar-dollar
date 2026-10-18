'use strict';
/* ================= رصدگر دلار — نسخه فایل مستقل =================
 * تک‌فایل آفلاین‌پسند: داده‌ها از اسنپ‌شات داخل فایل + تلاش اختیاری
 * بروزرسانی زنده قیمت‌ها از طریق پروکسی‌های عمومی CORS.
 * ================================================================ */

/* ---------- داده اسنپ‌شات ---------- */
var SNAP_EL = document.getElementById('sd-snapshot');
var SNAP_RAW = SNAP_EL.textContent;
var SNAP = JSON.parse(SNAP_RAW);
var GEN_ISO = SNAP.generatedAt;
var news = SNAP.news;
var ms = SNAP.market;

/* ---------- ذخیره‌سازی محلی ---------- */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

var SETTINGS_KEY = 'sd_settings_v1';
var settings = { highOnly: false, autoPrice: false, anim: true };
try {
  var _s = JSON.parse(lsGet(SETTINGS_KEY) || 'null');
  if (_s && typeof _s === 'object') {
    if (typeof _s.highOnly === 'boolean') settings.highOnly = _s.highOnly;
    if (typeof _s.autoPrice === 'boolean') settings.autoPrice = _s.autoPrice;
    if (typeof _s.anim === 'boolean') settings.anim = _s.anim;
  }
} catch (e) {}
function saveSettings() { lsSet(SETTINGS_KEY, JSON.stringify(settings)); }

var GRID_KEY = 'sd_grid_order_v1';
var HINT_KEY = 'sd_hint_v1';
var DISMISS_KEY = 'sd_banner_dismiss_v1';
var DEFAULT_ORDER = ['news', 'structure', 'suggestion', 'about'];

/* ---------- توابع تاریخ تهران ---------- */
var TEHRAN = 'Asia/Tehran';
var _keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TEHRAN, year: 'numeric', month: '2-digit', day: '2-digit' });
function dateKeyInTehran(d) { return _keyFmt.format(d); }
function todayKeyInTehran() { return dateKeyInTehran(new Date()); }
function addDaysToKey(key, days) {
  var p = key.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + days)).toISOString().slice(0, 10);
}
function faTime(d) {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: TEHRAN, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
function faDateLong(d) {
  return new Intl.DateTimeFormat('fa-IR', { timeZone: TEHRAN, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
var _FA = '۰۱۲۳۴۵۶۷۸۹';
function faDigits(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v)
    .replace(/(\d)\.(\d)/g, '$1٫$2')
    .replace(/[0-9]/g, function (c) { return _FA[+c]; })
    .replace(/%/g, '٪');
}
function faNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return faDigits(n.toLocaleString('en-US', { maximumFractionDigits: 2 })).replace(/,/g, '٬');
}

/* ---------- آیکون‌ها (SVG) ---------- */
var IC = {
  newspaper: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  trendUp: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  trendDown: '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>',
  moveH: '<polyline points="18 8 22 12 18 16"/><polyline points="6 8 2 12 6 16"/><line x1="2" y1="12" x2="22" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calDays: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  wifi: '<path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  battery: '<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/><rect width="10" height="6" x="5" y="9" rx="1" fill="currentColor" stroke="none"/>',
  signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  langs: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.48"/><path d="M16.24 7.76a6 6 0 0 1 0 8.48"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  dollar: '<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="m7 15-1.76-1.76a2 2 0 0 0-2.83 2.82l3.6 3.6C7.5 21.14 9.2 22 12 22h2a8 8 0 0 0 8-8V7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v4"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  sigM: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16" opacity=".35"/>',
  sigL: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8" opacity=".35"/><path d="M17 20V8" opacity=".35"/><path d="M22 4v16" opacity=".35"/>',
  calOff: '<path d="M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.8-1.2"/><path d="M21 15V6a2 2 0 0 0-2-2H9"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h7"/><path d="M21 10h-5"/><path d="m2 2 20 20"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
};
function icon(n, sz, cls) {
  return '<svg class="ic ' + (cls || '') + '" style="width:' + (sz || 16) + 'px;height:' + (sz || 16) + 'px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
}
function buzz() { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {} }

/* ---------- وضعیت پوسته ---------- */
var S = {
  gridOrder: (function () {
    try {
      var raw = lsGet(GRID_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 4 && arr.every(function (a) { return DEFAULT_ORDER.indexOf(a) >= 0; })) return arr;
      }
    } catch (e) {}
    return DEFAULT_ORDER.slice();
  })(),
  wiggle: false,
  drag: null,
  app: null,          // { id, rect }
  appPhase: 'closed', // closed | opening | open | closing
  ncOpen: false, ncProgress: 0,
  ccOpen: false, ccProgress: 0,
  page: 0,
  gesture: null,
  press: null
};

/* ---------- برچسب‌ها ---------- */
var APPS = {
  news: { label: 'اخبار دلار', cls: 'g-news', ic: 'newspaper' },
  structure: { label: 'ساختار بازار', cls: 'g-structure', ic: 'activity' },
  suggestion: { label: 'پیشنهاد معامله', cls: 'g-suggestion', ic: 'crosshair' },
  about: { label: 'درباره', cls: 'g-about', ic: 'info' }
};
var TF_LONG = { '5m': '۵ دقیقه', '15m': '۱۵ دقیقه', '1h': '۱ ساعته', '4h': '۴ ساعته', '1d': 'روزانه', '1wk': 'هفتگی', '1mo': 'ماهانه' };
var TF_SHORT = { '5m': '۵د', '15m': '۱۵د', '1h': '۱س', '4h': '۴س', '1d': 'روز', '1wk': 'هفته', '1mo': 'ماه' };
var TF_ORDER = ['15m', '1h', '4h', '1d', '1wk', '1mo'];
var TF_MINUTES = { '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440, '1wk': 10080, '1mo': 43200 };
var SYMBOL_LABEL = { xau: 'طلا', dji: 'داوجونز' };
function trendText(t) { return t === 'bullish' ? 'صعودی' : t === 'bearish' ? 'نزولی' : 'خنثی'; }
function trendChipCls(t) { return t === 'bullish' ? 'bull' : t === 'bearish' ? 'bear' : 'neut'; }
function trendIcon(t) { return t === 'bullish' ? 'trendUp' : t === 'bearish' ? 'trendDown' : 'moveH'; }

/* ---------- ارجاع‌های DOM ---------- */
function $(s) { return document.querySelector(s); }
var device = $('#device'), wall = $('#wall'), pages = $('#pages');
var page1 = $('#page1-inner'), page2 = $('#page2-inner');
var dotsEl = $('#dots'), dockIn = $('#dock-in');
var ncLayer = $('#nc-layer'), ncBack = $('#nc-back'), ncSheet = $('#nc-sheet');
var ccLayer = $('#cc-layer'), ccBack = $('#cc-back'), ccSheet = $('#cc-sheet');
var sheet = $('#app-sheet'), appScroll = $('#app-scroll');
var ghost = $('#drag-ghost'), sbClock = $('#sb-clock');

/* ---------- صفحات، پارالاکس، نقطه‌ها ---------- */
function onPageScroll() {
  var maxAbs = pages.scrollWidth - pages.clientWidth;
  var p = maxAbs > 0 ? Math.min(1, Math.abs(pages.scrollLeft) / maxAbs) : 0;
  wall.style.transform = 'translateX(' + ((0.5 - p) * 44).toFixed(1) + 'px) scale(1.08)';
  var np = Math.round(p * 1);
  if (np !== S.page) { S.page = np; renderDots(); }
}
function renderDots() {
  var h = '';
  for (var i = 0; i < 2; i++) h += '<button type="button" class="dot' + (S.page === i ? ' on' : '') + '" data-page="' + i + '" aria-label="صفحه ' + faDigits(i + 1) + '"></button>';
  dotsEl.innerHTML = h;
}
dotsEl.addEventListener('click', function (e) {
  var b = e.target.closest('[data-page]');
  if (!b) return;
  var maxAbs = pages.scrollWidth - pages.clientWidth;
  pages.scrollTo({ left: +b.dataset.page === 0 ? 0 : -maxAbs, behavior: 'smooth' });
});
pages.addEventListener('scroll', onPageScroll, { passive: true });

/* ---------- نوار وضعیت ---------- */
function renderStatusRight() {
  $('#sb-right').innerHTML =
    icon('signal', 14) + icon('wifi', 14) +
    '<button type="button" class="sb-batt" id="sb-batt" aria-label="باز کردن مرکز کنترل">' + icon('battery', 20) + '</button>';
  $('#sb-batt').addEventListener('click', function (e) { e.stopPropagation(); openCC(); });
}
function tickClock() { sbClock.textContent = faTime(new Date()); }
sbClock.addEventListener('click', function (e) { e.stopPropagation(); openNC(); });

/* ---------- مرکز اعلان‌ها / کنترل ---------- */
function setNC(v) { S.ncProgress = Math.max(0, Math.min(1, v)); applyCenter(ncLayer, ncBack, ncSheet, S.ncProgress, true); }
function setCC(v) { S.ccProgress = Math.max(0, Math.min(1, v)); applyCenter(ccLayer, ccBack, ccSheet, S.ccProgress, false); }
function applyCenter(layer, back, panel, progress, fromTop) {
  layer.style.pointerEvents = progress > 0 ? 'auto' : 'none';
  back.style.opacity = progress;
  panel.style.transform = fromTop
    ? 'translateY(' + ((progress - 1) * 100).toFixed(2) + '%)'
    : 'translateY(' + ((1 - progress) * 100).toFixed(2) + '%)';
  if (progress === 0 || progress === 1) panel.classList.add('spring');
  else panel.classList.remove('spring');
}
function openNC() { if (S.ncOpen) return; renderNC(); S.ncOpen = true; setNC(1); }
function closeNC() { S.ncOpen = false; setNC(0); }
function openCC() { if (S.ccOpen) return; renderCC(); S.ccOpen = true; setCC(1); }
function closeCC() { S.ccOpen = false; setCC(0); }
ncBack.addEventListener('click', closeNC);
ccBack.addEventListener('click', closeCC);

/* حرکات کشیدن از بالا/پایین روی سطح قاب */
device.addEventListener('pointerdown', function (e) {
  if (S.wiggle || S.drag || S.gesture || S.ncOpen || S.ccOpen) return;
  if (e.target.closest('[data-nogesture]')) return;
  var rect = device.getBoundingClientRect();
  var y = e.clientY - rect.top;
  var inApp = !!S.app && S.appPhase !== 'closing';
  if (y < 46) {
    S.gesture = { type: 'nc', startY: e.clientY, id: e.pointerId };
    try { device.setPointerCapture(e.pointerId); } catch (err) {}
  } else if (y > rect.height - 44) {
    S.gesture = { type: inApp ? 'close-app' : 'cc', startY: e.clientY, id: e.pointerId };
    try { device.setPointerCapture(e.pointerId); } catch (err) {}
  }
});
device.addEventListener('pointermove', function (e) {
  var g = S.gesture;
  if (!g || e.pointerId !== g.id) return;
  var dy = e.clientY - g.startY;
  if (g.type === 'nc') setNC(dy / 150);
  else if (g.type === 'cc') setCC(-dy / 170);
});
device.addEventListener('pointerup', function (e) {
  var g = S.gesture;
  S.gesture = null;
  if (!g || e.pointerId !== g.id) return;
  if (g.type === 'nc') { if (S.ncProgress > 0.4) { renderNC(); S.ncOpen = true; setNC(1); } else { S.ncOpen = false; setNC(0); } }
  else if (g.type === 'cc') { if (S.ccProgress > 0.4) { renderCC(); S.ccOpen = true; setCC(1); } else { S.ccOpen = false; setCC(0); } }
  else if (g.type === 'close-app') { if (e.clientY - g.startY < -36 && S.app && S.appPhase !== 'closing') closeApp(); }
});
device.addEventListener('pointercancel', function () {
  S.gesture = null;
  setNC(S.ncOpen ? 1 : 0);
  setCC(S.ccOpen ? 1 : 0);
});

/* ---------- اجرای اپ با انیمیشن بزرگ‌نمایی (FLIP) ---------- */
function applySheetGeom(animate) {
  var spring = 'transform .42s cubic-bezier(.32,.72,0,1), border-radius .42s cubic-bezier(.32,.72,0,1)';
  if (S.app && S.appPhase !== 'open') {
    var r = S.app.rect;
    sheet.style.transition = animate ? spring : 'none';
    sheet.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px) scale(' + (r.w / r.dw).toFixed(4) + ',' + (r.h / r.dh).toFixed(4) + ')';
    sheet.style.borderRadius = '22px';
  } else {
    sheet.style.transition = spring;
    sheet.style.transform = 'none';
    sheet.style.borderRadius = '0px';
  }
}
function openApp(id, srcEl) {
  if (!srcEl) { srcEl = dockIn.querySelector('[data-app="' + id + '"]'); }
  var d = device.getBoundingClientRect();
  var r = srcEl ? srcEl.getBoundingClientRect() : d;
  buzz();
  S.app = {
    id: id,
    rect: { x: r.left - d.left, y: r.top - d.top, w: r.width, h: r.height, dw: d.width, dh: d.height }
  };
  S.appPhase = 'opening';
  renderApp(id);
  sheet.hidden = false;
  applySheetGeom(false);
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { S.appPhase = 'open'; applySheetGeom(true); });
  });
}
function closeApp() {
  if (!S.app || S.appPhase === 'closing') return;
  S.appPhase = 'closing';
  applySheetGeom(true);
  setTimeout(function () { sheet.hidden = true; S.app = null; S.appPhase = 'closed'; }, 430);
}
$('#homebar').addEventListener('click', function () { if (S.app) closeApp(); else if (S.ccOpen) closeCC(); else openCC(); });
$('#app-homebar').addEventListener('click', closeApp);
$('#app-homebar').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (S.ncOpen) closeNC(); else if (S.ccOpen) closeCC(); else if (S.app) closeApp(); } });

/* ---------- حالت لرزش و جابه‌جایی آیکون‌ها ---------- */
var LONG_PRESS_MS = 450;
function cancelLongPress() { if (S.press && S.press.timer) clearTimeout(S.press.timer); }
function iconGridEl() { return page1.querySelector('.icongrid'); }
function renderIconGhost(id, x, y) {
  ghost.hidden = false;
  ghost.style.left = x + 'px';
  ghost.style.top = y + 'px';
  ghost.innerHTML = iconVisHTML(id, 52) + '<span class="ghost-label">' + APPS[id].label + '</span>';
}
function page1IconPointerDown(id, e) {
  e.stopPropagation();
  if (S.wiggle) {
    S.drag = { id: id, x: e.clientX, y: e.clientY };
    renderIconGhost(id, e.clientX, e.clientY);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  } else {
    var self = e.currentTarget;
    S.press = {
      id: id, startX: e.clientX, startY: e.clientY, longFired: false,
      timer: setTimeout(function () {
        S.wiggle = true;
        if (S.press) S.press.longFired = true;
        buzz();
        refreshWiggleUI();
      }, LONG_PRESS_MS)
    };
    try { self.setPointerCapture(e.pointerId); } catch (err) {}
  }
}
function page1IconPointerMove(id, e) {
  if (S.wiggle) {
    if (!S.drag || S.drag.id !== id) return;
    S.drag.x = e.clientX; S.drag.y = e.clientY;
    renderIconGhost(id, e.clientX, e.clientY);
    var order = S.gridOrder;
    var target = -1;
    for (var i = 0; i < order.length; i++) {
      var el = iconGridEl().querySelector('[data-icon="' + order[i] + '"] .icon-vis');
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right) { target = i; break; }
    }
    var cur = order.indexOf(id);
    if (target >= 0 && target !== cur) {
      var next = order.slice();
      next.splice(cur, 1);
      next.splice(target, 0, id);
      S.gridOrder = next;
      renderIconsGrid();
    }
    return;
  }
  var p = S.press;
  if (p && p.id === id) {
    if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 10) cancelLongPress();
  }
}
function page1IconPointerUp(id) {
  cancelLongPress();
  if (S.drag) {
    lsSet(GRID_KEY, JSON.stringify(S.gridOrder));
    S.drag = null;
    ghost.hidden = true;
    buzz();
  }
}
function page1IconClick(id) {
  if (S.press && S.press.longFired) { S.press.longFired = false; return; }
  if (S.wiggle) return;
  var el = iconGridEl().querySelector('[data-icon="' + id + '"]');
  openApp(id, el);
}
$('#wiggle-done').addEventListener('click', function () {
  S.wiggle = false;
  lsSet(GRID_KEY, JSON.stringify(S.gridOrder));
  refreshWiggleUI();
});
function refreshWiggleUI() {
  $('#wiggle-done').hidden = !S.wiggle;
  renderIconsGrid();
}

/* ---------- بروزرسانی زنده قیمت‌ها (پروکسی عمومی — تلاش نهاایی) ---------- */
var priceState = { mode: 'snapshot', lastTry: null, trying: false, okAt: null };
var PROXIES = [
  function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
  function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); },
  function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }
];
function fetchJSON(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); reject(new Error('timeout')); }, timeoutMs || 9000);
    fetch(url, { signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(t); resolve(j); })
      .catch(function (err) { clearTimeout(t); reject(err); });
  });
}
function fetchYahooPrice(sym) {
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1d&interval=1m';
  var i = 0;
  function attempt() {
    if (i >= PROXIES.length) return Promise.resolve(null);
    var p = PROXIES[i++];
    return fetchJSON(p(u), 9000).then(function (j) {
      var r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r || !r.meta || typeof r.meta.regularMarketPrice !== 'number') throw new Error('bad payload');
      var meta = r.meta;
      return { price: meta.regularMarketPrice, prev: (meta.chartPreviousClose != null ? meta.chartPreviousClose : meta.previousClose) || null };
    }).catch(function () { return attempt(); });
  }
  return attempt();
}
function refreshPrices() {
  if (priceState.trying) return Promise.resolve(false);
  priceState.trying = true;
  setPriceBusy(true);
  return Promise.all([fetchYahooPrice('GC=F'), fetchYahooPrice('^DJI')])
    .then(function (rs) {
      var ax = rs[0], ad = rs[1], ok = false;
      if (ax && ms.xau) {
        ms.xau.price = ax.price;
        if (ax.prev) { ms.xau.prevClose = ax.prev; ms.xau.changePct = (ax.price - ax.prev) / ax.prev * 100; }
        ok = true;
      }
      if (ad && ms.dji) {
        ms.dji.price = ad.price;
        if (ad.prev) { ms.dji.prevClose = ad.prev; ms.dji.changePct = (ad.price - ad.prev) / ad.prev * 100; }
        ok = true;
      }
      priceState.lastTry = new Date();
      priceState.trying = false;
      setPriceBusy(false);
      if (ok) {
        priceState.mode = 'live';
        priceState.okAt = new Date();
        updatePriceWidgets(true);
        updateStatusUI();
        if (S.app && S.app.id === 'structure' && S.appPhase === 'open') renderApp('structure', true);
      } else {
        priceState.mode = 'offline';
        updateStatusUI();
      }
      return ok;
    })
    .catch(function () { priceState.trying = false; setPriceBusy(false); priceState.mode = 'offline'; updateStatusUI(); return false; });
}
function restoreSnapshot() {
  try {
    var snap = JSON.parse(SNAP_RAW);
    news = snap.news; ms = snap.market;
    priceState.mode = 'snapshot';
    updatePriceWidgets(true);
    updateStatusUI();
    if (S.app && S.appPhase === 'open') renderApp(S.app.id, true);
  } catch (e) {}
}
var _autoPriceTimer = null;
function applyAutoPrice() {
  if (_autoPriceTimer) { clearInterval(_autoPriceTimer); _autoPriceTimer = null; }
  if (settings.autoPrice) {
    _autoPriceTimer = setInterval(function () {
      if (document.visibilityState === 'visible') refreshPrices();
    }, 15 * 60 * 1000);
  }
}
function setPriceBusy(busy) {
  var b1 = document.getElementById('cc-refresh-prices');
  if (b1) b1.disabled = busy;
  var spins = document.querySelectorAll('[data-price-spin]');
  for (var i = 0; i < spins.length; i++) spins[i].classList.toggle('spin', busy);
  updateStatusUI();
}
function priceModeLabel() {
  if (priceState.mode === 'live') return 'قیمت زنده';
  if (priceState.mode === 'offline') return 'بروزرسانی ناموفق';
  return 'اسنپ‌شات فایل';
}
