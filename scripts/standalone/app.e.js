/* ================= رندر رابط کاربری دستیار معامله‌گر ================= */

function btHead() {
  return '<div class="bt-head">' +
    '<img class="bt-logo-img" src="data:image/png;base64,__BT_LOGO_B64__" alt="لوگوی BIG TRADER — نشان شیر و تاج">' +
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

/* ---------- تب نمای بازار (بدون شناسنامه نماد + ماشین‌حساب حجم/حد ضرر و حد سود) ---------- */
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
    btSec('چه چیزی از آخرین بازدید تغییر کرده؟', 'refresh', changes + '<p class="bt-note">فقط تغییر واقعی داده‌ها نمایش داده می‌شود؛ هشدار، دستور ورود یا خروج نیست.</p>', 'var(--violet)') +
    btCalcHTML();
}

/* ---------- ماشین‌حساب پیپ/حجم و حد ضرر و حد سود (انتهای نمای بازار) ---------- */
function btCalcHTML() {
  var d = BT.data;
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
      '<div class="bt-copy"><code dir="ltr">' + p.copyText + '</code><button type="button" class="ai-rf" data-bt-copy aria-label="کپی خلاصه محاسبه">' + icon('copy', 11) + '</button></div>' + warns + '</div>';
  } else if (p && !p.ok) {
    result = '<p class="bt-warn red">' + p.error + '</p>';
  }
  var zf = BT.zf || {};
  return btSec('ماشین‌حساب پیپ/حجم و حد ضرر و حد سود', 'crosshair',
    '<div class="bt-form2">' +
    '<label>جهت<select id="bt_side"><option value="buy"' + (zf.side === 'buy' ? ' selected' : '') + '>خرید (Buy)</option><option value="sell"' + (zf.side === 'sell' ? ' selected' : '') + '>فروش (Sell)</option></select></label>' +
    '<label>نقطه ورود<input id="bt_entry" inputmode="decimal" dir="ltr" placeholder="' + (d.price ? Math.round(d.price * 100) / 100 : '4200') + '" value="' + (zf.entry || '') + '"></label>' +
    '<label>موجودی حساب ($)<input id="bt_balance" inputmode="decimal" dir="ltr" placeholder="1000" value="1000"></label>' +
    '<label>ریسک (٪)<input id="bt_risk" inputmode="decimal" dir="ltr" placeholder="1" value="1"></label>' +
    '<label>نسبت R/R<select id="bt_rr"><option value="2">۱ به ۲</option><option value="3">۱ به ۳</option></select></label>' +
    '<label>مبنای حد ضرر<select id="bt_slmode"><option value="atr">ATR × ۱.۵ (خودکار)</option><option value="swing">آخرین سوئینگ</option></select></label>' +
    '</div>' +
    '<button type="button" class="bt-gen" data-bt-gen>محاسبه حد ضرر، حد سود و حجم</button>' + result +
    '<p class="bt-note">اندازه قرارداد و ارزش پیپ به کارگزاری شما بستگی دارد؛ مقادیر را با پنل کارگزاری تطبیق دهید. این ماشین‌حساب تضمین نتیجه یا توصیه معامله نیست.</p>', 'var(--violet)');
}

