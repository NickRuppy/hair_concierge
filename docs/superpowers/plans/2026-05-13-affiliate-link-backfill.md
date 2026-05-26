# Affiliate Link Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four scripts that drive the affiliate-link backfill workflow described in `docs/superpowers/specs/2026-05-13-affiliate-link-backfill-design.md`, so that we can dispatch research subagents and write reviewed URLs back to `products.affiliate_link`.

**Architecture:** Four scripts (`export`, `validate-slice`, `aggregate`, `write`) plus a shared library under `src/lib/affiliate-research/` for pure logic (URL gate, brand-slug normalization, CSV utilities, slice validation, aggregation rules). Subagent dispatch is documented in a runbook but is not code — it's invoked from a Claude Code session. The DB write is the only place a service-role Supabase client is opened.

**Tech Stack:**
- Node 20+ via `tsx` (already in devDependencies)
- `@supabase/supabase-js` (already a dependency) with service-role key from `.env.local`
- `node:test` + `node:assert/strict` for unit tests (project convention)
- Plain CSV (no external CSV library — write a tiny in-house reader/writer with RFC-4180 quoting)

---

## File Structure

**New files (TS lib):**
- `src/lib/affiliate-research/url-gate.ts` — pure: URL parsing, host allowlist/denylist, brand-slug normalization, brand-direct match, top-level `urlGate(row)` returning `{pass, reason}`.
- `src/lib/affiliate-research/csv.ts` — pure: `readCsv(path)`, `writeCsv(path, header, rows)` with RFC-4180 quoting.
- `src/lib/affiliate-research/slice-validator.ts` — pure: `validateSlice({inputPath, outputPath}) → {ok, errors, missing, duplicated}`.
- `src/lib/affiliate-research/aggregate.ts` — pure: `dedupeByConfidence(rows)`, `classifyForOutput(row) → {bucket, reason}`.

**New files (scripts):**
- `scripts/export-missing-affiliate-links.ts` — queries Supabase, writes `missing.csv` + per-slice files.
- `scripts/validate-slice.ts` — thin CLI wrapper around `slice-validator`.
- `scripts/aggregate-affiliate-research.ts` — reads `results-*.csv`, writes `results.csv`, `approved.csv`, `review-queue.csv`.
- `scripts/write-affiliate-links.ts` — reads `approved.csv`, issues `UPDATE`s, writes `applied.log`. Has `--dry`.

**New files (tests):**
- `tests/affiliate-research-url-gate.test.ts`
- `tests/affiliate-research-csv.test.ts`
- `tests/affiliate-research-slice-validator.test.ts`
- `tests/affiliate-research-aggregate.test.ts`

**New files (docs):**
- `docs/runbooks/2026-05-13-affiliate-link-backfill-runbook.md` — step-by-step execution: export → canary → fanout → validate → aggregate → review → write.

**New files (data, gitignored):**
- `data/affiliate-research/` (created in Task 1; populated at execution time).

**Modified files:**
- `.gitignore` — add `data/affiliate-research/`.

**Layout rationale:** Pure logic in `src/lib/affiliate-research/` keeps the scripts thin and unit-testable. Per project convention (`tests/*.test.ts` flat), test filenames are prefixed `affiliate-research-`. The lib does NOT import `@supabase/supabase-js` — scripts pull data and pass plain objects to lib functions.

---

## Tasks

### Task 1: Set up gitignore + data directory

**Files:**
- Modify: `.gitignore`
- Create: `data/affiliate-research/.gitkeep`

- [ ] **Step 1: Add gitignore entry**

Edit `.gitignore`. Append at the end:

```
# Affiliate link research artefacts (regenerated; safe to delete)
/data/affiliate-research/
!/data/affiliate-research/.gitkeep
```

- [ ] **Step 2: Create the directory with a placeholder**

Run:
```bash
mkdir -p data/affiliate-research && touch data/affiliate-research/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore data/affiliate-research/.gitkeep
git commit -m "chore: scaffold data/affiliate-research/ for backfill workflow"
```

---

### Task 2: URL gate library + tests

This is the pure logic that the aggregator (and optionally the write-back) uses to decide if a URL is acceptable.

**Files:**
- Create: `src/lib/affiliate-research/url-gate.ts`
- Create: `tests/affiliate-research-url-gate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/affiliate-research-url-gate.test.ts`:

