/* ================= رندر رابط کاربری دستیار معامله‌گر ================= */

function btHead() {
  return '<div class="bt-head">' +
    '<span class="bt-logo-ic">' + icon('briefcase', 18) + '</span>' +
    '<div class="bt-head-t"><p class="bt-logo-t" dir="ltr">BIG TRADER</p>' +
    '<p class="bt-logo-s">دستیار هوشمند معامله‌گری — اطلاع‌رسانی، نه توصیه</p></div>' +
    '<button type="button" class="ai-rf" data-bt-refresh aria-label="بروزرسانی داده دستیار">' + icon('refresh', 12) + '</button>' +
    '</div>';
}
function btSymChips() {
  var h = '<div class="bt-syms">';
  var list = [['xau', 'طلا — XAUUSD'], ['dji', 'داوجونز — DJI']];
  for (var i = 0; i < list.length; i++)
    h += '<button type="button" class="cchip' + (BT.sym === list[i][0] ? ' on' : '') + '" data-bt-sym="' + list[i][0] + '">' + list[i][1] + '</button>';
  return h + '</div>';
}
function btTabBar() {
  var h = '<div class="bt-tabs">';
  for (var i = 0; i < BT_TABS.length; i++)
    h += '<button type="button" class="cchip' + (BT.tab === BT_TABS[i][0] ? ' on' : '') + '" data-bt-tab="' + BT_TABS[i][0] + '">' + BT_TABS[i][1] + '</button>';
  return h + '</div>';
}
function btSec(title, ic, body, tone) {
  return '<section class="bt-sec"><div class="bt-sec-h" style="' + (tone ? 'color:' + tone : '') + '">' + icon(ic, 14) + '<h2>' + title + '</h2></div>' + body + '</section>';
}
function btPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v > 0 ? '+' : '') + faDigits(Math.round(v * 100) / 100) + '٪';
}
function btNum(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return faDigits(Math.round(v * 100) / 100);
}
function btDot(t) {
  var cls = t === 'bullish' ? 'bull' : t === 'bearish' ? 'bear' : 'neut';
  return '<span class="tdot ' + cls + '">' + icon(t === 'bullish' ? 'trendUp' : t === 'bearish' ? 'trendDown' : 'moveH', 10) + (t ? BT_TREND_FA[t] : '—') + '</span>';
}

