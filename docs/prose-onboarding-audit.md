# Prose.com Hair Consultation — Onboarding Flow Audit

**Date:** 2026-03-22
**URL:** `https://prose.com/consultation/haircare/my-hair/length`
**Total pages:** ~33 question/info screens across 4 sections + sign-in gate + results

---

## Flow Structure Overview

The consultation is divided into **4 main sections**, each introduced by a full-screen hero transition page:

| # | Section | Title | Pages | Focus |
|---|---------|-------|-------|-------|
| 1 | Hair & Scalp | *(no title)* | 14 | Physical hair properties + scalp condition |
| 2 | Treatments | "How you style" | 6 | Chemical treatments, tools, styling habits |
| 3 | Lifestyle | "How you live" | 8 + sign-in | Age, hormones, diet, environment |
| 4 | Preferences & Goals | "How you like it" | 4 | Ingredient prefs, fragrance, goals |

**Progress indicator:** A segmented progress bar at the top shows all 4 sections. Completed sections are filled in; future sections are disabled/greyed out until prior sections complete.

**Navigation:** Back arrow (bottom-left) on every page. "Save + exit" (top-right) persists progress.

---

## Section 1: Hair & Scalp (14 questions)

### 1.1 Hair Length
- **URL:** `/my-hair/length`
- **Question:** "How long is your hair?"
- **Subtitle:** "If you have curly hair, pull the curl all the way down to find your true length."
- **UI:** Single-select cards (title + description)
- **Options:**
  1. Short — Buzz-cut to early-Beatles
  2. Chin-length — Doesn't touch shoulders
  3. Shoulder length — Sits on shoulders or falls slightly past
  4. Long — Below shoulder blades to mid-back
  5. Very Long — Mid-back and beyond
- **Extra:** "More of a visual learner? Tap for pics" modal with photo carousel
- **Recommendation relevance:** Hair length directly affects product quantity recommendations, formulation weight (longer hair needs more conditioning at the ends), and which products are suggested (e.g., leave-in conditioners for longer hair). It also influences how much heat protection is needed for styling.
- **Expert review:** The claims here are largely accurate but modest. Length does affect product dosing (more product needed for longer hair) and it is true that longer hair tends to have older, more weathered ends that benefit from conditioning. The leave-in conditioner recommendation for longer hair is supported by practitioner consensus. The heat-protection claim is loosely correct: longer hair requires more even distribution of heat protectant, though the *amount* of heat protection needed is driven more by tool temperature and frequency than by length alone. Overall, this question captures a real but secondary variable. It does not change *which* formulation category is needed, only quantity and application guidance. **Signal strength: LOW.** Length is useful for dosing and routine guidance but not for ingredient selection or formulation type. **Note for Hair Concierge:** Worth capturing as a lightweight onboarding data point. Use it for product quantity guidance and routine tips (e.g., "Bei deiner Haarlange empfehlen wir..."), not for formulation decisions. Low priority compared to texture, thickness, and scalp condition.