```typescript
import assert from "node:assert/strict"
import test from "node:test"

import {
  isUsableUrl,
  hostOf,
  isAllowedHost,
  isDeniedHost,
  normalizeBrandSlug,
  passesBrandDirect,
  urlGate,
} from "../src/lib/affiliate-research/url-gate"

test("isUsableUrl accepts http(s) URLs, rejects junk", () => {
  assert.equal(isUsableUrl("https://www.dm.de/p/foo"), true)
  assert.equal(isUsableUrl("http://example.com"), true)
  assert.equal(isUsableUrl("ftp://example.com"), false)
  assert.equal(isUsableUrl(""), false)
  assert.equal(isUsableUrl("   "), false)
  assert.equal(isUsableUrl(null), false)
  assert.equal(isUsableUrl("not a url"), false)
})

test("hostOf returns lowercased host without port", () => {
  assert.equal(hostOf("https://WWW.DM.de:443/x"), "www.dm.de")
  assert.equal(hostOf("https://olaplex.com/products/n3"), "olaplex.com")
})

test("isAllowedHost matches with or without www. prefix", () => {
  assert.equal(isAllowedHost("www.dm.de"), true)
  assert.equal(isAllowedHost("dm.de"), true)
  assert.equal(isAllowedHost("www.amazon.de"), true)
  assert.equal(isAllowedHost("amazon.com"), false)
  assert.equal(isAllowedHost("random.example"), false)
})

test("isDeniedHost catches aggregators and ebay/aliexpress/amazon.com", () => {
  assert.equal(isDeniedHost("www.idealo.de"), true)
  assert.equal(isDeniedHost("geizhals.de"), true)
  assert.equal(isDeniedHost("ebay.de"), true)
  assert.equal(isDeniedHost("amazon.com"), true)
  assert.equal(isDeniedHost("www.dm.de"), false)
})

test("normalizeBrandSlug strips non-alphanumerics and normalizes umlauts", () => {
  assert.equal(normalizeBrandSlug("OLAPLEX"), "olaplex")
  assert.equal(normalizeBrandSlug("Sante"), "sante")
  assert.equal(normalizeBrandSlug("Sante Naturkosmetik"), "santenaturkosmetik")
  assert.equal(normalizeBrandSlug("Schwarzköpf"), "schwarzkoepf")
  assert.equal(normalizeBrandSlug("K18"), "k18")
})

test("passesBrandDirect matches brand slug as hostname substring, min slug length 4", () => {
  assert.equal(passesBrandDirect("olaplex.com", "OLAPLEX"), true)
  assert.equal(passesBrandDirect("k18hair.com", "K18"), false, "K18 slug too short, fails brand-direct")
  assert.equal(passesBrandDirect("sante.de", "Sante"), true)
  assert.equal(passesBrandDirect("epres.com", "Epres"), true)
  assert.equal(passesBrandDirect("unrelated.de", "Sante"), false)
  assert.equal(passesBrandDirect("any.de", "AB"), false, "slug below 4 chars never matches")
})

test("urlGate returns pass=true for allowlisted host with valid URL", () => {
  const res = urlGate({
    chosen_url: "https://www.dm.de/p/foo",
    brand: "Pantene",
  })
  assert.equal(res.pass, true)
})

test("urlGate rejects denylisted hosts", () => {
  const res = urlGate({
    chosen_url: "https://www.idealo.de/foo",
    brand: "Pantene",
  })
  assert.equal(res.pass, false)
  assert.match(res.reason, /denylisted/i)
})

test("urlGate rejects malformed URLs", () => {
  const res = urlGate({
    chosen_url: "not a url",
    brand: "Pantene",
  })
  assert.equal(res.pass, false)
  assert.match(res.reason, /parse/i)
})

test("urlGate accepts brand-direct when host contains slug (length >= 4)", () => {
  const res = urlGate({
    chosen_url: "https://sante.de/products/foo",
    brand: "Sante",
  })
  assert.equal(res.pass, true)
})

test("urlGate rejects host that is neither allowlisted nor brand-direct", () => {
  const res = urlGate({
    chosen_url: "https://random-shop.example/foo",
    brand: "Pantene",
  })
  assert.equal(res.pass, false)
  assert.match(res.reason, /not on allowlist/i)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test tests/affiliate-research-url-gate.test.ts
```

Expected: all tests FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement `url-gate.ts`**

Create `src/lib/affiliate-research/url-gate.ts`:

```typescript
export const HOST_ALLOWLIST = new Set<string>([
  "dm.de",
  "www.dm.de",
  "rossmann.de",
  "www.rossmann.de",
  "mueller.de",
  "www.mueller.de",
  "amazon.de",
  "www.amazon.de",
  "douglas.de",
  "www.douglas.de",
  "flaconi.de",
  "www.flaconi.de",
  "notino.de",
  "www.notino.de",
  "otto.de",
  "www.otto.de",
])

export const HOST_DENYLIST = new Set<string>([
  "idealo.de",
  "www.idealo.de",
  "geizhals.de",
  "www.geizhals.de",
  "billiger.de",
  "www.billiger.de",
  "preisvergleich.de",
  "www.preisvergleich.de",
  "ebay.de",
  "www.ebay.de",
  "ebay.com",
  "www.ebay.com",
  "kleinanzeigen.de",
  "www.kleinanzeigen.de",
  "aliexpress.com",
  "www.aliexpress.com",
  "amazon.com",
  "www.amazon.com",
])

const MIN_BRAND_SLUG_LEN = 4

export function isUsableUrl(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function hostOf(url: string): string {
  return new URL(url).hostname.toLowerCase()
}

export function isAllowedHost(host: string): boolean {
  return HOST_ALLOWLIST.has(host.toLowerCase())
}

export function isDeniedHost(host: string): boolean {
  return HOST_DENYLIST.has(host.toLowerCase())
}

const UMLAUT_MAP: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" }

export function normalizeBrandSlug(brand: string | null | undefined): string {
  if (!brand) return ""
  const lowered = brand.toLowerCase()
  const expanded = lowered.replace(/[äöüß]/g, (ch) => UMLAUT_MAP[ch] ?? ch)
  return expanded.replace(/[^a-z0-9]/g, "")
}

export function passesBrandDirect(host: string, brand: string | null | undefined): boolean {
  const slug = normalizeBrandSlug(brand)
  if (slug.length < MIN_BRAND_SLUG_LEN) return false
  return host.toLowerCase().includes(slug)
}

export type UrlGateInput = {
  chosen_url: string | null | undefined
  brand: string | null | undefined
}

export type UrlGateResult = { pass: true } | { pass: false; reason: string }

export function urlGate(row: UrlGateInput): UrlGateResult {
  if (!isUsableUrl(row.chosen_url)) {
    return { pass: false, reason: "url failed to parse or is not http(s)" }
  }
  const host = hostOf(row.chosen_url as string)
  if (isDeniedHost(host)) {
    return { pass: false, reason: `host ${host} is denylisted (aggregator or wrong marketplace)` }
  }
  if (isAllowedHost(host)) {
    return { pass: true }
  }
  if (passesBrandDirect(host, row.brand)) {
    return { pass: true }
  }
  return { pass: false, reason: `host ${host} is not on allowlist and does not match brand-direct rule` }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test tests/affiliate-research-url-gate.test.ts
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-research/url-gate.ts tests/affiliate-research-url-gate.test.ts
git commit -m "feat(affiliate-research): add URL gate with host allow/deny + brand-direct rule"
```

---

### Task 3: CSV utilities + tests

A tiny RFC-4180-shaped reader/writer. Quoted fields with embedded commas, quotes, and newlines must round-trip.

**Files:**
- Create: `src/lib/affiliate-research/csv.ts`
- Create: `tests/affiliate-research-csv.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/affiliate-research-csv.test.ts`:

