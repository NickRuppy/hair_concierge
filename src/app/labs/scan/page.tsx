import { notFound } from "next/navigation"

import { ScanLabClient } from "./scan-lab-client"

/**
 * Dev-only harness for the `/scan` client flow (plan task 11, decision D4).
 *
 * `ScanFlow` is rendered with a fake camera and a fake barcode detector
 * (`ScannerRuntime`), so the whole scanning → resolving → sheet journey — including the
 * camera failure, retry and stall paths — can be driven from a Playwright spec
 * (`tests/scan-flow.spec.ts`) or by hand, on a laptop, without a webcam and without a
 * signed-in account. Everything the API would answer is mocked by the caller
 * (`page.route`), so this page touches no Supabase and no auth.
 *
 * Same guard as every other `/labs` page (`personal-plan-start/page.tsx`): a production
 * build 404s here.
 */
export default function ScanLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <ScanLabClient />
}
