import {
  assertB1BatchSelection,
  preflightB1,
  verifyB1Relations,
} from "@/lib/product-intake/catalog-enrichment/b1"
import { b1ClientAdapters } from "./b1-client"

async function main() {
  assertB1BatchSelection(process.argv.slice(2))
  const adapters = b1ClientAdapters()
  const preflight = await preflightB1({ read: adapters.read, mode: "post_apply" })
  if (!preflight.ok || !preflight.package)
    throw new Error(`B1 verifier preflight blocked: ${preflight.blockers.join("; ")}`)
  const result = await verifyB1Relations(adapters.read, preflight.package)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
void main()
