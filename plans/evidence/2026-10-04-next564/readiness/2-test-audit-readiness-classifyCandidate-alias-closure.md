# `classifyCandidate` compatibility alias — zero-quota closure

## Live closure

`classifyCandidate` is defined only in `scripts/scanner-catalog-coverage/readiness-export.ts:154-168`; exact repository search found exactly two imports/call regions, both in `tests/scanner-catalog-coverage-readiness.test.ts:5,83-135`. No source, package, CLI, dynamic, namespace or re-export consumer remains. The actual baseline uses `classifyProductReadiness` directly at `readiness-export.ts:190-225`, then filters `has_barcode:false` products to candidate output.

The alias is a compatibility projection only: it calls the canonical classifier then forces `has_barcode:false` and returns `blocked` or `ready_for_ean_research`. Both test inputs already set `has_barcode:false`; therefore replacing each call with `classifyProductReadiness` preserves every input, returned status and blocker assertion byte-for-byte. No callback deletion or AST credit.

## Main-only staged diff

```diff
-import { classifyCandidate, classifyProductReadiness, fingerprint, selectActiveSupportedProducts } from "..."
+import { classifyProductReadiness, fingerprint, selectActiveSupportedProducts } from "..."
@@
-const ready = classifyCandidate({
+const ready = classifyProductReadiness({
@@
-const blocked = classifyCandidate({
+const blocked = classifyProductReadiness({
@@
-const result = classifyCandidate({
+const result = classifyProductReadiness({
```

Then remove only `classifyCandidate` at owner lines 153-168. Do not alter input literals, status/blocker expectations, `has_barcode:false`, helpers, or any baseline selection behavior.

## Pins and guards

- owner SHA-256: `1e6074e1e7655477a1286c49f94f4c58b9849ebea7cee86542eb9ed6a72ddc9d`
- test SHA-256: `20af0916fd719f6f482e32bea99b38c9ab4a236fdc408c8039a5265333733be8`
- immediately before any write, repeat exact consumer closure over tracked code/operator roots and reject a non-test consumer; require both hashes, AST test count unchanged, only three callee identifiers/import and alias declaration changed, and TS parse of staged owner/test.
- history: `457c64be` added scanner catalog coverage. Current native owner gate is `node --import ./tests/server-only-register.cjs --import tsx --test tests/scanner-catalog-coverage-readiness.test.ts` (not run).

## Timing / limits

This alias cleanup must wait until the parent releases the overlapping 91-AST readiness source guards and full proof. No runner, edit, source fault, provider/DB operation, or current-source mutation was performed. The evidence is static closure only.
