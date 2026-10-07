# Live Stripe nonpersistent invoice previews — 14 September 2026

Owner authorized continuation of the approved implementation. Parent used only the documented nonpersistent `POST /v1/invoices/create_preview` and read operations on live Haarmony, LLC, `acct_1TH0lOGiGHTGZcKB`. No approval, charge, subscription or payable invoice was created. This is narrower than T0 execution proof.

Common request: EUR, `subscription_details.items=[{price: "price_1TNw7QGiGHTGZcKBv8jPk1MJ", quantity: 1}]`, `subscription_details.billing_mode.type="flexible"`, `discounts=[{coupon: "8KSV9CZz"}]`. No real customer/account identity or payment method was supplied.

| Independent preview | Additional request | Observed total / amount due | Evidence ID |
| --- | --- | --- | --- |
| First paid annual invoice | Default `next` preview, no trial field | 6999 cents; 9999-cent price less 3000-cent discount | `upcoming_in_1UFVliGiGHTGZcKB5RV0kQRf` |
| Free trial | `subscription_details.trial_end` set to request-time plus 604800 seconds | 0 cents; free trial line, discount applied amount 0 | `upcoming_in_1UFVm1GiGHTGZcKBaT3hJadc` |
| Recurring annual estimate | `preview_mode="recurring"` with the same once coupon supplied | 9999 cents; no discount amounts | `upcoming_in_1UFVmBGiGHTGZcKBn4rkjJTg` |

All responses report live mode and EUR. Automatic tax was false in these hypothetical requests; no tax configuration changed, no registration or exemption was asserted, and this does not prove automatic-tax behavior for a real buyer. The previously verified Price has inclusive tax behavior. These requests prove the catalog/coupon's modeled gross amounts under the supplied settings, not tax liability.

The free-trial response contains a virtual subscription ID, `sub_1UFVm1GiGHTGZcKBPKozk383`. A subsequent GET for that exact subscription returned **No such subscription**, consistent with the documented nonpersistent preview. The preview API spec used by the connector is `2026-08-26.preview`; the application SDK remains pinned to `2026-04-22.dahlia`.

These are three independent hypothetical previews, not a sequential invoice lineage. They do **not** establish once-coupon survival through an actual zero invoice, mandatory card authorization, seven full days measured from actual Checkout completion, cancellation, delayed first-payment recovery, or a renewal collection. The one-second transport difference between the supplied future timestamp and Stripe's preview start is not the application's `trial_period_days` authorization clock. PayPal's approval/start-time mechanism still needs controlled execution evidence.

Primary contract: [Stripe invoice preview API](https://docs.stripe.com/api/invoices/create_preview). Stripe documents that previews are not created invoices and cannot be paid or edited.
