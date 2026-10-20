#!/usr/bin/env python3
"""Splice thermometer module into standalone app.d.js / app.e.js"""
import re, sys

BASE = "/home/z/my-project/scripts/standalone"

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)

pt_engine = read(f"{BASE}/pt-engine.js").rstrip() + "\n"
pt_loader = read(f"{BASE}/pt-loader.js").rstrip() + "\n"
pt_render = read(f"{BASE}/pt-render.js").rstrip() + "\n"

# ---------------- app.d.js ----------------
d = read(f"{BASE}/app.d.js")

# 1) tab label
d = d.replace("['factors', 'عوامل']", "['factors', 'دماسنج']", 1)

# 2) BT state fields
old_state = "fq: null, fqBusy: false, fqErr: null"
if old_state not in d:
    sys.exit("d.js: BT state anchor missing")
d = d.replace(old_state, "pt: null, ptBusy: false, ptErr: null, ptTf: '1d'", 1)

# 3) btFetchSeries — interval param
old_fetch = """function btFetchSeries(sym, range) {
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=' + range + '&includePrePost=false';"""
new_fetch = """function btFetchSeries(sym, range, interval) {
  var itv = interval || '1d';
  var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=' + itv + '&range=' + range + '&includePrePost=false';"""
if old_fetch not in d:
    sys.exit("d.js: btFetchSeries anchor missing")
d = d.replace(old_fetch, new_fetch, 1)

# 4) replace FQ engine block (anchor: section header → end of btComputeFactors)
start = d.find("/* ================= کمّی‌سازی اجباری اثر عوامل + رنج فشرده + نواحی ورود (نسخه مستقل) ================= */")
end_marker = "/* ---------- رنج فشرده ---------- */"
end = d.find(end_marker)
if start == -1 or end == -1:
    sys.exit("d.js: FQ engine block anchors missing")
d = d[:start] + pt_engine + "\n" + d[end:]

# 5) replace FQ loaders to EOF (anchor: load section header)
start2 = d.find("/* ---------- بارگذاری تنبل عوامل کمّی (۴ سری ۲ساله از پروکسی) ---------- */")
if start2 == -1:
    sys.exit("d.js: FQ loader anchor missing")
d = d[:start2] + pt_loader

write(f"{BASE}/app.d.js", d)
print("app.d.js spliced OK")

# ---------------- app.e.js ----------------
e = read(f"{BASE}/app.e.js")

# 1) replace btFactorsHTML (anchor header → renderTraderApp header)
start = e.find("/* ---------- تب عوامل کمّی ---------- */")
end = e.find("/* ---------- رندر اصلی اپ ---------- */")
if start == -1 or end == -1:
    sys.exit("e.js: btFactorsHTML anchors missing")
e = e[:start] + pt_render + "\n" + e[end:]

# 2) lazy-load condition
old_lazy = "if (BT.tab === 'factors' && BT.data && !BT.fq && !BT.fqBusy && !BT.fqErr) btLoadFactors(false);"
new_lazy = "if (BT.tab === 'factors' && BT.data && !BT.pt && !BT.ptBusy && !BT.ptErr) btLoadPressure(false);"
if old_lazy not in e:
    sys.exit("e.js: lazy-load anchor missing")
e = e.replace(old_lazy, new_lazy, 1)

# 3) bind handlers: fq-reload + weights → pt-reload + tf chips
old_bind = """  var fqr = appScroll.querySelector('[data-bt-fq-reload]');
  if (fqr) fqr.addEventListener('click', function () { btLoadFactors(true); });
  var fws = appScroll.querySelectorAll('[data-bt-fw]');
  for (var wi = 0; wi < fws.length; wi++) {
    (function (b) {
      b.addEventListener('change', function () {
        btFqSetWeight(b.dataset.btFw, Number(b.value));
        renderTraderApp(true);
      });
    })(fws[wi]);
  }"""
new_bind = """  var ptr = appScroll.querySelector('[data-pt-reload]');
  if (ptr) ptr.addEventListener('click', function () { btLoadPressure(true); });
  var ptfs = appScroll.querySelectorAll('[data-pt-tf]');
  for (var wi = 0; wi < ptfs.length; wi++) {
    (function (b) {
      b.addEventListener('click', function () {
        if (BT.ptTf === b.dataset.ptTf && BT.pt) return;
        BT.ptTf = b.dataset.ptTf;
        BT.pt = null;
        btLoadPressure(false, BT.ptTf);
      });
    })(ptfs[wi]);
  }"""
if old_bind not in e:
    sys.exit("e.js: bind anchor missing")
e = e.replace(old_bind, new_bind, 1)

# 4) symbol switch reset
old_sym = "BT.fq = null; BT.fqErr = null;"
if old_sym not in e:
    sys.exit("e.js: sym-reset anchor missing")
e = e.replace(old_sym, "BT.pt = null; BT.ptErr = null;", 1)

# 5) render switch
old_render = "else if (BT.tab === 'factors') inner += btFactorsHTML();"
if old_render not in e:
    sys.exit("e.js: render anchor missing")
e = e.replace(old_render, "else if (BT.tab === 'factors') inner += btThermoHTML();", 1)

write(f"{BASE}/app.e.js", e)
print("app.e.js spliced OK")

# ---------------- cleanup temp snippet files ----------------
import os
for f in ("pt-engine.js", "pt-loader.js", "pt-render.js"):
    os.remove(f"{BASE}/{f}")
print("cleanup OK")
