import { readFileSync, writeFileSync } from "node:fs"

export type CsvRow = Record<string, string>

export function parseCsv(text: string): CsvRow[] {
  const lines = splitCsvLines(text)
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0])
  const out: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line === "") continue
    const cells = parseCsvLine(line)
    const row: CsvRow = {}
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j] ?? ""
    }
    out.push(row)
  }
  return out
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
      continue
    }
    if (ch === "\n" && !inQuotes) {
      lines.push(current)
      current = ""
      continue
    }
    if (ch === "\r" && !inQuotes) {
      if (text[i + 1] === "\n") i++
      lines.push(current)
      current = ""
      continue
    }
    current += ch
  }
  if (current) lines.push(current)
  return lines
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      if (ch === '"') {
        inQuotes = false
        continue
      }
      cur += ch
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ",") {
      cells.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  cells.push(cur)
  return cells
}

function quoteField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function stringifyCsv(header: string[], rows: CsvRow[]): string {
  const lines: string[] = [header.map(quoteField).join(",")]
  for (const row of rows) {
    lines.push(header.map((h) => quoteField(row[h] ?? "")).join(","))
  }
  return lines.join("\n") + "\n"
}

export type ReadCsvOptions = {
  expectedHeader?: string[]
}

export function readCsv(path: string, opts: ReadCsvOptions = {}): CsvRow[] {
  const text = readFileSync(path, "utf-8")
  const rows = parseCsv(text)
  if (opts.expectedHeader) {
    const actual = rows.length > 0 ? Object.keys(rows[0]) : []
    // header is the first parsed line — but parseCsv discards it as column names,
    // so check by reading the first physical line:
    const firstLine = text.split(/\r?\n/, 1)[0]
    const headerActual = parseCsvLine(firstLine)
    const equal =
      headerActual.length === opts.expectedHeader.length &&
      headerActual.every((h, i) => h === opts.expectedHeader![i])
    if (!equal) {
      throw new Error(
        `csv header mismatch in ${path}: expected [${opts.expectedHeader.join(", ")}], got [${headerActual.join(", ")}]`,
      )
    }
    void actual
  }
  return rows
}

export function writeCsv(path: string, header: string[], rows: CsvRow[]): void {
  writeFileSync(path, stringifyCsv(header, rows), "utf-8")
}
