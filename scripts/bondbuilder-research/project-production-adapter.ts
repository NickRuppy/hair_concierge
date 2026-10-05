import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { projectBondbuilderForProduction } from "../../src/lib/bondbuilder-research/production-adapter"

/** Local artifact writer only. A nonempty destination is immutable, including refused runs. */
export function runBondbuilderProductionAdapterCli(argv: string[]): number {
  if (argv.length !== 4 || argv[0] !== "--input" || argv[2] !== "--output")
    throw new Error("Usage: --input <envelope.json> --output <new-or-empty-directory>")
  const input = path.resolve(argv[1]),
    output = path.resolve(argv[3])
  if (output === path.parse(output).root) throw new Error("Refusing filesystem root as output")
  if (
    existsSync(output) &&
    (lstatSync(output).isSymbolicLink() ||
      !lstatSync(output).isDirectory() ||
      readdirSync(output).length)
  )
    throw new Error("Refusing nonempty, symlink or non-directory output")
  if (statSync(input).size > 1048576) throw new Error("Input exceeds 1 MiB parser bound")
  const envelope: unknown = JSON.parse(readFileSync(input, "utf8"))
  const result = projectBondbuilderForProduction(envelope)
  mkdirSync(output, { recursive: true })
  writeFileSync(
    path.join(output, "research-envelope.json"),
    `${JSON.stringify(envelope, null, 2)}\n`,
    { flag: "wx" },
  )
  writeFileSync(
    path.join(output, "production-projection.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    { flag: "wx" },
  )
  return result.status === "projected" ? 0 : 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = runBondbuilderProductionAdapterCli(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
