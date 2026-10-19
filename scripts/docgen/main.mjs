/* مونتاژ نهایی مستند فنی BIG TRADER — جلد R1 + فهرست (رومنی) + بدنه (عددی) */
import {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, SectionType, TableOfContents, PageBreak,
} from "docx";
import fs from "node:fs";
import { P, buildCoverR1, faRun, H1 } from "./lib.mjs";
import { part1 } from "./part1.mjs";
import { part2 } from "./part2.mjs";
import { part3 } from "./part3.mjs";

const OUT = "/home/z/my-project/download/BIG-TRADER-Technical-Document.docx";

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1417, right: 1417 };

function pageHeader() {
  return new Header({
    children: [new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      children: [faRun("مستند فنی دستیار معامله‌گر — BIG TRADER", { size: 18, color: "808080" })],
    })],
  });
}
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" } })],
    })],
  });
}

/* ---------- جلد ---------- */
const coverChildren = buildCoverR1({
  title: "مستند فنی دستیار معامله‌گر BIG TRADER",
  subtitle: "موتور همگرایی پویا، شبیه‌ساز واکنش به خبر، پلن‌ساز معامله، ردیاب واگرایی بین‌بازاری و مربی رفتاری — منطق، اسکیما، کد، رابط کاربری و سناریوهای تست",
  englishLabel: "BIG TRADER  ·  TECHNICAL SPECIFICATION  ·  v1.0",
  metaLines: [
    "نمادهای پوشش: طلا (XAUUSD) و داوجونز (DJI)",
    "پلتفرم: وب‌اپلیکیشن موبایل‌محور + فایل مستقل HTML",
    "نسخه سند: ۱.۰ — مهر ۱۴۰۵ / اکتبر ۲۰۲۶",
    "تهیه‌شده برای: تیم توسعه و عامل‌های کدنویس هوش مصنوعی",
  ],
  footerLeft: "BIG TRADER · Rasadgar Dollar",
  footerRight: "اسناد فنی — نسخه ۱.۰",
  palette: P.cover,
});

/* ---------- فهرست مطالب (سکشن رومی) ---------- */
const tocChildren = [
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: 380, lineRule: "atLeast" },
    children: [faRun("فهرست مطالب", { bold: true, size: 32, color: P.primary })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200 },
    children: [faRun("یادآوری: این فهرست با کد فیلد تولید شده است؛ پس از هر ویرایش، روی فهرست راست‌کلیک کنید و «Update Field» را بزنید تا شماره صفحه‌ها دقیق شود.", { italics: true, size: 18, color: "888888" })],
  }),
  /* شکست صفحه توسط SectionType.NEXT_PAGE سکشن بدنه تأمین می‌شود — PageBreak اضافی صفحه سفید می‌سازد */
];

/* ---------- بدنه ---------- */
const bodyChildren = [...part1(), ...part2(), ...part3()];

/* ---------- سند ---------- */
const doc = new Document({
  creator: "BIG TRADER",
  title: "مستند فنی دستیار معامله‌گر BIG TRADER",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" }, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" }, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 400, after: 180, line: 380 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" }, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 280, after: 140, line: 340 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" }, size: 24, bold: true, color: P.primary },
        paragraph: { spacing: { before: 220, after: 110, line: 320 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    { /* سکشن ۱: جلد — بدون شماره صفحه */
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: coverChildren,
    },
    { /* سکشن ۲: فهرست — شماره رومی */
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: pageHeader() },
      footers: { default: pageNumFooter() },
      children: tocChildren,
    },
    { /* سکشن ۳: بدنه — شماره عددی از ۱ */
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: pageHeader() },
      footers: { default: pageNumFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK →", OUT, (buf.length / 1024).toFixed(1) + " KB");
});
