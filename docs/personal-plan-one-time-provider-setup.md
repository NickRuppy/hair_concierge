# Einmalkauf persönlicher Haarplan – Provider-Setup

## Zweck und Grenze

Diese Checkliste gilt für den Einmalkauf `personal_plan_once` neben den bestehenden
Mitgliedschaften. Sie ist eine Launch-Abhängigkeit, keine bestätigte Rechts- oder
Provider-Freigabe. Der Einmalkauf ist kein `BillingInterval`, keine Stripe-Subscription und
kein PayPal-Billing-Plan.

## Voraussetzungen vor Provider-Arbeit

- Das Produkt ist dunkel in Produktion ausgerollt. `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED`
  bleibt aus und verhindert die öffentliche Variantenzuweisung.
- `PERSONAL_PLAN_ONE_TIME_QA_ENABLED` wird nur für den signierten internen QA-Pfad aktiviert;
  ohne gültiges, lead- und sessiongebundenes QA-Token bleibt der Einmalkauf unerreichbar.
- Migrationen, Webhook-Verarbeitung, Entitlement und Analytics sind in der dunklen Produktion
  zunächst ohne Kaufabschluss verifiziert. Danach folgt genau ein ausdrücklich freigegebener
  echter Live-Kauf über den weiterhin nicht öffentlich zugewiesenen QA-Pfad.
- Eine zuständige Person hat die konkrete Live-Provider-Aktion und, vor jeder echten Belastung,
  den einzelnen Testkauf ausdrücklich freigegeben.

## Stripe (nur live, nach dunklem Deployment)

1. Im **Live-Modus** das Product `Persönlicher Haarplan` mit
   `metadata.product_kind=personal_plan_once` anlegen. Dazu einen aktiven einmaligen Price über
   **29,99 EUR**, `tax_behavior=inclusive` und ebenfalls
   `metadata.product_kind=personal_plan_once` anlegen. Keine Test-Mode-Ressource für diesen
   Launchpfad anlegen.
2. Die Live-Price-ID als `STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE` setzen; der Server muss Checkout
   mit `mode=payment` und serverseitig geprüftem Betrag/Währung erzeugen.
3. Den Produktions-Webhook auf die erforderlichen Checkout-/Payment-Events setzen und die
   Signaturprüfung, Idempotenz und Zuordnung von Session/Payment zu `personal_plan_once`
   kontrollieren. Keine Order- oder Payment-ID in `provider_subscription_id` schreiben.
4. Erst nach ausdrücklicher aktionsbezogener Freigabe einen realen Live-Kauf durchführen und
   Capture, Zugriff, Analytics und Rückabwicklungspfad gegen die tatsächlichen Providerdaten
   prüfen. Ohne diese Freigabe keine echte Belastung auslösen.

## PayPal (Orders v2, nur live)

1. Keine PayPal Product-/Plan-Ressource anlegen: der Einmalkauf verwendet **Orders v2**.
2. Den Live-Client, `PAYPAL_MERCHANT_ID` und den Produktions-Webhook konfigurieren. Der Webhook
   benötigt `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED` und
   `PAYMENT.CAPTURE.REVERSED`. Die serverseitige Order enthält eine `DIGITAL_GOODS`-Position,
   EUR-Betrag und `NO_SHIPPING`.
3. Vor Freigabe den Webhook-Signaturpfad, Idempotenz und die Zuordnung von Order/Capture zum
   Einmalkauf prüfen. Keine Order- oder Capture-ID in `provider_subscription_id` schreiben.
4. Einen realen Capture nur nach ausdrücklicher aktionsbezogener Freigabe ausführen und Ergebnis,
   Zugriff sowie Analytics mit den Produktionsdaten abgleichen.

## Freigabe und Rollout

- Stripe-Testmodus und PayPal-Sandbox sind für diesen Launchpfad nicht vorgesehen.
- Nach erfolgreichen, genehmigten Live-Prüfungen kann die öffentliche Zuweisung aktiviert werden;
  vorher bleibt sie aus. Anschließend zuerst die interne QA-Markierung entfernen und nur die zwei
  Experimentsarme auswerten.
- Die Checkout-Einwilligung für den digitalen Leistungsbeginn muss vor Aktivierung im UI gemäß
  dem genehmigten Plan umgesetzt und durch Rechtsprüfung freigegeben sein. Diese Datei ersetzt
  keine Rechtsberatung und sagt keine Erstattung zu.
