export class ToonParseError extends Error {
  constructor() {
    super("Malformed dm product table")
    this.name = "ToonParseError"
  }
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
    const cells: string[] = []
    let start = 0
    let quoted = false
    let escaped = false
    const row = line.replace(/^ {2}/, "")
    for (let index = 0; index < row.length; index++) {
      const char = row[index]
      if (escaped) {
        escaped = false
      } else if (quoted && char === "\\") {
        escaped = true
      } else if (char === '"') {
        quoted = !quoted
      } else if (char === "|" && !quoted) {
        cells.push(row.slice(start, index))
        start = index + 1
      }
    }
    if (quoted || escaped) throw new ToonParseError()
    cells.push(row.slice(start))
    if (cells.length !== keys.length) throw new ToonParseError()
    const values = cells.map((cell) => {
      if (!cell.startsWith('"')) return cell
      try {
        const value: unknown = JSON.parse(cell)
        if (typeof value !== "string") throw new ToonParseError()
        return value
      } catch {
        throw new ToonParseError()
      }
    })
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
  })
}
