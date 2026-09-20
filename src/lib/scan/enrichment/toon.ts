export class ToonParseError extends Error {
  constructor() {
    super("Malformed dm product table")
    this.name = "ToonParseError"
  }
}

function splitToonRow(row: string, delimiter: string): string[] {
  const cells: string[] = []
  let start = 0
  let quoted = false
  let escaped = false
  for (let index = 0; index < row.length; index++) {
    const char = row[index]
    if (escaped) {
      escaped = false
    } else if (quoted && char === "\\") {
      escaped = true
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(row.slice(start, index))
      start = index + 1
    }
  }
  if (quoted || escaped) throw new ToonParseError()
  cells.push(row.slice(start))
  return cells
}

function decodeToonCells(cells: string[]): string[] {
  return cells.map((cell) => {
    if (!cell.startsWith('"')) return cell
    try {
      const value: unknown = JSON.parse(cell)
      if (typeof value !== "string") throw new ToonParseError()
      return value
    } catch {
      throw new ToonParseError()
    }
  })
}

/** The flat, pipe-delimited TOON table emitted by getProductDetails; no inference of types. */
export function parseToonTable(text: string): Array<Record<string, string>> {
  const lines = text.trimEnd().split(/\r?\n/)
  const header = /^\[(\d+)\]\{([^{}]+)\}:$/.exec(lines.shift()?.trim() ?? "")
  if (!header) throw new ToonParseError()
  const keys = header[2].split("|")
  if (
    keys.some((key) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) ||
    new Set(keys).size !== keys.length
  ) {
    throw new ToonParseError()
  }
  if (lines.length !== Number(header[1])) throw new ToonParseError()
  return lines.map((line) => {
    const cells = splitToonRow(line.replace(/^ {2}/, ""), "|")
    if (cells.length !== keys.length) throw new ToonParseError()
    const values = decodeToonCells(cells)
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
  })
}

/** A single name-prefixed, comma-delimited TOON table, e.g. `products[2]{gtin,title}:`. */
function parseSearchToonTable(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/)
  const header = /^[a-zA-Z][a-zA-Z0-9_]*\[(\d+)\]\{([^{}]+)\}:$/.exec(lines.shift()?.trim() ?? "")
  if (!header) throw new ToonParseError()
  const keys = header[2].split(",")
  if (
    keys.some((key) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) ||
    new Set(keys).size !== keys.length
  ) {
    throw new ToonParseError()
  }
  const rowCount = Number(header[1])
  // Unlike getProductDetails, a search table may be followed by trailing footer text
  // (a blank line plus a usage tip) that is not part of the declared row data.
  if (lines.length < rowCount) throw new ToonParseError()
  return lines.slice(0, rowCount).map((line) => {
    const cells = splitToonRow(line.replace(/^ {2}/, ""), ",")
    if (cells.length !== keys.length) throw new ToonParseError()
    const values = decodeToonCells(cells)
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
  })
}

/**
 * searchProducts' `result` is a JSON-encoded array of name-prefixed, comma-delimited TOON
 * tables (unlike getProductDetails' single pipe-delimited table). Rows from every table in
 * the array are flattened into one list.
 */
export function parseSearchToonTables(result: string): Array<Record<string, string>> {
  let tables: unknown
  try {
    tables = JSON.parse(result)
  } catch {
    throw new ToonParseError()
  }
  if (!Array.isArray(tables) || tables.some((table) => typeof table !== "string")) {
    throw new ToonParseError()
  }
  return (tables as string[]).flatMap(parseSearchToonTable)
}
