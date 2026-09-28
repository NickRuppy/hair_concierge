# Apple Media Services Terms and Conditions (DE) — Research Notes

**Note on method:** Per copyright policy, this file does not reproduce large verbatim blocks of Apple's terms. Each clause below is described in accurate paraphrase (I read the full raw HTML text via curl+regex-strip and cross-checked every claim against it — tagged `[raw-verified]`), with only short verbatim fragments (a few words each, in quotation marks) to pin down exact legal terminology where the precise wording matters for the comparison. If you need the full original sentence for a specific clause, tell me which one and I'll pull just that sentence.

## Source, version, contract partner

- **URL confirmed**: https://www.apple.com/de/legal/internet-services/itunes/de/terms.html (title: "Bedingungen der Apple Mediendienste"). `[raw-verified]`
- **Version date on page**: "Stand: 14. September 2026" (bottom of page, before the footer nav). `[raw-verified]`
- **Standard EULA German-only page** (`https://www.apple.com/de/legal/internet-services/itunes/dev/stdeula/`) → 404 ("Seite nicht gefunden"). There is no separate German standard-EULA page; instead the German terms page embeds an EU-adapted "Endnutzer-Lizenzvertrag für lizenzierte Anwendungen (Standard-EULA)" directly inside Section P (see below). The English-only stdeula page exists but wasn't used since the brief asked for German text. `[raw-verified]`
- **Contract-partner entity ("DEFINITION VON APPLE", Section U)**: depends on the user's home country. For "alle anderen Nutzer:innen" (which includes Germany/EU users not otherwise listed) it is **Apple Distribution International Ltd., Hollyhill Industrial Estate, Hollyhill, Cork, Republic of Ireland**. Other entities (Apple Inc., Apple Canada Inc., Apple Services LATAM LLC, Apple Services Pte. Ltd., iTunes K.K., Apple Pty Limited) apply to US/Canada/LatAm/parts of Asia/Australia-NZ respectively — not Germany. `[raw-verified]`

## a) Seller/contract partner for IAP and third-party apps; developer ↔ customer relationship

Section P ("ZUSÄTZLICHE BEDINGUNGEN FÜR DEN APP STORE") states plainly: **"Apple agiert beim Betrieb des App Store als Vermittler für App-Provider und ist nicht Partei des Kaufvertrags oder der Nutzungsvereinbarung zwischen dir und dem App-Provider."** `[raw-verified]` — i.e., for third-party apps Apple is an intermediary/agent, not a contracting party to the purchase agreement between customer and developer.

However, there's a carve-out specific to German/EU customers: if the customer is a customer of **Apple Distribution International Ltd.** or **Apple Services Pte. Ltd.**, that entity is the "eingetragene Händler" (registered reseller) for content bought via App Store/Apple Books/Apple Podcasts, as shown on the product page. In that case the customer buys the **app license from Apple Distribution International Ltd.**, which itself licenses the app from the App-Provider (developer). Apps licensed by Apple are "Apple Apps"; apps licensed by a developer are "Drittanbieter-Apps" (third-party apps). `[raw-verified]`

Responsibility split: subject to local law, the App-Provider of a third-party app is **"allein verantwortlich"** (solely responsible) for its content, warranties/guarantees, pricing, and any claims relating to the app — **unless** the claim relates directly to Apple Distribution International Ltd.'s role as **"Verkäufer der App-Lizenz"** (seller of the app license). Statutory claims against Apple Distribution International Ltd. in its capacity as seller (including statutory conformity warranty under sales law) remain unaffected. `[raw-verified]`

Same duality applies to In-App Purchases (Section B, general payments clause): "Jede Transaktion ist ein elektronischer Vertrag zwischen dir und Apple und/oder zwischen dir und dem Unternehmen, das die Inhalte über unsere Dienste zur Verfügung stellt." For customers of Apple Distribution International Ltd. / Apple Services Pte. Ltd., that entity is again named as the registered reseller for the content, licensed from the content provider. `[raw-verified]`

