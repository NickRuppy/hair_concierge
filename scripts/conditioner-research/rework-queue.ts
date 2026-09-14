import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { readConditionerReworkQueue } from "../../src/lib/conditioner-research/review-state"

export function unresolvedConditionerReworkPacket(filePath: string) {
  const queue = readConditionerReworkQueue(filePath)
  if (!queue) throw new Error(`Conditioner-Rework-Queue fehlt oder ist ungültig: ${filePath}`)
  const entries = queue.entries.filter((entry) => entry.status === "open")
  return {
    schemaVersion: "conditioner-inci-worker-rework-packet-v1",
    sourceUpdatedAt: queue.updatedAt,
    openCount: entries.length,
    entries: entries.map((entry) => ({
      reworkId: entry.id,
      productId: entry.productId,
      productName: entry.productName,
      propertyPath: entry.propertyPath,
      reviewerComment: entry.comment,
      formulaFingerprint: entry.formulaFingerprint,
      profileFingerprint: entry.profileFingerprint,
      fieldFingerprint: entry.fieldFingerprint,
      standardVersion: entry.standardVersion,
      openedAt: entry.openedAt,
    })),
  }
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main() {
  const filePath = resolve(
    argumentValue("--path") ??
      process.env.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH ??
      "data/research/conditioner-inci/v1.0/rework-queue.json",
  )
  const packet = unresolvedConditionerReworkPacket(filePath)
  process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
