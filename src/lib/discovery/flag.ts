/**
 * Kill switch for the discovery-call toolkit (see
 * plans/discovery-call-toolkit/plan.md). Read directly from process.env on
 * every call so callers on the Edge runtime (middleware) stay Edge-safe:
 * no Node-only APIs, no cached/derived module state. Default off.
 */
export function isDiscoveryCallToolkitEnabled(): boolean {
  return process.env.DISCOVERY_CALL_TOOLKIT_ENABLED === "true"
}
