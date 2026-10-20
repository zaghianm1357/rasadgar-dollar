#!/usr/bin/env python3
"""پست‌پروسس docx: اصلاح instrText فوتر (ROMAN/arabic) + حذف pgNumType خالی جلد"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

SRC = Path("/home/z/my-project/download/BIG-TRADER-Technical-Document.docx")
TMP = SRC.with_suffix(".tmp.docx")

with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

# ۱) document.xml: حذف pgNumType خالی + یافتن ترتیب سکشن‌ها
doc_xml = data["word/document.xml"].decode("utf-8")
doc_xml = doc_xml.replace("<w:pgNumType/>", "")

# ۲) فوترها: شناسایی فوتر سکشن رومی و عددی از ترتیب تعریف سکشن‌ها
#    سکشن ۲ (رومنی) و سکشن ۳ (عربی) هر دو footerReference دارند؛ ترتیب rId در document.xml حفظ می‌شود.
sect_footers = re.findall(r'<w:footerReference[^>]*r:id="(rId\d+)"', doc_xml)
rels = data["word/_rels/document.xml.rels"].decode("utf-8")
rid2file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))
footer_files = [rid2file.get(r) for r in sect_footers if rid2file.get(r)]
# ترتیب: اولی مربوط به سکشن فهرست (رومنی)، دومی بدنه (عربی)
fmt_map = {}
if len(footer_files) >= 1 and footer_files[0]:
    fmt_map["word/" + footer_files[0]] = "ROMAN"
for f in footer_files[1:]:
    fmt_map["word/" + f] = "arabic"

patched = []
for fname, fmt in fmt_map.items():
    if fname not in data:
        continue
    xml = data[fname].decode("utf-8")
    new_xml, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\g<1> PAGE \\* " + fmt + r" \\* MERGEFORMAT \g<2>",
        xml,
    )
    if n:
        data[fname] = new_xml.encode("utf-8")
        patched.append((fname, fmt, n))

data["word/document.xml"] = doc_xml.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(TMP, SRC)
print("patched footers:", patched)
print("OK:", SRC)
