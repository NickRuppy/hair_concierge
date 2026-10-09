# Styling calibration, round 2: shared lane brief

Round 2 does three things:
- freezes authoritative claims for the round-1 products;
- fills the subtypes that are still thin;
- runs the formal Leave-in G0 check on the borderline products.

**Owner rulings** are in `plans/styling-concept/02-rulings.md`; read it first. **Concept** (Rev. 1, updated by the rulings) is in `plans/styling-concept/01-styling-concept.md`. **Round-1 data** is in `../samples/*.json` (raw) and `../calibration-set.json` (routing and proposed hold).

## Claim authority tiers (same as the Leave-in standard §2.4.1)

| Tier | Source |
|---|---|
| **C1** | The German pack itself: front/back text, or a product photo showing the pack text. |
| **C2** | The manufacturer's **German-market** product page (e.g. schwarzkopf.de, taft.de, got2b.de, syoss.de, wella.com/de, loreal-paris.de, nivea.de, guhl.com/de, johnfrieda.de). Also C2: a house brand on its own retailer's page (dm ↔ Balea/alverde, Rossmann ↔ Isana). |
| **C3** | A retailer page for a third-party brand (dm, Rossmann, Douglas, Flaconi, Müller, Amazon). |
| **C5** | A non-German manufacturer page (other country or language). Exception: it counts only if the identical formula/GTIN is verified for Germany *and* a DE retailer corroborates it. |

Rules:
- Retailer filter chips (dm "Halt", Douglas "Haltgrad") are **C3 traces only**.
- The **product name printed on the pack** (e.g. „Haarspray POWER Halt 5") counts as C1, once you confirm it with a pack image or the manufacturer page.

## Lane type F: claim freeze (one JSON array per lane)

```json
{
  "sample_id": "exact id from calibration-set.json",
  "best_tier": "C1 | C2 | C2_house_brand | C3 | C5 | none",
  "sources": [{ "tier": "C2", "url": "", "retrieved": "2026-10-09" }],
  "primary_promise_raw": "≤15 words, verbatim German, from the best tier",
  "hold": { "raw": "Halt 5", "number": 5, "scale_max": 5, "scale_max_stated": false, "words": "sehr starker Halt", "tier": "C2" },
  "flexibility_words": ["flexibel"],
  "finish": { "raw": "matt", "number": null, "tier": "C2" },
  "directions_summary": "short paraphrase: damp/dry, before heat/finish, where, amount",
  "directions_tier": "C2",
  "heat_claim_raw": null,
  "humidity_claim_raw": null,
  "duration_claim_raw": null,
  "conflicts_with_round1": "what differs from the round-1 record (hold, name, formula, discontinued), or null",
  "inci_changed": false,
  "notes": ""
}
```

**Never invent a claim.** If no C1/C2 source is found, set `best_tier` to the best tier you did find and say so in `notes`.

## Lane type G: gap fill

Use the same record schema as round 1 (`plans/styling-concept/00-taxonomy-draft.md`, "Calibration sample record"). Rules:
- Use the **v1 subtype keys**: gel, curl_cream, mousse, blowdry_lotion, smoothing_styler, hairspray, shine_finish, salt_spray, texture_spray, hair_powder, molding, refresher.
- Try for C2 or better on claims.
- Add a `claim_tier` field to each record.

## Practical tips from round 1

- **dm.de** pages are JS-rendered. The product JSON endpoint `https://products.dm.de/product/products/detail/DE/dan/<DAN>` returns the verbatim INCI, claims, directions, price and EAN. The dm search API rate-limits, so find the DAN via web search or redirects.
- **Rossmann** has a bot wall; don't retry.
- **Douglas / Flaconi** pages render only in a browser.
- If you use the built-in browser (`mcp__Claude_Browser__*`), first call `tabs_create` and pass that `tabId` on **every** call. Other agents share the browser, so never act on the fronted tab.
- Decline cookies. Never log in, submit forms or download files.
- If a site blocks you, move on.
- Each lane writes **only its own output file** in this folder.
