import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

import { parseCatalogAuthorityAuditArgs } from "../scripts/catalog-authority/audit"
import { CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS } from "../src/lib/catalog-authority/contracts"

test("catalogue audit arguments keep live mode read-only and explicit", () => {
  assert.deepEqual(parseCatalogAuthorityAuditArgs([]), {
    inputPath: null,
    schemaInputPath: null,
    pretty: false,
    allowIssues: false,
  })
  assert.deepEqual(
    parseCatalogAuthorityAuditArgs([
      "--input",
      "/tmp/catalog.json",
      "--schema-input",
      "/tmp/schema.json",
      "--pretty",
      "--allow-issues",
    ]),
    {
      inputPath: "/tmp/catalog.json",
      schemaInputPath: "/tmp/schema.json",
      pretty: true,
      allowIssues: true,
    },
  )
  assert.throws(
    () => parseCatalogAuthorityAuditArgs(["--apply"]),
    /unknown catalog authority audit argument/,
  )
})

test("catalogue audit replays a sanitized snapshot without credentials or writes", () => {
  const directory = mkdtempSync(join(tmpdir(), "catalog-authority-audit-"))
  try {
    const input = join(directory, "snapshot.json")
    const schemaInput = join(directory, "schema.json")
    writeFileSync(
      input,
      JSON.stringify({
        schemaVersion: 1,
        inspectedAt: "2026-08-15T12:00:00.000Z",
        products: [],
        facts: [],
        protocols: [],
        guidance: [],
        evidence: [],
        rowCounts: {},
        schemaObjects: null,
      }),
    )
    writeFileSync(schemaInput, JSON.stringify([{ receipt: { schemaObjects: [] } }]))
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/catalog-authority/audit.ts",
        "--input",
        input,
        "--schema-input",
        schemaInput,
        "--allow-issues",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    )

    assert.equal(result.status, 0, result.stderr)
    const receipt = JSON.parse(result.stdout) as Record<string, unknown>
    assert.equal(receipt.mode, "read_only")
    assert.equal(receipt.clean, false)
    assert.match(
      result.stderr,
      new RegExp(
        `0 products, ${CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS.length} issues, mode=read_only`,
      ),
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
