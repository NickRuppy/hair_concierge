import {
  isStage1ProductExamplePreviewResponse,
  stage1ProductExamplePreviewRequestUrl,
} from "./product-preview-contract"

export type Stage1ProductPreviewWarmupResult =
  | { status: "warmed"; imageUrls: string[] }
  | { status: "unavailable"; imageUrls: [] }

type WarmupResponse = {
  ok: boolean
  json: () => Promise<unknown>
}

export type Stage1ProductPreviewWarmupDependencies = {
  fetcher?: (url: string, init: RequestInit) => Promise<WarmupResponse>
  warmImage?: (url: string) => void
}

type Stage1PreviewIdentity = {
  personalPlanId: string
  sourceInputHash: string
}

export function shouldStartStage1ProductPreviewWarmup(
  readinessStatus: string,
  alreadyStarted: boolean,
): boolean {
  return readinessStatus === "ready" && !alreadyStarted
}

export async function warmStage1ProductExampleImages(
  dependencies: Stage1ProductPreviewWarmupDependencies = {},
): Promise<Stage1ProductPreviewWarmupResult> {
  const fetcher = dependencies.fetcher ?? globalThis.fetch
  const warmImage = dependencies.warmImage ?? warmBrowserImage

  try {
    const planResponse = await fetcher("/api/personal-plan/stage-1", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!planResponse.ok) return unavailable()
    const identity = readStage1PreviewIdentity(await planResponse.json())
    if (!identity) return unavailable()

    const previewResponse = await fetcher(stage1ProductExamplePreviewRequestUrl(identity), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "default",
    })
    if (!previewResponse.ok) return unavailable()
    const body = await previewResponse.json()
    if (
      !isStage1ProductExamplePreviewResponse(body) ||
      body.personalPlanId !== identity.personalPlanId ||
      body.sourceInputHash !== identity.sourceInputHash
    ) {
      return unavailable()
    }

    const imageUrls = [
      ...new Set(
        body.previews
          .filter((preview) => preview.kind === "recommendation")
          .map((preview) => preview.imageUrl),
      ),
    ].filter((imageUrl) => imageUrl.trim().length > 0)
    const warmedImageUrls: string[] = []
    for (const imageUrl of imageUrls) {
      try {
        warmImage(imageUrl)
        warmedImageUrls.push(imageUrl)
      } catch {
        // One presentation-only image must not prevent the remaining previews from warming.
      }
    }
    return { status: "warmed", imageUrls: warmedImageUrls }
  } catch {
    return unavailable()
  }
}

function readStage1PreviewIdentity(value: unknown): Stage1PreviewIdentity | null {
  if (!value || typeof value !== "object") return null
  const body = value as {
    status?: unknown
    personalPlanId?: unknown
    outputSnapshot?: { inputHash?: unknown }
  }
  if (
    body.status !== "completed" ||
    typeof body.personalPlanId !== "string" ||
    !body.personalPlanId ||
    !body.outputSnapshot ||
    typeof body.outputSnapshot.inputHash !== "string" ||
    !body.outputSnapshot.inputHash
  ) {
    return null
  }
  return {
    personalPlanId: body.personalPlanId,
    sourceInputHash: body.outputSnapshot.inputHash,
  }
}

function warmBrowserImage(imageUrl: string): void {
  if (typeof window === "undefined") return
  const image = new window.Image()
  image.src = imageUrl
}

function unavailable(): Stage1ProductPreviewWarmupResult {
  return { status: "unavailable", imageUrls: [] }
}
