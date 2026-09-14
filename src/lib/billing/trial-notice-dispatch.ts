import "server-only"
import { dispatchTrialRequiredNotices } from "./trial-required-notices-delivery"

/** Provider/account writes have committed already; notice delivery cannot roll them back. */
export function deferRequiredTrialNotices(defer: (work: () => Promise<void>) => void) {
  if (process.env.TRIAL_IDENTITY_PROCESSING_APPROVED !== "true") return
  defer(async () => {
    try {
      const result = await dispatchTrialRequiredNotices()
      if (result.blocked || result.supportRequired)
        console.error("[trial:notices] dispatch needs attention", result)
    } catch {
      console.error("[trial:notices] dispatch unavailable; durable queue retained")
    }
  })
}
