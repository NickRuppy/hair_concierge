-- Dry-run support audit for PayPal identity cleanup.
-- Do not use this to infer PayPal-E-Mail from profiles.email. Backfill
-- provider_subscriber_email only from PayPal API-confirmed subscriber data.

select
  p.id as user_id,
  p.email as chaarlie_email,
  l.email as linked_lead_email,
  bs.provider_subscription_id,
  bs.provider_subscriber_email as paypal_email,
  p.onboarding_completed,
  au.last_sign_in_at,
  bs.entitlement_status,
  bs.cancel_at_period_end,
  bs.current_period_end,
  case
    when bs.entitlement_status in ('active', 'past_due') then true
    when bs.entitlement_status = 'canceled'
      and bs.cancel_at_period_end = true
      and bs.current_period_end > now()
      then true
    else false
  end as current_access,
  case
    when au.last_sign_in_at is null and coalesce(p.onboarding_completed, false) = false
      then 'Support prüfen: nie aktiviert; ggf. Auth/profiles.email auf Chaarlie-E-Mail korrigieren'
    when bs.provider_subscriber_email is null
      then 'Optional: PayPal API subscriber.email_address prüfen und provider_subscriber_email backfillen'
    else 'Keine automatische Änderung'
end as recommended_action
from billing_subscriptions bs
join profiles p on p.id = bs.user_id
left join lateral (
  select leads.email
  from leads
  where leads.user_id = p.id
     or lower(leads.email) = lower(p.email)
  order by leads.created_at desc
  limit 1
) l on true
left join auth.users au on au.id = p.id
where bs.provider = 'paypal'
order by bs.created_at desc;
