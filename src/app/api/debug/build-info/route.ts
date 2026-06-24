import { NextResponse } from "next/server"

import { collectLocalGitInfo } from "@/lib/debug/build-info"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SERVER_STARTED_AT = new Date(Date.now() - process.uptime() * 1000).toISOString()

function isDebugBuildInfoEnabled(): boolean {
  return process.env.NODE_ENV === "development"
}

export async function GET() {
  if (!isDebugBuildInfoEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const git = collectLocalGitInfo()
  return NextResponse.json({
    server_started_at: SERVER_STARTED_AT,
    node_env: process.env.NODE_ENV ?? null,
    cwd: process.cwd(),
    ...git,
  })
}
