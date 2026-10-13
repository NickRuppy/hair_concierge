# Deps upgrade campaign — baseline

Base: main 746bf6df (2026-10-09). Node v22.12.0 / npm 10.9.0 locally; CI uses .nvmrc = 22, engines node >=22 <23 → @types/node stays on ^22.

## Verification on untouched tree

| Check | Result |
|---|---|
| npm run ci:verify (typecheck + lint + build) | PASS |
| npm run test:node | 11102 pass / 1 fail / 15 skipped |
| npm run test:personal-plan | 3131 pass / 0 fail / 1 skipped |
| npm run test:agent | 888 pass / 33 fail |

Machine was under heavy external load (load avg 35-90 on 10 cores from other worktrees' builds) during the whole campaign; typecheck ~11 min, build ~25 min.

### Pre-existing red tests (not counted against later steps)

- test:node (1): `retry shares the original budget` (tests/scan-dm-mcp-client.test.ts, expected 2 / actual 1; timing-sensitive).
- test:agent (33): all `selectProducts …` cases in tests/agent-select-products-tool.spec.ts fail with `supabaseUrl is required.` (test env lacks a Supabase URL in this process). Full list:

  - selectProducts applies leave-in thickness overrides and surfaces profile deviation
  - selectProducts includes owned verified non-recommended products for assessment
  - selectProducts narrows product-detail assessment grounding to target product ids
  - selectProducts preserves resolved assessment target when engine returns no products
  - selectProducts applies leave-in texture and density overrides with profile notices
  - selectProducts applies leave-in heat tool overrides to the runtime
  - selectProducts builds a leave-in target for explicit heat requests on otherwise quiet profiles
  - selectProducts builds a leave-in heat target from generic Hitzeschutz wording
  - selectProducts treats separate heat protectant as a leave-in bonus for blow-dry-only requests
  - selectProducts marks exact leave-in heat temperatures unsupported
  - selectProducts recommends conditioner for low-need balanced profile with existing conditioner
  - selectProducts keeps silicone-free unsupported while still recommending conditioner
  - selectProducts keeps silicone-free unsupported while still recommending shampoo
  - selectProducts tool carries unsupported ingredient caveats for leave-in requests
  - selectProducts tool passes request-aware mask runtime into category engine
  - selectProducts asks for oil purpose when a product pick lacks inferred purpose
  - selectProducts carries unsupported ingredient caveats for live oil requests
  - selectProducts still returns explicit oil products while exposing CareBalance decrease-frequency framing
  - selectProducts preserves supplied effective care context in runtime and care balance output
  - selectProducts applies oil thickness overrides to hard-gated oil selection
  - selectProducts applies oil density overrides to density-weight caution
  - selectProducts treats non-greasy fine-hair oil wording as a light finish target
  - selectProducts passes explicit dry-shampoo bridge context into category engine
  - selectProducts redirects message-stated frequent dry-shampoo use instead of recommending more
  - selectProducts treats dry-shampoo routine need questions as guidance-only, not dry-hair hard-nos
  - selectProducts does not treat oily-root product wording as a dry-shampoo bridge
  - selectProducts with a saved 5 € cap lists within-budget products first and flags over-budget ones
  - selectProducts labels the flexible cap and never reorders for an uncapped budget
  - selectProducts output is unchanged without a saved budget, an invalid one, or the flag off
  - selectProducts keeps the user's own product in place and unflagged under a 5 € cap
  - selectProducts hands a capped budget to the engine before its cut, and only a capped one
  - selectProducts passes the capped budget hook to the bondbuilder engine too
  - selectProducts pairs the most trusted affordable Bondbuilder with the most trusted overall under Bis 15 €

## npm audit --omit=dev

critical 1 · high 18 · moderate 36 · low 1 · total 56

| Package | Severity | Direct | Fix |
|---|---|---|---|
| @babel/core | low |  | npm audit fix |
| @customerio/cdp-analytics-browser | high | yes | @customerio/cdp-analytics-browser@0.5.11 (major) |
| @grpc/grpc-js | high |  | npm audit fix |
| @grpc/proto-loader | high |  | npm audit fix |
| @modelcontextprotocol/sdk | high | yes | @modelcontextprotocol/sdk@1.32.1 |
| @opentelemetry/configuration | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/core | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/exporter-logs-otlp-grpc | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/exporter-logs-otlp-http | moderate |  | npm audit fix |
| @opentelemetry/exporter-logs-otlp-proto | moderate |  | npm audit fix |
| @opentelemetry/exporter-metrics-otlp-grpc | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/exporter-metrics-otlp-http | moderate |  | npm audit fix |
| @opentelemetry/exporter-metrics-otlp-proto | moderate |  | npm audit fix |
| @opentelemetry/exporter-prometheus | high |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/exporter-trace-otlp-grpc | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/exporter-trace-otlp-http | moderate |  | npm audit fix |
| @opentelemetry/exporter-trace-otlp-proto | moderate |  | npm audit fix |
| @opentelemetry/exporter-zipkin | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-http | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-knex | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-mongoose | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-mysql | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-mysql2 | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-pg | moderate |  | npm audit fix |
| @opentelemetry/instrumentation-tedious | moderate |  | npm audit fix |
| @opentelemetry/otlp-exporter-base | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/otlp-grpc-exporter-base | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/otlp-transformer | high |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/propagator-b3 | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/propagator-jaeger | high |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/resources | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/sdk-logs | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/sdk-metrics | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/sdk-node | high | yes | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/sdk-trace-base | moderate |  | @opentelemetry/sdk-node@0.223.0 (major) |
| @opentelemetry/sdk-trace-node | moderate |  | npm audit fix |
| @protobufjs/utf8 | moderate |  | npm audit fix |
| @sentry/nextjs | moderate | yes | npm audit fix |
| @sentry/node | moderate | yes | npm audit fix |
| baseline-browser-mapping | moderate |  | npm audit fix |
| brace-expansion | high |  | npm audit fix |
| browserslist | high |  | npm audit fix |
| customerio-gist-web | moderate |  | @customerio/cdp-analytics-browser@0.5.11 (major) |
| dompurify | moderate |  | npm audit fix |
| fast-uri | high |  | npm audit fix |
| fflate | moderate |  | npm audit fix |
| js-cookie | high |  | @customerio/cdp-analytics-browser@0.5.11 (major) |
| nanoid | high |  | npm audit fix |
| next | critical | yes | npm audit fix |
| postcss | high |  | npm audit fix |
| posthog-js | moderate | yes | npm audit fix |
| protobufjs | high |  | @opentelemetry/sdk-node@0.223.0 (major) |
| sharp | high | yes | sharp@0.35.5 (major) |
| source-map-js | high |  | npm audit fix |
| uuid | moderate |  | @customerio/cdp-analytics-browser@0.5.11 (major) |
| ws | high |  | npm audit fix |

## npm outdated

| Package | Current | Wanted | Latest | Workspace |
|---|---|---|---|---|
| @customerio/cdp-analytics-browser | 0.4.16 | 0.4.16 | 0.5.11 | deps-upgrade-campaign |
| @electric-sql/pglite | 0.3.14 | 0.3.16 | 0.5.8 | deps-upgrade-campaign |
| @langfuse/client | 5.2.0 | 5.13.1 | 5.13.1 | deps-upgrade-campaign |
| @langfuse/openai | 5.2.0 | 5.13.1 | 5.13.1 | deps-upgrade-campaign |
| @langfuse/otel | 5.2.0 | 5.13.1 | 5.13.1 | deps-upgrade-campaign |
| @langfuse/tracing | 5.2.0 | 5.13.1 | 5.13.1 | deps-upgrade-campaign |
| @modelcontextprotocol/sdk | 1.30.0 | 1.30.0 | 1.32.1 | deps-upgrade-campaign |
| @opentelemetry/sdk-node | 0.216.0 | 0.216.0 | 0.223.0 | deps-upgrade-campaign |
| @paypal/react-paypal-js | 9.2.0 | 9.3.0 | 10.6.0 | deps-upgrade-campaign |
| @playwright/test | 1.59.1 | 1.64.0 | 1.64.0 | deps-upgrade-campaign |
| @sentry/nextjs | 10.51.0 | 10.76.2 | 11.6.0 | deps-upgrade-campaign |
| @sentry/node | 10.51.0 | 10.76.2 | 11.6.0 | deps-upgrade-campaign |
| @stripe/react-stripe-js | 6.8.0 | 6.12.0 | 7.0.0 | deps-upgrade-campaign |
| @stripe/stripe-js | 9.12.0 | 9.17.0 | 10.0.0 | deps-upgrade-campaign |
| @supabase/ssr | 0.10.2 | 0.10.3 | 0.12.7 | deps-upgrade-campaign |
| @supabase/supabase-js | 2.105.1 | 2.117.3 | 2.117.3 | deps-upgrade-campaign |
| @supabase/supabase-js | 2.105.1 | 2.117.3 | 2.117.3 | product-intake-core |
| @supabase/supabase-js | 2.105.1 | 2.117.3 | 2.117.3 | product-intake-review |
| @tailwindcss/postcss | 4.2.4 | 4.3.3 | 4.3.3 | deps-upgrade-campaign |
| @types/jsdom | 28.0.3 | 28.0.3 | 30.0.0 | deps-upgrade-campaign |
| @types/node | 22.19.19 | 22.20.5 | 26.6.5 | deps-upgrade-campaign |
| @types/node | 22.19.19 | 22.20.5 | 26.6.5 | product-intake-review |
| @types/react | 19.2.14 | 19.3.0 | 19.3.0 | deps-upgrade-campaign |
| @types/react | 19.2.14 | 19.3.0 | 19.3.0 | product-intake-review |
| @types/react-dom | 19.2.3 | 19.3.0 | 19.3.0 | deps-upgrade-campaign |
| @types/react-dom | 19.2.3 | 19.3.0 | 19.3.0 | product-intake-review |
| clawpatch | 0.4.0 | 0.4.0 | 0.8.2 | deps-upgrade-campaign |
| date-fns | 4.1.0 | 4.4.0 | 4.4.0 | deps-upgrade-campaign |
| eslint | 9.39.4 | 9.39.5 | 9.39.5 | deps-upgrade-campaign |
| eslint | 9.39.4 | 9.39.5 | 9.39.5 | product-intake-review |
| eslint-config-next | 16.2.4 | 16.4.0 | 16.4.0 | deps-upgrade-campaign |
| eslint-config-next | 16.2.4 | 16.4.0 | 16.4.0 | product-intake-review |
| lucide-react | 1.14.0 | 1.54.0 | 1.54.0 | deps-upgrade-campaign |
| next | 16.2.4 | 16.4.0 | 16.4.0 | deps-upgrade-campaign |
| next | 16.2.4 | 16.4.0 | 16.4.0 | product-intake-review |
| openai | 6.35.0 | 6.49.0 | 7.31.0 | deps-upgrade-campaign |
| playwright | 1.59.1 | 1.64.0 | 1.64.0 | deps-upgrade-campaign |
| posthog-js | 1.372.6 | 1.438.6 | 1.438.6 | deps-upgrade-campaign |
| prettier | 3.8.3 | 3.9.9 | 3.9.9 | deps-upgrade-campaign |
| react | 19.2.5 | 19.2.5 | 19.3.0 | deps-upgrade-campaign |
| react | 19.2.5 | 19.2.5 | 19.3.0 | product-intake-review |
| react-dom | 19.2.5 | 19.2.5 | 19.3.0 | deps-upgrade-campaign |
| react-dom | 19.2.5 | 19.2.5 | 19.3.0 | product-intake-review |
| sharp | 0.34.5 | 0.34.5 | 0.35.5 | deps-upgrade-campaign |
| start-server-and-test | 2.1.5 | 2.1.5 | 3.0.13 | deps-upgrade-campaign |
| stripe | 22.1.0 | 22.6.2 | 23.0.0 | deps-upgrade-campaign |
| supabase | 2.98.0 | 2.120.0 | 2.120.0 | deps-upgrade-campaign |
| tailwind-merge | 3.5.0 | 3.7.0 | 3.7.0 | deps-upgrade-campaign |
| tailwindcss | 4.2.4 | 4.3.3 | 4.3.3 | deps-upgrade-campaign |
| tsx | 4.21.0 | 4.23.15 | 4.23.15 | deps-upgrade-campaign |
| typescript | 5.9.3 | 5.9.3 | 7.0.2 | deps-upgrade-campaign |
| typescript | 5.9.3 | 5.9.3 | 7.0.2 | product-intake-core |
| typescript | 5.9.3 | 5.9.3 | 7.0.2 | product-intake-review |
| zod | 4.4.3 | 4.6.5 | 4.6.5 | deps-upgrade-campaign |
| zustand | 5.0.12 | 5.0.15 | 5.0.15 | deps-upgrade-campaign |

## Open Dependabot PRs (read-only, not modified)

- #482 (prod group): quality-static fails typecheck — supabase-js 2.11x `RejectExcessProperties` on `.update()/.upsert()` with union payloads (scripts/catalog-additions/prepare-2026-06-27-products.ts, src/lib/stripe/checkout-activation.ts) and stripe-node 22.6 narrowing `apiVersion` to `2026-08-26.dahlia` (src/lib/stripe/client.ts). Next patch applied with a version-mismatch warning only.
- #463 (dev group): typescript 7 breaks the TS compiler API used by tests/landing-client-import-boundary.test.ts and implicit-any inference; @types/node 26 breaks `Timeout` typing (src/components/quiz/result-offer-pricing.tsx); sharp 0.35 drops the `sharp` namespace type.
