/* کتابخانه تولید مستند فنی BIG TRADER — فارسی RTL بر پایه دستور R1 اسکیل docx */
import {
  Paragraph, TextRun, Table, TableRow, TableCell, TableLayoutType,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType, PageBreak,
} from "docx";

/* ---------- پالت رنگی FinTech (سرمه‌ای تیره + طلایی) ---------- */
export const P = {
  primary: "1A2433",
  body: "212B3B",
  secondary: "5B6B7D",
  accent: "B7791F",
  accentBright: "F59E0B",
  surface: "F5F2EA",
  surfaceAlt: "EEF2F6",
  cover: {
    bg: "14202E",
    titleColor: "F8FAFC",
    subtitleColor: "CBD5E1",
    metaColor: "A8B6C4",
    accent: "F59E0B",
    footerColor: "7C8DA0",
  },
};

const FA_FONT = { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma" };
const CODE_FONT = { ascii: "Consolas", hAnsi: "Consolas", cs: "Tahoma" };

export const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};
export const allNoBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};

/* ---------- متن فارسی RTL ---------- */
export function faRun(text, opts = {}) {
  return new TextRun({
    text,
    rightToLeft: true,
    font: FA_FONT,
    size: opts.size ?? 24,
    sizeComplexScript: true,
    bold: opts.bold ?? false,
    boldComplexScript: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? P.body,
  });
}

/** پاراگراف بدنه — تراز دوطرفه، فاصله خط ۱.۳؛ ورودی: رشته یا آرایه سگمنت {t, b, c} */
export function Pbody(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after ?? 120 },
    children: (Array.isArray(text) ? text : [{ t: text }]).map((seg) =>
      faRun(seg.t, { bold: seg.b, color: seg.c ?? P.body, size: seg.s }),
    ),
  });
}

/** آیتم فهرست گلوله‌ای — تراز راست (بدون justification) */
export function BUL(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    bullet: { level: 0 },
    spacing: { line: 312, after: opts.after ?? 60 },
    children: (Array.isArray(text) ? text : [{ t: text }]).map((seg) =>
      faRun(seg.t, { bold: seg.b, color: seg.c ?? P.body }),
    ),
  });
}

/** سرفصل‌ها — با HeadingLevel برای فهرست مطالب */
export function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 400, after: 180, line: 380, lineRule: "atLeast" },
    children: [faRun(text, { bold: true, size: 32, color: P.primary })],
  });
}
export function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 280, after: 140, line: 340, lineRule: "atLeast" },
    children: [faRun(text, { bold: true, size: 28, color: P.primary })],
  });
}
export function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 220, after: 110, line: 320, lineRule: "atLeast" },
    children: [faRun(text, { bold: true, size: 24, color: P.primary })],
  });
}

/** کپشن جدول/کد — با keepNext برای چسبیدن به جدول */
export function CAP(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    keepNext: true,
    spacing: { before: 160, after: 80 },
    children: [faRun(text, { bold: true, size: 21, color: P.secondary })],
  });
}

/** بلوک کد — چپ‌چین LTR با پس‌زمینه روشن */
export function CODE(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    out.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      shading: { type: ShadingType.CLEAR, fill: "F4F6F8" },
      spacing: { line: 264, lineRule: "atLeast", before: i === 0 ? 80 : 0, after: isLast ? 160 : 0 },
      indent: { left: 200, right: 200 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 6, color: P.accentBright, space: 8 },
      },
      children: [new TextRun({
        text: lines[i].length ? lines[i] : " ",
        font: CODE_FONT,
        size: 17,
        sizeComplexScript: true,
        color: "24313F",
      })],
    }));
  }
  return out;
}

/** جدول RTL با همه الزامات (tableHeader/cantSplit/margins/PERCENTAGE) */
export function TBL(headers, rows, widths) {
  const mkCell = (text, isHead, w) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: isHead ? P.surface : "FFFFFF" },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { line: 288 },
      children: [faRun(String(text), { bold: isHead, size: 20, color: isHead ? P.primary : P.body })],
    })],
  });
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "9AA6B2" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "9AA6B2" },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE3" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((h, i) => mkCell(h, true, widths[i])),
      }),
      ...rows.map((r) => new TableRow({
        cantSplit: true,
        children: r.map((c, i) => mkCell(c, false, widths[i])),
      })),
    ],
  });
}

/* ---------- جلد R1 سازگار با فارسی ---------- */

/** عرض تقریبی هر نویسه فارسی ≈ pt×12 توئیپ + شکست مرزی معنایی روی فاصله */
function calcTitleLayoutFa(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 12;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  const split = (t, cpl) => {
    if (t.length <= cpl) return [t];
    const words = t.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const cand = cur ? cur + " " + w : w;
      if (cand.length <= cpl) cur = cand;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length > 1 && lines[lines.length - 1].length <= 4) {
      const last = lines.pop();
      lines[lines.length - 1] += " " + last;
    }
    return lines;
  };
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 4) { titlePt -= 2; continue; }
    lines = split(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = split(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

/** دستور R1 — پاراگراف خالص روی پس‌زمینه تمام‌صفحه، بدون جدول تودرتو */
export function buildCoverR1(config) {
  const C = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayoutFa(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      indent: { left: padL, right: padR },
      spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel,
        size: 18, sizeComplexScript: true, color: C.accent,
        font: { ascii: "Arial", hAnsi: "Arial", cs: "Tahoma" },
      })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      indent: { left: padL, right: padR },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 300,
        line: Math.ceil(titlePt * 23), lineRule: "atLeast",
      },
      children: [faRun(titleLines[i], { bold: true, size: titleSize, color: C.titleColor })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      indent: { left: padL, right: padR },
      spacing: { after: 800, line: 340, lineRule: "atLeast" },
      children: [faRun(config.subtitle, { size: 24, color: C.subtitleColor })],
    }));
  }

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      indent: { left: padL, right: padR + 200 },
      spacing: { after: 80 },
      border: { right: accentLeft },
      children: [faRun(line, { size: 24, color: C.metaColor })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  children.push(new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      faRun(config.footerRight || "", { size: 16, color: C.footerColor }),
      new TextRun({ text: "                                   ", font: FA_FONT, size: 16 }),
      new TextRun({
        text: config.footerLeft || "", size: 16, sizeComplexScript: true,
        color: C.footerColor, font: { ascii: "Arial", hAnsi: "Arial", cs: "Tahoma" },
      }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: C.bg },
        borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}
