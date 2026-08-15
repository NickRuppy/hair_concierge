# Idealplan image preload after payment

## Outcome

Start loading every source-authoritative Basis and Optional Idealplan preview image on the existing `/plan-bereit` transition as soon as readiness becomes `ready`, so `/plan-start` can render the images from a warm browser cache.

## Planning evidence and journey sign-off

- Nick supplied a current desktop capture of the Basis Idealplan with example images and explicitly requested preloading "already in the transition screen before" or "as early as possible post payment" on 2026-08-15.
- This is a loading-performance change only. The transition screen, Idealplan layout, German copy, CTA, navigation timing, and recommendation authority remain unchanged, so no new visual mockup is required.
- The requested journey is explicit: successful payment/authentication -> existing `/plan-bereit` readiness flow -> non-blocking preview/image warmup once the plan is ready -> unchanged `Idealplan ansehen` action -> Basis and Optional screens use the warmed assets.

## Scope and design

1. Add a small client-side warmup helper at the Personal Plan preview boundary.
   - Load the existing `/api/personal-plan/stage-1` representation to obtain the exact `personalPlanId` and `sourceInputHash`.
   - Accept the extra uncached Stage-1 read as the smallest self-contained way to start plan preparation before navigation; do not expand `/plan-bereit` server props.
   - Request the existing source-keyed Stage-1 preview URL with the same authenticated `fetch` shape as the `/plan-start` client (`Accept: application/json`, `cache: "default"`). Do not use an anonymous `<link as="fetch">`, which would not share the credentialed request shape.
   - Validate the preview response with the existing contract and require its source keys to match the Stage-1 plan.
   - Start an `Image` request for every unique non-empty preview URL, covering both Basis and Optional categories without re-deriving category membership.
2. Trigger that helper from `/plan-bereit` whenever readiness first becomes `ready`, including server-ready and poll/link-to-ready paths.
   - Declare the effect before the ready-state early return and guard it with a ref so it fires once per mounted transition.
3. Keep the warmup presentation-only and fail open: it must not block readiness, CTA activation, navigation, or error recovery, and it must not run for pending/forbidden/error states.
   - A `ready` readiness envelope can still precede Stage-1 availability; a 404/409 is therefore an expected no-op, not a transition error.
4. Preserve the current `/plan-start` warmup and rendering path as the fallback for direct entry, cache expiry, and preload failure.

## Verification

- Add an injection seam for the helper's fetch and image-warm operations. Test first that it requests Stage 1, then the exact source-keyed preview URL with the production request shape, then warms all unique Basis/Optional image URLs.
- Cover source mismatch, invalid responses, failed requests, duplicate/empty URLs, and non-ready states without user-visible failure or navigation impact.
- Run the new helper regression plus the existing Personal Plan ready/start tests, TypeScript checking, and lint for touched files.
- If the development Personal Plan harness can expose the authenticated transition without production writes, verify network order: preview request and image requests begin on `/plan-bereit` before the user activates `Idealplan ansehen`.

The primary acceptance signal is that the raw Supabase image URLs are warm before navigation. Reuse of the small preview JSON response is opportunistic because its private cache entry may legitimately revalidate after 60 seconds.

## Non-goals and stop boundary

- No image selection, recommendation, catalog, persistence, readiness, payment, transition animation, copy, analytics, or release-flag changes.
- No database migrations or production writes.
- Stop at a verified local branch. Commit, push, PR, merge, deploy, and cleanup require separate authorization.
