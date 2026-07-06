import { NextResponse } from "next/server"

import { assertLocalServiceRoute } from "../../../_lib/service-client"

type PublishParams = {
  params: Promise<{ submissionId: string }>
}

export async function POST(request: Request, { params }: PublishParams) {
  const { submissionId } = await params

  try {
    assertLocalServiceRoute(request)

    return NextResponse.json(
      {
        ok: false,
        submissionId,
        error:
          "Finaler Supabase-Handoff ist im Review Center gesperrt. Nutze den expliziten approve-package CLI-Handoff fuer genau dieses Produkt.",
        command:
          "npm run products:intake:approve-package -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id> --reviewed-by nick --apply --confirm",
      },
      { status: 409 },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Publish konnte nicht gestartet werden."

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    )
  }
}