/* ---------- تب نمای بازار ---------- */
function btViewHTML() {
  var d = BT.data;
  var scoreCls = d.verdict === 'strong' ? 'ok' : d.verdict === 'moderate' ? 'mid' : 'bad';
  var rows = [
    ['هم‌جهتی تایم‌فریم‌ها', d.factors.tf, 40],
    ['خلأ خبری', d.factors.news, 30],
    ['همبستگی با DXY', d.factors.dxy, 20],
    ['نوسان ATR', d.factors.atr, 10]
  ];
  var brk = '';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    brk += '<div class="bt-frow"><div class="bt-frow-t"><span>' + r[0] + '</span><span class="bt-frow-v">' + faDigits(r[1].score) + '/' + faDigits(r[2]) + ' — ' + r[1].label + '</span></div>' +
      '<div class="bt-bar"><span style="width:' + Math.round(r[1].score / r[2] * 100) + '%"></span></div>' +
      '<p class="bt-frow-d">' + r[1].detail + '</p></div>';
  }
  var tbl = '';
  var tfs = ['15m', '1h', '4h', '1d'];
  for (i = 0; i < tfs.length; i++) {
    var row = btRowOf(BT.sym, tfs[i]);
    tbl += '<tr><td>' + BT_TF_FA[tfs[i]] + '</td><td>' + btDot(row && row.trend) + '</td><td>' + (row && row.trend ? faDigits(row.strength) + '٪' : '—') + '</td></tr>';
  }
  var specs = '';
  for (i = 0; i < d.conf.specs.length; i++) {
    var s = d.conf.specs[i];
    specs += '<div class="bt-spec"><span class="k">' + s[0] + '</span><span class="v">' + s[1] + (s[2] ? '<em>نیازمند تأیید</em>' : '') + '</span></div>';
  }
  var changes = BT.changes.length
    ? '<ul class="bt-list">' + BT.changes.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>'
    : '<p class="bt-note">تغییر قابل‌توجهی نسبت به بازدید قبلی شما ثبت نشده است (یا این اولین بازدید است).</p>';

  return btSec('موتور همگرایی پویا — امتیاز اطمینان', 'gauge',
    '<div class="bt-score-row"><div class="bt-score ' + scoreCls + '"><b>' + faDigits(d.total) + '</b><span>از ۱۰۰</span></div>' +
    '<div class="bt-score-txt"><p class="bt-score-v">' + trVerdictLabel(d.verdict) + '</p>' +
    '<p class="bt-note">≥۷۵ قوی · ۵۰–۷۴ متوسط · کمتر از ۵۰ بدون معامله — امتیاز، فرصت را اندازه می‌گیرد، نه نتیجه را تضمین می‌کند.</p></div></div>' + brk, 'var(--violet)') +
    btSec('تحلیل ساختار بازار — جمع‌بندی ' + d.summary, 'activity',
      '<table class="mini-tbl"><thead><tr><th>تایم‌فریم</th><th>جهت</th><th>قدرت</th></tr></thead><tbody>' + tbl + '</tbody></table>' +
      '<p class="bt-note">' + d.tfF.detail + ' برداشت از وضعیت تأییدشده جداست؛ سطوح ۲۰ روز اخیر — مقاومت: ' + btNum(d.hh) + ' · حمایت: ' + btNum(d.ll) + '.</p>' +
      '<p class="bt-src">داده ساختار: اسنپ‌شات فایل — برای ساختار زنده از اپ «ساختار بازار» با بروزرسانی زنده استفاده کنید.</p>', 'var(--sky)') +
    btSec('رژیم بازار', 'activity', '<p class="bt-strong">' + d.regime.label + '</p><p class="bt-note">' + d.regime.reason + '</p>', 'var(--sky)') +
    btSec('وابستگی به DXY و US10Y', 'dollar',
      '<div class="bt-grid3">' +
      '<div class="bt-cell"><p>DXY</p><b dir="ltr">' + (d.dxyPrice ? faNum(d.dxyPrice) : '—') + '</b><span>' + btPct(d.dxyChangePct) + '</span></div>' +
      '<div class="bt-cell"><p>US10Y</p><b dir="ltr">' + (d.tnxPrice ? faNum(d.tnxPrice) : '—') + '</b><span>' + btPct(d.tnxChangePct) + '</span></div>' +
      '<div class="bt-cell"><p>همبستگی با DXY</p><b dir="ltr">' + (d.corr === null ? '—' : faDigits(Math.round(d.corr * 100) / 100)) + '</b><span>۳۰ بازده روزانه</span></div>' +
      '</div>' +
      '<p class="bt-note">' + (d.conf.inv ? 'رابطه معمول این نماد با دلار معکوس است؛ ' : 'جهت رابطه این نماد با دلار ثابت فرض نمی‌شود؛ ') + 'حرکت هم‌زمان دلیل علّی نیست و DXY فقط یکی از عوامل زمینه‌ای است.</p>', 'var(--amber)') +
    btSec('شناسنامه نماد — ' + d.conf.name, 'briefcase', specs, 'var(--amber)') +
    btSec('چه چیزی از آخرین بازدید تغییر کرده؟', 'refresh', changes + '<p class="bt-note">فقط تغییر واقعی داده‌ها نمایش داده می‌شود؛ هشدار، دستور ورود یا خروج نیست.</p>', 'var(--violet)');
}

