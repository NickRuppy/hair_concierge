# Pre-release scan/dm latency evidence — 2026-09-17

Read-only local tests on branch `codex/scan-dm-enrichment`, before deployment or the telemetry
migration. No product submissions, catalog writes, or production flag changes occurred. The
resolver was invoked directly with the dm flag injected on and a 1500 ms per-operation deadline.
Ten different GTINs were run sequentially, mirroring separate scans rather than one batch.

| Product (dm page) | GTIN | dm outcome | dm operation |
| --- | --- | --- | ---: |
| [Weleda Shampoo Rosmarin Revitalising](https://www.dm.de/p/d/2973187/weleda-shampoo-rosmarin-revitalising) | 4001638530378 | hit | 670 ms |
| [Balea Conditioner Intensivpflege](https://www.dm.de/p/d/1703704/balea-conditioner-intensivpflege) | 4066447982794 | hit | 397 ms |
| [hair biology Haarkur Anti-Frizz](https://www.dm.de/p/d/1585347/hair-biology-haarkur-anti-frizz-und-illuminate-maske) | 8001841228488 | not_found | 349 ms |
| [GUHL Sprüh-Conditioner Intensiv Reparatur](https://www.dm.de/p/d/1722197/guhl-sprueh-conditioner-intensiv-reparatur-5in1) | 4072600710135 | not_found | 313 ms |
| [Balea PROFESSIONAL Haaröl Oil Repair Intensiv](https://www.dm.de/p/d/1700841/balea-professional-haaroel-oil-repair-intensiv) | 4066447888195 | hit | 372 ms |
| [Balea Hitzeschutzspray](https://www.dm.de/p/d/1460813/balea-hitzeschutzspray) | 4070765073546 | hit | 307 ms |
| [Balea Trockenshampoo 6in1](https://www.dm.de/p/d/1493901/balea-trockenshampoo-6in1) | 4066447989397 | hit | 290 ms |
| [alverde Haarserum Kopfhaut Balance](https://www.dm.de/p/d/2972156/alverde-naturkosmetik-haarserum-kopfhaut-balance) | 4066447919424 | hit | 288 ms |
| [OGX Conditioner Rescue Fusions](https://www.dm.de/p/d/3146845/ogx-conditioner-rescue-fusions) | 3574661829036 | hit | 400 ms |
| [Balea Sprühpflege Feuchtigkeit 5in1](https://www.dm.de/p/d/3125096/balea-spruehpflege-feuchtigkeit-5in1) | 4070765001624 | hit | 329 ms |

Sequential wall time: 3715 ms. Per-product wall time: 288–670 ms, median 339 ms; no 1500 ms
timeouts. The original search result for Balea Trockenshampoo supplied an older GTIN; the
table uses the current page GTIN, which the resolver found. The two remaining misses were
repeated: dm `getProductDetails` returned `found=false` by both GTIN and DAN, while their
public pages remained accessible but listed the products as unavailable. This is a provider
coverage discrepancy, not evidence that the products do not exist or that availability is
the proven cause.

The scan decision path was also run directly with real read-only production catalog and
open-submission checks, real dm calls, and response construction. Auth, rate limiting,
HTTP/network travel, browser decoding/rendering, and deferred telemetry were replaced or
excluded to avoid production writes before the migration. Results: 500 ms (Balea conditioner,
dm 302 ms), 580 ms (hair biology not_found, dm 318 ms), and 1005/642 ms (Weleda runs,
dm 635/322 ms). These are **not** complete user-visible scan-to-sheet measurements.

Production cap selection remains open to the planned QA smoke and monitored public trial.
Measure actual barcode-to-sheet, confirmation-to-pending, resolve/submit lookup outcomes,
and timeout share after migration-first deployment and activation. A single ten-product
sample cannot establish p95 or an optimal deadline.
