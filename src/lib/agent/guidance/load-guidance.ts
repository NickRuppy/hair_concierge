import { readFile } from "fs/promises"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

import { guidanceCatalog } from "./catalog"
import type { GuidanceCatalogEntry } from "./catalog"
import type { GuidanceId, GuidanceLoadResult } from "../contracts"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(moduleDir, "../../../../")

function resolveEntryPaths(entry: GuidanceCatalogEntry): string[] {
  if (entry.paths && entry.paths.length > 0) {
    return [...entry.paths]
  }

  if (entry.path) {
    return [entry.path]
  }

  throw new Error(`Guidance catalog entry has no path: ${entry.title}`)
}

export async function loadGuidance(ids: readonly string[]): Promise<GuidanceLoadResult> {
  const items = await Promise.all(
    ids.map(async (id) => {
      const guidanceId = id as GuidanceId
      const entry = guidanceCatalog[guidanceId]

      if (!entry) {
        throw new Error(`Unknown guidance id: ${id}`)
      }

      const contentParts = await Promise.all(
        resolveEntryPaths(entry).map((entryPath) => readFile(resolve(repoRoot, entryPath), "utf8")),
      )

      return {
        id: guidanceId,
        kind: entry.kind,
        title: entry.title,
        content: contentParts.join("\n\n"),
      }
    }),
  )

  return { items }
}
