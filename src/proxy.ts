import { updateSession } from "@/lib/supabase/middleware"
import { type NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === "www.chaarlie.de") {
    const url = request.nextUrl.clone()
    url.hostname = "chaarlie.de"
    return NextResponse.redirect(url, 308)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)",
  ],
}
