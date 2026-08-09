import { assertB1BatchSelection, preflightB1 } from "@/lib/product-intake/catalog-enrichment/b1"
import { b1ClientAdapters } from "./b1-client"

async function main() {
  assertB1BatchSelection(process.argv.slice(2))
  const result = await preflightB1({ read: b1ClientAdapters().read })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main()