/* ---------- تب پلن و ریسک ---------- */
function btPlanHTML() {
  var d = BT.data;
  var lock = trLock(btGet(BT_KEYS.lastloss, null));
  var lockHTML = lock.locked
    ? '<div class="bt-warn red">احتمالاً در حالت Revenge Trading هستید — یک نفس عمیق بکشید. پیشنهاد معامله تا ' + faDigits(lock.minutesLeft) + ' دقیقه قفل است.</div>'
    : '';
  var p = BT.plan;
  var result = '';
  if (p && p.ok) {
    var warns = '';
    for (var i = 0; i < p.warnings.length; i++) warns += '<p class="bt-warn-l">⚠ ' + p.warnings[i] + '</p>';
    result = '<div class="bt-plan-res">' +
      '<div class="bt-plan-grid">' +
      '<span>حد ضرر: <b class="r" dir="ltr">' + p.sl + '</b></span><span>حد سود: <b class="g" dir="ltr">' + p.tp + '</b></span>' +
      '<span>حجم: <b class="a" dir="ltr">' + p.lots + '</b> لات</span><span>ریسک: <b dir="ltr">$' + p.riskAmount + '</b></span>' +
      '<span>زیان در SL: <b class="r" dir="ltr">$' + p.lossAtSL + '</b></span><span>سود در TP: <b class="g" dir="ltr">$' + p.profitAtTP + '</b></span>' +
      '</div>' +
      '<div class="bt-copy"><code dir="ltr">' + p.copyText + '</code><button type="button" class="ai-rf" data-bt-copy aria-label="کپی خلاصه پلن">' + icon('copy', 11) + '</button></div>' + warns + '</div>';
  } else if (p && !p.ok) {
    result = '<p class="bt-warn red">' + p.error + '</p>';
  }
  /* چک‌لیست */
  var auto = [
    ['خبر مهم نزدیک است؟', d.mins !== null && d.mins < 240],
    ['تایم‌فریم‌ها ' + d.summary + ' هستند؟', d.summary === 'هم‌جهت'],
    ['حرکت DXY با سناریو سازگار است؟', d.div.level === 'normal'],
    ['داده‌های لازم موجود هستند؟', true]
  ];
  var chk = '';
  for (i = 0; i < auto.length; i++)
    chk += '<div class="bt-chk-row"><span>' + auto[i][0] + '</span><span class="bt-chip ' + (auto[i][1] ? 'ok' : 'bad') + '">' + (auto[i][1] ? 'بله' : 'خیر') + '</span></div>';
  var manuals = [['reason', 'دلیل معامله روشن و ثبت شده است؟'], ['sl', 'حد ضرر یا شرط ابطال مشخص است؟'], ['cap', 'ریسک معامله با سقف ریسک من سازگار است؟']];
  var done = 0;
  for (i = 0; i < manuals.length; i++) {
    var on = !!BT.checks[manuals[i][0]];
    if (on) done++;
    chk += '<label class="bt-chk-row man"><span>' + manuals[i][1] + '</span><input type="checkbox" data-bt-chk="' + manuals[i][0] + '"' + (on ? ' checked' : '') + '></label>';
  }
  var readyNote = done === manuals.length
    ? '<p class="bt-note ok">چک‌لیست کامل شد — اجرای برنامه همچنان بر عهده خودتان است.</p>'
    : '<p class="bt-note warn">وضعیت: تحلیل ناقص — موارد دستی را تکمیل کنید؛ اطلاعات حدس زده نمی‌شود.</p>';

  /* پیش‌مرگ */
  var pmBtns = '<div class="bt-pm-btns">' +
    '<button type="button" class="cchip' + (BT.pmSide === 'buy' ? ' on' : '') + '" data-bt-pm="buy">سناریوی خرید</button>' +
    '<button type="button" class="cchip' + (BT.pmSide === 'sell' ? ' on' : '') + '" data-bt-pm="sell">سناریوی فروش</button></div>';
  var pmList = '<ul class="bt-list red">' + trPreMortem({
    side: BT.pmSide, structure4h: d.structure4h, tfScore: d.tfF.score, newsMin: d.mins,
    div: d.div.level, regime: d.regime.type, rsi: d.rsi
  }).map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>' +
    '<p class="bt-note">شواهد موافق و مخالف با هم نمایش داده می‌شوند؛ ابزار صرفاً نظر اولیه شما را تأیید نمی‌کند.</p>';

  /* ریسک تجمیعی */
  var poss = btGet(BT_KEYS.positions, []);
  var posHTML = '', totalRisk = 0;
  for (i = 0; i < poss.length; i++) {
    var pp = poss[i];
    totalRisk += pp.riskUsd;
    posHTML += '<div class="bt-pos"><b>' + pp.sym + '</b><span class="' + (pp.side === 'buy' ? 'g' : 'r') + '">' + (pp.side === 'buy' ? 'خرید' : 'فروش') + '</span><span dir="ltr">' + pp.lots + ' lot</span><span dir="ltr">$' + pp.riskUsd + '</span><button type="button" data-bt-posdel="' + pp.id + '" aria-label="حذف پوزیشن">' + icon('x', 11) + '</button></div>';
  }
  var bal = Number((document.getElementById('bt_balance') || {}).value || 0);
  var totPct = bal > 0 ? Math.round(totalRisk / bal * 10000) / 100 : null;
  var posSec = poss.length === 0
    ? '<p class="bt-note">پوزیشنی ثبت نشده است. پوزیشن‌های باز خود را اضافه کنید تا مواجهه کلی با دلار بررسی شود.</p>'
    : posHTML + '<p class="bt-note">ریسک تجمیعی: <b dir="ltr">$' + Math.round(totalRisk * 100) / 100 + '</b>' + (totPct !== null ? ' (' + btPct(totPct) + ' موجودی)' : '') + (totPct !== null && totPct > 5 ? ' — بالاتر از سقف معمول ۵٪؛ هم‌جهت‌بودن پوزیشن‌ها در برابر دلار را بررسی کنید.' : '') + '</p>';
  posSec += '<div class="bt-pos-add">' +
    '<select id="bt_psym"><option>XAUUSD</option><option>DJI</option><option>EURUSD</option><option>BTCUSDT</option></select>' +
    '<select id="bt_pside"><option value="buy">خرید</option><option value="sell">فروش</option></select>' +
    '<input id="bt_plots" inputmode="decimal" dir="ltr" placeholder="لات">' +
    '<input id="bt_prisk" inputmode="decimal" dir="ltr" placeholder="ریسک $">' +
    '<button type="button" data-bt-posadd aria-label="افزودن پوزیشن">+</button></div>' +
    '<p class="bt-note">چند نماد متفاوت می‌توانند هم‌زمان تحت‌تأثیر یک عامل مشترک (دلار) باشند؛ همبستگی ثابت فرض نمی‌شود.</p>';

  return lockHTML +
    btSec('تولیدکننده خودکار پلن معامله', 'crosshair',
      '<div class="bt-form2">' +
      '<label>جهت<select id="bt_side"><option value="buy">خرید (Buy)</option><option value="sell">فروش (Sell)</option></select></label>' +
      '<label>نقطه ورود<input id="bt_entry" inputmode="decimal" dir="ltr" placeholder="' + (d.price ? Math.round(d.price * 100) / 100 : '4200') + '"></label>' +
      '<label>موجودی حساب ($)<input id="bt_balance" inputmode="decimal" dir="ltr" placeholder="1000" value="1000"></label>' +
      '<label>ریسک (٪)<input id="bt_risk" inputmode="decimal" dir="ltr" placeholder="1" value="1"></label>' +
      '<label>نسبت R/R<select id="bt_rr"><option value="2">۱ به ۲</option><option value="3">۱ به ۳</option></select></label>' +
      '<label>مبنای حد ضرر<select id="bt_slmode"><option value="atr">ATR × ۱.۵ (خودکار)</option><option value="swing">آخرین سوئینگ</option></select></label>' +
      '</div>' +
      '<button type="button" class="bt-gen" data-bt-gen' + (lock.locked ? ' disabled' : '') + '>ساخت پلن</button>' + result, 'var(--violet)') +
    btSec('چک‌لیست پیش از معامله', 'check', chk + readyNote, 'var(--emerald)') +
    btSec('اگر این معامله شکست بخورد، محتمل‌ترین دلیل چیست؟', 'alert', pmBtns + pmList, 'var(--red)') +
    btSec('ریسک تجمیعی پوزیشن‌ها', 'alert', posSec, 'var(--amber)');
}