Apple is also named a **third-party beneficiary** ("Drittbegünstigter") under the Standard EULA / any custom EULA applicable to a third-party app, entitled to enforce that agreement against the customer. `[raw-verified]`

**Bottom line for the comparison**: Apple's own drafting is deliberately two-layered — Apple describes itself as an "intermediary/agent" for the developer relationship, but simultaneously identifies Apple Distribution International Ltd. as the **legal seller ("Verkäufer"/"eingetragener Händler") of the app license and of in-app content** for EU/German customers, with the developer responsible for the app's own content/quality but not standing as the seller of record for the license or the IAP transaction itself.

## b) Subscriptions — auto-renewal, billing timing, trial conversion, cancellation location

Section I ("ABONNEMENTE"): Subscriptions **auto-renew and are billed periodically until cancelled** ("Abonnements laufen weiter und werden regelmäßig in Rechnung gestellt, bis sie gekündigt werden"). Cancellation is done in **Accounteinstellungen → "Abonnements verwalten"**, effective at the end of the current billing period. `[raw-verified]`

Billing timing: charged **"frühestens vierundzwanzig (24) Stunden vor Beginn des nächsten Abrechnungszeitraums"** (at the earliest 24 hours before the next billing period starts). `[raw-verified]`

Free trial conversion: if a free trial is offered, the payment method is charged once the trial ends unless cancelled at least 24 hours before the trial expires; a trial cancelled early cannot be reactivated. `[raw-verified]`

## c) Cancellation of subscriptions

Two cancellation routes, both described in Section I:
1. **Ordinary**: cancel in account settings ("Abonnements verwalten"), effective end of current billing period — this is the "auto-renewal opt-out."
2. **Immediate + pro-rata refund**: "du hast das Recht, Abonnements jederzeit mit sofortiger Wirkung zu kündigen und eine anteilige Rückerstattung zu erhalten" — contact Apple Support, or write to Apple Distribution International Ltd. at its Cork address, or (for German home country) call **0800 6645 451**. `[raw-verified]`

## d) Refunds / "Problem melden" (reportaproblem)

The word "reportaproblem.apple.com" appears in the terms only in the context of **reporting content that violates Apple's submission guidelines** (user-generated content, Section M), not as the general refund mechanism described on this page — the general refund flow for content the consumer purchased is described via Kundendienst/Apple Support in Section L and the payments clause in Section B, not by name-dropping "reportaproblem" as a URL here. `[raw-verified]`

General refund rule (Section B): if content fails to download, availability is blocked/delayed, or content is defective, the customer's **sole remedy** is either re-delivery of the content (if possible) **or a refund of the price paid**. Apple may suspend/cancel payments or reject a refund request where there are signs of fraud, abuse, illegal, or otherwise manipulative behavior. For subscriptions requiring a minimum commitment of billing periods, a refund on early cancellation covers only the already-paid-but-not-yet-delivered access period — no refund for future unbilled periods. `[raw-verified]`

## e) Widerrufsrecht (14-day right of withdrawal)

- **Against whom**: the sample withdrawal form in the terms is addressed to **"Apple Distribution International Ltd., Apple Support, Hollyhill Industrial Estate, Hollyhill, Cork, Republic of Ireland, rightofwithdrawal@apple.com"** — confirming the withdrawal right is exercised against **Apple Distribution International Ltd.**, not the app developer. `[raw-verified]`
- **Period**: 14 days from receipt of the invoice, no reason required; subscription services can only be withdrawn from after the subscription is first concluded.
- **How**: via Apple Account → "Kaufhistorie" → select order → "Transaktion widerrufen," or via the sample withdrawal form, or any other unambiguous statement, sent before the 14-day period expires.
- **Effect**: refund within 14 days of receiving the notice, using the original payment method, no fee.
- **Exception/waiver**: withdrawal is **not** possible for an order whose delivery began **with the customer's express consent and acknowledgment that they thereby lose their right of withdrawal** ("Ausnahme zum Widerrufsrecht"). `[raw-verified]`

