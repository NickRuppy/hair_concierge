# Styling category — taxonomy draft v0 (working input for calibration sampling)

Status: DRAFT, 2026-10-09. Not ruled. Input for the calibration-sample lanes; the concept doc supersedes it.

## Owner rulings so far (Nick, 2026-10-09)

- SD1 Scope: all styling families (incl. short-hair modelling) PLUS the overlap product types that today sit at the edge of Leave-in, Heat Protectant, Oil and Dry Shampoo.
- SD2 One category key `styling` with subtypes (not four format keys).
- SD3 Oil-free shine/finish sprays and serums belong to Styling, not Oil ("no oil contained").
- SD4 Styling is optional by default; it becomes an active recommendation when the user states a matching problem/goal (e.g. too little volume, definition does not hold).
- SD5 Chaarlie defines its own coherent hold scale (not copied from any brand).

## Draft subtypes (`styling_subtype`)

Families group subtypes by mechanism + application moment.

### A · Formen & Definieren — applied to damp hair before drying
| Key | DE label | Core job | Includes |
|---|---|---|---|
| `gel` | Haargel | hold + definition / sleek | classic gel, Crunch-Gel, Flaxseed/Leinsamen-Gel, jelly, Sprühgel / curl-defining spray with gel-like hold |
| `curl_cream` | Lockencreme / Gel-Creme | soft definition + frizz control WITH a real hold route | curl creams, gel-creams, curl balms with fixative (overlap: Leave-in) |
| `mousse` | Schaumfestiger | volume + light-to-strong hold, wave/curl lift | foams, curl foams |
| `setting_lotion` | Föhnlotion / Festiger | liquid set for blow-dry/rollers | Föhnlotion, Stylinglotion, Festiger (liquid) |
| `root_lift` | Ansatzvolumen-Spray | targeted root volume | Volumenspray, Ansatzspray (damp roots) |
| `heat_styling_spray` | Stylingspray für Föhn & Eisen | shape/smoothness/hold produced WITH heat tools | Föhnspray with styling result, Glättungsspray, Lockenstab-/Thermo-Styling spray (overlap: Heat Protectant) |

### B · Fixieren & Finish — applied to dry, finished hair
| Key | DE label | Core job | Includes |
|---|---|---|---|
| `hairspray` | Haarspray / Haarlack | fix the finished style, humidity resistance | aerosol + pump, flexible → extra strong |
| `finish_shine` | Glanz- & Anti-Frizz-Finish | shine, flyaway/frizz smoothing, humidity shield — no oil-led formula | Glanzspray, Brillantine, oil-free silicone serum/anti-frizz finish, anti-humidity finishing spray without fixative (overlap: Oil) |

### C · Textur & Volumen
| Key | DE label | Core job | Includes |
|---|---|---|---|
| `salt_spray` | Salzspray | beachy, piecey texture | Meersalzspray, wet texture spray with salt |
| `texture_spray` | Texturspray | dry texture, grip, airy volume | dry texture spray, volume finishing aerosol (overlap: Dry Shampoo) |
| `hair_powder` | Haarpuder | root grip + matte volume | Volumenpuder, Ansatzpuder, Stylingpuder |

### D · Modellieren & Bändigen — mostly dry hair, often short
| Key | DE label | Core job | Includes |
|---|---|---|---|
| `wax` | Haarwachs | restylable hold + separation | wax, gel-wax, cream-wax |
| `paste` | Paste / Clay | texture + medium/strong hold, matte-natural | paste, Mattpaste, clay, fiber |
| `pomade` | Pomade | slick control + shine | oil-based and water-based pomade |
| `styling_cream` | Stylingcreme / Glättungscreme | soft control, smoothing, light hold (non-curl) | Haarcreme for styling, grooming cream, Glättungscreme |
| `edge_control` | Edge Control | lay down hairline (niche) | edge control gels/pomades |

### E · Auffrischen — second-day
| Key | DE label | Core job | Includes |
|---|---|---|---|
| `curl_refresher` | Locken-Refresh | revive curls/waves between washes | refresh sprays with/without light hold (overlap: Leave-in) |

## Calibration sample record (JSON, one object per product)

```json
{
  "sample_id": "brand-product-slug",
  "subtype_candidate": "gel",
  "boundary_probe": false,
  "brand": "",
  "product_name": "",
  "size": "150 ml",
  "format": "gel | spray_gel | jelly | cream | foam | liquid | pump_spray | aerosol | wax | paste | clay | pomade | powder | serum",
  "market_tier": "drugstore | premium_drugstore | salon_prestige",
  "retailers_seen": ["dm", "rossmann", "mueller", "douglas", "flaconi"],
  "price_eur": 3.95,
  "price_source_url": "",
  "ean": null,
  "inci": "Aqua, ... (full list exactly as published, comma-separated)",
  "inci_source_url": "",
  "inci_source_tier": "manufacturer | retailer_product_page | ingredient_database | not_found",
  "claims_verbatim": ["short German pack/retailer claims, each ≤ 15 words"],
  "hold_claim": { "raw": "Halt 4", "number": 4, "scale_max": 5, "words": "starker Halt", "none_stated": false },
  "finish_claim": "matt | natürlich | glänzend | wet look | null + raw text",
  "humidity_claim": "raw text or null",
  "heat_claim": "raw text or null",
  "hair_type_claims": ["raw: feines Haar, Locken, ..."],
  "free_from_claims": ["ohne Alkohol", "ohne Silikone", "CG-geeignet", "vegan", ...],
  "directions": "short paraphrase: damp/dry, before heat/finish, amount, where (roots/lengths)",
  "application_moment": "damp_before_drying | before_heat | dry_finish | dry_restyle | second_day",
  "formula_observations": "your read: fixative(s) present and position, alcohol position, oils/silicones/waxes/salts/starches/clays leading, emulsion vs gel vs aerosol",
  "notes": "anything surprising (e.g. claims vs formula mismatch, boundary doubt)"
}
```
