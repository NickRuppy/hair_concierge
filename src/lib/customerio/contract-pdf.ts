import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib"

export const CONTRACT_PDF_FILENAME = "Deine-Chaarlie-Vertragsunterlagen.pdf"
const WIDTH = 595.28
const HEIGHT = 841.89
const MARGIN = 48
const BOTTOM = 54

/** Preserve all receipt text; wrap by measured font width, including long tokens. */
function wrap(text: string, font: PDFFont, size: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= WIDTH - MARGIN * 2) {
      line += ` ${word}`
      continue
    }
    if (line) lines.push(line)
    line = ""
    for (const char of word) {
      if (line && font.widthOfTextAtSize(line + char, size) > WIDTH - MARGIN * 2) {
        lines.push(line)
        line = ""
      }
      // Throws for unsupported characters: never silently lose contractual text.
      font.encodeText(char)
      line += char
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function buildContractPdf(receiptText: string): Promise<Uint8Array> {
  if (!receiptText.trim()) throw new Error("Cannot create an empty contract PDF")
  const pdf = await PDFDocument.create()
  pdf.setTitle("Deine Chaarlie-Vertragsunterlagen")
  pdf.setAuthor("Chaarlie · Haarmony LLC")
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const color = rgb(0.176, 0.106, 0.275)
  let page = pdf.addPage([WIDTH, HEIGHT])
  let y = HEIGHT - MARGIN
  const newPage = () => {
    page = pdf.addPage([WIDTH, HEIGHT])
    y = HEIGHT - MARGIN
  }
  page.drawText("chaarlie", { x: MARGIN, y: y - 22, font: bold, size: 25, color })
  y -= 58
  page.drawText("Deine Vertragsunterlagen", { x: MARGIN, y, font: bold, size: 18, color })
  y -= 32

  for (const paragraph of receiptText.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      y -= 7
      continue
    }
    const heading =
      /^(§ \d+ |Leistung und weitere Vertragsbedingungen$|Widerrufsbelehrung$|Allgemeine Geschäftsbedingungen|Muster-Widerrufsformular)/.test(
        paragraph,
      )
    const font = heading ? bold : regular
    const size = heading ? 11 : 10.5
    const leading = 14.5
    const lines = wrap(paragraph, font, size)
    // Keep a heading with at least two lines of the following paragraph.
    if (
      y - leading * (heading ? lines.length + 2 : Math.min(lines.length, 2)) - (heading ? 15 : 0) <
      BOTTOM
    )
      newPage()
    for (const line of lines) {
      if (y < BOTTOM) newPage()
      page.drawText(line, { x: MARGIN, y, font, size, color })
      y -= leading
    }
    y -= heading ? 8 : 6
  }
  const pages = pdf.getPages()
  for (const [index, item] of pages.entries()) {
    item.drawText(`Chaarlie · Vertragsunterlagen | ${index + 1} / ${pages.length}`, {
      x: MARGIN,
      y: 28,
      font: regular,
      size: 8,
      color: rgb(0.4, 0.35, 0.45),
    })
  }
  return pdf.save()
}