```typescript
import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parseCsv, stringifyCsv, readCsv, writeCsv } from "../src/lib/affiliate-research/csv"

test("parseCsv handles simple rows", () => {
  const rows = parseCsv("id,name\n1,foo\n2,bar\n")
  assert.deepEqual(rows, [
    { id: "1", name: "foo" },
    { id: "2", name: "bar" },
  ])
})

test("parseCsv handles quoted fields with commas and quotes", () => {
  const rows = parseCsv('id,name\n1,"foo, bar"\n2,"she said ""hi"""\n')
  assert.deepEqual(rows, [
    { id: "1", name: "foo, bar" },
    { id: "2", name: 'she said "hi"' },
  ])
})

test("parseCsv tolerates trailing newline and empty fields", () => {
  const rows = parseCsv("id,name\n1,\n")
  assert.deepEqual(rows, [{ id: "1", name: "" }])
})

test("stringifyCsv quotes only when necessary", () => {
  const out = stringifyCsv(
    ["id", "name"],
    [
      { id: "1", name: "foo" },
      { id: "2", name: "has, comma" },
      { id: "3", name: 'has "quotes"' },
    ],
  )
  assert.equal(out, 'id,name\n1,foo\n2,"has, comma"\n3,"has ""quotes"""\n')
})

test("round-trip: writeCsv then readCsv recovers data", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-test-"))
  const path = join(dir, "x.csv")
  const rows = [
    { id: "a", url: "https://x.example/p?q=1,2" },
    { id: "b", url: "https://y.example/p" },
  ]
  writeCsv(path, ["id", "url"], rows)
  const back = readCsv(path)
  assert.deepEqual(back, rows)
})

test("readCsv throws on header mismatch via callback", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-test-"))
  const path = join(dir, "x.csv")
  writeFileSync(path, "id,brand\n1,Pantene\n")
  assert.throws(
    () => readCsv(path, { expectedHeader: ["id", "name"] }),
    /header/i,
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test tests/affiliate-research-csv.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `csv.ts`**

Create `src/lib/affiliate-research/csv.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test tests/affiliate-research-csv.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-research/csv.ts tests/affiliate-research-csv.test.ts
git commit -m "feat(affiliate-research): add RFC-4180 CSV reader/writer"
```

---

### Task 4: Slice validator library + tests

The per-slice validator checks a subagent's output CSV against its input slice CSV.

**Files:**
- Create: `src/lib/affiliate-research/slice-validator.ts`
- Create: `tests/affiliate-research-slice-validator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/affiliate-research-slice-validator.test.ts`:

```typescript
import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { validateSlice } from "../src/lib/affiliate-research/slice-validator"

const INPUT_HEADER = "id,brand,name,description,category,price_eur"
const OUTPUT_HEADER = "id,brand,name,chosen_url,host,confidence,matched_tokens,notes"

function fixtureDir() {
  return mkdtempSync(join(tmpdir(), "slice-val-"))
}

test("valid slice: ids match exactly, no duplicates", () => {
  const dir = fixtureDir()
  writeFileSync(
    join(dir, "in.csv"),
    `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\nb,Brand,Name2,Desc2,Shampoo,6\n`,
  )
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,https://x.de/p,x.de,high,Foo,ok\nb,Brand,Name2,,,none,,not found\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, true)
  assert.deepEqual(res.missing, [])
  assert.deepEqual(res.duplicated, [])
})

test("missing id reported", () => {
  const dir = fixtureDir()
  writeFileSync(
    join(dir, "in.csv"),
    `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\nb,Brand,Name2,Desc2,Shampoo,6\n`,
  )
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,,,none,,\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.deepEqual(res.missing, ["b"])
})

test("duplicate id reported", () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, "in.csv"), `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\n`)
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,,,none,,\na,Brand,Name,,,none,,\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.deepEqual(res.duplicated, ["a"])
})

test("wrong output header reported as schemaError", () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, "in.csv"), `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\n`)
  writeFileSync(join(dir, "out.csv"), `id,brand,name,url\na,Brand,Name,https://x.de\n`)
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.match(res.errors.join("\n"), /header/i)
})

test("invalid confidence value reported", () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, "in.csv"), `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\n`)
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,https://x.de,x.de,SUPER,Foo,ok\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.match(res.errors.join("\n"), /confidence/i)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test tests/affiliate-research-slice-validator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `slice-validator.ts`**

Create `src/lib/affiliate-research/slice-validator.ts`:

```typescript
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
    errors.push(`output contains ${extras.length} ids not in input: ${extras.slice(0, 5).join(", ")}`)
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test tests/affiliate-research-slice-validator.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-research/slice-validator.ts tests/affiliate-research-slice-validator.test.ts
git commit -m "feat(affiliate-research): add per-slice CSV validator"
```

---

### Task 5: Aggregator library + tests

Pure functions for deduping and classifying rows into `approved` / `review` buckets.

**Files:**
- Create: `src/lib/affiliate-research/aggregate.ts`
- Create: `tests/affiliate-research-aggregate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/affiliate-research-aggregate.test.ts`:

```typescript
import assert from "node:assert/strict"
import test from "node:test"

import {
  dedupeByConfidence,
  classifyForOutput,
  type ResultRow,
} from "../src/lib/affiliate-research/aggregate"

function row(p: Partial<ResultRow>): ResultRow {
  return {
    id: "x",
    brand: "Brand",
    name: "Name",
    chosen_url: "",
    host: "",
    confidence: "none",
    matched_tokens: "",
    notes: "",
    ...p,
  }
}

test("dedupeByConfidence keeps highest confidence per id", () => {
  const rows = [
    row({ id: "a", confidence: "none" }),
    row({ id: "a", confidence: "high", chosen_url: "https://www.dm.de/p" }),
    row({ id: "b", confidence: "medium" }),
  ]
  const out = dedupeByConfidence(rows)
  assert.equal(out.length, 2)
  const a = out.find((r) => r.id === "a")!
  assert.equal(a.confidence, "high")
})

test("dedupeByConfidence tie-breaks on allowlisted host > brand-direct > other", () => {
  const rows = [
    row({ id: "a", confidence: "high", chosen_url: "https://other-shop.example/p", host: "other-shop.example" }),
    row({ id: "a", confidence: "high", chosen_url: "https://www.dm.de/p", host: "www.dm.de" }),
  ]
  const out = dedupeByConfidence(rows)
  assert.equal(out.length, 1)
  assert.equal(out[0].host, "www.dm.de")
})

test("classifyForOutput approves confidence=high with allowlisted host and tokens", () => {
  const r = row({
    id: "a",
    confidence: "high",
    chosen_url: "https://www.dm.de/p/foo",
    host: "www.dm.de",
    matched_tokens: "Aqua|Revive",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "approved")
})

test("classifyForOutput sends confidence=medium to review", () => {
  const r = row({
    id: "a",
    confidence: "medium",
    chosen_url: "https://olaplex.com/p",
    host: "olaplex.com",
    matched_tokens: "No3",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "review")
  assert.match(out.reason, /confidence/i)
})

test("classifyForOutput sends confidence=high but denylisted host to review", () => {
  const r = row({
    id: "a",
    confidence: "high",
    chosen_url: "https://idealo.de/p",
    host: "idealo.de",
    matched_tokens: "Foo",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "review")
  assert.match(out.reason, /denylisted/i)
})

test("classifyForOutput sends confidence=high but empty matched_tokens to review", () => {
  const r = row({
    id: "a",
    confidence: "high",
    chosen_url: "https://www.dm.de/p",
    host: "www.dm.de",
    matched_tokens: "",
  })
  const out = classifyForOutput(r)
  assert.equal(out.bucket, "review")
  assert.match(out.reason, /matched_tokens/i)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test tests/affiliate-research-aggregate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `aggregate.ts`**

Create `src/lib/affiliate-research/aggregate.ts`:

```typescript
import { isAllowedHost, passesBrandDirect, urlGate } from "./url-gate"