## f) Price changes for subscriptions / consent

Section I: customers are notified by email **at least 30 days in advance** of a price increase. If the customer doesn't agree, they can cancel the subscription for free before the price change takes effect. If the price increase **requires the customer's express consent**, Apple asks for it in the notification email; if the customer does not consent, **the subscription is automatically cancelled on the last day before the price change takes effect**. `[raw-verified]`

Apple-content subscriptions ("Abonnement von Apple") may increase proportionally to objectively verifiable cost increases (content licensing, infrastructure, labor, taxes/levies, FX, regulatory compliance, service changes), netting any offsetting cost decreases. For third-party-app subscriptions, price-increase reasons are set out in the developer's own user agreement, and **Apple disclaims liability for third-party price increases**, merely passing along the notice. `[raw-verified]`

## g) Liability

Section U ("GEWÄHRLEISTUNGSAUSSCHLUSS; HAFTUNGSBESCHRÄNKUNGEN"): Apple provides the services with reasonable care ("angemessene Sorgfalt"). Subject to local law, customers may have a statutory conformity-warranty right for purchased content of **at least 2 years**, and for the duration of the contract term for subscribed content. Apple disclaims liability for interruptions/errors and for security incidents (loss, corruption, attacks, viruses, hacking), treating these as force majeure. A detailed liability carve-out (points (i)-(vi)) excludes Apple's liability for losses/damages absent breach of a legal duty of care, unless the loss was a foreseeable consequence of Apple's breach, subject to statutory refund/damages rights the customer doesn't waive. The clause explicitly does **not** exclude/limit liability for fraud, gross negligence, intentional misconduct, or death/personal injury caused by Apple's negligence (mirrored in the embedded Standard-EULA liability clause, Section P.g(ii)). `[raw-verified]`

## h) Changes to Apple's terms

Section U ("ÄNDERUNGEN DER VEREINBARUNG"): Apple may amend the agreement and add new/additional terms (e.g., for new services/features, legal changes, readability, or updated contact info). Changes are communicated to the customer and become effective immediately upon acceptance. If the customer doesn't accept, they may be unable to make future purchases under the agreement — but **already-purchased/downloaded content and existing Apple subscriptions are unaffected** by declining the change. `[raw-verified]`

## i) Minimum age / family sharing / Apple ID age

Section N ("FAMILIENFREIGABE"): a family "Organisator:in" must be **18+ (or local age of majority)** and a parent/guardian of any family member **under 13** (or local minimum age). Up to **6 family members** can share subscriptions/purchases. "Kaufanfrage" (Ask to Buy) lets the organizer approve purchases by members **under 18**; it's on by default for members under 13 and can't be re-enabled once a member turns 18. Family members using the organizer's payment method act as the organizer's **"Vertreter:innen"** (representatives/agents) for those transactions, and the organizer is liable for them. Rules: one family at a time, join at most twice/year, change linked Apple Account at most every 90 days, all members must share the same home country. `[raw-verified]`

## j) Applicable law, venue

Section U ("GELTENDES RECHT"): default is **California law**, exclusive jurisdiction of Santa Clara County courts — **but** for residents of an EU member state, the UK, Switzerland, Norway, or Iceland, **the law and courts of the customer's habitual residence apply** instead. The UN Convention on Contracts for the International Sale of Goods (CISG) is expressly excluded. Same split applies inside the embedded Standard-EULA (Section P.j), with an added German-specific clause naming **SKW Schwarz Rechtsanwälte, Munich**, as domestic agent for service of process for regulatory/authority notices under the German Medienstaatsvertrag (media state treaty) — explicitly not for civil-law filings. `[raw-verified]`

## k) Dispute resolution / Verbraucherschlichtung