/* ---------- تب اخبار و سناریو ---------- */
function btNewsHTML() {
  var d = BT.data;
  var ev = d.nextHigh;
  var cal = ev
    ? '<div class="bt-ev"><div class="bt-ev-t"><b>' + (ev.titleFa || ev.title) + '</b><span class="bt-chip bad">اهمیت بالا</span></div>' +
      '<p class="bt-note"><b style="color:var(--amber)">ارز: ' + currencyFa(ev.country) + '</b> — ' + (ev.dateISO ? faTime(new Date(ev.dateISO)) + ' تهران' : 'زمان نامشخص') + ' — پیش‌بینی: <span dir="ltr">' + (ev.forecast || '—') + '</span> · قبلی: <span dir="ltr">' + (ev.previous || '—') + '</span></p>' +
      (ev.country !== 'USD' ? '<p class="bt-note" style="border:1px solid rgba(56,189,248,.3);background:rgba(56,189,248,.08);border-radius:8px;padding:6px 8px;font-size:9.5px">این خبر مربوط به دلار آمریکا نیست، اما داده قوی اقتصادهای اصلی از مسیر شاخص دلار و حس ریسک بر طلا و داو اثر می‌گذارد؛ به همین دلیل در تقویم نمایش داده می‌شود.</p>' : '') +
      '<p class="bt-cd">' + (d.mins !== null ? (d.mins >= 60 ? faDigits(Math.floor(d.mins / 60)) + ' ساعت و ' : '') + faDigits(Math.round(d.mins % 60)) + ' دقیقه باقی‌مانده' : '—') + '</p>' +
      (d.mins !== null && d.mins < 240 ? '<div class="bt-warn">هشدار: خبر مهم نزدیک است — نوسان، اسپرد و لغزش ممکن است به‌طور موقت چند برابر شود. این هشدار دستور ورود/خروج نیست.</div>' : '') +
      '</div>'
    : '<p class="bt-note">در فید این هفته خبری با اهمیت «بالا» از اقتصادهای اصلی (آمریکا، اروپا، انگلیس، ژاپن، کانادا، استرالیا، نیوزیلند) ثبت نشده است. تقویم ForexFactory فقط هفته جاری را پوشش می‌دهد؛ خبرهای «متوسط» هفته در اپ اخبار دیده می‌شوند.</p>' +
      '<p class="bt-note">توجه: در فایل مستقل، فید خبری همان اسنپ‌شات لحظه تولید فایل است و بروزرسانی زنده ندارد.</p>';
  cal += '<p class="bt-src">منبع: ForexFactory (USD کامل + ارزهای اصلی High/Medium) — مناسبت‌ها و زمان‌های بدون تاریخ، حدس زده نمی‌شوند.</p>';

  var sc = '';
  if (d.scenarios.length) {
    if (d.conflict) sc += '<div class="bt-warn red">⚠ هشدار ریسک: ' + d.conflict + '</div>';
    for (var i = 0; i < d.scenarios.length; i++) {
      var s = d.scenarios[i];
      sc += '<div class="bt-sc"><p class="t">' + s.title + '</p><p>' + s.trigger + '.</p>' +
        '<p class="b">طلا: ' + (s.xauDir || '—') + (s.djiDir ? ' · داوجونز: ' + s.djiDir : '') + '</p>' +
        '<p class="m">' + s.confirm + '</p><p class="m">' + s.invalidate + '</p><p class="m">' + s.limits + '</p></div>';
    }
  }

  var hist;
  if (d.history.available) {
    hist = '<p class="bt-note">در ' + faDigits(d.history.n) + ' نمونه مشابه از همین عنوان خبر در ۳۰ روز اخیر، میانگین واکنش دو روزه طلا <b dir="ltr">' + (d.history.avg > 0 ? '+' : '') + d.history.avg + '٪</b> بوده است (در ' + faDigits(d.history.up) + '٪ موارد مثبت).</p>' +
      '<p class="bt-note">روش: تغییر درصدی بسته‌شدن دو روز کاری در برابر روز خبر — فیوچرز GC=F. تاریخچه تضمین واکنش آینده نیست و عدم‌قطعیت نمونه کم بالاست.</p>';
  } else {
    hist = '<p class="bt-note">' + d.history.reason + ' (نمونه‌های قابل‌اتصال: ' + faDigits(d.history.n || 0) + ')</p>';
  }

  return btSec('تقویم رویدادها — آمادگی پیش از خبر', 'flame', cal, 'var(--amber)') +
    (d.scenarios.length ? btSec('شبیه‌ساز واکنش به خبر — دو سناریوی مشروط', 'sparkles', sc, 'var(--violet)') : '') +
    btSec('مقایسه با واکنش‌های تاریخی خبر', 'calDays', hist, 'var(--sky)');
}

