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
  searchParams: Promise<{ gruppe?: string; detail?: string; fehler?: string; leer?: string }>
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
        job: entry.job,
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
        Lokale Vorschau mit erfundenen Recherchepaketen. Hier werden keine Produkte freigegeben.
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
