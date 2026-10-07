/** Create-only byte inventory; verification and method approval remain separate. */
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(__dirname, "../..")
const runIndex = process.argv.indexOf("--run")
if (runIndex === -1 || !process.argv[runIndex + 1])
  throw new Error("Usage: --run <completed-run-directory>")
const run = path.resolve(ROOT, process.argv[runIndex + 1])
const target = path.join(run, "final-seal.json")
if (existsSync(target)) throw new Error("Refusing existing final seal")
for (const required of [
  "comparison-correction-01.json",
  "adjudication.json",
  "findings.md",
  "assembly-report.json",
  "wire-amendment-01/receipt.json",
  "source-amendment-01/receipt.json",
  "source-amendment-02/receipt.json",
])
  if (!existsSync(path.join(run, required)))
    throw new Error(`Incomplete final inventory: ${required}`)
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in replay: ${file}`)
    return entry.isDirectory() ? files(file) : [path.relative(run, file)]
  })
}
const sha256 = Object.fromEntries(
  files(run)
    .sort()
    .map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(path.join(run, file)))
        .digest("hex"),
    ]),
)
writeFileSync(
  target,
  `${JSON.stringify({ version: "bondbuilder-method-replay-final-seal-v1", purpose: "Frozen regression bytes only; not method lock, publication or activation.", sha256 }, null, 2)}\n`,
  { flag: "wx" },
)
console.log(
  JSON.stringify({ files: Object.keys(sha256).length, seal: path.relative(ROOT, target) }),
)
