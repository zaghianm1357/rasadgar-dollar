/* راهنمای وردپرس ابزار «رصدگر دلار» — فارسی RTL — R1 cover (mirrored) + TOC + 3-section numbering */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, SectionType,
  TableOfContents, TableLayoutType, LevelFormat,
} = require("docx");
const fs = require("fs");

/* ---------- پالت BIG TRADER ---------- */
const P = {
  bg: "101823", titleColor: "FFFFFF", subtitleColor: "C8D2DC",
  metaColor: "AEBCC8", accent: "F59E0B", footerColor: "8FA0B0",
  primary: "14213D", body: "000000", secondary: "5B6B7D",
  surface: "FBF4E4", line: "D8DEE6",
};

const FA_FONT = { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" };
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

/* ---------- کمکی‌ها ---------- */
function faRun(text, opts = {}) {
  return new TextRun({ text, rightToLeft: true, font: FA_FONT, size: 24, color: P.body, ...opts });
}
function body(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [faRun(text)],
    ...opts,
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" },
    children: [faRun(text, { bold: true, size: 32, color: P.primary })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    bidirectional: true,
    spacing: { before: 240, after: 120, line: 340, lineRule: "atLeast" },
    children: [faRun(text, { bold: true, size: 28, color: P.primary })],
  });
}
function bullet(text, ref) {
  return new Paragraph({
    bidirectional: true,
    numbering: { reference: ref, level: 0 },
    spacing: { line: 312, after: 60 },
    children: [faRun(text)],
  });
}
function note(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, before: 80, after: 160 },
    indent: { left: 200, right: 200 },
    border: { right: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 10 } },
    children: [faRun(text, { size: 22, color: P.secondary })],
  });
}
function cellPara(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    spacing: { line: 312 },
    children: [faRun(text, { size: 21, ...opts })],
  });
}
function tbl(headers, rows, widths) {
  const mkCell = (t, isHead, w) => new TableCell({
    children: [cellPara(t, isHead ? { bold: true, color: P.primary } : {})],
    shading: isHead ? { type: ShadingType.CLEAR, fill: P.surface } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: { size: w, type: WidthType.PERCENTAGE },
  });
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.line },
      insideVertical: NB,
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => mkCell(t, true, widths[i])) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => mkCell(t, false, widths[i])) })),
    ],
  });
}
function spacer(after = 120) { return new Paragraph({ spacing: { after }, children: [] }); }

/* ---------- جلد: R1 آینه‌شده برای RTL ---------- */
function splitTitleLinesFa(title, cpl) {
  if (title.length <= cpl) return [title];
  const words = title.split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > cpl && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > 1 && lines[lines.length - 1].length <= 4) {
    const last = lines.pop(); lines[lines.length - 1] += " " + last;
  }
  return lines;
}
function calcTitleLayoutFa(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11; // حروف فارسی حدوداً نصف عرض CJK
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = Math.floor(maxWidthTwips / charWidth(titlePt));
    lines = splitTitleLinesFa(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLinesFa(title, Math.floor(maxWidthTwips / charWidth(minPt))); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(p) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = p;
  const SAFETY = 1200;
  const usable = pageHeight - SAFETY;
  const contentH = titleLineCount * (titlePt * 23 + 200) + (hasSubtitle ? 12 * 23 + 600 : 0) +
    (hasEnglishLabel ? 9 * 23 + 600 : 0) + metaLineCount * (10 * 23 + 100) + fixedHeight + 3 * 300;
  const remaining = Math.max(usable - contentH, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(remaining * 0.45), rawBottom = Math.floor(remaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}
function buildCoverR1RTL(cfg) {
  const pad = 1100;
  const availableWidth = 11906 - pad * 2 - 300;
  const { titlePt, titleLines } = calcTitleLayoutFa(cfg.title, availableWidth, 40, 24);
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!cfg.subtitle, hasEnglishLabel: !!cfg.englishLabel,
    metaLineCount: (cfg.metaLines || []).length, fixedHeight: 400,
  });
  const accentRight = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing }, children: [] }));
  if (cfg.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      indent: { left: pad, right: pad }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: cfg.englishLabel, size: 18, color: P.accent, font: FA_FONT, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: pad, right: pad },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [faRun(titleLines[i], { size: titlePt * 2, bold: true, color: P.titleColor })],
    }));
  }
  if (cfg.subtitle) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: pad, right: pad }, spacing: { after: 800, line: 320, lineRule: "atLeast" },
      children: [faRun(cfg.subtitle, { size: 24, color: P.subtitleColor })],
    }));
  }
  for (const line of (cfg.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: pad, right: pad + 200 }, spacing: { after: 80, line: 300, lineRule: "atLeast" },
      border: { right: accentRight },
      children: [faRun(line, { size: 24, color: P.metaColor })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing }, children: [] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    indent: { left: pad, right: pad },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: cfg.footerText || "", size: 16, color: P.footerColor, font: FA_FONT }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

/* ---------- سربرگ/پاصفحه ---------- */
function pageHeader() {
  return new Header({
    children: [new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.START,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.line, space: 4 } },
      spacing: { after: 0 },
      children: [faRun("راهنمای انتشار ابزار رصدگر دلار روی وردپرس — BIG TRADER", { size: 18, color: "888888" })],
    })],
  });
}
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: FA_FONT })],
    })],
  });
}

module.exports = { P, FA_FONT, allNoBorders, noBorders, NB, faRun, body, h1, h2, bullet, note, cellPara, tbl, spacer, buildCoverR1RTL, pageHeader, pageNumFooter, calcTitleLayoutFa };

/* در صورت اجرای مستقیم، محتوای سند از فایل guide-content.js خوانده می‌شود */
if (require.main === module) {
  const { buildDoc } = require("./guide-content.js");
  buildDoc().then(() => console.log("DOCX-OK"));
}
