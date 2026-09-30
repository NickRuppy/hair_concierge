-- Service-only native registration metadata. No quiz, OTP or provider credentials.
CREATE TABLE public.mobile_registration_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  email text NOT NULL CHECK(email=lower(trim(email)) AND length(email)<=254),
  flow text NOT NULL DEFAULT 'registration' CHECK(flow IN ('registration','login')),
  send_generation uuid NOT NULL DEFAULT gen_random_uuid(),
  code_digest text CHECK(code_digest ~ '^[a-f0-9]{64}$'),
  code_key_id text,
  provider_user_id uuid,
  verified_user_id uuid,
  verification_count integer NOT NULL DEFAULT 0 CHECK(verification_count BETWEEN 0 AND 8),
  claim_id uuid,
  claim_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
  verified_at timestamptz,
  completed_at timestamptz,
  completion_receipt jsonb,
  superseded_at timestamptz,
  CHECK((verified_user_id IS NULL)=(verified_at IS NULL))
);
CREATE INDEX mobile_registration_intents_email_idx ON public.mobile_registration_intents(email);
CREATE INDEX mobile_registration_intents_expiry_idx ON public.mobile_registration_intents(expires_at) WHERE verified_at IS NULL;
CREATE TABLE public.mobile_registration_enrollments (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK(email=lower(trim(email)) AND length(email)<=254),
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz
);
ALTER TABLE public.mobile_registration_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_registration_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_registration_intents,public.mobile_registration_enrollments FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mobile_registration_intents,public.mobile_registration_enrollments TO service_role;

CREATE FUNCTION public.mobile_registration_start(p_request_id uuid,p_request_hash text,p_email text,p_flow text DEFAULT 'registration') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.mobile_registration_intents;
BEGIN
  IF p_email<>lower(trim(p_email)) OR length(p_email)>254 OR p_request_hash !~ '^[a-f0-9]{64}$' OR p_flow NOT IN ('registration','login') THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mobile-registration:'||p_email,0));
  -- Expired unverified metadata only; never Auth users or completed provenance.
  WITH expired AS (SELECT id FROM public.mobile_registration_intents WHERE expires_at<=now() AND verified_at IS NULL ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)
  DELETE FROM public.mobile_registration_intents i USING expired WHERE i.id=expired.id;
  SELECT * INTO v FROM public.mobile_registration_intents WHERE request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v.email<>p_email OR v.request_hash<>p_request_hash OR v.flow<>p_flow OR v.completed_at IS NOT NULL THEN
      RETURN jsonb_build_object('status','conflict');
    END IF;
    UPDATE public.mobile_registration_intents SET send_generation=gen_random_uuid(), code_digest=NULL,code_key_id=NULL,
      provider_user_id=NULL,verified_user_id=NULL,verified_at=NULL,verification_count=0,claim_id=NULL,claim_expires_at=NULL,
      superseded_at=NULL,expires_at=now()+interval '1 hour'
      WHERE id=v.id RETURNING * INTO v;
  ELSE
    INSERT INTO public.mobile_registration_intents(request_id,request_hash,email,flow) VALUES(p_request_id,p_request_hash,p_email,p_flow) RETURNING * INTO v;
  END IF;
  UPDATE public.mobile_registration_intents SET superseded_at=now(),claim_id=NULL,claim_expires_at=NULL
    WHERE email=p_email AND id<>v.id AND completed_at IS NULL AND superseded_at IS NULL;
  RETURN jsonb_build_object('status','ready','intent',to_jsonb(v));
END $$;

CREATE FUNCTION public.mobile_registration_bind_send(p_attempt_id uuid,p_send_generation uuid,p_request_hash text,p_email text,p_provider_user_id uuid,p_code_digest text,p_code_key_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
  UPDATE public.mobile_registration_intents SET provider_user_id=p_provider_user_id,code_digest=p_code_digest,code_key_id=p_code_key_id
    WHERE id=p_attempt_id AND send_generation=p_send_generation AND request_hash=p_request_hash AND email=p_email
      AND expires_at>now() AND superseded_at IS NULL AND verified_at IS NULL
      AND (provider_user_id IS NULL OR (provider_user_id=p_provider_user_id AND code_digest=p_code_digest AND code_key_id=p_code_key_id));
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE FUNCTION public.mobile_registration_claim(p_attempt_id uuid,p_send_generation uuid,p_code_digest text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.mobile_registration_intents;
BEGIN
  SELECT * INTO v FROM public.mobile_registration_intents WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v.send_generation<>p_send_generation OR v.expires_at<=now() OR v.superseded_at IS NOT NULL OR v.verified_at IS NOT NULL OR v.provider_user_id IS NULL OR v.verification_count>=8 OR v.claim_expires_at>now() THEN RETURN NULL; END IF;
  UPDATE public.mobile_registration_intents SET verification_count=verification_count+1 WHERE id=v.id;
  IF p_code_digest IS NOT NULL AND v.code_digest IS DISTINCT FROM p_code_digest THEN RETURN NULL; END IF;
  UPDATE public.mobile_registration_intents SET claim_id=gen_random_uuid(),claim_expires_at=now()+interval '60 seconds' WHERE id=v.id RETURNING * INTO v;
  RETURN to_jsonb(v);
END $$;

CREATE FUNCTION public.mobile_registration_finish(p_attempt_id uuid,p_send_generation uuid,p_claim_id uuid,p_user_id uuid,p_email text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
  UPDATE public.mobile_registration_intents SET verified_user_id=p_user_id,verified_at=now(),claim_id=NULL,claim_expires_at=NULL
    WHERE id=p_attempt_id AND send_generation=p_send_generation AND claim_id=p_claim_id AND claim_expires_at>now()
      AND email=p_email AND provider_user_id=p_user_id AND expires_at>now() AND superseded_at IS NULL AND verified_at IS NULL;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE FUNCTION public.mobile_registration_release(p_attempt_id uuid,p_claim_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
  UPDATE public.mobile_registration_intents SET claim_id=NULL,claim_expires_at=NULL WHERE id=p_attempt_id AND claim_id=p_claim_id;
$$;
REVOKE ALL ON FUNCTION public.mobile_registration_start(uuid,text,text,text),public.mobile_registration_bind_send(uuid,uuid,text,text,uuid,text,text),public.mobile_registration_claim(uuid,uuid,text),public.mobile_registration_finish(uuid,uuid,uuid,uuid,text),public.mobile_registration_release(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_registration_start(uuid,text,text,text),public.mobile_registration_bind_send(uuid,uuid,text,text,uuid,text,text),public.mobile_registration_claim(uuid,uuid,text),public.mobile_registration_finish(uuid,uuid,uuid,uuid,text),public.mobile_registration_release(uuid,uuid) TO service_role;