/* ---------- تب ژورنال ---------- */
function btJournalHTML() {
  var entries = btGet(BT_KEYS.journal, []);
  var lock = trLock(btGet(BT_KEYS.lastloss, null));
  var todayKey = todayKeyInTehran();
  var lossesToday = 0, i;
  for (i = 0; i < entries.length; i++)
    if (entries[i].result === 'loss' && entries[i].atISO && dateKeyInTehran(new Date(entries[i].atISO)) === todayKey) lossesToday++;
  var rest = trRest(lossesToday);

  var h = '';
  if (lock.locked) h += '<div class="bt-warn red">احتمالاً در حالت Revenge Trading هستید — یک نفس عمیق بکشید. پیشنهاد معامله تا ' + faDigits(lock.minutesLeft) + ' دقیقه دیگر قفل است.</div>';
  if (rest.suggest) h += '<div class="bt-warn">' + rest.message + '</div>';

  h += btSec('ثبت فرض‌ها — پیش از معامله', 'book',
    '<div class="bt-form2">' +
    '<label>جهت<select id="bt_jside"><option value="buy">خرید</option><option value="sell">فروش</option></select></label>' +
    '<label>ورود (اختیاری)<input id="bt_jentry" inputmode="decimal" dir="ltr"></label>' +
    '</div>' +
    '<label class="bt-lbl">دلیل ورود (اجباری)<textarea id="bt_jreason" rows="2" placeholder="مثال: بازگشت از حمایت با کندل پوششی در ۱ ساعته"></textarea></label>' +
    '<label class="bt-lbl">سناریوی انتخاب‌شده<input id="bt_jscen" placeholder="سناریوی اول / دوم یا توضیح خودتان"></label>' +
    '<label class="bt-lbl">شرط ابطال (اجباری)<textarea id="bt_jinval" rows="2" placeholder="مثال: بسته‌شدن کندل زیر 4185"></textarea></label>' +
    '<label class="bt-lbl">انتظار شما از معامله<input id="bt_jexp" placeholder="مثال: رسیدن به TP با RR=۲"></label>' +
    '<button type="button" class="bt-gen green" data-bt-jsave>ثبت در ژورنال</button>' +
    '<p class="bt-note" id="bt_jsave-msg">بدون دلیل و شرط ابطال، ثبت انجام نمی‌شود — تحلیل ناقص حدس زده نمی‌شود.</p>', 'var(--emerald)');

  var list = '';
  if (!entries.length) {
    list = '<p class="bt-note">هنوز معامله‌ای ثبت نشده است. کیفیت تصمیم جدا از سود/زیان ارزیابی می‌شود.</p>';
  } else {
    var dqFa = { good: 'تصمیم خوب + نتیجه مثبت', neutral: 'تصمیم سالم', lucky: 'نتیجه مثبت با فرآیند ناسالم', 'bad-execution': 'اجرای ناسالم' };
    for (i = 0; i < Math.min(10, entries.length); i++) {
      var e = entries[i];
      var dq = e.review && e.result ? trDQ(e.review, e.result) : null;
      var body = '<div class="bt-jt"><b>' + (e.side === 'buy' ? 'خرید' : 'فروش') + (e.entry ? ' @ ' + e.entry : '') + '</b><span>' + faTime(new Date(e.atISO)) + '</span></div>' +
        '<p class="bt-note">دلیل: ' + e.reason + '</p><p class="bt-note">ابطال: ' + e.invalidation + '</p>' +
        (dq ? '<p class="bt-note sky">ارزیابی: ' + dqFa[dq.grade] + ' — ' + dq.note + '</p>' : '');
      if (!e.result) {
        body += '<div class="bt-jres"><span>نتیجه:</span>' +
          '<button type="button" class="cchip g" data-bt-res="win" data-bt-id="' + e.id + '">سود</button>' +
          '<button type="button" class="cchip r" data-bt-res="loss" data-bt-id="' + e.id + '">ضرر</button>' +
          '<button type="button" class="cchip" data-bt-res="be" data-bt-id="' + e.id + '">سربه‌سر</button></div>';
      } else {
        body += '<div class="bt-jres"><span class="bt-chip ' + (e.result === 'win' ? 'ok' : e.result === 'loss' ? 'bad' : '') + '">' + (e.result === 'win' ? 'سود' : e.result === 'loss' ? 'ضرر' : 'سربه‌سر') + '</span>';
        if (e.review) {
          var rvs = [['followedPlan', 'طبق برنامه'], ['riskRespected', 'ریسک رعایت شد'], ['slMovedBadly', 'SL بد جابه‌جا شد'], ['assumptionViolated', 'فرض نقض شد']];
          for (var j = 0; j < rvs.length; j++)
            body += '<button type="button" class="bt-mini' + (e.review[rvs[j][0]] ? ' on' : '') + '" data-bt-rv="' + rvs[j][0] + '" data-bt-id="' + e.id + '">' + rvs[j][1] + '</button>';
        }
        body += '</div>';
      }
      list += '<div class="bt-jitem">' + body + '</div>';
    }
  }
  h += btSec('معاملات ثبت‌شده', 'book', list + '<p class="bt-note">نتیجه یک معامله به‌تنهایی اثبات خوب یا بد بودن روش شما نیست؛ ژورنال فقط روی همین دستگاه ذخیره می‌شود.</p>', 'var(--sky)');
  return h;
}