export type Confidence = "high" | "medium" | "none"

export type ResultRow = {
  id: string
  brand: string
  name: string
  chosen_url: string
  host: string
  confidence: Confidence | string
  matched_tokens: string
  notes: string
}

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, none: 1 }

function hostRank(row: ResultRow): number {
  if (!row.host) return 0
  if (isAllowedHost(row.host)) return 3
  if (passesBrandDirect(row.host, row.brand)) return 2
  return 1
}

export function dedupeByConfidence(rows: ResultRow[]): ResultRow[] {
  const best = new Map<string, ResultRow>()
  for (const r of rows) {
    const existing = best.get(r.id)
    if (!existing) {
      best.set(r.id, r)
      continue
    }
    const a = CONFIDENCE_RANK[r.confidence] ?? 0
    const b = CONFIDENCE_RANK[existing.confidence] ?? 0
    if (a > b || (a === b && hostRank(r) > hostRank(existing))) {
      best.set(r.id, r)
    }
  }
  return [...best.values()]
}

export type ClassifyResult =
  | { bucket: "approved"; reason: "" }
  | { bucket: "review"; reason: string }

export function classifyForOutput(row: ResultRow): ClassifyResult {
  if (row.confidence !== "high") {
    return { bucket: "review", reason: `confidence is '${row.confidence}', not 'high'` }
  }
  if (!row.matched_tokens || row.matched_tokens.trim() === "") {
    return { bucket: "review", reason: "matched_tokens is empty" }
  }
  const gate = urlGate({ chosen_url: row.chosen_url, brand: row.brand })
  if (gate.pass === false) {
    return { bucket: "review", reason: gate.reason }
  }
  return { bucket: "approved", reason: "" }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test tests/affiliate-research-aggregate.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-research/aggregate.ts tests/affiliate-research-aggregate.test.ts
git commit -m "feat(affiliate-research): add dedupe + approve/review classifier"
```

---

### Task 6: Export script

Queries Supabase, applies the missing-link predicate, writes `missing.csv` and 16 per-slice files (1 canary + 15 fanout slices).

**Files:**
- Create: `scripts/export-missing-affiliate-links.ts`

- [ ] **Step 1: Implement the export script**

Create `scripts/export-missing-affiliate-links.ts`:

```typescript
import { config as loadEnv } from "dotenv"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

import { isUsableUrl } from "../src/lib/affiliate-research/url-gate"
import { writeCsv } from "../src/lib/affiliate-research/csv"

loadEnv({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type ProductRow = {
  id: string
  name: string
  brand: string | null
  description: string | null
  category: string | null
  affiliate_link: string | null
  price_eur: number | string | null
  is_active: boolean | null
}

const OUT_DIR = "data/affiliate-research"

const EXPORT_HEADER = ["id", "brand", "name", "description", "category", "price_eur"] as const

type SliceSpec = {
  slug: string
  category: string
  startIndex: number // 0-based, inclusive
  endIndex: number // exclusive
}

const SLICE_PLAN: ReadonlyArray<SliceSpec> = [
  { slug: "shampoo-a", category: "Shampoo", startIndex: 0, endIndex: 13 },
  { slug: "shampoo-b", category: "Shampoo", startIndex: 13, endIndex: 26 },
  { slug: "shampoo-c", category: "Shampoo", startIndex: 26, endIndex: 39 },
  { slug: "shampoo-d", category: "Shampoo", startIndex: 39, endIndex: 51 },
  { slug: "leave-in-a", category: "Leave-in", startIndex: 0, endIndex: 14 },
  { slug: "leave-in-b", category: "Leave-in", startIndex: 14, endIndex: 28 },
  { slug: "leave-in-c", category: "Leave-in", startIndex: 28, endIndex: 42 },
  { slug: "oele-a", category: "Öle", startIndex: 0, endIndex: 14 },
  { slug: "oele-b", category: "Öle", startIndex: 14, endIndex: 28 },
  { slug: "oele-c", category: "Öle", startIndex: 28, endIndex: 41 },
  { slug: "conditioner-a", category: "Conditioner (Drogerie)", startIndex: 0, endIndex: 14 },
  { slug: "conditioner-b", category: "Conditioner (Drogerie)", startIndex: 14, endIndex: 27 },
  { slug: "conditioner-c", category: "Conditioner (Drogerie)", startIndex: 27, endIndex: 40 },
  { slug: "maske-a", category: "Maske", startIndex: 0, endIndex: 18 },
  { slug: "maske-b", category: "Maske", startIndex: 18, endIndex: 35 },
]

function toExportRow(r: ProductRow): Record<string, string> {
  return {
    id: r.id,
    brand: r.brand ?? "",
    name: r.name,
    description: r.description ?? "",
    category: r.category ?? "",
    price_eur: r.price_eur != null ? String(r.price_eur) : "",
  }
}

async function fetchAllMissing(): Promise<ProductRow[]> {
  const pageSize = 1000
  let from = 0
  const all: ProductRow[] = []
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, description, category, affiliate_link, price_eur, is_active")
      .order("category", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as ProductRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all.filter((r) => r.is_active && !isUsableUrl(r.affiliate_link))
}

function pickCanary(rows: ProductRow[]): ProductRow[] {
  // 1-2 rows per category, prefer brand diversity
  const byCat = new Map<string, ProductRow[]>()
  for (const r of rows) {
    const cat = r.category ?? "(none)"
    const arr = byCat.get(cat) ?? []
    arr.push(r)
    byCat.set(cat, arr)
  }
  const out: ProductRow[] = []
  for (const [, list] of byCat) {
    out.push(list[0])
    if (list.length > 1) out.push(list[Math.min(list.length - 1, 5)])
    if (out.length >= 8) break
  }
  return out.slice(0, 8)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const missing = await fetchAllMissing()
  console.log(`Found ${missing.length} active products missing a usable affiliate_link.`)

  // Write master missing.csv
  writeCsv(
    join(OUT_DIR, "missing.csv"),
    [...EXPORT_HEADER],
    missing.map(toExportRow),
  )

  // Write canary slice
  const canary = pickCanary(missing)
  writeCsv(
    join(OUT_DIR, "missing-canary.csv"),
    [...EXPORT_HEADER],
    canary.map(toExportRow),
  )
  console.log(`Wrote missing-canary.csv with ${canary.length} rows.`)

  // Group by category, sort by id, slice
  const byCategory = new Map<string, ProductRow[]>()
  for (const r of missing) {
    const list = byCategory.get(r.category ?? "") ?? []
    list.push(r)
    byCategory.set(r.category ?? "", list)
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id))
  }

  let totalWritten = 0
  for (const slice of SLICE_PLAN) {
    const pool = byCategory.get(slice.category) ?? []
    const rows = pool.slice(slice.startIndex, slice.endIndex)
    writeCsv(
      join(OUT_DIR, `missing-${slice.slug}.csv`),
      [...EXPORT_HEADER],
      rows.map(toExportRow),
    )
    console.log(`Wrote missing-${slice.slug}.csv (${rows.length} rows from ${slice.category}).`)
    totalWritten += rows.length
  }

  if (totalWritten !== missing.length) {
    console.warn(
      `WARNING: slice plan covers ${totalWritten} rows but ${missing.length} are missing. Adjust SLICE_PLAN ranges if category counts changed.`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the export script against the live DB**

```bash
npx tsx scripts/export-missing-affiliate-links.ts
```

Expected output:
```
Found 209 active products missing a usable affiliate_link.
Wrote missing-canary.csv with 8 rows.
Wrote missing-shampoo-a.csv (13 rows from Shampoo).
...
```

If totals don't match (e.g. category counts have drifted), the warning fires — adjust `SLICE_PLAN` ranges and rerun.

- [ ] **Step 3: Spot-check one slice file**

```bash
head -3 data/affiliate-research/missing-shampoo-a.csv
```

Expected: header row plus two product rows with valid id/brand/name.

- [ ] **Step 4: Commit**

```bash
git add scripts/export-missing-affiliate-links.ts
git commit -m "feat(affiliate-research): export missing-link products into slice CSVs"
```

---

### Task 7: Validate-slice CLI

Thin wrapper around `validateSlice`. Runs after each subagent's slice; exits non-zero on failure.

**Files:**
- Create: `scripts/validate-slice.ts`

- [ ] **Step 1: Implement the validator CLI**

Create `scripts/validate-slice.ts`:

```typescript
import { appendFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import { validateSlice } from "../src/lib/affiliate-research/slice-validator"

function usage(): never {
  console.error(
    "Usage: tsx scripts/validate-slice.ts <slug>\n" +
      "  Reads data/affiliate-research/missing-<slug>.csv and results-<slug>.csv.\n" +
      "  Appends one line to data/affiliate-research/validation.log.\n" +
      "  Exits 0 on success, 1 on validation failure, 2 on missing files.",
  )
  process.exit(2)
}

const slug = process.argv[2]
if (!slug) usage()
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`Invalid slug '${slug}' — must match [a-z0-9-]+`)
  process.exit(2)
}

const DIR = "data/affiliate-research"
const inputPath = join(DIR, `missing-${slug}.csv`)
const outputPath = join(DIR, `results-${slug}.csv`)
const logPath = join(DIR, "validation.log")

if (!existsSync(inputPath)) {
  console.error(`Missing input file: ${inputPath}`)
  process.exit(2)
}
if (!existsSync(outputPath)) {
  console.error(`Missing output file: ${outputPath} — subagent has not produced results yet.`)
  process.exit(2)
}

const res = validateSlice({ inputPath, outputPath })
const timestamp = new Date().toISOString()
const summary = `${timestamp} slice=${slug} ok=${res.ok} rows=${res.rowCount} missing=${res.missing.length} duplicated=${res.duplicated.length}`
appendFileSync(logPath, summary + "\n")
console.log(summary)
if (!res.ok) {
  for (const err of res.errors) console.error("  - " + err)
  process.exit(1)
}
process.exit(0)
```

- [ ] **Step 2: Smoke-test against a hand-built fixture**

```bash
mkdir -p data/affiliate-research
cat > data/affiliate-research/missing-smoke.csv <<'EOF'
id,brand,name,description,category,price_eur
a,Brand,Name,Desc,Shampoo,5
b,Brand,Name2,Desc2,Shampoo,6
EOF
cat > data/affiliate-research/results-smoke.csv <<'EOF'
id,brand,name,chosen_url,host,confidence,matched_tokens,notes
a,Brand,Name,https://www.dm.de/p,www.dm.de,high,Foo,ok
b,Brand,Name2,,,none,,not found
EOF
npx tsx scripts/validate-slice.ts smoke
```

Expected output:
```
... slice=smoke ok=true rows=2 missing=0 duplicated=0
```

Exit code 0.

- [ ] **Step 3: Negative test — corrupt the output**

```bash
echo "a,Brand,Name,,,WRONG,," >> data/affiliate-research/results-smoke.csv
npx tsx scripts/validate-slice.ts smoke
echo "exit code: $?"
```

Expected: ok=false, error mentioning duplicate id and/or invalid confidence. Exit code 1.

- [ ] **Step 4: Clean up smoke files**

```bash
rm data/affiliate-research/missing-smoke.csv data/affiliate-research/results-smoke.csv
```

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-slice.ts
git commit -m "feat(affiliate-research): add per-slice CLI validator"
```

---

### Task 8: Aggregate script

Reads `data/affiliate-research/results-*.csv` (hard-coded glob, no flag), dedupes, classifies, writes `results.csv`, `approved.csv`, `review-queue.csv`.

**Files:**
- Create: `scripts/aggregate-affiliate-research.ts`

- [ ] **Step 1: Implement the aggregator**

Create `scripts/aggregate-affiliate-research.ts`:

```typescript
import { readdirSync } from "node:fs"
import { join } from "node:path"

import { readCsv, writeCsv, type CsvRow } from "../src/lib/affiliate-research/csv"
import {
  dedupeByConfidence,
  classifyForOutput,
  type ResultRow,
} from "../src/lib/affiliate-research/aggregate"
import {
  INPUT_HEADER,
  OUTPUT_HEADER,
} from "../src/lib/affiliate-research/slice-validator"

const DIR = "data/affiliate-research"
const RESULTS_GLOB = /^results-[a-z0-9-]+\.csv$/

const APPROVED_HEADER = ["id", "brand", "name", "chosen_url", "host", "matched_tokens", "notes"] as const
const REVIEW_HEADER = [
  "id",
  "brand",
  "name",
  "chosen_url",
  "host",
  "confidence",
  "matched_tokens",
  "notes",
  "review_reason",
] as const

function toResultRow(r: CsvRow): ResultRow {
  return {
    id: r.id,
    brand: r.brand,
    name: r.name,
    chosen_url: r.chosen_url,
    host: r.host,
    confidence: r.confidence,
    matched_tokens: r.matched_tokens,
    notes: r.notes,
  }
}

function loadCategoryByIdFromMissing(): Map<string, string> {
  const path = join(DIR, "missing.csv")
  const rows = readCsv(path, { expectedHeader: [...INPUT_HEADER] })
  const map = new Map<string, string>()
  for (const r of rows) map.set(r.id, r.category)
  return map
}

function main(): void {
  const files = readdirSync(DIR).filter((f) => RESULTS_GLOB.test(f))
  if (files.length === 0) {
    console.error(`No results-*.csv found in ${DIR}. Did the subagents run?`)
    process.exit(2)
  }

  const categoryById = loadCategoryByIdFromMissing()

  const all: ResultRow[] = []
  for (const f of files) {
    const rows = readCsv(join(DIR, f), { expectedHeader: [...OUTPUT_HEADER] })
    for (const r of rows) all.push(toResultRow(r))
    console.log(`Loaded ${rows.length} rows from ${f}`)
  }

  const deduped = dedupeByConfidence(all)
  console.log(`Deduped ${all.length} → ${deduped.length} unique ids.`)

  const approved: CsvRow[] = []
  const review: CsvRow[] = []
  for (const r of deduped) {
    const cls = classifyForOutput(r)
    if (cls.bucket === "approved") {
      approved.push({
        id: r.id,
        brand: r.brand,
        name: r.name,
        chosen_url: r.chosen_url,
        host: r.host,
        matched_tokens: r.matched_tokens,
        notes: r.notes,
      })
    } else {
      review.push({
        id: r.id,
        brand: r.brand,
        name: r.name,
        chosen_url: r.chosen_url,
        host: r.host,
        confidence: r.confidence,
        matched_tokens: r.matched_tokens,
        notes: r.notes,
        review_reason: cls.reason,
      })
    }
  }

  writeCsv(
    join(DIR, "results.csv"),
    [...OUTPUT_HEADER],
    deduped.map((r) => ({
      id: r.id,
      brand: r.brand,
      name: r.name,
      chosen_url: r.chosen_url,
      host: r.host,
      confidence: r.confidence,
      matched_tokens: r.matched_tokens,
      notes: r.notes,
    })),
  )
  writeCsv(join(DIR, "approved.csv"), [...APPROVED_HEADER], approved)
  writeCsv(join(DIR, "review-queue.csv"), [...REVIEW_HEADER], review)

  // Category × confidence summary (joined via missing.csv)
  type Tallies = { high: number; medium: number; none: number; approved: number; review: number }
  const summary = new Map<string, Tallies>()
  for (const r of deduped) {
    const cat = categoryById.get(r.id) ?? "(unknown)"
    const slot: Tallies = summary.get(cat) ?? { high: 0, medium: 0, none: 0, approved: 0, review: 0 }
    if (r.confidence === "high") slot.high++
    else if (r.confidence === "medium") slot.medium++
    else slot.none++
    summary.set(cat, slot)
  }
  for (const row of approved) {
    const cat = categoryById.get(row.id) ?? "(unknown)"
    const slot = summary.get(cat)
    if (slot) slot.approved++
  }
  for (const row of review) {
    const cat = categoryById.get(row.id) ?? "(unknown)"
    const slot = summary.get(cat)
    if (slot) slot.review++
  }

  console.log("\n=== Summary ===")
  console.log(`Total unique ids: ${deduped.length}`)
  console.log(`Approved:         ${approved.length}`)
  console.log(`Review queue:     ${review.length}`)
  console.log("\ncategory                 | high | medium | none | approved | review")
  for (const [cat, t] of [...summary.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(
      `${cat.padEnd(24)} | ${String(t.high).padStart(4)} | ${String(t.medium).padStart(6)} | ${String(t.none).padStart(4)} | ${String(t.approved).padStart(8)} | ${String(t.review).padStart(6)}`,
    )
  }
}

main()
```

- [ ] **Step 2: Smoke-test against minimal fixtures**

If a real `missing.csv` already exists (from Task 6), back it up first:

```bash
[ -f data/affiliate-research/missing.csv ] && mv data/affiliate-research/missing.csv data/affiliate-research/missing.csv.bak

cat > data/affiliate-research/missing.csv <<'EOF'
id,brand,name,description,category,price_eur
a,Pantene,Aqua Glow,,Shampoo,5
b,Sante,Aloe Conditioner,,Conditioner (Drogerie),6
c,Bali,Bali Curls,,Leave-in,7
d,Foo,Foo Mask,,Maske,8
e,Cantu,Cantu Repair,,Conditioner (Drogerie),9
EOF

cat > data/affiliate-research/results-smoke1.csv <<'EOF'
id,brand,name,chosen_url,host,confidence,matched_tokens,notes
a,Pantene,Aqua Glow,https://www.dm.de/p/aqua-glow,www.dm.de,high,Aqua|Glow,ok
b,Sante,Aloe Conditioner,https://sante.de/aloe,sante.de,high,Aloe,brand-direct
c,Bali,Bali Curls,https://random.example/p,random.example,high,Bali|Curls,unknown shop
EOF

cat > data/affiliate-research/results-smoke2.csv <<'EOF'
id,brand,name,chosen_url,host,confidence,matched_tokens,notes
a,Pantene,Aqua Glow,https://other.example/p,other.example,medium,Aqua,older candidate
d,Foo,Foo Mask,,,none,,no shop carries it
e,Cantu,Cantu Repair,https://idealo.de/p,idealo.de,high,Repair,oops aggregator
EOF

npx tsx scripts/aggregate-affiliate-research.ts
```

Expected:
- a → approved (high on dm.de; deduped against the medium other.example)
- b → approved (high, brand-direct sante.de)
- c → review (host not allowlisted, brand "Bali" too short for brand-direct)
- d → review (confidence=none)
- e → review (host denylisted)

```
Approved:     2
Review queue: 3
```

- [ ] **Step 3: Clean up smoke files**

```bash
rm data/affiliate-research/results-smoke1.csv data/affiliate-research/results-smoke2.csv
rm -f data/affiliate-research/results.csv data/affiliate-research/approved.csv data/affiliate-research/review-queue.csv
rm data/affiliate-research/missing.csv
[ -f data/affiliate-research/missing.csv.bak ] && mv data/affiliate-research/missing.csv.bak data/affiliate-research/missing.csv
```

- [ ] **Step 4: Commit**

```bash
git add scripts/aggregate-affiliate-research.ts
git commit -m "feat(affiliate-research): aggregate subagent results into approved/review CSVs"
```

---

### Task 9: Write-back script with --dry

Reads `approved.csv`, runs the UPDATE with the safety-belt WHERE clause, appends to `applied.log`.

**Files:**
- Create: `scripts/write-affiliate-links.ts`

- [ ] **Step 1: Implement the write-back script**

Pattern: pre-fetch each candidate's current `affiliate_link`, decide locally whether the safety belt allows the write (mirroring the export predicate exactly: `null OR empty OR non-http(s)`), then `UPDATE`. Two round-trips per row, ~200 rows = ~400 calls. Acceptable.

Create `scripts/write-affiliate-links.ts`:

```typescript
import { config as loadEnv } from "dotenv"
import { appendFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

import { readCsv } from "../src/lib/affiliate-research/csv"
import { isUsableUrl, urlGate } from "../src/lib/affiliate-research/url-gate"

loadEnv({ path: ".env.local" })

const DIR = "data/affiliate-research"
const APPROVED_PATH = join(DIR, "approved.csv")
const LOG_PATH = join(DIR, "applied.log")

const APPROVED_HEADER = ["id", "brand", "name", "chosen_url", "host", "matched_tokens", "notes"]

const dry = process.argv.includes("--dry")

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Mirrors the export predicate: write-eligible iff current value is null,
// empty/whitespace, or not a usable http(s) URL.
function safeToWrite(currentValue: string | null | undefined): boolean {
  return !isUsableUrl(currentValue)
}

function appendLog(line: string): void {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`)
}

async function main(): Promise<void> {
  const rows = readCsv(APPROVED_PATH, { expectedHeader: APPROVED_HEADER })
  console.log(`Read ${rows.length} approved rows from ${APPROVED_PATH}.`)

  // Defensive re-gate — should be a no-op for a well-formed approved.csv.
  const rejected: { id: string; reason: string }[] = []
  const accepted = rows.filter((r) => {
    const g = urlGate({ chosen_url: r.chosen_url, brand: r.brand })
    if (g.pass === false) {
      rejected.push({ id: r.id, reason: g.reason })
      return false
    }
    return true
  })
  if (rejected.length > 0) {
    console.warn(`REJECTED ${rejected.length} rows on re-validation:`)
    for (const r of rejected) console.warn(`  - ${r.id}: ${r.reason}`)
  }

  let applied = 0
  let skippedBySafetyBelt = 0
  let failed = 0
  for (const r of accepted) {
    const { data: current, error: readErr } = await supabase
      .from("products")
      .select("id, affiliate_link")
      .eq("id", r.id)
      .maybeSingle()
    if (readErr) {
      console.error(`READ FAILED ${r.id}: ${readErr.message}`)
      failed++
      continue
    }
    if (!current) {
      console.error(`NOT FOUND ${r.id} — product no longer exists`)
      failed++
      continue
    }
    if (!safeToWrite(current.affiliate_link as string | null)) {
      skippedBySafetyBelt++
      appendLog(`SKIP id=${r.id} reason=safety_belt_existing=${JSON.stringify(current.affiliate_link)}`)
      continue
    }
    if (dry) {
      console.log(`DRY  UPDATE products SET affiliate_link='${r.chosen_url}' WHERE id='${r.id}'`)
      applied++
      continue
    }
    const { error: writeErr } = await supabase
      .from("products")
      .update({ affiliate_link: r.chosen_url })
      .eq("id", r.id)
    if (writeErr) {
      console.error(`WRITE FAILED ${r.id}: ${writeErr.message}`)
      failed++
      continue
    }
    appendLog(`OK   id=${r.id} url=${r.chosen_url}`)
    applied++
  }

  console.log(
    `\nDone. applied=${applied}, skipped_by_safety_belt=${skippedBySafetyBelt}, rejected_on_revalidate=${rejected.length}, failed=${failed}.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run --dry against a small approved.csv fixture**

```bash
cat > data/affiliate-research/approved.csv <<'EOF'
id,brand,name,chosen_url,host,matched_tokens,notes
test-id,Pantene,Aqua Glow,https://www.dm.de/p/aqua-glow,www.dm.de,Aqua|Glow,ok
EOF
npx tsx scripts/write-affiliate-links.ts --dry
```

Expected: prints a DRY UPDATE statement; no DB writes; reports `applied=1`.

- [ ] **Step 3: Negative dry-run — junk URL**

```bash
cat > data/affiliate-research/approved.csv <<'EOF'
id,brand,name,chosen_url,host,matched_tokens,notes
junk-id,Pantene,Aqua,https://idealo.de/p,idealo.de,Aqua,oops
EOF
npx tsx scripts/write-affiliate-links.ts --dry
```

Expected: warns that `junk-id` was rejected on re-validation (denylisted host); applied=0.

- [ ] **Step 4: Clean up fixture**

```bash
rm -f data/affiliate-research/approved.csv data/affiliate-research/applied.log
```

- [ ] **Step 5: Commit**

```bash
git add scripts/write-affiliate-links.ts
git commit -m "feat(affiliate-research): write-back script with safety-belt UPDATE and --dry"
```

---

### Task 10: Runbook

Document the execution sequence so anyone (or the dispatcher in a fresh session) can run the workflow without re-reading the spec.

**Files:**
- Create: `docs/runbooks/2026-05-13-affiliate-link-backfill-runbook.md`

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/2026-05-13-affiliate-link-backfill-runbook.md`:

````markdown
# Runbook — Affiliate Link Backfill Execution

Spec: `docs/superpowers/specs/2026-05-13-affiliate-link-backfill-design.md`
Plan: `docs/superpowers/plans/2026-05-13-affiliate-link-backfill.md`

This runbook walks through a single end-to-end execution. Everything that mutates production data is explicit and confirm-able.

## Prerequisites

- `.env.local` is populated with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run ci:verify` passes on `main`.
- `data/affiliate-research/` exists.

## Step 1 — Export

```bash
npx tsx scripts/export-missing-affiliate-links.ts
```

Confirm the row count matches the audit (`209` at time of plan-writing). If the totals warning fires, update `SLICE_PLAN` in the export script and rerun.

## Step 2 — Canary

Dispatch one general-purpose subagent. From the Claude Code session, invoke the `Agent` tool with the prompt template below, parameterized for the canary slice:

```
INPUT  = data/affiliate-research/missing-canary.csv
OUTPUT = data/affiliate-research/results-canary.csv
CATEGORY = "mixed (canary)"
PREFERENCE_ORDER = "DM > Rossmann > Müller > brand-direct > Amazon DE"
```

Wait for the agent to complete. Then:

```bash
npx tsx scripts/validate-slice.ts canary
head -5 data/affiliate-research/results-canary.csv
```

Eyeball the chosen URLs. If the verification rules need tweaking (too many false `high`s, etc.), edit the prompt template before fanout.

## Step 3 — Fanout

In a single Claude Code message, dispatch 15 `Agent` calls in parallel — one per slice. Use the per-category preference orders from the spec. Each agent's prompt swaps in its slice's `SLUG`, `CATEGORY`, and `PREFERENCE_ORDER`.

Slices:

```
shampoo-a, shampoo-b, shampoo-c, shampoo-d
leave-in-a, leave-in-b, leave-in-c
oele-a, oele-b, oele-c
conditioner-a, conditioner-b, conditioner-c
maske-a, maske-b
```

When all 15 return:

```bash
for slug in shampoo-a shampoo-b shampoo-c shampoo-d \
            leave-in-a leave-in-b leave-in-c \
            oele-a oele-b oele-c \
            conditioner-a conditioner-b conditioner-c \
            maske-a maske-b; do
  npx tsx scripts/validate-slice.ts "$slug" || echo "FAILED: $slug"
done
```

Any slice that fails: rerun ONLY that slice's subagent (point it at the same input/output paths). Re-validate.

## Step 4 — Pre-aggregation diff check

Confirm the subagents only wrote `results-*.csv` files (boundary check from the spec):

```bash
ls data/affiliate-research/
git status -- data/affiliate-research/
```

Expected: only `missing-*.csv` (already-present) and `results-*.csv` (newly written) files. If anything else changed (e.g. someone touched `applied.log` already, or a stray script-output file appeared), STOP and investigate before aggregating.

## Step 5 — Aggregate

```bash
npx tsx scripts/aggregate-affiliate-research.ts
```

Inspect:

```bash
wc -l data/affiliate-research/{results,approved,review-queue}.csv
head -10 data/affiliate-research/approved.csv
```

## Step 6 — Manual review of `approved.csv`

Open `approved.csv`. Sanity-check each row's `chosen_url` against `name` and `brand`. Delete any row that looks wrong. Move rows you'd like to escalate from `review-queue.csv` into `approved.csv` if you trust them.

## Step 7 — Dry write-back

```bash
npx tsx scripts/write-affiliate-links.ts --dry
```

Confirm the printed UPDATE count matches `approved.csv` row count.

## Step 8 — Real write-back

```bash
npx tsx scripts/write-affiliate-links.ts
```

Then re-audit:

```bash
npx tsx scripts/audit-affiliate-links.ts
```

`activeWithLink` should have increased by exactly the count in `applied.log`.

## Rollback

If a bad batch of URLs was written, regenerate from the previous audit and re-NULL specific rows:

```sql
UPDATE products SET affiliate_link = NULL WHERE id IN ('id1', 'id2', ...);
```

Then re-export, re-research only those rows, and re-aggregate.
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-05-13-affiliate-link-backfill-runbook.md
git commit -m "docs(affiliate-research): runbook for end-to-end execution"
```

---

### Task 11: Final verification

Confirm all scripts run, all tests pass, and the type-check is clean before declaring the implementation done.

- [ ] **Step 1: Run all affiliate-research tests**

```bash
npx tsx --test \
  tests/affiliate-research-url-gate.test.ts \
  tests/affiliate-research-csv.test.ts \
  tests/affiliate-research-slice-validator.test.ts \
  tests/affiliate-research-aggregate.test.ts
```

Expected: all tests pass (28 total across the four files).

- [ ] **Step 2: Type-check the whole project**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Lint the whole project**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Confirm script entry-points work without arguments**

```bash
npx tsx scripts/validate-slice.ts 2>&1 | head -5
npx tsx scripts/aggregate-affiliate-research.ts 2>&1 | head -5
npx tsx scripts/write-affiliate-links.ts --dry 2>&1 | head -5
```

Each should print a useful error or usage message (no uncaught crash).

No commit needed; this task is verification only.

---

## Runbook (post-implementation)

The implementation builds the tooling. **Running the workflow against the live DB is not part of this plan** — it's the runbook (Task 10) that the user (or a fresh Claude Code session) executes.
