-- Persistent rate limiting table for serverless-safe rate limiting.
-- Replaces in-memory Maps that reset on cold starts and are not shared across instances.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key        text        NOT NULL,
  window_id     text        NOT NULL,
  count      integer     NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key, window_id)
);

CREATE INDEX idx_rate_limits_expires_at ON public.rate_limits (expires_at);

-- RLS enabled, no user-facing policies — only the service_role (admin client) accesses this table.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic check-and-increment function.
-- Returns TRUE if the request is allowed, FALSE if rate limit exceeded.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms bigint
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_id     text;
  v_now        timestamptz := now();
  v_expires_at timestamptz;
  v_count      integer;
BEGIN
  v_window_id := to_char(
    to_timestamp(
      floor(extract(epoch from v_now) / (p_window_ms / 1000.0)) * (p_window_ms / 1000.0)
    ),
    'YYYY-MM-DD"T"HH24:MI:SS'
  );
  v_expires_at := to_timestamp(
    (floor(extract(epoch from v_now) / (p_window_ms / 1000.0)) + 1) * (p_window_ms / 1000.0)
  );

  INSERT INTO public.rate_limits (key, window_id, count, expires_at)
  VALUES (p_key, v_window_id, 1, v_expires_at)
  ON CONFLICT (key, window_id) DO UPDATE
    SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- Cleanup function for expired window_ids. Run periodically via pg_cron or manually.
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
