-- Task 1.8 (Banner-Lifecycle-Persistenz): a single small table backing two
-- unrelated but identically-shaped pieces of UI state that both replace
-- ad-hoc/legacy rules with server-side per-user persistence:
--
--   1. module_banner_dismissed — the Routine refinement banner's dismissal,
--      keyed per user+module (`products`|`habits`, see Stage2Module in
--      src/lib/personal-plan/refinement/types.ts). Replaces today's 24h
--      `nudge_dismissed_until` timestamp (migration 20260817090000): the ✕
--      now hides the banner for that module indefinitely, and it reappears
--      exactly once when a DIFFERENT module becomes the next open one —
--      because that module has no dismissal row yet. No extra "already
--      reappeared" bit is needed: per-module dismissal rows alone give the
--      dismiss-until-next-different-module-then-once-more semantics (PR 2
--      Task 2.3 reads this by comparing the current open module against the
--      dismissed set).
--   2. nav_surface_visited — the nav-dot "never visited this tab" state
--      (PR 2 Task 2.9), keyed per user+nav-item-key (`chat`|`routine`|
--      `scan`|`application`|`profile`, see PersonalPlanNavigationItem in
--      src/lib/personal-plan/navigation-access.ts).
--
-- Co-located rather than two tables: both are "did user X ever/most-recently
-- mark Y" facts with the same (user, discriminator, subject, timestamp)
-- shape, the same owner-only access pattern, and the same graceful-
-- degradation contract below. Splitting them would just duplicate this file.
--
-- Deploy-order note (mirrors src/lib/personal-plan/routine/repository.ts:72-108):
-- this is a NEW TABLE, so any pre-migration deploy sees `42P01 undefined_table`
-- (or the RPC/policy simply not existing yet) on every read and write. The
-- repository functions in src/lib/personal-plan/lifecycle/repository.ts
-- degrade every read to "no marks" (banner visible, nav dot shown) on ANY
-- error and swallow write errors the same way, so deploy order between this
-- migration and the code that calls it is non-load-bearing in either
-- direction — the worst case pre-migration is a banner/nav-dot that doesn't
-- remember a dismissal/visit yet.

CREATE TABLE IF NOT EXISTS public.personal_plan_ui_lifecycle_marks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('module_banner_dismissed', 'nav_surface_visited')),
  subject text NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, subject)
);

-- No separate index: reads always filter by (user_id, kind), the PK's
-- leading columns, so the PK index already serves them.

ALTER TABLE public.personal_plan_ui_lifecycle_marks ENABLE ROW LEVEL SECURITY;

-- Grants mirror public.scan_resolve_events (migration 20260821120000):
-- service_role only. The Routine page and nav render server-side on the
-- admin client (see src/app/routine/page.tsx), so there is no owner-facing
-- client read/write path to defend-in-depth for today.
REVOKE ALL ON TABLE public.personal_plan_ui_lifecycle_marks FROM anon, authenticated;
GRANT ALL ON TABLE public.personal_plan_ui_lifecycle_marks TO service_role;

DROP POLICY IF EXISTS personal_plan_ui_lifecycle_marks_service_role_all
  ON public.personal_plan_ui_lifecycle_marks;
CREATE POLICY personal_plan_ui_lifecycle_marks_service_role_all
  ON public.personal_plan_ui_lifecycle_marks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
