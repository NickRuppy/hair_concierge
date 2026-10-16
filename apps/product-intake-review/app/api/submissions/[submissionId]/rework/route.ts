import { NextResponse } from "next/server"
import { assertLocalServiceRoute } from "../../../_lib/service-client"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  try {
    assertLocalServiceRoute(request)
    const { submissionId } = await params
    return NextResponse.json(
      {
        ok: false,
        error:
          "Diese Entscheidung braucht die aktuelle Produktversion. Bitte öffne die Produktprüfung in Admin.",
        admin_path: `/admin/produkt-intake/${encodeURIComponent(submissionId)}`,
      },
      { status: 409, headers: { "Cache-Control": "private, no-store" } },
    )
  } catch {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
  }
}
