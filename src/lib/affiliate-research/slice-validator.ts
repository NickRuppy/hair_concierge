import { readCsv } from "./csv"

export const INPUT_HEADER = ["id", "brand", "name", "description", "category", "price_eur"] as const
export const OUTPUT_HEADER = [
  "id",
  "brand",
  "name",
  "chosen_url",
  "host",
  "confidence",
  "matched_tokens",
  "notes",
] as const

export type ValidateSliceInput = {
  inputPath: string
  outputPath: string
}

export type ValidateSliceResult = {
  ok: boolean
  errors: string[]
  missing: string[]
  duplicated: string[]
  rowCount: number
}

const VALID_CONFIDENCE = new Set(["high", "medium", "none"])

export function validateSlice({ inputPath, outputPath }: ValidateSliceInput): ValidateSliceResult {
  const errors: string[] = []

  let inputRows: ReturnType<typeof readCsv> = []
  try {
    inputRows = readCsv(inputPath, { expectedHeader: [...INPUT_HEADER] })
  } catch (err) {
    errors.push(`input: ${(err as Error).message}`)
  }

  let outputRows: ReturnType<typeof readCsv> = []
  try {
    outputRows = readCsv(outputPath, { expectedHeader: [...OUTPUT_HEADER] })
  } catch (err) {
    errors.push(`output: ${(err as Error).message}`)
    return { ok: false, errors, missing: [], duplicated: [], rowCount: 0 }
  }

  const inputIds = new Set(inputRows.map((r) => r.id))
  const seen = new Set<string>()
  const duplicated: string[] = []
  for (const r of outputRows) {
    if (seen.has(r.id)) duplicated.push(r.id)
    else seen.add(r.id)
    if (r.confidence && !VALID_CONFIDENCE.has(r.confidence)) {
      errors.push(`row ${r.id}: invalid confidence value '${r.confidence}'`)
    }
  }
  const missing = [...inputIds].filter((id) => !seen.has(id))
  const extras = [...seen].filter((id) => !inputIds.has(id))
  if (extras.length > 0) {
    errors.push(
      `output contains ${extras.length} ids not in input: ${extras.slice(0, 5).join(", ")}`,
    )
  }
  if (missing.length > 0) {
    errors.push(`output missing ${missing.length} input ids: ${missing.slice(0, 5).join(", ")}`)
  }
  if (duplicated.length > 0) {
    errors.push(`output has duplicate ids: ${duplicated.slice(0, 5).join(", ")}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    missing,
    duplicated,
    rowCount: outputRows.length,
  }
}