### 1.2 Hair Texture (Pattern)
- **URL:** `/my-hair/texture`
- **Question:** "What's your natural, untreated, air-dried hair texture?"
- **Subtitle:** "If your hair is texturally treated, think back to when it wasn't."
- **UI:** Single-select cards in 2-column grid, each with an **illustration** of the curl pattern
- **Options (10):**
  1. Type 1 — Straight
  2. Type 2A — Soft Waves (Almost straight with a slight bend)
  3. Type 2B — Wavy (Like a loose "S")
  4. Type 2C — Deep Waves or Loose Curls (Defined, S-shaped pattern)
  5. Type 3A — Curly (Like a loose "C")
  6. Type 3B — Very Curly (Defined & springy C's)
  7. Type 3C — Tight Curls (Like a corkscrew)
  8. Type 4A — Coily (Tight & springy, like a slinky)
  9. Type 4B — Zig-Zag Coils (A less-defined "Z")
  10. Type 4C — Tight Zig-Zag (Like a sharply defined "Z")
- **Extra:** Visual modal with tabs for Type 1–4 with photos
- **Recommendation relevance:** The single most important data point for hair care. Curl pattern determines moisture needs (curlier = more moisture), ideal cleansing agents (sulfate-free for curly/coily), product weight, whether curl-defining products are recommended, and the overall formulation approach. Straight hair tends toward oiliness at roots; coily hair toward dryness at ends.
- **Expert review:** The core claim that curl pattern is among the most important data points is well supported by cosmetic science and practitioner consensus. Curlier and coilier hair does have higher moisture needs because sebum has difficulty traveling down the hair shaft along curves, and the hair fiber itself tends to be more elliptical and porous. The "sulfate-free for curly/coily" recommendation is practitioner consensus but not strongly supported by controlled clinical trials; recent evidence suggests formulation pH and overall surfactant system matter more than the presence or absence of sulfates per se. The claim "straight hair tends toward oiliness at roots; coily hair toward dryness at ends" is a reasonable generalization but oversimplifies -- individual sebum production, scalp condition, and porosity vary significantly within any curl-pattern category. Two important caveats are missing: (1) The Andre Walker typing system (1-4C) lacks scientific validation -- it is a qualitative, marketing-originated classification with no standardized measurement criteria, and people commonly mistype themselves. Self-assessment accuracy is a known limitation. (2) Curl pattern alone is insufficient; strand thickness and porosity interact heavily with pattern to determine product needs. A fine-haired 3B person needs very different products from a coarse-haired 3B person. **Signal strength: HIGH.** Despite classification limitations, this remains a foundational segmentation variable for product category selection. **Note for Hair Concierge:** Essential to capture but pair it with thickness and porosity indicators. Consider using fewer granular subtypes (e.g., 4 main categories instead of 10 subtypes) since self-typing at the subtype level is unreliable. Visual aids are critical for accuracy. Use this to drive product category (cleansing system, conditioning weight, styling product type), not to make overly precise ingredient claims.

### 1.3 Oily/Dry Spectrum (Hair)
- **URL:** `/my-hair/type`
- **Question:** "Where would you put your hair on the oily/dry spectrum?"
- **UI:** Single-select cards
- **Options:**
  1. On the oily side — Roots get oily quickly, while lengths are balanced
  2. Medium — Roots don't get oily quickly, and lengths aren't dry either
  3. Mixed — Roots get oily quickly while my lengths are dry or frizzy
  4. On the dry side — Roots don't get oily quickly and my lengths are always dry or frizzy
- **Prose "Why we ask":** "We know oiliness and dryness levels can vary throughout the year, so just answer with what you're feeling at this exact moment. We'll track the conditions in your area throughout the year and subtly adjust your formulas to anticipate the way your hair changes with the seasons."
- **Recommendation relevance:** Determines cleansing intensity — oily hair gets stronger surfactants, dry hair gets gentler cleansers with more emollients. Mixed hair may get dual-zone formulation (clarifying at roots, moisturizing at lengths). This also affects conditioner weight and how much oil/serum is recommended.
- **Expert review:** The core logic is sound -- perceived oil/dry balance does influence which cleansing system is appropriate, and the principle that oily hair tolerates stronger surfactants while dry hair needs gentler ones is well supported in cosmetic chemistry. The "dual-zone formulation" claim (clarifying at roots, moisturizing at lengths) is marketing language that overstates what a single shampoo product can realistically do; in practice, application technique (shampoo on scalp, conditioner on lengths) achieves this, not a special "dual-zone" formula. Prose's "Why we ask" sidebar claims they "subtly adjust your formulas to anticipate the way your hair changes with the seasons" -- this is a significant overclaim. While humidity and temperature do affect perceived oiliness and hair behavior, there is no published evidence that automated seasonal micro-adjustments to shampoo formulations produce measurably better outcomes than a well-chosen base formulation. Cosmetic chemists have noted that shampoo formulation space is more constrained than personalization marketing suggests. A notable missing nuance: self-reported oil/dry perception is highly unreliable. Many users confuse product buildup with oiliness, or mistake dehydration-driven frizz for "dryness." The question captures subjective experience, not an objective measurement. **Signal strength: MEDIUM.** Useful as a directional input for cleansing and conditioning weight, but should be cross-validated with wash frequency and scalp-specific questions rather than treated as a standalone driver. **Note for Hair Concierge:** Worth asking, but frame it as one input among several scalp/hair condition questions. Do not promise seasonal formula adjustments unless we can actually deliver them. Use this primarily to guide cleansing strength recommendations and conditioner weight suggestions.

### 1.4 Split Ends
- **URL:** `/my-hair/split-ends`
- **Question:** "Do you get split ends?"
- **Subtitle:** "Check your ends right now—do you see any fiber divisions, white specks, or tiny knots?"
- **UI:** Single-select cards
- **Options:**
  1. Yes, plenty
  2. Only a few
  3. None in sight
- **Extra:** Modal showing 6 types of split ends with illustrations
- **Recommendation relevance:** Indicates damage level at the hair fiber level. Drives recommendations for protein-based repair ingredients (keratin, amino acids), bond-building actives, and heavier conditioning treatments. Severe split ends may trigger hair mask or oil recommendations in the routine.
- **Expert review:** The claim that split ends indicate fiber-level damage is scientifically correct -- trichoptilosis (split ends) results from mechanical and chemical degradation of the hair cuticle and cortex. However, the recommendation logic overstates what products can do. Cosmetic science is clear: once a hair fiber has split, no product can permanently repair it. Bond-building actives (e.g., bis-aminopropyl diglycol dimaleate) can reinforce remaining disulfide bonds and reduce further breakage, but they do not "fix" existing splits. Protein treatments can temporarily fill in cuticle gaps and improve strength metrics, but the only true solution for split ends is cutting them off. The audit should note this limitation. Additionally, the recommendation to add protein for damaged hair is correct directionally, but missing a critical nuance: protein sensitivity is a real phenomenon, particularly for fine or low-porosity hair. Overloading with protein (especially heavy keratin treatments) can make hair stiff, brittle, and more prone to snapping. The molecular weight of the protein matters significantly -- low-MW hydrolyzed proteins penetrate the cortex while high-MW proteins coat the surface. Recommending "protein-based repair ingredients" without considering hair thickness and porosity is incomplete logic. **Signal strength: MEDIUM.** Useful as a damage indicator that informs conditioning and treatment intensity, but should not drive protein-specific claims without cross-referencing thickness and porosity. **Note for Hair Concierge:** Worth asking as a damage assessment proxy. Use it to recommend deeper conditioning treatments and to flag that a trim may be needed (honest, trust-building advice). Avoid overpromising that products can "repair" split ends. Pair with thickness data before recommending protein treatments.

### 1.5 Hair Thickness (Strand Diameter)
- **URL:** `/my-hair/thickness`
- **Question:** "What does a single strand of hair feel like?"
- **Subtitle:** "Roll a single hair between your fingers. If you…"
- **UI:** Single-select cards in 2-column grid with strand thickness illustrations
- **Options:**
  1. Barely feel it = fine/thin hair
  2. Not sure or feel it slightly = medium hair
  3. Feels like sewing thread = thick/coarse hair
- **Prose "Why we ask":** "This info about individual hair thickness is crucial to supporting overall strength and addressing frizz and flyaways."
- **Recommendation relevance:** Fine hair needs lightweight formulas to avoid being weighed down; coarse/thick hair needs richer formulas with heavier oils and butters. Thickness affects protein needs (fine hair is more prone to breakage), volume product recommendations, and how much hold a styling product should provide.
- **Expert review:** The core claims are well supported by cosmetic science. Fine hair has a smaller cross-sectional area and thinner cortex, making it physically weaker and more easily weighed down by heavy oils, butters, and silicones. Coarse hair has a larger cortex and can tolerate (and often benefits from) richer formulations. The claim that "fine hair is more prone to breakage" is correct -- finer strands have lower tensile strength. However, the protein recommendation logic is backwards from what the audit implies. Fine hair is more susceptible to *protein overload* -- excessive protein can make fine hair stiff and snap-prone rather than stronger. Fine hair generally benefits from lightweight, low-MW proteins (amino acids, peptides) in moderate amounts, while coarse hair can handle heavier protein treatments. The audit's framing ("thickness affects protein needs") is directionally correct but the detail is inverted from what many practitioners assume. The self-assessment method (rolling a strand between fingers) is a reasonable proxy given the constraints, though it has significant inter-individual variability. Most consumers struggle to distinguish "fine" from "medium." **Signal strength: HIGH.** Strand diameter is a primary driver of product weight, formulation richness, and ingredient selection. It directly determines whether lightweight vs. rich formulations are appropriate. **Note for Hair Concierge:** Essential question. This is one of the top 3 variables (alongside curl pattern and scalp condition) for product recommendation. Use it to drive product weight/richness decisions. Include visual or tactile guidance to improve self-assessment accuracy. Be careful with protein recommendations -- pair thickness with damage assessment before suggesting protein treatments.

### 1.6 Hair Density
- **URL:** `/my-hair/density`
- **Question:** "How dense is your hair?"
- **Subtitle:** "Part your hair and check the mirror—the more scalp you see, the less dense your hair is."
- **UI:** Single-select cards in 2-column grid with density illustrations
- **Options:**
  1. Very dense — I see very little to no scalp
  2. Medium or not sure — I can see a little skin
  3. Low density — I have a wide part
- **Prose "Why we ask":** "Density (how many hairs you have) and thickness (how thick a single strand is) aren't the same thing, but the two have an important correlation—we'll use this info to help manage your volume the way you want it."
- **Recommendation relevance:** Combined with thickness, density determines volume strategy. Low density + fine hair = volumizing formulas; high density + thick hair = smoothing/taming formulas. Also affects product dosing recommendations and whether scalp-care products (for visible scalp) are prioritized.
- **Expert review:** The core logic is sound and well supported by practitioner consensus. Density + thickness together are more informative than either alone for volume-related product decisions. The volumizing/smoothing axis based on these two variables is standard in professional hairstyling and product recommendation. The claim about scalp-care products for visible scalp (low density) is a reasonable inference -- users with visible scalp may be more interested in scalp health and volumizing products. However, the self-assessment method (looking at a part in the mirror) is one of the weakest self-report measures in the quiz. Density is notoriously difficult to self-assess because it interacts with thickness, curl pattern, and hair color (dark hair on light scalp looks less dense than it is; fine straight hair can look low-density even at medium density). Prose's educational note distinguishing density from thickness is good practice, as most consumers conflate the two. The dosing claim is correct -- higher density genuinely requires more product. **Signal strength: MEDIUM.** Useful for volume strategy and product quantity but limited by poor self-assessment accuracy. Most of its value comes from the interaction with thickness, not as a standalone signal. **Note for Hair Concierge:** Worth asking, especially in combination with thickness. Use the pair to drive volume-related recommendations. Keep the question simple (3 options maximum) and include Prose-style educational content distinguishing it from thickness. Accept that self-report accuracy will be low and design fallback logic accordingly.

### 1.7 Shedding
- **URL:** `/my-hair/hairloss`
- **Question:** "Do you feel like you're shedding more than usual lately?"
- **Subtitle:** "What's normal? Check the tip!"
- **UI:** Single-select cards
- **Options:**
  1. No, seems normal
  2. Sometimes it feels that way, sometimes not
  3. Yes, I know for sure I am
- **Extra:** Educational modal explaining normal shedding (up to 100 strands/day) vs. breakage
- **Recommendation relevance:** Triggers inclusion of hair-strengthening ingredients (biotin, caffeine, peptides) and potentially supplement recommendations (Prose sells hair supplements). Also may influence how gentle the cleansing formula is and whether scalp-stimulating ingredients are added.
- **Expert review:** The connection between perceived shedding and product recommendations is problematic on multiple levels. First, self-reported shedding is highly unreliable. Dermatological research shows that even standardized clinical tests (hair pull test) lack reproducibility, and patients routinely confuse normal shedding (50-100 hairs/day) with abnormal loss, or confuse breakage with shedding. The question's value as a diagnostic input is low. Second, the ingredient recommendations are overclaimed. Biotin supplementation has no demonstrated benefit for hair growth in non-deficient individuals -- a 2024 systematic review found no difference between biotin and placebo groups in the highest-quality trial. Caffeine has some in-vitro evidence for stimulating hair follicle growth but limited clinical evidence for topical application in cosmetic products at typical concentrations. Peptides vary widely in evidence quality. Third, a question about shedding in a cosmetic product consultation risks crossing into medical territory. Significant shedding can indicate telogen effluvium, alopecia areata, thyroid disorders, iron deficiency, or other conditions that require medical evaluation, not a new shampoo. The question primarily serves Prose's supplement upsell strategy. **Signal strength: LOW for topical product recommendations. MEDIUM as a screening/escalation trigger.** The answer does not meaningfully change which shampoo or conditioner someone needs. Its main value is as a flag for escalation ("talk to a dermatologist") or supplement sales. **Note for Hair Concierge:** Consider including as an educational/screening question rather than a product-driving one. If a user reports significant shedding, the app should recommend consulting a dermatologist rather than suggesting products. Do not claim that any topical product "strengthens" hair against shedding without strong evidence. Avoid biotin claims.

### 1.8 Genetic Hair Loss
- **URL:** `/my-hair/genetic-hair-loss`
- **Question:** "Is hair loss a genetic issue in your family?"
- **UI:** Single-select cards
- **Options:**
  1. Yes
  2. No
  3. I'm not sure
- **Prose "Why we ask":** "We see hair loss as a multi-factorial issue, and will customize your supplements to address as many of the aggravating factors in your case as possible."
- **Recommendation relevance:** Primarily drives supplement formulation. Genetic hair loss (androgenetic alopecia) responds to different ingredients than stress-related loss. May trigger DHT-blocking ingredients in supplements and scalp-stimulating actives in topical products.
- **Expert review:** The distinction between genetic (androgenetic) and other types of hair loss is medically important and correctly noted. Androgenetic alopecia is DHT-mediated, while telogen effluvium is typically stress/hormonal/nutritional. However, the recommendation logic has serious problems. "DHT-blocking ingredients in supplements" -- the evidence for cosmetic/supplement DHT-blockers is weak. Finasteride (prescription) has strong evidence; saw palmetto and pumpkin seed oil have limited, low-quality evidence with modest effects at best. A cosmetic quiz should not be the basis for DHT-blocking supplement recommendations. "Scalp-stimulating actives in topical products" for genetic hair loss is also overclaimed -- minoxidil (a drug, not a cosmetic ingredient) is the only topical with strong evidence for androgenetic alopecia. Cosmetic "scalp-stimulating" ingredients (caffeine, rosemary oil, etc.) have preliminary evidence at best. More fundamentally, family history of hair loss is a medical data point. If someone confirms genetic hair loss, the most responsible recommendation is to see a dermatologist or trichologist, not to buy a different shampoo. This question is primarily a supplement upsell mechanism for Prose. **Signal strength: LOW for cosmetic product recommendations. MEDIUM as a medical escalation signal.** **Note for Hair Concierge:** Do not use this to drive topical product recommendations -- the evidence does not support it. If included, use it solely as an escalation trigger: "Erblich bedingter Haarausfall sollte mit einem Dermatologen besprochen werden." This builds trust through honesty rather than overclaiming what a cosmetic product can do.

### 1.9 Wash Frequency
- **URL:** `/my-hair/shampoo-frequency`
- **Question:** "How often do you wash your hair?"
- **Subtitle:** "This includes shampooing and co-washing."
- **UI:** Single-select cards
- **Options:**
  1. Every day
  2. Every 2-3 days
  3. Once a week
  4. Less than once a week
- **Recommendation relevance:** Determines cleansing strength — daily washers need gentler surfactants to avoid stripping; infrequent washers may need deeper-cleansing formulas to handle buildup. Also influences whether dry shampoo is recommended in the routine and product size/quantity recommendations.
- **Expert review:** This is straightforwardly correct and well supported by cosmetic chemistry principles. Daily washing with aggressive surfactants strips the lipid barrier and can trigger reactive sebum overproduction; gentler surfactants (e.g., cocamidopropyl betaine, sodium cocoyl isethionate) are appropriate for frequent washers. Infrequent washers do accumulate more sebum, dead skin cells, and product buildup that may warrant periodic use of clarifying or deeper-cleansing formulas. The dry shampoo recommendation for infrequent washers is reasonable. The product size/quantity point is a minor but valid business consideration. One missing nuance: wash frequency is both a *cause* and *consequence* of hair condition. Someone washing daily because they have an oily scalp has different needs from someone washing daily out of habit with normal sebum production. This question is more useful when cross-referenced with oil production speed (1.10) and scalp oiliness (1.11). **Signal strength: HIGH.** Wash frequency is a direct, reliable input that meaningfully changes cleansing product recommendations and routine structure. Users know how often they wash their hair -- self-report accuracy is high. **Note for Hair Concierge:** Essential question. Easy to answer accurately, directly actionable for product recommendations. Use it in combination with scalp oiliness to recommend cleansing strength. Also useful for routine cadence advice and product consumption/quantity estimates.

### 1.10 Oil Production Speed
- **URL:** `/my-hair/oil`
- **Question:** "After a wash, how long until hair gets oily again?"
- **Subtitle:** "If you're stuck between answers, choose the greater number of days."
- **UI:** Single-select cards
- **Options:**
  1. The same day
  2. The second day
  3. 3+ days
  4. It never gets oily
  5. I don't know
- **Prose "Why we ask":** "Your sebum production can vary within the year, depending on elements like temperature, humidity, styling routine, diet, stress, etc."
- **Recommendation relevance:** Cross-referenced with wash frequency and scalp type to calibrate sebum-control ingredients. Fast oil production may warrant clarifying or oil-absorbing ingredients; slow production suggests the scalp needs gentler, more hydrating formulas. Prose also says they adjust formulas seasonally based on this.
- **Expert review:** The core logic is sound -- sebum production rate is a meaningful variable for cleansing product selection, and the directional recommendations (faster oil = more cleansing power, slower oil = gentler formulas) are well supported. Cross-referencing with wash frequency and scalp type is good practice. However, the seasonal adjustment claim should be flagged as unsubstantiated marketing. While sebum production does fluctuate somewhat with temperature and humidity, the idea that Prose meaningfully reformulates individual bottles based on seasonal data has no published evidence behind it. Cosmetic chemists have noted that the actual formulation space for shampoos is far more constrained than personalization brands suggest. Furthermore, this question partially overlaps with 1.3 (hair oily/dry spectrum) and 1.11 (scalp oily/dry spectrum). The incremental information gain from asking oil production *speed* separately is modest -- it primarily helps distinguish between people who wash frequently because they produce a lot of sebum vs. those who wash frequently for other reasons. **Signal strength: MEDIUM.** Useful refinement when combined with wash frequency, but partially redundant with the oily/dry spectrum questions. **Note for Hair Concierge:** Consider whether this question can be merged with or replaced by the scalp oily/dry spectrum question (1.11) to reduce quiz length. If kept, use it primarily as a cross-validation for wash frequency and scalp oiliness. Do not make seasonal adjustment claims.

### 1.11 Scalp Oily/Dry Spectrum
- **URL:** `/my-hair/scalp`
- **Question:** "In between washes, where is your scalp on the oily/dry spectrum?"
- **Subtitle:** "Just like your skin, your scalp is constantly changing, but think about how it typically feels."
- **UI:** Single-select cards
- **Options:**
  1. On the oily side
  2. Balanced
  3. On the dry side
  4. Not sure / I don't know
- **Extra:** Educational modal about scalp microbiome
- **Recommendation relevance:** Drives scalp-specific ingredients. Oily scalps get sebum-regulating ingredients (e.g., zinc, salicylic acid); dry scalps get humectants and soothing agents (aloe, glycerin). This is distinct from the hair oil question — hair and scalp can have opposite needs (oily roots, dry ends).
- **Expert review:** The distinction between scalp condition and hair shaft condition is an important and scientifically valid point -- the scalp is skin and should be treated as such, independently from the hair fiber. The ingredient recommendations are directionally correct: zinc pyrithione and salicylic acid have established efficacy for oily/seborrheic scalps, and humectants/emollients are appropriate for dry scalps. The "oily roots, dry ends" observation is a well-recognized pattern in dermatology and cosmetic science, particularly for people with longer hair or curlier textures. However, the framing implies that a shampoo can meaningfully deliver "sebum-regulating ingredients" like zinc to the scalp in the brief contact time of a wash -- this is partially true for zinc pyrithione (which does have wash-off efficacy data) but less established for other ingredients at cosmetic concentrations. Salicylic acid in a shampoo has some evidence for descaling but its sebum-regulating effect requires adequate contact time and concentration. **Signal strength: HIGH.** Scalp condition is a primary driver of cleansing product selection and is distinct enough from hair condition to justify a separate question. **Note for Hair Concierge:** Essential question. The scalp-hair distinction is a point of genuine user education and differentiates us from simpler quizzes. Use this to drive shampoo/scalp product selection. Consider combining insights from this question with flakiness (1.12) and sensitivity (1.13) to build a composite scalp profile.

### 1.12 Flakiness
- **URL:** `/my-hair/dandruff-level`
- **Question:** "Are you prone to flakiness?"
- **UI:** Single-select cards
- **Options:**
  1. No
  2. Rarely
  3. Sometimes
  4. Very Often
- **Extra:** Educational modal distinguishing flakes (skin-based) from product buildup
- **Recommendation relevance:** Triggers anti-dandruff/anti-flake active ingredients (piroctone olamine, zinc pyrithione, tea tree oil). Frequent flakiness may indicate fungal involvement, warranting antifungal actives. Also influences whether a scalp mask or serum is recommended in the routine.
- **Expert review:** The ingredient recommendations are largely evidence-based. Piroctone olamine and zinc pyrithione are established anti-dandruff actives with clinical evidence. Tea tree oil (melaleuca alternifolia) has some evidence for anti-fungal and anti-inflammatory effects, though at lower confidence than the pharmaceutical-grade actives. The observation that frequent flakiness may indicate fungal (Malassezia) involvement is correct and well supported in dermatological literature. However, an important nuance is missing: flakiness has multiple causes that require different treatments. Seborrheic dermatitis (fungal-driven) responds to antifungals. Dry scalp flaking responds to moisturizing. Psoriasis flaking requires different management entirely. Contact dermatitis from products causes flaking that resolves by removing the irritant. A simple frequency question cannot distinguish between these causes. Prose's educational modal distinguishing flakes from product buildup is a good start, but the diagnostic limitation remains. Additionally, recommending antifungal actives based solely on self-reported flaking frequency carries a mild safety concern -- some users with psoriasis or contact dermatitis could receive inappropriate product recommendations. **Signal strength: MEDIUM-HIGH.** Flakiness is a meaningful and common scalp concern that directly affects product selection. However, the inability to distinguish causes limits how precisely the app can recommend. **Note for Hair Concierge:** Worth asking. Use the response to recommend appropriate scalp-focused products, but include caveats for persistent or severe flakiness ("Bei anhaltenden Schuppen empfehlen wir einen Besuch beim Hautarzt"). Consider adding a follow-up question to distinguish dry-scalp flaking from oily/seborrheic flaking, as these require opposite treatments.

### 1.13 Scalp Sensitivity
- **URL:** `/my-hair/sensitivity`
- **Question:** "Do you have a sensitive scalp?"
- **Subtitle:** "If you experience tightness, dryness, burning, tingling, pain, itching, or redness, all that counts as sensitivity."
- **UI:** Single-select cards
- **Options:**
  1. Not at all
  2. Off and on
  3. Yes, for sure
  4. It's ridiculously sensitive
- **Extra:** Educational modal about causes (chemical, hormonal) and recommendation for fragrance-free option
- **Recommendation relevance:** Directly affects ingredient safety profile — sensitive scalps get fragrance-free recommendations, avoidance of common irritants (certain essential oils, harsh surfactants), and inclusion of soothing/anti-inflammatory ingredients (bisabolol, allantoin). High sensitivity may exclude certain active ingredients entirely.
- **Expert review:** This is one of the strongest recommendation-relevance claims in the audit. The link between scalp sensitivity and fragrance avoidance is well supported -- fragrance is one of the top allergens in dermatological literature, responsible for up to 30% of cosmetic allergies in clinical practice. Fragrance allergy affects 1-4% of the general population and 8-15% of those with contact dermatitis. The recommendation to avoid harsh surfactants and certain essential oils for sensitive scalps is also well supported. Bisabolol (from chamomile) and allantoin are established soothing ingredients with reasonable evidence for anti-inflammatory and skin-calming effects. The logic that high sensitivity should exclude certain active ingredients is sound -- ingredients like salicylic acid, menthol, and certain essential oils can exacerbate sensitivity. One important nuance: "sensitive scalp" is subjective and encompasses a wide range of conditions from mild irritation to contact dermatitis to scalp psoriasis. Self-reported sensitivity is useful as a safety gate but should not replace dermatological assessment for severe cases. The cross-reference with fragrance selection (4.3) is well designed. **Signal strength: HIGH.** This is a genuine safety gate question. The answer directly and meaningfully changes which ingredients should be included or excluded. It functions as a constraint filter on the entire recommendation system. **Note for Hair Concierge:** Essential question -- possibly the single most important safety gate in the quiz. Use it as a hard constraint: high sensitivity should trigger fragrance-free defaults and exclusion of known irritants from all recommendations. Build this into the recommendation logic as a filter layer, not just a preference. For severe sensitivity, recommend dermatological consultation.

### 1.14 Gray Hair Percentage
- **URL:** `/my-hair/gray`
- **Question:** "How much of your hair is gray?"
- **Subtitle:** "If your hair is color-treated, answer with your natural gray percentage."
- **UI:** Single-select cards
- **Options:**
  1. 10-30% — A few grays
  2. 40-60% — About half gray
  3. 70-100% — All or nearly-all gray
  4. None
- **Extra:** Visual modal with photos of each percentage range
- **Recommendation relevance:** Gray hair has a different structure — coarser, drier, more porous, and often more wiry. It needs specialized moisturizing and may benefit from purple/blue-toning ingredients to prevent yellowing. Also affects color-protection ingredient inclusion.
- **Expert review:** The structural claims about gray hair are largely supported by scientific evidence, though with important nuances. Gray (depigmented) hair does show measurable changes: thinner cuticle layers, increased porosity, reduced internal lipid content, and lower moisture retention. The "coarser" claim is partially correct -- gray hair often *feels* coarser due to cuticle changes and reduced lubrication, though individual strand diameter may actually decrease with age. The wiry texture is attributed to oxidative stress (including hydrogen peroxide accumulation) altering keratin assembly in the follicle. The moisturizing recommendation is well supported. Purple/blue-toning for yellow prevention is cosmetically valid -- gray hair can yellow from UV exposure, environmental pollutants, and product buildup, and violet pigments neutralize this optically. However, the percentage-based question design is potentially misleading. What matters for product formulation is whether gray hair is the *dominant* fiber type a person is dealing with, and whether it is natural gray or color-treated. The four-bucket approach (10-30%, 40-60%, 70-100%, None) is reasonable for this purpose. A missing consideration: gray hair percentage often correlates with age-related changes (scalp thinning, decreased sebum production) that independently affect product needs. **Signal strength: MEDIUM.** Gray hair does require somewhat different care, but the product adjustments are incremental (more moisture, optional toning) rather than requiring a fundamentally different product category. **Note for Hair Concierge:** Worth including, particularly for the toning product recommendation and moisture guidance. The question also serves a user-recognition function -- people with significant gray hair feel seen when asked about it. Use it for conditioning intensity and to flag potential interest in toning products. Lower priority than curl pattern, thickness, and scalp health.

---

## Section 2: Treatments — "How you style" (6 pages)

### 2.1 Section Intro
- Full-screen hero image with Section 2 label: "How you style"
- Description: "Hair that's been dyed or treated needs special attention, and we'll make sure you get it."

### 2.2 Color-Treated
- **URL:** `/my-treatments/color`
- **Question:** "Is your hair color-treated?"
- **Subtitle:** "If any part of your hair has been lightened or darkened from your natural color, answer yes."
- **UI:** Single-select cards
- **Options:**
  1. Yes — My hair is colored or lightened
  2. No — Currently my hair color is 100% natural
- **Recommendation relevance:** Color-treated hair needs UV protection to prevent fading, gentler surfactants (sulfate-free), lower pH formulas, and color-seal/lock ingredients. If yes, Prose likely asks follow-up questions about color type and frequency (not observed since we selected "No").
- **Expert review:** The core claim is well supported, though the specific mechanisms deserve more precision. UV protection for color-treated hair is valid -- UV radiation accelerates oxidative fading of both synthetic dyes and natural melanin. The "sulfate-free" recommendation is widely adopted but the evidence is more nuanced than presented: a 2021 comparative study found that pH is actually more important than surfactant type for color retention. A pH-balanced SLES shampoo (pH 4.7) outperformed an unbuffered sulfate-free formula (pH 6.9) in color-fade tests. So "lower pH formulas" is the more evidence-based recommendation, and "sulfate-free" is a useful proxy but not the actual mechanism. Milder surfactant systems (SCI, cocamidopropyl betaine blends) do reduce pigment solubilization, which supports the general direction. "Color-seal/lock ingredients" is marketing language -- what this means in practice is cuticle-smoothing agents (silicones, cationic polymers) and antioxidants that reduce oxidative fading. The science supports these approaches. The type of color treatment (permanent oxidative, semi-permanent, bleach/highlights) matters significantly for damage level and product needs, so follow-up questions are appropriate. **Signal strength: HIGH.** Color treatment is a clear, binary gate that meaningfully changes product requirements across multiple categories (cleansing, conditioning, treatment, UV protection). **Note for Hair Concierge:** Essential question. Use as a hard gate: if yes, filter recommendations toward color-safe formulations. Prioritize pH-appropriate and gentle-surfactant products. Consider follow-up on color type (highlights vs. all-over, permanent vs. semi-permanent) as damage profiles differ significantly.

### 2.3 Textural Treatments
- **URL:** `/my-treatments/other-treatments`
- **Question:** "Has your hair undergone any textural treatments?"
- **Subtitle:** "Select all that apply, even if you're growing one out."
- **UI:** **Multi-select** cards + Next button
- **Options:**
  1. Relaxer — Curly hair became straight(er)
  2. Perm or Waving — Straight hair became curly
  3. Keratin — Hair was smoothed & straightened for 3-5 months
  4. None of the above
- **Extra:** Educational modal explaining each treatment type
- **Recommendation relevance:** Chemical treatments weaken the hair's disulfide bonds and alter porosity. Treated hair needs bond-repair ingredients, extra moisture, and gentler formulas. The type of treatment tells Prose how the hair structure has been altered (relaxed vs. permed vs. keratin-smoothed have different damage profiles).
- **Expert review:** This is scientifically accurate and well-articulated. Relaxers (sodium hydroxide or guanidine hydroxide based) permanently break and reform disulfide bonds, significantly weakening the hair fiber and increasing porosity. Perms use thioglycolate to break and reform bonds in a different configuration. Keratin/smoothing treatments vary widely -- some use formaldehyde-releasing agents (which have safety concerns), while others use glyoxylic acid, and their damage profile is generally milder than relaxers or perms. The claim that each treatment has different damage profiles is correct and is an important distinction that most quizzes miss. Bond-repair ingredients (bis-aminopropyl diglycol dimaleate and similar) have evidence for reinforcing remaining disulfide bonds and reducing further breakage in chemically treated hair. The note about increased porosity is correct -- chemical treatments raise and damage the cuticle, increasing porosity and reducing moisture retention. One important consideration: the "growing out" sub-instruction is valuable. Users with partially grown-out chemical treatments have dual-texture hair with different needs at root vs. mid-length/ends. **Signal strength: HIGH.** Chemical treatments create irreversible structural changes that directly and significantly alter product requirements. This is a critical gate question. **Note for Hair Concierge:** Essential question. Use as a major input for conditioning intensity, bond-repair product recommendations, and gentle cleansing requirements. The multi-select format is correct since users may have had multiple treatments. Consider that "growing it out" users need guidance for managing dual-texture transitions.

### 2.4 Products & Styling Tools
- **URL:** `/my-treatments/styles`
- **Question:** "What products and styling tools do you use?"
- **Subtitle:** "Select all that apply, even ones you use infrequently."
- **UI:** **Multi-select** chips/tags organized in **3 categories** + Next button
- **Categories & Options:**
  - **CLEANSE + CONDITION:** Shampoo, Conditioner, Leave-in Conditioner
  - **STYLING PRODUCTS + TOOLS:** Straightening iron, Curling iron/wand, Blow dryer, Hairspray, Curl Cream, Paste/Pomade, Mousse, Gel/Jelly, Dry Shampoo, Hair Oil
  - **TREATMENTS:** Scalp Mask, Hair Mask, Scalp Serum, Hair Butter, Hair Vitamins & Supplements
- **Prose "Why we ask":** "This tells us what level of heat protection you need, how much build-up you might be experiencing, and helps us create a personalized routine that factors in your styling and product preferences."
- **Recommendation relevance:** Heat tool usage → heat protection ingredients. Heavy product use (hairspray, mousse, gel) → clarifying ingredients to fight buildup. Existing routine complexity tells Prose how many products to recommend. If user already uses masks/serums, Prose can suggest replacements rather than additions.
- **Expert review:** The core logic is sound and practically useful. Heat tool usage genuinely warrants heat protection -- thermal damage to hair is well documented (protein denaturation starts around 150-230C depending on hair condition and moisture content). Heavy product users do accumulate buildup that may benefit from periodic clarifying. The "routine complexity" insight is important and serves a dual purpose: (1) it helps Prose recommend the right number of products (commercial motivation), and (2) it genuinely helps avoid overwhelming users with too many new products at once (user experience motivation). The suggestion that Prose positions its products as replacements rather than additions for complex-routine users is commercially savvy and user-friendly. However, the three-category structure (Cleanse + Condition, Styling + Tools, Treatments) reveals something important: this question is doing triple duty -- assessing heat damage risk, product buildup risk, and current routine complexity. Each of these would ideally be separate signals, but combining them into one multi-select keeps the quiz concise. The main risk is that the multi-select format with 18+ options may cause decision fatigue or inaccurate responses. **Signal strength: MEDIUM-HIGH.** Heat tool usage is a strong signal for heat protection needs. Current routine complexity is valuable for UX/recommendation framing. Product usage patterns are useful for identifying buildup risk. **Note for Hair Concierge:** Adapt a simplified version. The most valuable signals are: (1) Do you use heat tools? (drives heat protection recommendations), (2) Do you use heavy-hold styling products? (drives clarifying needs), and (3) How many products do you currently use? (drives routine complexity). Consider splitting into 2-3 simpler questions rather than one large multi-select.

### 2.5 Hair Styles Worn
- **URL:** `/my-treatments/hair-style`
- **Question:** "Do you wear any of these styles?"
- **Subtitle:** "Select all that apply. Include any style you plan to wear in the near future."
- **UI:** **Multi-select** cards in 2-column grid + Next button
- **Options (11):**
  1. Natural Waves — Beachy or defined natural waves and loose curls
  2. Crafted Curls — Curls created with a styling tool like a curling iron or rollers
  3. Pulled-back styles — Buns, braids, ponytails, updos
  4. Lifted roots — Teased or raised for added volume
  5. Locs or Dreadlocks — Ropes or strands of entangled, braided, twisted, or palm-rolled hair
  6. Finger-combed — For added shape like swoops or spikes
  7. Stretched out or straightened — Usually created with blowouts or a straightening iron
  8. Extensions — Natural or synthetic extensions
  9. Wrapped styles — Including head wraps, turbans, scarves
  10. Wigs — Natural or synthetic wigs
  11. I don't wear any of these styles
- **Recommendation relevance:** Certain styles create specific needs — pulled-back styles cause traction stress (need strengthening), heat-styled looks need thermal protection, protective styles (wraps, locs) need scalp-focused care since products can't reach the lengths as easily. This also affects which styling products Prose includes in the routine.
- **Expert review:** The traction alopecia connection is well supported by dermatological evidence. Tight ponytails, buns, braids, and extensions exert sustained pulling force on hair follicles, and traction alopecia is a well-documented condition with a clear clinical presentation pattern. The AAD explicitly warns about hairstyles that pull. However, the claim that "strengthening" products address traction stress is misleading -- traction alopecia is caused by mechanical force on the follicle, not by weak hair fibers. No topical product prevents traction damage; the solution is styling modification (looser styles, alternating tension points). The heat-styled looks and thermal protection connection is valid (see 2.4 review). The observation about protective styles needing scalp-focused care is an insightful and underserved niche -- people wearing wraps, locs, or wigs do have different scalp-care access patterns, and lightweight scalp oils or sprays are more practical than traditional shampoo for these styles. This is a genuinely useful differentiation that most quizzes miss. The 11-option multi-select is comprehensive but quite long. Some options overlap with heat tool usage (2.4), creating redundancy. **Signal strength: MEDIUM.** The most valuable signals here are: (1) protective/low-manipulation styles (shifts focus to scalp care), (2) extensions/wigs (specific care needs and potential traction concerns), and (3) heat-created styles (redundant with 2.4). Most other options have marginal incremental value. **Note for Hair Concierge:** Selectively adapt. The protective-style and extensions signals are the most uniquely valuable. For traction concerns, recommend style modifications rather than products. Consider a shorter version focusing on the most actionable distinctions. Redundancy with 2.4 (heat tools) should be resolved.

### 2.6 Hold Level
- **URL:** `/my-treatments/hold-level`
- **Question:** "What level of hold do you prefer when styling?"
- **UI:** Single-select cards
- **Options:**
  1. None — I don't need hold!
  2. Light — For minimal hold
  3. Medium* — Next-level hold
  4. Strong* — Our maximal hold level
  5. Not Sure — We'll give suggestions based on your hair needs
- **Note:** "*These product features are specific to our Styling Gel"
- **Recommendation relevance:** Directly determines which styling products are recommended and their formulation strength. Also helps Prose decide whether to include a styling gel in the routine at all.
- **Expert review:** This is a straightforward preference question with clear product implications. Hold level is a genuine product selection variable -- the amount and type of hold polymers (VP/VA copolymer, PVP, polyquaternium compounds, etc.) in styling products varies significantly between "light hold" and "strong hold" formulations. The note that medium and strong hold are "specific to our Styling Gel" reveals this question's primary commercial function: it determines whether Prose includes their styling gel in the recommendation (and thus the cart). The "Not Sure" option with fallback to hair-needs-based suggestions is good UX design. This question is purely about user preference and styling product selection -- it does not involve any scientific or formulation claims that need verification. The only concern is that hold preference may vary by occasion (light hold for casual days, strong hold for events), and a single answer may not capture this. **Signal strength: MEDIUM.** Directly drives styling product selection and inclusion/exclusion from the recommended routine. However, it only affects one product category (styling) and has no impact on cleansing, conditioning, or treatment recommendations. **Note for Hair Concierge:** Include if we recommend styling products. This is a clear, easy-to-answer preference question with direct product implications. Consider framing it in context of hair type (e.g., fine hair may need lighter hold to avoid weighing down, curly hair may need stronger hold for definition).

### 2.7 Routine Preference
- **URL:** `/my-treatments/routine`
- **Question:** "What describes your ideal hair routine?"
- **UI:** Single-select cards
- **Options:**
  1. Streamlined & minimal
  2. More than basic, but nothing fancy
  3. Long & luxurious
- **Prose "Why we ask":** "We'll make sure your custom routine has the number of products and steps you actually enjoy doing every day—nothing more and nothing less."
- **Recommendation relevance:** Controls the number of products recommended. Minimal = shampoo + conditioner only. Mid = adds a treatment or styling product. Luxurious = full routine with masks, serums, oils, supplements. This is a business-critical question — it directly affects cart size and conversion.
- **Expert review:** This is refreshingly honest in the audit's assessment: "This is a business-critical question -- it directly affects cart size and conversion." The question has no scientific basis -- there is no evidence that a "long & luxurious" routine produces better hair outcomes than a well-chosen minimal one. In many cases, over-layering products causes buildup, ingredient interactions, and actually worsens hair condition. The question is purely about user preference, time investment, and willingness to purchase multiple products. That said, it is excellent UX and commercial design. By asking the user's preference upfront, Prose avoids recommending 7 products to someone who will only use 2 (leading to frustration and churn) or under-recommending to someone who enjoys an elaborate routine (missing revenue and satisfaction). The framing also manages expectations. The three tiers map cleanly to product bundle sizes. **Signal strength: LOW for hair health. HIGH for UX and commercial outcomes.** This question does not improve product-ingredient matching at all, but it dramatically improves recommendation acceptance and cart relevance. **Note for Hair Concierge:** Highly recommended to adapt -- not for formulation logic but for recommendation framing. Use it to control how many products and steps we suggest. Frame it positively ("Wie ausfuhrlich soll deine Routine sein?"). This is one of the best predictors of whether users will actually follow through on recommendations.

---

## Section 3: Lifestyle — "How you live" (8 questions + sign-in)

### 3.1 Section Intro
- Full-screen hero: "How you live"
- "Your hair lives with you day-in and day-out, and is affected by your actual environment and routine."

### 3.2 Age
- **URL:** `/my-lifestyle/age`
- **Question:** "How old are you?"
- **Subtitle:** "This helps us give the right support, at every stage."
- **UI:** Single-select cards
- **Options:** Under 30, In my 30s, In my 40s, In my 50s, In my 60s, 70 or over
- **Recommendation relevance:** Hair changes with age — thinning, graying, dryness, slower growth. Age determines the strength of anti-aging ingredients, whether volumizing formulas are prioritized (older = more thinning), and supplement formulation. Also a legal gate — products not intended for under-18.
- **Expert review:** The general claim that hair changes with age is well supported. Dermatological evidence confirms: hair shaft diameter peaks in the 4th decade for women (2nd for men) and then progressively decreases; anagen phase shortens with age; density decreases; sebum production declines; and graying progresses. By age 50, roughly 50% of women experience noticeable thinning. However, the specific claims deserve scrutiny. "Anti-aging ingredients" for hair is marketing language -- there are no topical ingredients with robust evidence for reversing age-related hair changes. Minoxidil (a drug) can address thinning but is not typically in cosmetic quiz-recommended products. Volumizing formulas for older users is a reasonable default but may not match individual needs (some older users have thick, coarse hair). The age-thinning correlation is a population-level trend, not an individual predictor. The legal gate point is valid -- age collection is necessary for responsible supplement or treatment recommendations, particularly for under-18 and pregnant/breastfeeding populations. The decade-bucket approach is appropriate for this purpose. **Signal strength: MEDIUM.** Age is a broad contextual variable. It correlates with many hair changes but does not directly determine formulation needs as precisely as texture, thickness, or scalp condition do. The direct questions about those specific conditions are more informative than age as a proxy. **Note for Hair Concierge:** Worth collecting for context, legal gating, and supplement safety. However, do not use age as a primary driver of hair product recommendations -- the specific hair property questions (thickness, density, gray percentage, scalp condition) are better signals. Age is most useful for: (1) legal compliance, (2) supplement safety gating, and (3) educational content personalization.

### 3.3 Hormonal Status
- **URL:** `/my-lifestyle/hormones`
- **Question:** "Are you currently..."
- **Subtitle:** "Select all that apply"
- **UI:** **Multi-select** + Next button
- **Options:**
  1. Pregnant*
  2. Post-pregnancy (delivered in the last 12 months)
  3. Breastfeeding*
  4. Experiencing menopause
  5. None of the above
- **Note:** "*Please check with your doctor before starting supplements"
- **Recommendation relevance:** Major hormonal events directly affect hair growth cycles. Pregnancy = extended growth phase (fuller hair). Post-pregnancy = telogen effluvium (shedding). Menopause = thinning + dryness from estrogen decline. Also a safety gate — certain ingredients must be excluded during pregnancy/breastfeeding, especially in supplements.
- **Expert review:** The hormonal-hair cycle claims are well supported by dermatological literature. During pregnancy, elevated estrogen extends the anagen phase, resulting in thicker, fuller-appearing hair and reduced shedding. Post-partum, the synchronized shift to telogen creates noticeable shedding (telogen effluvium) typically 2-4 months after delivery, affecting about 30% of hairs vs. the normal 10%. Menopause is associated with decreased hair density, diameter, and growth rate due to declining estrogen and relative androgen excess. These are well-established mechanisms in dermatology. The safety gate function is critically important and correctly identified. During pregnancy and breastfeeding, certain ingredients must be avoided -- retinoids, certain essential oils (rosemary, sage, juniper in high concentrations), salicylic acid at high concentrations, and many supplement ingredients (high-dose vitamin A, certain herbs). This is not just a recommendation refinement; it is a patient safety concern. Prose's asterisk note ("Please check with your doctor before starting supplements") is responsible but minimal. A more cautious approach would be to exclude supplement recommendations entirely for pregnant/breastfeeding users. **Signal strength: HIGH.** This is a dual-purpose question: (1) a genuine safety gate for ingredient exclusions, and (2) a meaningful predictor of current hair condition (shedding, texture changes). Both functions are well supported by evidence. **Note for Hair Concierge:** Essential question for any app that recommends products. The safety gate function is non-negotiable -- pregnant/breastfeeding users must receive filtered recommendations. For menopause, use it to contextualize thinning/dryness concerns and adjust moisture/volume recommendations. Consider stronger safety language than Prose uses for pregnancy.

### 3.4 Diet
- **URL:** `/my-lifestyle/diet`
- **Question:** "What makes up the majority of your diet?"
- **Subtitle:** "Select all that apply"
- **UI:** **Multi-select** chips in 2-column grid + Next button
- **Options:** Meat, Fish/Seafood, Vegetables, Fruits, Dairy, Processed or fast food, Carbs/Starches, Sweets
- **Prose "Why we ask":** "What you eat literally powers your hair growth and scalp balance."
- **Recommendation relevance:** Primarily drives supplement formulation. Low protein intake = add biotin and amino acids. No fish/seafood = supplement omega-3s. Heavy processed food = add antioxidants. Also affects topical formulation — nutritional deficiencies show up in hair quality (dull, brittle, slow-growing).
- **Expert review:** The connection between nutrition and hair health exists but is significantly overclaimed in this recommendation logic. Let's examine each claim: (1) "Low protein intake = add biotin and amino acids" -- biotin supplementation has no demonstrated benefit for hair in non-deficient individuals. A 2024 systematic review found no difference between biotin and placebo in the highest-quality trial. The claim is not supported by evidence for the general population. Protein deficiency does affect hair (kwashiorkor-associated hair changes are well documented), but this is relevant to severe malnutrition, not to someone who eats less meat. (2) "No fish/seafood = supplement omega-3s" -- omega-3 supplementation for hair has limited evidence. A few small studies suggest possible benefits, but there is no strong consensus. (3) "Heavy processed food = add antioxidants" -- the link between processed food and hair quality is plausible but not established with specific supplement interventions. (4) "Nutritional deficiencies show up in hair quality" -- this is true for severe deficiencies (iron, zinc, protein, vitamin D) but the relationship between moderate dietary patterns and topical hair product needs is not established. A multi-select diet checklist cannot diagnose deficiencies. The fundamental problem: this question is designed to drive supplement sales, not topical product formulation. No published evidence supports changing a shampoo formula based on whether someone eats fish. **Signal strength: LOW for topical product recommendations. LOW-MEDIUM for supplement context.** The diet question does not meaningfully change which shampoo, conditioner, or styling product someone needs. For supplements, the evidence is weak enough that specific claims should be avoided. **Note for Hair Concierge:** Do not use for topical product recommendations. If we ever offer supplement guidance, this would be relevant context -- but only as a prompt to consult a healthcare provider about potential deficiencies, not as a basis for specific supplement claims. The question is better suited to a health app than a hair product concierge.

### 3.5 Water Intake
- **URL:** `/my-lifestyle/hydration`
- **Question:** "How much water do you drink daily?"
- **UI:** Single-select cards
- **Options:**
  1. Less than 3 glasses (24 oz)
  2. 4-6 glasses (up to 48 oz)
  3. 7-8 glasses (up to 64 oz)
  4. Even more
- **Fun fact:** "Hair is 10% water!"
- **Recommendation relevance:** Dehydration affects hair elasticity and strength. Low water intake may trigger extra humectant ingredients in formulas and stronger hydration recommendations. Primarily affects supplement formulation and may influence conditioning intensity.
- **Expert review:** The evidence for this claim is extremely weak. While hair does contain water (~10-15%, not the "10%" cited in Prose's fun fact, which is at the low end), and severe dehydration theoretically affects all tissues, there is no published clinical evidence that self-reported water intake predicts hair quality or that it should drive topical formulation decisions. A systematic review on water intake and skin hydration found "weak evidence in terms of quantity and methodological quality," and skin (which receives direct blood supply) is a more plausible target than hair (which is a dead keratinized fiber that receives no blood supply once emerged from the follicle). The hair shaft's moisture content is determined primarily by humidity, porosity, and product application -- not by how many glasses of water the user drank. The idea that "low water intake triggers extra humectant ingredients in formulas" is not supported by any evidence -- humectant efficacy depends on environmental humidity and hair porosity, not the user's hydration status. This question appears designed to create an impression of holistic, whole-body care rather than to drive meaningful formulation decisions. The "Hair is 10% water!" fun fact is engagement content, not science. **Signal strength: LOW.** No evidence supports using self-reported water intake to modify hair product recommendations. **Note for Hair Concierge:** Do not include. This question adds quiz length without adding recommendation signal. It risks making the app appear pseudo-scientific. If general wellness content is desired, it could appear in educational articles, not in the recommendation logic.

### 3.6 Odor Retention
- **URL:** `/my-lifestyle/smoke-exposure`
- **Question:** "Does your hair retain noticeable odors from food or smoke?"
- **UI:** Single-select cards
- **Options:** Never noticed, Yes sometimes, All the time
- **Recommendation relevance:** Primarily drives fragrance recommendations — if hair retains odors, Prose steers toward stronger fragrances. Hair porosity correlates with odor retention (more porous = more absorption). May also influence cleansing recommendations.
- **Expert review:** The porosity-odor correlation is directionally supported by the science. Higher-porosity hair (damaged, chemically treated, or naturally porous cuticle) does absorb and retain volatile organic compounds (VOCs) more readily than low-porosity hair with an intact cuticle layer. A peer-reviewed study confirmed hair acts as a retention matrix for VOCs. However, the recommendation logic ("steer toward stronger fragrances") is questionable. If the user's problem is that their hair retains unwanted odors, adding a stronger fragrance does not solve the underlying porosity issue -- it just layers a fragrance on top of the retained odor. A more evidence-based response would be to address porosity (cuticle-sealing treatments, acidic rinses) and recommend more frequent gentle cleansing. Additionally, this question is primarily a porosity proxy -- but Prose does not ask about porosity directly. The odor retention question captures one consequence of porosity without addressing the root variable. The cleansing recommendation connection is reasonable (more frequent washing helps manage odor retention). The main function of this question appears to be engagement/relatability (many users notice this issue) and fragrance upselling. **Signal strength: LOW.** The question indirectly captures porosity information, but the primary action it drives (fragrance strength) is a preference, not a formulation need. The porosity signal is better captured through other questions (damage level, chemical treatments). **Note for Hair Concierge:** Low priority. If porosity assessment is desired, ask about it more directly or infer it from damage/treatment history. Odor retention is a relatable concern but does not drive product formulation in a meaningful way.

### 3.7 Stress Frequency
- **URL:** `/my-lifestyle/stress`
- **Question:** "How often are you stressed out?"
- **Subtitle:** "We're interested in the frequency, not the intensity."
- **UI:** Single-select cards
- **Options:** Rarely, Maybe once a week, Multiple times a week, Every day
- **Prose "Why we ask":** "Emotional stress can weaken hair."
- **Recommendation relevance:** Chronic stress increases cortisol, which disrupts hair growth cycles (telogen effluvium), increases scalp inflammation, and can worsen sebum production. High stress → adaptogenic and stress-mitigating ingredients in supplements (ashwagandha, B vitamins), plus scalp-soothing topicals.
- **Expert review:** The stress-hair loss connection is well supported by dermatological evidence. Chronic psychological stress activates the HPA axis, elevating cortisol, which can suppress hair follicle stem cells and trigger a premature shift from anagen to telogen phase. The 2025 JAAD review confirms the role of stress in telogen effluvium pathogenesis. However, the product recommendation logic breaks down significantly. (1) "Adaptogenic ingredients (ashwagandha)" for hair -- clinical evidence for ashwagandha's effect on hair is limited to one small 75-day topical study. Oral ashwagandha has evidence for stress/cortisol reduction but not specifically for hair outcomes. (2) "B vitamins" for stress-related hair loss -- B-vitamin supplementation is only supported when a deficiency exists. (3) "Scalp-soothing topicals" for stress -- while scalp inflammation can co-occur with stress, the idea that topical soothing products address the cortisol pathway is not supported. They may provide symptomatic relief for stress-exacerbated scalp conditions, but they do not treat stress-related hair loss. The fundamental issue: stress-related hair loss is a systemic problem requiring stress management, not a topical product. A hair product quiz cannot meaningfully address chronic stress. This question primarily serves: (a) supplement upselling, (b) engagement/empathy building, and (c) creating a perception of holistic care. **Signal strength: LOW for topical product recommendations. LOW for supplement recommendations (evidence is weak).** **Note for Hair Concierge:** Do not use to drive product recommendations. If included, use for empathetic context and educational content ("Stress kann sich auf dein Haar auswirken -- hier erfaehrst du mehr"). Consider providing stress-management resources rather than product claims. Honest acknowledgment without product overclaim builds more trust.

### 3.8 Exercise/Workout
- **URL:** `/my-lifestyle/sports`
- **Question:** "In an average week, where do you workout?"
- **Subtitle:** "Select all that apply, considering your life over the next 2 months."
- **UI:** **Multi-select** + Next button
- **Options:**
  1. I don't exercise often
  2. Indoors
  3. Outdoors
  4. Swimming Pool
  5. Ocean
  6. I work out, but not in these spaces
- **Recommendation relevance:** Sweat frequency affects scalp oil/pH balance and wash frequency needs. Swimming pool = chlorine exposure (needs chelating/clarifying ingredients). Ocean = salt exposure (drying). Outdoor = UV exposure (needs UV filters). Indoor = minimal environmental impact.
- **Expert review:** This is one of the better-designed lifestyle questions because it maps to specific, actionable product recommendations with reasonable evidence. Swimming pool / chlorine exposure: chlorine damages hair cuticle, strips color, and causes dryness. Chelating shampoos (containing EDTA or phytic acid) and clarifying treatments are well-established responses. This is a genuinely useful signal. Ocean / salt exposure: salt water is hygroscopic and dehydrating to hair; it can cause dryness and brittleness. Extra conditioning and protective products are appropriate. Outdoor exercise: UV exposure does cause measurable oxidative damage to hair proteins and lipids. UV-filtering ingredients in hair products have some evidence for protective benefit. The sweat-scalp connection is also valid -- sweat combined with sebum creates an environment that can promote scalp issues if not managed with appropriate cleansing. However, the claim that sweat "affects scalp pH balance" is slightly overstated; sweat is mildly acidic (pH 4.5-6.2 when mixed with sebum) which is within the normal scalp range. The main concern with sweat is buildup, not pH disruption. "Indoor = minimal environmental impact" is an appropriate null case. **Signal strength: MEDIUM-HIGH.** The swimming and outdoor signals produce genuinely different product needs (chelating products, UV protection, extra conditioning). The sweat/wash frequency connection is a useful practical signal. **Note for Hair Concierge:** Worth adapting, particularly the swimming pool and outdoor exercise signals. These map to specific, evidence-supported product recommendations (chelating shampoo, UV protection). Consider simplifying to focus on the highest-signal activities: swimming in chlorinated water and regular outdoor exposure.

### 3.9 Location (Zip Code)
- **URL:** `/my-lifestyle/zipcode`
- **Question:** "Where will you be spending most of your time in the next 2 months?"
- **UI:** Country dropdown (US/Canada) + Zip Code text input
- **Recommendation relevance:** This is Prose's signature differentiator. Zip code feeds into their geo-environmental data engine to determine local UV intensity, pollution levels, water hardness, humidity, and wind exposure — all of which affect formulation.
- **Expert review:** The environmental factors cited are all supported by evidence to varying degrees. UV radiation causes oxidative damage to hair proteins and lipids (well supported). Air pollution (particulate matter, PAHs) damages the cuticle and cortex and is associated with scalp inflammation (growing evidence base). Water hardness causes mineral buildup that weakens cuticle and blocks moisture penetration (well supported). Humidity affects frizz and product behavior, particularly for humectant-based formulations like glycerin (well supported in cosmetic science). Wind causes mechanical weathering (minor factor, well established but low impact). However, the claim that Prose "adjusts formulation" based on these factors deserves serious scrutiny. Cosmetic chemists have pointed out that "shampoo actually comes in roughly four formulas from a chemistry standpoint" and that the personalization space is far more constrained than marketing suggests. While it is plausible that Prose adjusts some parameters (e.g., including chelating agents for hard-water regions, adjusting humectant levels for humid vs. dry climates), the idea of hyper-personalized geo-environmental formulation at scale is likely overstated. A more honest framing would be: location data helps select from a set of formula variants, not create a truly unique formula. The zip code is also a significant data collection point that serves targeting and marketing purposes beyond formulation. **Signal strength: MEDIUM.** The underlying environmental signals are real and evidence-supported, but the degree to which a cosmetic product can meaningfully "adjust" to them is limited. Water hardness and humidity are the highest-signal environmental factors. **Note for Hair Concierge:** The concept of location-aware recommendations is strong and differentiating, but be honest about what it can do. Water hardness data (available for German postcodes) is the most actionable signal -- recommend chelating/clarifying products for hard-water areas. Humidity data can inform humectant vs. anti-humectant guidance. UV and pollution are valid but secondary for product recommendations. Avoid implying formula-level personalization if we are recommending existing products.

### 3.10 Environmental Data (Informational)
- **URL:** `/my-lifestyle/geo-aggressors`
- **Title:** "Here's what affects your hair in [City]."
- **Displays 5 metrics on 0-100 scales:**
  - UV Rays
  - Pollution
  - Water Hardness
  - Humidity
  - Wind
- **Recommendation relevance:** Not a question — this is a transparency page showing the user what environmental data Prose uses. High UV → UV-filter ingredients. High pollution → antioxidant actives. Hard water → chelating agents. High humidity → anti-humectants/frizz control. High wind → strengthening ingredients. This builds trust and justifies the custom approach.
- **Expert review:** As a UX element, this is excellent -- showing the user their environmental data builds trust, creates a sense of sophistication, and justifies the price premium. The specific factor-to-ingredient mappings vary in evidence quality: (1) Hard water -> chelating agents: well supported. EDTA and phytic acid effectively bind mineral deposits. This is the most actionable and evidence-based mapping. (2) High humidity -> anti-humectants/frizz control: well supported by cosmetic science. In high humidity, strong humectants like glycerin can cause hygral fatigue and frizz by pulling excess moisture into the hair shaft. Anti-humectant formulations are a real and meaningful adjustment. (3) High UV -> UV-filter ingredients: supported but implementation varies. Some hair UV filters have evidence (benzophenone-4, ethylhexyl methoxycinnamate), though hair UV protection is less regulated and studied than skin UV protection. (4) High pollution -> antioxidant actives: plausible but less specific. Which antioxidants, at what concentrations, in what delivery system? The evidence for specific anti-pollution hair product efficacy is still emerging. (5) High wind -> "strengthening ingredients": weakly supported. Wind causes mechanical weathering but it is a minor factor compared to chemical/thermal damage, and the concept that a product ingredient "strengthens" against wind is vague. The 0-100 scale presentation creates an impression of quantitative precision that may exceed the actual resolution of the underlying data or formulation response. **Signal strength: N/A (informational page, not a question).** As a trust-building and engagement element, it is highly effective. **Note for Hair Concierge:** Strongly consider adapting this concept. Showing users location-specific data (especially Wasserhaerte/water hardness, which varies significantly across German regions) is a powerful differentiator and trust builder. Keep the presentation honest -- show 2-3 high-confidence factors rather than 5 factors of mixed evidence quality.

---

## Sign-in Gate (between Lifestyle and Preferences)

- **URL:** `/consultation/haircare/signin`
- **Heading:** "60% off + your free gift is just a few questions away…"
- **Fields:** First name, Last name, Email address
- **Purpose:** Email capture for lead generation, placed at ~75% completion to maximize sunk-cost commitment

---

## Section 4: Preferences & Goals — "How you like it" (4 pages)

### 4.1 Section Intro
- Full-screen hero: "How you like it"
- "Last step! Tell us your hair goals and formula preferences."

### 4.2 Ingredient Preferences
- **URL:** `/my-preferences/exceptions`
- **Question:** "Any specific haircare ingredient preferences?"
- **Subtitle:** "All Prose products are already free of parabens, mineral oils, sulfates, GMOs, and animal cruelty."
- **UI:** **Multi-select** + Next button
- **Options:**
  1. Vegan
  2. Silicone-free
  3. No Thanks
- **Extra:** Educational modal explaining what silicone does
- **Recommendation relevance:** Direct formulation constraint. Vegan = no animal-derived ingredients (keratin, honey, silk proteins replaced with plant alternatives). Silicone-free = replace dimethicone etc. with plant-based smoothing agents. These are exclusion filters applied on top of the personalized formula.
- **Expert review:** The framing as "exclusion filters" is accurate and well-designed from a system architecture perspective. These preferences impose hard constraints on ingredient selection without changing the underlying recommendation logic. The vegan constraint is straightforward -- animal-derived ingredients (keratin from animal sources, lanolin, beeswax, honey, silk amino acids, collagen) have plant-based or synthetic alternatives. There is no performance penalty for most substitutions, though some practitioners argue animal-derived keratin has better affinity for human hair (limited evidence for this claim). The silicone-free option is more nuanced. Silicones (dimethicone, cyclomethicone, amodimethicone) are among the most effective conditioning agents in cosmetic science -- they provide slip, shine, heat protection, and frizz control with robust evidence. "Plant-based smoothing agents" are available alternatives (e.g., plant oils, fatty alcohols, cationic guar) but they generally perform differently, not equivalently. Users who prefer silicone-free should understand the tradeoff. Prose's educational modal on silicones is a responsible touch. Notably, the baseline exclusions (parabens, mineral oils, sulfates, GMOs, animal cruelty) reflect market expectations rather than safety evidence -- parabens and sulfates have strong safety records at cosmetic concentrations, and their exclusion is a marketing/consumer preference decision. **Signal strength: MEDIUM as a constraint filter. Not a formulation driver but a necessary user preference gate.** **Note for Hair Concierge:** Essential to include. Ingredient preferences are non-negotiable user constraints that must be respected. Implement as exclusion filters in the recommendation logic. For our app, consider adding more granular options relevant to the German market (e.g., Naturkosmetik-zertifiziert, which is more common in Germany than in the US). Be transparent about performance tradeoffs when users select silicone-free.

### 4.3 Fragrance
- **URL:** `/my-preferences/fragrance`
- **Question:** "What haircare fragrance would you like?"
- **UI:** Single-select cards with **fragrance swatch images**, split into "Recommended" and "Other"
- **Recommended Fragrances:**
  1. Glacia — Invigorating + Woody (Cypress, Fresh Citrus, Musk) *limited edition*
  2. Prelude — Floral + Fresh (Rose, Geranium, Blue Iris)
  3. Corsica — Fresh + Aquatic (Anjou Pear, Peony, Cedar Wood)
- **Other Fragrances:**
  4. Meleni — Fruity + Tropical (Mango, Melon, Lush Greens)
  5. Arcadia — Citrusy + Woody (Grapefruit, Basil, Cedar)
  6. Fragrance-Free
- **Extra:** "Need help deciding?" modal with team descriptions and subtle/strong scale
- **Recommendation relevance:** Pure preference — doesn't affect functional formulation. However, "Fragrance-Free" is recommended for sensitive scalps (cross-referenced from Section 1). Fragrance selection also increases emotional attachment to the product. The "recommended" categorization likely uses quiz answers to suggest scent families.
- **Expert review:** The audit's assessment is accurate -- fragrance is purely a preference variable with one important exception: the fragrance-free option for sensitive scalps is evidence-based and appropriately cross-referenced with scalp sensitivity (1.13). Fragrance allergy is a well-documented dermatological concern (1-4% prevalence in general population, up to 30% of cosmetic allergies in clinical settings). The observation about emotional attachment is commercially astute. Fragrance is one of the strongest drivers of product satisfaction and repurchase in consumer research -- people who love how their hair smells are more likely to continue using a product. The "recommended" fragrance sorting is likely a conversion optimization technique (reducing decision fatigue by pre-selecting options). One concern: the "limited edition" label on the first recommended fragrance is a scarcity/urgency sales tactic, not a recommendation based on quiz data. The question design is clean -- offering fragrance-free as an explicit option is better than burying it or requiring the user to ask for it. **Signal strength: LOW for product efficacy. HIGH for user satisfaction, retention, and the sensitive-scalp safety gate.** **Note for Hair Concierge:** Include fragrance preference if we recommend specific products with fragrance variants. The fragrance-free default for sensitive scalps should be implemented as a hard cross-reference with the sensitivity question. For our German market, note that German consumers tend to be more fragrance-averse than US consumers and more open to fragrance-free products, so the fragrance-free option may need more prominent placement.

### 4.4 Hair Goals
- **URL:** `/my-goals/goals`
- **Question:** "What are your hair goals?"
- **UI:** **Multi-select** cards in 2-column grid + Next button
- **Options:**
  1. More Volume
  2. More Shine
  3. More Smoothness
  4. More Curl Definition
  5. More hair growth † (supplements only)
  6. Less shedding † (supplements only)
- **Extra:** Tip modal explaining when each goal applies
- **Recommendation relevance:** The primary driver of the final formulation focus. Goals determine which active ingredients are prioritized — volumizing polymers, shine-enhancing oils, anti-frizz silicones/smoothers, curl-defining agents, or growth-stimulating actives. Goals marked with † steer toward supplement recommendations.
- **Expert review:** Goals as a "primary driver of final formulation focus" is a reasonable design choice, though it is important to understand what this actually means. The goals function as a priority-weighting layer on top of the hair-property data, not as a standalone formulation driver. Someone with fine straight hair who selects "More Volume" gets a different product than someone with thick curly hair who selects the same goal -- the goal modulates, it does not override. The specific ingredient-goal mappings are directionally correct: volumizing polymers (VP/VA copolymers, panthenol at high concentrations) do add volume; certain oils and silicones do enhance shine; anti-frizz/smoothing agents are a well-established product category; and curl-defining products (polyquaternium compounds, flaxseed-derived polymers) have evidence for improved curl formation. The supplement-specific goals ("More hair growth," "Less shedding") with the dagger notation are a responsible and transparent distinction -- Prose is correctly signaling that topical products cannot drive growth or prevent shedding, and that these goals require supplements or medical intervention. This is more honest than many competitors. However, the concept of "growth-stimulating actives" even in supplements is overclaimed for most ingredients at cosmetic concentrations (see reviews of 1.7 and 1.8). The multi-select format is appropriate since users often have multiple concurrent goals. **Signal strength: HIGH for product selection and recommendation framing.** Goals directly determine which product features and categories are prioritized. Combined with hair properties, they create the complete recommendation. **Note for Hair Concierge:** Essential question. Hair goals function as user-declared priorities that weight the recommendation output. Implement as a priority layer, not a standalone driver. The multi-select approach is correct. Consider limiting to 2-3 selections maximum to force prioritization, which produces more actionable recommendations. The supplement distinction is worth emulating -- be honest about what topical products can and cannot do.

---

## Results Page

- **URL:** `/results/scoring`
- **Title:** "[Name], your results are in!"
- **Displays 5 scoring dimensions (0-100):**
  - Sebum
  - Stressors
  - Dryness
  - Sensitivity
  - Damage
- **Note:** "Your formulas will reflect these exact needs."
- After scoring, leads to product recommendations page.

---

## UI Patterns Summary

| Pattern | Used For | Count |
|---------|----------|-------|
| Single-select cards | Most questions | ~18 |
| Multi-select + Next button | Products, styles, diet, etc. | ~7 |
| Multi-select chips (tag-style) | Products & tools page | 1 |
| Text input + dropdown | Zip code | 1 |
| Informational (no input) | Section intros, geo data, results | ~5 |
| Form fields | Sign-in (name + email) | 1 |

**Recurring UI elements:**
- "Why we ask" / "Did you know" / "Fun fact" expandable modals on most pages
- "More of a visual learner? Tap for pics" photo carousels on 3-4 pages
- Illustrations for texture, thickness, and density questions
- Back arrow (bottom-left) + Next/auto-advance on every page
- Progress bar with 4 labeled sections at top

---

## Hair Concierge — Decision Summary

### Coverage Comparison

| | Prose | Hair Concierge |
|---|---|---|
| Total quiz questions | ~25 | ~10 (quiz + onboarding) |
| Sections | 4 | 2 (quiz + onboarding) |
| Sign-in gate mid-flow | Yes (75%) | No |
| Section intro pages | 4 | 0 |

### Question-by-Question Mapping

| # | Prose Question | Signal | Our Decision | Our Coverage |
|---|---------------|--------|-------------|-------------|
| **Section 1: Hair & Scalp** | | | | |
| 1.1 | Hair Length | LOW | Skip as question; general dosage guidance instead | Not needed — **Ask Tom** |
| 1.2 | Hair Texture (10 types) | HIGH | Essential | `hair_texture` (4 types) |
| 1.3 | Oily/Dry Spectrum | MEDIUM | Our scalp_type is more precise | `scalp_type` |
| 1.4 | Split Ends | MEDIUM | Don't ask; add "Weniger Spliss" to goals | Goals list update needed |
| 1.5 | Thickness | HIGH | Essential | `thickness` |
| 1.6 | Density | MEDIUM | Useful refinement | `density` (onboarding) |
| 1.7 | Shedding | LOW | Skip — medical territory | Not needed |
| 1.8 | Genetic Hair Loss | LOW | Skip — medical territory | Not needed |
| 1.9 | Wash Frequency | HIGH | Essential, needed | **GAP — must add** |
| 1.10 | Oil Production Speed | MEDIUM | Redundant with scalp_type | `scalp_type` covers it |
| 1.11 | Scalp Oily/Dry | HIGH | Redundant with scalp_type | `scalp_type` covers it |
| 1.12 | Flakiness | MED-HIGH | Covered by scalp_condition | `scalp_condition` (dandruff/dry_flakes) |
| 1.13 | Scalp Sensitivity | HIGH | Covered by scalp_condition | `scalp_condition` (irritated) |
| 1.14 | Gray Hair % | MEDIUM | Skip for now | Not needed — **Ask Tom** |
| **Section 2: Treatments** | | | | |
| 2.1 | Section Intro | N/A | Skip — keep flow lean | Not needed |
| 2.2 | Color-Treated | HIGH | Essential | `chemical_treatment` |
| 2.3 | Textural Treatments | HIGH | Essential | `chemical_treatment` covers this |
| 2.4 | Products & Styling Tools | MED-HIGH | Adapt — ask routine with frequencies | **GAP — expand current_routine_products** |
| 2.5 | Hair Styles Worn | MEDIUM | Simplify to mechanical stress question | **GAP — add mechanical stress question** |
| 2.6 | Hold Level | MEDIUM | Skip — no styling products yet | Not needed |
| 2.7 | Routine Preference | LOW/UX | Skip — Tom's philosophy: always minimal | `routine_preference` exists but Tom overrides |
| **Section 3: Lifestyle** | | | | |
| 3.1 | Section Intro | N/A | Skip | Not needed |
| 3.2 | Age | MEDIUM | Skip | Not needed |
| 3.3 | Hormonal Status | HIGH (safety) | Skip — symptoms captured by other Qs | Not needed |
| 3.4 | Diet | LOW | Skip — supplement upsell | Not needed |
| 3.5 | Water Intake | LOW | Skip — supplement upsell | Not needed |
| 3.6 | Odor Retention | LOW | Skip | Not needed |
| 3.7 | Stress | LOW | Skip | Not needed |
| 3.8 | Exercise/Workout | MEDIUM | Skip — out of scope | Not needed |
| 3.9 | Zip Code / Location | MEDIUM | Skip — out of scope | Not needed |
| 3.10 | Environmental Data | N/A | Skip | Not needed |
| **Section 4: Preferences & Goals** | | | | |
| 4.1 | Section Intro | N/A | Skip | Not needed |
| 4.2 | Ingredient Preferences | MEDIUM | Skip for now | Not needed — **Ask Tom** |
| 4.3 | Fragrance | LOW | Skip | Not needed |
| 4.4 | Hair Goals | HIGH | Essential — adapt for our goal list | `goals` (needs update) |

### Score Card

| | Count |
|---|---|
| Prose questions we **already cover** | **12** (texture, thickness, oily/dry, scalp condition x2, density, chemical treatment x2, goals, routine products, desired volume, post-wash actions) |
| Prose questions we **will add** | **3** (wash frequency, mechanical stress, expanded routine w/ frequencies) |
| Prose questions we **skip intentionally** | **10** (length, shedding, genetic loss, oil speed, gray, hold, age, hormones, diet, water, odor, stress, exercise, zip, environment, fragrance) |
| Prose questions that are **Tom questions** | **3** (hair length needed?, gray hair needed?, ingredient filters in product table?) |

We cover 12 of Prose's 25 questions with ~10 questions — extracting the same signal with less than half the questions. The 10 we skip are mostly LOW-signal (supplement upsells, lifestyle marketing, engagement pages).

### Gaps to Close

1. **Add wash frequency question** — HIGH signal, easy to answer, directly actionable
2. **Add mechanical stress question** — simplified version of Prose's styles question
3. **Expand current routine** — add frequency inputs for shampoo, conditioner, heat tools
4. **Update goals list** — add "Weniger Spliss", drop supplement-related, brainstorm final set

### Questions for Tom

1. Do we need to ask for **hair length or hair style**?
2. Is **gray hair %** relevant for our recommendation logic?
3. Should we add **ingredient preference filters** (vegan, silicone-free) to the product table?

---

## Original Key Takeaways (Prose Flow Design)

1. **Prose asks ~25 questions** across 4 logical sections — a substantial quiz that takes 5-10 minutes
2. **Section 1 (Hair & Scalp) is the heaviest** with 14 questions — this is the core diagnostic data
3. **Multi-select is used for lifestyle/behavior questions**, single-select for physical properties
4. **Educational modals** ("Why we ask") on nearly every page build trust and reduce abandonment
5. **The sign-in gate at 75%** leverages sunk-cost psychology — users invested enough to continue
6. **Geo-environmental data** (zip code → UV/pollution/water/humidity/wind) is a unique differentiator
7. **Results are presented as 5 dimensions** (Sebum, Stressors, Dryness, Sensitivity, Damage) — a clear, simple summary of a complex profile
8. **Routine preference question** ("streamlined / medium / luxurious") directly controls upsell potential
9. **Supplement-specific goals** (growth, shedding) are clearly marked — transparent about what topicals can/can't do
10. **Visual aids** (illustrations, photo carousels) are used heavily for physical properties that are hard to self-assess
