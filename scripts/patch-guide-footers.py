#!/usr/bin/env python3
"""پست‌پروسس راهنمای وردپرس: پچ instrText پاصفحه‌ها (ROMAN/arabic) + حذف pgNumType خالی."""
import re, shutil, sys, zipfile, os

DOC = "/home/z/my-project/download/rasadgar-dollar-wordpress-guide.docx"
TMP = "/tmp/guide_docx"

if os.path.exists(TMP):
    shutil.rmtree(TMP)
os.makedirs(TMP)
with zipfile.ZipFile(DOC) as z:
    z.extractall(TMP)

doc_path = os.path.join(TMP, "word", "document.xml")
with open(doc_path, encoding="utf-8") as f:
    doc = f.read()

# ۱) حذف pgNumType خالی (سازگاری WPS)
doc = doc.replace("<w:pgNumType/>", "")

# ۲) ترتیب sectPr ها → شناسایی footerReference هر بخش
sect_prs = re.findall(r"<w:sectPr.*?</w:sectPr>|<w:sectPr[^>]*/>", doc, re.S)
print("sections found:", len(sect_prs))
footer_refs = []  # (section_index, rId)
for i, sp in enumerate(sect_prs):
    m = re.search(r'<w:footerReference w:type="default" r:id="(rId\d+)"', sp)
    footer_refs.append((i, m.group(1) if m else None))
print("footer refs:", footer_refs)

# ۳) نگاشت rId → فایل footer
rels_path = os.path.join(TMP, "word", "_rels", "document.xml.rels")
with open(rels_path, encoding="utf-8") as f:
    rels = f.read()
rid2file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))
print("rid map:", rid2file)

# بخش‌هایی که footer دارند → به ترتیب: اولین=فهرست(ROMAN)، دومین=بدنه(arabic)
with_footers = [(i, rid2file[r]) for i, r in footer_refs if r and r in rid2file]
formats = ["ROMAN", "arabic"] + ["arabic"] * 10
for (sec, fname), fmt in zip(with_footers, formats):
    fpath = os.path.join(TMP, "word", fname)
    with open(fpath, encoding="utf-8") as f:
        xml = f.read()
    xml2, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + fmt + r" \\* MERGEFORMAT \2",
        xml,
    )
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(xml2)
    print(f"section {sec}: {fname} → {fmt} (patched {n})")

with open(doc_path, "w", encoding="utf-8") as f:
    f.write(doc)

# ۴) بازبسته‌بندی
out = DOC
if os.path.exists(out):
    os.remove(out)
zf = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
for root, _, files in os.walk(TMP):
    for name in files:
        full = os.path.join(root, name)
        rel = os.path.relpath(full, TMP)
        zf.write(full, rel)
zf.close()
print("REPACKED:", out)