Section U ("Alternative Streitbeilegung"): **"Apple ist nicht verpflichtet, an einem alternativen Streitbeilegungsverfahren teilzunehmen, und sieht auch nicht vor, an einem solchen Verfahren teilzunehmen."** (Apple is not obligated to, and does not intend to, participate in alternative/consumer dispute resolution.) Customers are directed to Apple Support for problems instead. No mention of the EU ODR platform or a specific Verbraucherschlichtungsstelle by name in this section — Apple simply opts out. `[raw-verified]`

## l) From the embedded Standard-EULA (Section P)

The German consumer-terms page embeds an **EU-adapted** version of the Standard EULA (not the developer-facing English template, which lives at a separate, English-only URL and is not localized into German as a standalone page). Coverage of the specific EULA topics requested:

- **Developer responsibility for maintenance/support**: not present as a distinct "Wartung und Support" clause in this embedded EULA (that heading exists in Apple's English developer-facing template but wasn't carried into this German consumer page). The closest equivalent is the Section P responsibility split already described in (a): the App-Provider is solely responsible for the app's content/quality; general App Store transaction support (payment, delivery, refunds) comes from Apple, while content/functionality questions go to the App-Provider (Section L, "KUNDENDIENST"). `nicht geregelt as a standalone maintenance/support clause` `[raw-verified]`
- **Warranty / refund of purchase price by Apple**: covered by the general statutory-warranty language in P.f ("GEWÄHRLEISTUNG") — Licensor (App-Provider or Apple) provides the app with reasonable care; statutory conformity warranty of at least 2 years for purchased apps, contract-term duration for in-app subscriptions; no other promises about uninterrupted/error-free operation. `[raw-verified]`
- **Product claims**: not a separately labeled "Produktansprüche" clause in this German version; substantively covered by the same responsibility-split language in (a) — the App-Provider bears claims about the app's content/warranties/pricing except where the claim concerns Apple Distribution International Ltd.'s role as seller of the license.
- **Third-party beneficiary**: explicit — **"Apple [ist] ein Drittbegünstigter unter der für die jeweilige Drittanbieter-App geltenden Standard-EULA oder individuellen EULA... und kann daher einen solchen Vertrag durchsetzen."** `[raw-verified]`
- **US export/embargo clause**: present, EULA Section P.h — customer represents they are not located in a US-embargoed country and not on the US Treasury's Specially Designated Nationals list or Commerce Department's Denied Persons/Entity Lists, and won't use the app for prohibited purposes (e.g., WMD development). `[raw-verified]`

---

## Summary for Nick

1. **Widerrufsrecht (IAP, 14 days)** is exercised **against Apple Distribution International Ltd.** (Cork, Ireland) — the sample withdrawal form in Apple's own German terms is addressed to that entity, not the app developer.
2. **Seller/contract partner for IAP subscriptions**: Apple's drafting is two-layered. Apple calls itself an "intermediary/agent" ("Vermittler") for the developer relationship generally, but for German/EU customers it explicitly names **Apple Distribution International Ltd. as the "eingetragener Händler"/"Verkäufer der App-Lizenz"** (registered reseller / seller of the app license and IAP content) — so for the purposes most relevant to your comparison (who is legally the seller a German consumer transacts with), **Apple positions itself (via ADI Ltd.) as the seller**, while the developer remains responsible only for the app's own content, quality, and pricing.
3. Cancellation is self-service in account settings (ends of period) or immediate with pro-rata refund via Apple Support/Cork address/German phone number — never through the developer.
4. Price increases need 30 days' notice; some require explicit consumer consent, with automatic free cancellation as the fallback if the consumer doesn't consent.
5. Apple explicitly refuses to participate in alternative/consumer dispute resolution (Verbraucherschlichtung), and for EU/German residents applicable law and venue defer to the consumer's habitual residence rather than California — a notable carve-out worth checking against your own app's terms.

Full raw text saved locally at `/tmp/apple_terms.txt` (fetched via curl, HTML-stripped) if you want me to pull an exact sentence verbatim for any specific clause — happy to do that within the copyright-safe one-sentence-at-a-time boundary.