/* ---------- رندر اصلی اپ ---------- */
function renderTraderApp(soft) {
  if (!soft) { BT.tab = btGet('bt_tab_v1', 'view'); }
  var inner = btHead() + btSymChips() + btTabBar();

  /* نوار واگرایی همیشه فعال */
  if (BT.data) {
    var dv = BT.data.div;
    var dot = dv.color === 'green' ? '🟢' : dv.color === 'amber' ? '🟡' : dv.color === 'red' ? '🔴' : '⚪';
    inner += '<div class="bt-divbar ' + dv.color + '"><span class="e">' + dot + '</span><div class="t"><b>' + dv.text + '</b><span>' + dv.reason + '</span></div></div>';
  }
  if (BT.nudge) inner += '<div class="bt-warn">⚠ ' + BT.nudge + '</div>';
  if (BT.data && BT.data.degraded) inner += '<div class="bt-warn">حالت کاهش‌یافته: دریافت داده زنده Yahoo ناموفق بود — فقط اسنپ‌شات فایل نمایش داده می‌شود؛ عوامل وابسته به داده زنده با برچسب «داده ناکافی» علامت خورده‌اند. با دکمه بروزرسانی دوباره تلاش کنید.</div>';

  if (BT.busy) {
    inner += '<div class="bt-state"><span class="spin">' + icon('refresh', 20) + '</span>در حال دریافت سری روزانه و محاسبه وضعیت بازار…<span class="s">ساختار، DXY، US10Y، اخبار و امتیاز اطمینان</span></div>';
  } else if (BT.err && !BT.data) {
    inner += '<div class="bt-state"><span style="color:var(--red)">' + icon('wifi', 22) + '</span>' + BT.err +
      '<button type="button" class="btn" data-bt-refresh>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
  } else if (BT.data) {
    if (BT.tab === 'view') inner += btViewHTML();
    else if (BT.tab === 'plan') inner += btPlanHTML();
    else if (BT.tab === 'news') inner += btNewsHTML();
    else inner += btJournalHTML();
    inner += '<p class="bt-foot">منبع: ' + (BT.data.degraded ? 'اسنپ‌شات فایل (داده زنده در دسترس نبود)' : 'سری روزانه Yahoo Finance (پروکسی عمومی) · ساختار و اخبار: اسنپ‌شات فایل') + ' — آخرین محاسبه: ' + faTime(new Date()) +
      '<br>هیچ خروجی این بخش توصیه قطعی خرید/فروش یا اجرای خودکار سفارش نیست.</p>';
  }
  appScroll.innerHTML = '<div class="bt-wrap">' + inner + '</div>';
  btBind();
  /* بارگذاری اولیه — فقط وقتی هیچ داده یا وضعیتی وجود ندارد */
  if (!BT.data && !BT.busy && !BT.err) btLoadData(false);
}
function btBind() {
  var rf = appScroll.querySelector('[data-bt-refresh]');
  if (rf) rf.addEventListener('click', function () {
    var log = btGet(BT_KEYS.refresh, []);
    log.push(Date.now());
    btSet(BT_KEYS.refresh, log);
    var n = trRefreshNudge(log);
    BT.nudge = n.warn ? n.message : '';
    btLoadData(true);
  });
  var syms = appScroll.querySelectorAll('[data-bt-sym]');
  for (var i = 0; i < syms.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (BT.sym === b.dataset.btSym) return;
        BT.sym = b.dataset.btSym; BT.data = null; BT.plan = null; BT.changes = []; BT.pmSide = null;
        btLoadData(true);
      });
    })(syms[i]);
  }
  var tabs = appScroll.querySelectorAll('[data-bt-tab]');
  for (i = 0; i < tabs.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        BT.tab = b.dataset.btTab;
        btSet('bt_tab_v1', BT.tab);
        renderTraderApp(true);
      });
    })(tabs[i]);
  }
  var gen = appScroll.querySelector('[data-bt-gen]');
  if (gen) gen.addEventListener('click', function () {
    var d = BT.data;
    var side = appScroll.querySelector('#bt_side').value;
    var entry = Number((appScroll.querySelector('#bt_entry').value || '').replace(/[^\d.]/g, ''));
    var balance = Number((appScroll.querySelector('#bt_balance').value || '').replace(/[^\d.]/g, ''));
    var riskPct = Number((appScroll.querySelector('#bt_risk').value || '').replace(/[^\d.]/g, ''));
    var rr = Number(appScroll.querySelector('#bt_rr').value);
    var slMode = appScroll.querySelector('#bt_slmode').value;
    var atrAbs = d.price && d.atr !== null ? d.atr / 100 * d.price : null;
    BT.plan = trPlan({
      side: side, entry: entry, balance: balance, riskPct: riskPct, rr: rr, slMode: slMode,
      swingLevel: side === 'buy' ? d.ll : d.hh, atr: atrAbs, contractSize: d.conf.contractSize,
      symbolLabel: d.conf.label
    });
    BT.copied = false;
    renderTraderApp(true);
  });
  var cp = appScroll.querySelector('[data-bt-copy]');
  if (cp) cp.addEventListener('click', function () {
    if (!BT.plan || !BT.plan.copyText) return;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(BT.plan.copyText);
      else {
        var ta = document.createElement('textarea');
        ta.value = BT.plan.copyText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    } catch (e) {}
  });
  var chks = appScroll.querySelectorAll('[data-bt-chk]');
  for (i = 0; i < chks.length; i++) {
    (function (b) {
      b.addEventListener('change', function () { BT.checks[b.dataset.btChk] = b.checked; });
    })(chks[i]);
  }
  var pms = appScroll.querySelectorAll('[data-bt-pm]');
  for (i = 0; i < pms.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        BT.pmSide = BT.pmSide === b.dataset.btPm ? null : b.dataset.btPm;
        renderTraderApp(true);
      });
    })(pms[i]);
  }
  var pAdd = appScroll.querySelector('[data-bt-posadd]');
  if (pAdd) pAdd.addEventListener('click', function () {
    var lots = Number((appScroll.querySelector('#bt_plots').value || '').replace(/[^\d.]/g, ''));
    var risk = Number((appScroll.querySelector('#bt_prisk').value || '').replace(/[^\d.]/g, ''));
    if (!(lots > 0) || !(risk > 0)) return;
    var poss = btGet(BT_KEYS.positions, []);
    poss.push({ id: String(Date.now()), sym: appScroll.querySelector('#bt_psym').value, side: appScroll.querySelector('#bt_pside').value, lots: lots, riskUsd: risk });
    btSet(BT_KEYS.positions, poss);
    renderTraderApp(true);
  });
  var dels = appScroll.querySelectorAll('[data-bt-posdel]');
  for (i = 0; i < dels.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        var poss = btGet(BT_KEYS.positions, []).filter(function (p) { return p.id !== b.dataset.btPosdel; });
        btSet(BT_KEYS.positions, poss);
        renderTraderApp(true);
      });
    })(dels[i]);
  }
  var js = appScroll.querySelector('[data-bt-jsave]');
  if (js) js.addEventListener('click', function () {
    var reason = (appScroll.querySelector('#bt_jreason').value || '').trim();
    var inval = (appScroll.querySelector('#bt_jinval').value || '').trim();
    var msgEl = appScroll.querySelector('#bt_jsave-msg');
    if (!reason || !inval) {
      if (msgEl) { msgEl.textContent = 'تحلیل ناقص — دلیل ورود و شرط ابطال اجباری‌اند؛ اطلاعات حدس زده نمی‌شود.'; msgEl.style.color = 'var(--amber)'; }
      return;
    }
    var entries = btGet(BT_KEYS.journal, []);
    entries.unshift({
      id: String(Date.now()), atISO: new Date().toISOString(),
      reason: reason, scenario: (appScroll.querySelector('#bt_jscen').value || '').trim(),
      invalidation: inval, expectation: (appScroll.querySelector('#bt_jexp').value || '').trim(),
      side: appScroll.querySelector('#bt_jside').value, entry: (appScroll.querySelector('#bt_jentry').value || '').trim(),
      result: null, review: null
    });
    btSet(BT_KEYS.journal, entries);
    if (msgEl) { msgEl.textContent = 'ثبت شد.'; msgEl.style.color = 'var(--emerald)'; }
    renderTraderApp(true);
  });
  var ress = appScroll.querySelectorAll('[data-bt-res]');
  for (i = 0; i < ress.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        var entries = btGet(BT_KEYS.journal, []);
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].id !== b.dataset.btId) continue;
          entries[k].result = b.dataset.btRes;
          if (b.dataset.btRes === 'loss' && !entries[k].review)
            entries[k].review = { followedPlan: true, riskRespected: true, slMovedBadly: false, assumptionViolated: false };
        }
        btSet(BT_KEYS.journal, entries);
        if (b.dataset.btRes === 'loss') {
          btSet(BT_KEYS.lastloss, new Date().toISOString());
          try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
        }
        renderTraderApp(true);
      });
    })(ress[i]);
  }
  var rvs = appScroll.querySelectorAll('[data-bt-rv]');
  for (i = 0; i < rvs.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        var entries = btGet(BT_KEYS.journal, []);
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].id === b.dataset.btId && entries[k].review) entries[k].review[b.dataset.btRv] = !entries[k].review[b.dataset.btRv];
        }
        btSet(BT_KEYS.journal, entries);
        renderTraderApp(true);
      });
    })(rvs[i]);
  }
}
