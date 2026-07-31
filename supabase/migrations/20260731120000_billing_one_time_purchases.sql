CREATE TABLE public.billing_one_time_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  product_kind text NOT NULL CHECK (product_kind = 'personal_plan_once'),
  provider_transaction_id text NOT NULL,
  provider_customer_id text,
  provider_order_id text,
  amount_minor integer NOT NULL CHECK (amount_minor = 2999),
  currency text NOT NULL CHECK (currency = 'eur'),
  refunded_amount_minor integer NOT NULL DEFAULT 0 CHECK (
    refunded_amount_minor >= 0 AND refunded_amount_minor <= amount_minor
  ),
  status text NOT NULL CHECK (status IN ('paid', 'refunded', 'reversed', 'disputed')),
  paid_at timestamptz NOT NULL,
  refunded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id)
);

CREATE UNIQUE INDEX billing_one_time_purchases_one_paid_per_user_product
  ON public.billing_one_time_purchases (user_id, product_kind)
  WHERE status = 'paid';

CREATE INDEX billing_one_time_purchases_user_product_status_idx
  ON public.billing_one_time_purchases (user_id, product_kind, status);

CREATE INDEX billing_one_time_purchases_provider_order_idx
  ON public.billing_one_time_purchases (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

ALTER TABLE public.billing_one_time_purchases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_one_time_purchases FROM anon, authenticated;
GRANT SELECT ON TABLE public.billing_one_time_purchases TO authenticated;
GRANT ALL ON TABLE public.billing_one_time_purchases TO service_role;

CREATE POLICY billing_one_time_purchases_select_own
  ON public.billing_one_time_purchases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_updated_at_billing_one_time_purchases
  BEFORE UPDATE ON public.billing_one_time_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.billing_one_time_purchases IS
  'Durable one-time €29.99 personal-plan provider transactions and entitlement state.';