/* ---------- تب تحلیل هوشمند (منتقل‌شده از پنجره تریدینگ‌ویو) ---------- */
function btAiHTML() {
  var symBody = '';
  Object.keys(CHART_YAHOO).forEach(function (k) {
    symBody += '<button type="button" class="cchip' + (S_AI.sym === k ? ' on' : '') + '" data-bt-ai-sym="' + k + '">' + CHART_YAHOO[k].name + '</button>';
  });
  var tfBody = '';
  Object.keys(CHART_ITV).forEach(function (k) {
    tfBody += '<button type="button" class="cchip' + (S_AI.tf === k ? ' on' : '') + '" data-bt-ai-tf="' + k + '">' + CHART_ITV[k].label + '</button>';
  });
  return btSec('تحلیل هوشمند — نماد و تایم‌فریم دلخواه شما', 'sparkles',
    '<p class="bt-note">این بخش از پنجره تریدینگ‌ویو به دستیار معامله‌گر منتقل شده است؛ نماد و تایم‌فریم را انتخاب و «اجرای تحلیل» را بزنید. موتور: الگوریتم محلی (EMA/RSI/ATR/سوئینگ) روی کندل‌های Yahoo Finance.</p>' +
    '<div class="sc-chips" data-bt-ai-syms>' + symBody + '</div>' +
    '<div class="sc-chips" data-bt-ai-tfs>' + tfBody + '</div>' +
    '<div class="sc-chips"><button type="button" class="cchip ai-btn on" data-bt-ai-run>' + icon('sparkles', 12) + 'اجرای تحلیل</button></div>', 'var(--violet)') +
    '<div id="ai_panel" hidden>' +
    '<div class="ai-head"><span style="display:inline-flex;flex:none">' + icon('sparkles', 13) + '</span><span class="t">تحلیل هوشمند</span><span class="at" id="ai_at"></span>' +
    '<button type="button" class="ai-rf" data-ai-refresh title="بروزرسانی تحلیل">' + icon('refresh', 11) + '</button></div>' +
    '<div class="ai-body"><div class="ai-state">برای شروع، دکمه «اجرای تحلیل» را بزنید.</div></div>' +
    '<p class="ai-foot">تحلیل صرفاً اطلاع‌رسانی است و توصیه معاملاتی محسوب نمی‌شود — منبع داده: Yahoo Finance.</p>' +
    '</div>';
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

/* ---------- تب عوامل کمّی ---------- */
function btFactorsHTML() {
  if (BT.fqBusy) {
    return '<div class="bt-state"><span class="spin">' + icon('refresh', 20) + '</span>در حال برآورد رگرسیون‌های تاریخی…<span class="s">بازده نماد و عوامل در افق‌های ۱/۵/۲۰ روزه — دریافت ۴ سری ۲ساله، کمی طول می‌کشد</span></div>';
  }
  if (BT.fqErr && !BT.fq) {
    return '<div class="bt-state"><span style="color:var(--red)">' + icon('wifi', 22) + '</span>' + BT.fqErr +
      '<button type="button" class="btn" data-bt-fq-reload>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
  }
  var fq = BT.fq;
  if (!fq) return '<div class="bt-state">داده عوامل آماده نشده است.</div>';
  var score = btFqLocalScore(fq);
  var scoreLabel = score === null ? 'بدون امتیاز معتبر' : score > 15 ? 'فشار صعودی' : score < -15 ? 'فشار نزولی' : 'فشار خنثی/متعادل';
  var scoreCls = score === null ? '' : score > 15 ? 'ok' : score < -15 ? 'bad' : 'mid';
  var sumW = btFqSumValidW(fq);
  var w = btFqWeights();

  var rows = '';
  for (var i = 0; i < fq.rows.length; i++) {
    var r = fq.rows[i];
    var bc = function (b) { return b ? (b.beta >= 0 ? '+' : '') + faDigits(b.beta) + '<span class="t">t=' + faDigits(b.t) + '</span>' : '—'; };
    rows += '<tr>' +
      '<td class="fa"><b>' + r.nameFa + '</b><span dir="ltr">Yahoo: ' + r.sourceYahoo + '</span><span>وزن ' + faNum(w[r.id] !== undefined ? w[r.id] : r.w) + '</span></td>' +
      '<td dir="ltr">' + btNum(r.current) + '</td>' +
      '<td dir="ltr">' + (r.change5 === null ? '—' : (r.change5 > 0 ? '+' : '') + faDigits(r.change5) + ' ' + r.unitFa) + '</td>' +
      '<td dir="ltr">' + (r.z === null ? '—' : (r.z > 0 ? '+' : '') + faDigits(r.z)) + '</td>' +
      '<td dir="ltr">' + bc(r.beta.h1) + '</td><td dir="ltr">' + bc(r.beta.h5) + '</td><td dir="ltr">' + bc(r.beta.h20) + '</td>' +
      '<td dir="ltr"><b>' + (r.pressure === null ? 'نامشخص' : (r.pressure > 0 ? '+' : '') + faDigits(r.pressure)) + '</b></td>' +
      '<td dir="ltr">' + (r.reliability === null ? '—' : faDigits(r.reliability)) + '</td>' +
      '<td class="' + (r.effect === 'supportive' ? 'g' : r.effect === 'restrictive' ? 'r' : r.effect === 'conflict' ? 'a' : '') + '">' + r.effectFa + '</td>' +
      '</tr>';
  }
  var interps = '';
  for (i = 0; i < fq.rows.length; i++) {
    if (fq.rows[i].interpFa) interps += '<p class="bt-note boxed">' + fq.rows[i].interpFa + '</p>';
    else if (fq.rows[i].unreliableReason) interps += '<p class="bt-note warn">⚠ ' + fq.rows[i].nameFa + ': ' + fq.rows[i].unreliableReason + ' — Pressure محاسبه نشد و عدد حدس زده نشد.</p>';
  }
  var skips = '';
  if (fq.skipped.length) {
    skips = '<div class="bt-warn">عوامل کنارگذاشته‌شده از امتیاز (وزن بقیه بازتنظیم شد — مجموع وزن مؤثر: ' + faDigits(sumW) + '): <ul>' +
      fq.skipped.map(function (s) { return '<li>• ' + s.nameFa + ': ' + s.reason + '</li>'; }).join('') + '</ul></div>';
  }
  var wInputs = '';
  for (i = 0; i < fq.rows.length; i++) {
    var rw = fq.rows[i];
    wInputs += '<label class="bt-fw-row"><span>' + rw.nameFa + '</span><input type="number" min="0" max="1" step="0.05" dir="ltr" data-bt-fw="' + rw.id + '" value="' + (w[rw.id] !== undefined ? w[rw.id] : rw.w) + '" aria-label="وزن ' + rw.nameFa + '"></label>';
  }
  var notes = '<ul class="bt-list">' + fq.notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>';
  return btSec('شاخص فشار مدل — Composite', 'sparkles',
    '<div class="bt-score-row"><div class="bt-score ' + scoreCls + '"><b dir="ltr">' + (score === null ? '—' : (score > 0 ? '+' : '') + faDigits(score)) + '</b><span>−۱۰۰ تا +۱۰۰</span></div>' +
    '<div class="bt-score-txt"><p class="bt-score-v">' + scoreLabel + '</p>' +
    '<p class="bt-note">مثبت = فشار تاریخی مدل به سمت رشد نماد · منفی = فشار به سمت افت · نزدیک صفر = فشار خالص کم یا عوامل متضاد. این «شاخص فشار مدل» است — احتمال صعود، بازده مورد انتظار یا تضمین حرکت نیست.</p></div></div>' + skips, 'var(--violet)') +
    btSec('جدول کمّی عوامل — رابطه تاریخی/آماری، نه علّی', 'activity',
      '<div class="fq-scroll"><table class="mini-tbl fq"><thead><tr><th>عامل</th><th>مقدار جاری</th><th>تغییر ۵روزه</th><th>Z</th><th>β افق ۱ر</th><th>β افق ۵ر</th><th>β افق ۲۰ر</th><th>Pressure</th><th>قابلیت اتکا</th><th>اثر فعلی</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      interps + '<p class="bt-src">نمونه: ' + faDigits(fq.sampleBars || 0) + ' کندل روزانه ۲ساله · محاسبه محلی روی همین دستگاه — آخرین محاسبه: ' + faTime(new Date(fq.generatedAtISO)) + '</p>', 'var(--sky)') +
    btSec('تنظیمات وزن عوامل (۰ تا ۱)', 'crosshair',
      wInputs +
      '<p class="bt-note">وزن‌ها در امتیاز تجمیعی همان بالا اعمال می‌شوند. اگر داده عاملی موجود نباشد از امتیاز کنار گذاشته می‌شود و وزن عوامل باقی‌مانده شفاف بازتنظیم می‌شود (مجموع وزن مؤثر فعلی: ' + faDigits(sumW) + ').</p>', 'var(--violet)') +
    btSec('روش و محدودیت‌ها', 'alert', notes + '<p class="bt-note bold">این جدول کمّی‌سازی شفاف رابطه تاریخی عوامل با نماد است؛ برای تصمیم معامله به تنهایی کافی نیست و توصیه خرید/فروش محسوب نمی‌شود.</p>', 'var(--amber)');
}

/* ---------- رندر اصلی اپ ---------- */
function renderTraderApp(soft) {
  if (!soft) { BT.tab = btGet('bt_tab_v1', 'view'); }
  if (BT.tab === 'plan' || BT.tab === 'journal') BT.tab = 'view'; /* تب‌های حذف‌شده → نمای بازار */
  var inner = btHead() + btSymChips() + btTabBar();

  /* نوار واگرایی همیشه فعال */
  if (BT.data) {
    var dv = BT.data.div;
    var dot = dv.color === 'green' ? '🟢' : dv.color === 'amber' ? '🟡' : dv.color === 'red' ? '🔴' : '⚪';
    inner += '<div class="bt-divbar ' + dv.color + '"><span class="e">' + dot + '</span><div class="t"><b>' + dv.text + '</b><span>' + dv.reason + '</span></div></div>';
  }
  if (BT.nudge) inner += '<div class="bt-warn">⚠ ' + BT.nudge + '</div>';
  if (BT.data && BT.data.degraded) inner += '<div class="bt-warn">حالت کاهش‌یافته: دریافت داده زنده Yahoo ناموفق بود — فقط اسنپ‌شات فایل نمایش داده می‌شود؛ عوامل وابسته به داده زنده با برچسب «داده ناکافی» علامت خورده‌اند. با دکمه بروزرسانی دوباره تلاش کنید.</div>';
  /* هشدار جدی رنج فشرده / رنج — همیشه بالای همه تب‌ها */
  if (BT.data && BT.data.rangeWarning && BT.data.rangeWarning.active) {
    var rwv = BT.data.rangeWarning;
    inner += '<div class="bt-rangewarn' + (rwv.severity === 'tight' ? ' red' : '') + '">' +
      '<b>' + (rwv.severity === 'tight' ? 'هشدار جدی: رنج فشرده' : 'هشدار: بازار رنج است') + '</b>' +
      '<p>' + rwv.message + '</p>' +
      (rwv.severity === 'tight' ? '<ul>' + rwv.advice.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ul>' : '') +
      '<span class="m">سنجه‌ها: صدک ATR ' + (rwv.metrics.atrPctile === null ? '—' : faDigits(rwv.metrics.atrPctile)) + ' · نسبت کارایی ' + (rwv.metrics.er === null ? '—' : faDigits(rwv.metrics.er)) + ' · ارتفاع محدوده ' + (rwv.metrics.boxPctOfAtr === null ? '—' : faDigits(rwv.metrics.boxPctOfAtr)) + ' برابر ATR</span></div>';
  }

  if (BT.busy) {
    inner += '<div class="bt-state"><span class="spin">' + icon('refresh', 20) + '</span>در حال دریافت سری روزانه و محاسبه وضعیت بازار…<span class="s">ساختار، DXY، US10Y، اخبار و امتیاز اطمینان</span></div>';
  } else if (BT.err && !BT.data) {
    inner += '<div class="bt-state"><span style="color:var(--red)">' + icon('wifi', 22) + '</span>' + BT.err +
      '<button type="button" class="btn" data-bt-refresh>' + icon('refresh', 13) + 'تلاش مجدد</button></div>';
  } else if (BT.data) {
    if (BT.tab === 'ai') inner += btAiHTML();
    else if (BT.tab === 'factors') inner += btFactorsHTML();
    else if (BT.tab === 'news') inner += btNewsHTML();
    else inner += btViewHTML();
    inner += '<p class="bt-foot">منبع: ' + (BT.data.degraded ? 'اسنپ‌شات فایل (داده زنده در دسترس نبود)' : 'سری روزانه Yahoo Finance (پروکسی عمومی) · ساختار و اخبار: اسنپ‌شات فایل') + ' — آخرین محاسبه: ' + faTime(new Date()) +
      '<br>هیچ خروجی این بخش توصیه قطعی خرید/فروش یا اجرای خودکار سفارش نیست.</p>';
  }
  appScroll.innerHTML = '<div class="bt-wrap">' + inner + '</div>';
  btBind();
  /* بارگذاری اولیه — فقط وقتی هیچ داده یا وضعیتی وجود ندارد */
  if (!BT.data && !BT.busy && !BT.err) btLoadData(false);
  /* بارگذاری تنبل عوامل کمّی هنگام باز شدن تب */
  if (BT.tab === 'factors' && BT.data && !BT.fq && !BT.fqBusy && !BT.fqErr) btLoadFactors(false);
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
  var fqr = appScroll.querySelector('[data-bt-fq-reload]');
  if (fqr) fqr.addEventListener('click', function () { btLoadFactors(true); });
  var fws = appScroll.querySelectorAll('[data-bt-fw]');
  for (var wi = 0; wi < fws.length; wi++) {
    (function (b) {
      b.addEventListener('change', function () {
        btFqSetWeight(b.dataset.btFw, Number(b.value));
        renderTraderApp(true);
      });
    })(fws[wi]);
  }
  var syms = appScroll.querySelectorAll('[data-bt-sym]');
  for (var i = 0; i < syms.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (BT.sym === b.dataset.btSym) return;
        BT.sym = b.dataset.btSym; BT.data = null; BT.plan = null; BT.changes = []; BT.fq = null; BT.fqErr = null; BT.zf = null;
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
  /* ماشین‌حساب حجم/حد ضرر و حد سود */
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
      swingLevel: side === 'buy' ? d.ll : d.hh, atr: atrAbs, contractSize: d.conf.contract,
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
  /* تب تحلیل هوشمند */
  var aiSyms = appScroll.querySelectorAll('[data-bt-ai-sym]');
  for (i = 0; i < aiSyms.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { aiApply(b.dataset.btAiSym, S_AI.tf); renderTraderApp(true); });
    })(aiSyms[i]);
  }
  var aiTfs = appScroll.querySelectorAll('[data-bt-ai-tf]');
  for (i = 0; i < aiTfs.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { aiApply(S_AI.sym, b.dataset.btAiTf); renderTraderApp(true); });
    })(aiTfs[i]);
  }
  var aiRun = appScroll.querySelector('[data-bt-ai-run]');
  if (aiRun) aiRun.addEventListener('click', function () {
    var p = document.getElementById('ai_panel');
    if (p) p.hidden = false;
    aiSyncHeader();
    runAi(false);
  });
  var aiRf = appScroll.querySelector('[data-ai-refresh]');
  if (aiRf) aiRf.addEventListener('click', function () { runAi(true); });
}
