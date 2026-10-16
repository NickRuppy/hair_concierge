import { notFound } from "next/navigation"
import AdminLayout from "@/app/admin/layout"
import {
  ProductReviewDetailView,
  ProductReviewQueue,
  ProductReviewUnavailable,
} from "@/components/product-intake/admin-review"
import {
  PRODUCT_REVIEW_GROUPS,
  type ProductReviewGroup,
  type ProductReviewQueueEntry,
} from "@/lib/product-intake/admin-review-model"
import type { ProductReviewDetail } from "@/lib/product-intake/admin-review-repository"

const basePath = "/labs/produkt-intake"
const timestamp = "2026-10-15T10:00:00Z"
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
]

function fixtures(): ProductReviewQueueEntry[] {
  return [
    {
      id: ids[0]!,
      brand_text: "CARE",
      product_name_text: "Conditioner · Beispieldaten",
      category: "conditioner",
      group: "ready" as const,
    },
    {
      id: ids[1]!,
      brand_text: "Botanical",
      product_name_text: "Hair Mask · Beispieldaten",
      category: "mask",
      group: "decisions" as const,
    },
    {
      id: ids[2]!,
      brand_text: "Daily",
      product_name_text: "Shampoo · Beispieldaten",
      category: "shampoo",
      group: "errors" as const,
    },
  ].map((item, index) => ({
    ...item,
    status: index === 0 ? "ready_for_review" : "researching",
    created_at: timestamp,
    updated_at: timestamp,
    job: {
      id: item.id,
      submission_id: item.id,
      status: index === 0 ? "waiting_for_review" : index === 1 ? "blocked" : "failed",
      stage: "preview_build",
      priority: 0,
      attempt_count: 1,
      max_attempts: 3,
      locked_by: null,
      locked_at: null,
      started_at: null,
      completed_at: null,
      next_run_at: timestamp,
      last_error:
        index === 1
          ? "Die Marke ist noch nicht eindeutig."
          : index === 2
            ? "Die Recherche wurde nach dem Zeitlimit beendet."
            : null,
      progress: {},
      created_at: timestamp,
      updated_at: timestamp,
    },
  }))
}

export default async function ProductIntakeLab({
  searchParams,
}: {
  searchParams: Promise<{
    gruppe?: string
    detail?: string
    fehler?: string
    leer?: string
    bilder?: string
  }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const query = await searchParams
  const entries = query.leer ? [] : fixtures()
  const entry = entries.find((item) => item.id === query.detail)
  const group: ProductReviewGroup = PRODUCT_REVIEW_GROUPS.includes(
    query.gruppe as ProductReviewGroup,
  )
    ? (query.gruppe as ProductReviewGroup)
    : "ready"
  const detail: ProductReviewDetail | null = entry
    ? {
        submission: {
          ...entry,
          payload_revision: 3,
          payload_sha256: "a".repeat(64),
          researched_payload: {
            engine: { id: "conditioner-standard", methodology: "v1.6", adapter: "v1" },
            final: {
              product: {
                canonical_brand: "CARE",
                clean_name: "Conditioner",
                price_eur: 4.95,
                net_content_label: "300 ml",
                suitable_thicknesses: ["fine", "normal", "coarse"],
              },
              category_specs: {
                product_conditioner_rerank_specs: {
                  weight: "medium",
                  repair_level: "low",
                  balance_direction: "moisture",
                },
              },
              field_rationales: {
                "category_specs.product_conditioner_rerank_specs.weight":
                  "Nur Beispieldaten zur Darstellung der Prüfung.",
              },
            },
            draft: {
              protocol: {
                instructions:
                  "Nach dem Shampoo in die feuchten Längen geben, 2 Minuten einwirken lassen und gründlich ausspülen. Beispieldaten.",
              },
            },
          },
        },
        job: entry.job
          ? { ...entry.job, review_cycle_id: "77777777-7777-4777-8777-777777777777" }
          : null,
        publication_review: {
          submission_id: entry.id,
          payload_revision: 3,
          payload_sha256: "a".repeat(64),
          job_id: entry.job?.id ?? null,
          review_cycle_id: "77777777-7777-4777-8777-777777777777",
          data_decision_id: null,
          image_decision_id: null,
          approved_asset_sha256: "a".repeat(64),
          ok: false,
          blockers: ["data_approval_missing", "image_approval_missing"],
          no_image: false,
          can_approve_no_image: false,
          publication: null,
          legacy_package: false,
          proposed_final: null,
          validation_blockers: [],
        },
        images:
          query.bilder === "missing"
            ? []
            : (["raw", "magenta", "final"] as const).map((kind) => ({
                id: `example-${kind}`,
                kind,
                sha256: "a".repeat(64),
                signed_url:
                  query.bilder === "abgelaufen" && kind === "raw"
                    ? "/labs/produkt-intake/expired-image.png"
                    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220" viewBox="0 0 180 220"><rect width="180" height="220" fill="${kind === "magenta" ? "#ff00ff" : kind === "raw" ? "#ececec" : "#f6f4ef"}"/><rect x="58" y="27" width="64" height="160" rx="12" fill="#e7ddc8"/><rect x="62" y="28" width="56" height="17" rx="4" fill="#4a463b"/><rect x="64" y="74" width="52" height="61" fill="#faf8f2"/><text x="90" y="95" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#38352c">CARE</text><text x="90" y="113" text-anchor="middle" font-size="6" font-family="sans-serif" fill="#38352c">BEISPIEL</text></svg>`)}`,
              })),
        decisions: [],
        artifacts: [
          {
            id: "example-source",
            submission_id: entry.id,
            job_id: entry.job?.id ?? null,
            kind: "source_page",
            status: "proposed",
            payload: {},
            confidence: null,
            source_urls: ["https://example.com/hersteller"],
            model: null,
            prompt_version: null,
            created_at: timestamp,
          },
        ],
      }
    : null
  return (
    <AdminLayout>
      <p className="mx-auto mb-6 max-w-6xl rounded-lg bg-primary/10 p-3 text-sm text-primary">
        Lokale Vorschau mit erfundenen Recherchepaketen. Alle Aktionen bleiben in dieser Vorschau;
        Katalog und Kunden werden nicht verändert.
      </p>
      {query.fehler ? (
        <ProductReviewUnavailable href={basePath} />
      ) : detail ? (
        <ProductReviewDetailView detail={detail} queuePath={basePath} />
      ) : (
        <ProductReviewQueue entries={entries} group={group} basePath={basePath} />
      )}
    </AdminLayout>
  )
}
