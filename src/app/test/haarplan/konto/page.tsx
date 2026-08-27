import type { Metadata } from "next"

import { createModeratorAccountPage } from "./moderator-account-page"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default createModeratorAccountPage()
