import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import ts from "typescript"
import { fileURLToPath } from "node:url"

const repoRoot = fileURLToPath(new URL("..", import.meta.url))
const landingEntries = [
  "instrumentation-client.ts",
  "src/app/global-error.tsx",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/lp/[slug]/page.tsx",
]

test("landing client dependency graphs contain no static Sentry SDK import", () => {
  const queue = landingEntries.map((relativePath) => ({
    clientGraph:
      relativePath === "instrumentation-client.ts" || relativePath === "src/app/global-error.tsx",
    path: path.join(repoRoot, relativePath),
    trail: [relativePath],
  }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    assert.ok(current)
    const source = readFileSync(current.path, "utf8")
    const isClientGraph = current.clientGraph || hasUseClientDirective(source)
    const visitKey = `${isClientGraph ? "client" : "server"}:${current.path}`
    if (visited.has(visitKey)) continue
    visited.add(visitKey)

    for (const specifier of staticValueImports(current.path, source)) {
      assert.notEqual(
        isClientGraph ? specifier : null,
        "@sentry/nextjs",
        `Static Sentry import reached from landing client graph:\n${current.trail.join(" -> ")} -> ${specifier}`,
      )
      const resolved = resolveProjectImport(current.path, specifier)
      if (!resolved) continue
      queue.push({
        clientGraph: isClientGraph,
        path: resolved,
        trail: [...current.trail, path.relative(repoRoot, resolved)],
      })
    }
  }
})

function hasUseClientDirective(source: string) {
  return /^\s*["']use client["']/m.test(source)
}

function staticValueImports(filePath: string, source: string) {
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
  const imports: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.importClause?.isTypeOnly) continue
      if (hasOnlyTypeNamedImports(statement.importClause)) continue
      imports.push(statement.moduleSpecifier.text)
      continue
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      !statement.isTypeOnly
    ) {
      imports.push(statement.moduleSpecifier.text)
    }
  }
  return imports
}

function hasOnlyTypeNamedImports(clause: ts.ImportClause | undefined) {
  if (
    !clause ||
    clause.name ||
    !clause.namedBindings ||
    ts.isNamespaceImport(clause.namedBindings)
  ) {
    return false
  }
  return (
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((item) => item.isTypeOnly)
  )
}

function resolveProjectImport(fromPath: string, specifier: string) {
  let base: string
  if (specifier.startsWith("@/")) {
    base = path.join(repoRoot, "src", specifier.slice(2))
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromPath), specifier)
  } else {
    return null
  }

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}
