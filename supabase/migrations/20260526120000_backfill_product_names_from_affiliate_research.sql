-- Backfill canonical product names + brands from affiliate-link research.
--
-- Source: docs/plans/2026-05-14-affiliate-research-name-changes.md
-- 42 rename rows + 1 soft-delete, accumulated across review Buckets A/B/C
-- during the 2026-05-14 to 2026-05-26 enrichment campaign.
--
-- These updates are display-only (name + brand) — the recommendation engine
-- uses product_oil_eligibility / product_conditioner_specs / etc. join tables
-- keyed on product_id, so renames don't affect what products surface.
--
-- Each statement is keyed on id (UUID), so the migration is idempotent: a
-- second run no-ops because the new values match the current values.
--
-- NOTE: products has a UNIQUE(name, category) constraint (added in
-- 20260316102000_allow_duplicate_product_names_across_categories.sql).
-- On a fresh / divergent environment where a target name already exists in
-- the same category from unrelated data, the matching UPDATE will fail.
-- If that happens during deploy: investigate the colliding row first; do
-- not blindly relax the constraint.

begin;

-- ──────────────────────────────────────────────────────────────────────────
-- Bucket A — Garnier line corrections (DB had Wahre Schätze ↔ Hair Food mix-ups)
-- ──────────────────────────────────────────────────────────────────────────

update products
  set name = 'Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung'
  where id = '5516009a-eecb-42dd-87f6-07c560161136';

update products
  set name = 'Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung'
  where id = '8c3eda97-5009-40bb-959b-1a7d90f48b09';

-- ──────────────────────────────────────────────────────────────────────────
-- Bucket A — typo/rename fixes
-- ──────────────────────────────────────────────────────────────────────────

-- "Haarkur" isn't a brand; product is Syoss
update products
  set brand = 'Syoss',
      name = 'Syoss Haarkur Lamination Intense Glaze'
  where id = 'cce6346c-8c92-4a17-b39b-cc7f300e84de';

-- Pantene Pro-V Volumen Pur (DE name uses "Volumen")
update products set name = 'Pantene Pro-V Volumen Pur'
  where id = '6fde3fe2-3850-4502-b9f2-ebb17eb13bad';

-- Cantu DM SKU name
update products set name = 'Cantu Shampoo Locken Pflege'
  where id = 'a1c3dc8d-2638-497f-8c7f-9b491c9003b0';

-- DM never sold "Ultra"; SKU is "Ultimate"
update products set name = 'Balea Professional Ultimate Volume'
  where id = 'd01de47e-e360-4b31-9924-e3e5bc31ccdc';

-- Official Sebamed name uses hyphen
update products set name = 'Sebamed Every-Day Shampoo'
  where id = 'e7bfd306-b128-4735-a9f8-0eeacdbd5013';

-- Aloe variant rebranded for DE market
update products set name = 'Head & Shoulders Derma X Pro Beruhigende Pflege'
  where id = '088b1427-ed22-424e-8cfd-ea2578120ae6';

-- Only Magique Serum on DM is the Midnight variant
update products set name = 'Elvital Öl Magique Midnight Serum'
  where id = '6b01025d-9e72-4514-b42e-bbb6065fbe1c';

-- Living Proof dropped "Instant" from the name
update products set name = 'Living Proof Restore Repair Leave-In'
  where id = '0756a919-5fab-4b6c-a5da-8cb810869b6f';

-- Brand typo: Acina → Alcina
update products set brand = 'Alcina', name = 'Alcina Hyaluron 2.0'
  where id = '9b664b11-fd11-47e3-9b7e-76e34736b43e';

-- Pantene Hydra Glow leave-in is the Milk-to-Water serum
update products set name = 'Pantene Miracles Milk-to-Water Leave-In Serum'
  where id = 'e781ca9e-886d-40a1-bfe1-48177cfbf381';

-- DM SKU name
update products set name = 'Balea Natural Beauty Pflegeöl Bio'
  where id = '4f373d4f-fef8-4434-91c7-055133d8427f';

-- Full DE SKU name
update products set name = 'Pantene Pro-V Miracles 7in1 Öl-Spray'
  where id = '5827a3b9-a488-4c74-b13a-4d655f94f1c3';

-- DE variant is sold as serum, not oil
update products set name = 'Garnier Fructis Sleek & Stay Heat-Activated Serum'
  where id = 'c574ee6f-ad22-45c0-b936-57b847d93433';

-- ──────────────────────────────────────────────────────────────────────────
-- Bucket B — brand-direct premium PDP renames
-- ──────────────────────────────────────────────────────────────────────────

update products
  set name = 'Urban Alchemy Repair & Revive Leave-In Spray'
  where id = '45f4fe15-c439-476d-8a86-3b2aac5053bd';

update products
  set name = 'Urban Alchemy Smooth Supreme Öl Serum'
  where id = '5ad6c978-fd27-469e-9f26-ff3f05b9f67a';

-- Brand rebranded the product from "Healing Oil" → "Treatment Oil" (same SKU)
update products
  set name = 'Innersense Harmonic Treatment Oil'
  where id = '7f5207e6-d281-416e-922c-3135dd9a8cc8';

-- ──────────────────────────────────────────────────────────────────────────
-- Bucket C Group 1 — generic ingredient Öle → canonical retailer SKUs
--
-- 16 rows where brand == name (e.g. "Calendulaöl"). Promoted to actual
-- retailer brand + full SKU name. Display-only change; recommendation
-- engine uses product_oil_eligibility join table for matching.
-- ──────────────────────────────────────────────────────────────────────────

update products set brand = 'Primavera', name = 'Primavera Calendulaöl Bio'
  where id = '1dce2c18-6a45-4017-a748-e3a7f1cba36f';

update products set brand = 'wesentlich.', name = 'wesentlich. Macadamianussöl kaltgepresst'
  where id = '19aea9c4-4b90-4ec4-8cb6-90cb270010f7';

update products set brand = 'Rapunzel', name = 'Rapunzel Bio Distelöl'
  where id = '29e36443-93ff-4b62-9cf0-55ad9f89f530';

update products set brand = 'nedura', name = 'nedura Schwarzkümmelöl ungefiltert'
  where id = '2ffeae68-c625-4df5-be02-0c1b620aa0fc';

update products set brand = 'MoriVeda', name = 'MoriVeda Premium Moringaöl'
  where id = '38886b62-2c45-4b34-9a24-7d831e97946e';

update products set brand = 'greenmade', name = 'greenmade Bio Rizinusöl'
  where id = '3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b';

update products set brand = 'KoRo', name = 'KoRo MCT Öl'
  where id = '3eb198a5-9aab-4f28-9df1-c4869c6a12db';

update products set brand = 'Dr. Scheller', name = 'Dr. Scheller Jojobaöl'
  where id = '4a95e1de-54e9-4fcd-b227-72a5824d13c1';

update products set brand = 'Ölmühle Solling', name = 'Ölmühle Solling Bio Traubenkernöl'
  where id = '517dca50-5d55-4038-ba1d-f9b745708327';

update products set brand = 'MARRAKESCH', name = 'MARRAKESCH Bio Arganöl'
  where id = '70ea52bc-2194-4bb3-82a8-3f4a2aede041';

-- Cacayöl: Amazon SKU has no clean brand; leave brand as ingredient placeholder
update products set name = 'Cacayöl kaltgepresst'
  where id = '78e6f1b2-7262-46af-b689-a92af6702739';

update products set brand = 'dmBio', name = 'dmBio natives Olivenöl extra'
  where id = '9bfe0a67-72ad-4951-bb99-9f2f5d5c724a';

update products set brand = 'Kräuterland', name = 'Kräuterland Bio Aprikosenkernöl'
  where id = 'a11855eb-64e5-438f-8880-1d3573efa9fa';

update products set brand = 'Rapunzel', name = 'Rapunzel Bio Kokosöl nativ'
  where id = 'acf9d5cd-76e4-49c7-9c04-0af1f20506ad';

update products set brand = 'Mynatura', name = 'Mynatura Bio Mandelöl'
  where id = 'ca4ae209-79d2-4f4d-8e44-46e586cec62d';

update products set brand = 'Kräuterland', name = 'Kräuterland Bio Avocadoöl'
  where id = 'ff13bc3a-8bc6-49df-85a0-7a67add26926';

-- ──────────────────────────────────────────────────────────────────────────
-- Bucket C Group 2 — DE-successor / closest-variant substitutions
-- ──────────────────────────────────────────────────────────────────────────

update products
  set name = 'Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege'
  where id = '4fd5f4c3-83b2-4893-be8c-ada29b8ca718';

update products
  set brand = 'Monday Haircare',
      name = 'Monday Haircare Volume Kraft & Fülle Shampoo'
  where id = '6dc65df2-2466-43e4-bdc2-3a05803f305c';

update products
  set name = 'Curlsmith Weightless Air Dry Cream'
  where id = '8715f0f5-9104-46ec-b450-e73f1441c1fa';

update products
  set brand = 'Wella Professionals',
      name = 'Wella Ultimate Repair Protective Leave-In'
  where id = '94cf6959-a53b-421b-9f0f-05efc239171c';

update products
  set name = 'Pantene Pro-V Miracles 7in1 Haaröl Spray'
  where id = 'f8f3b51d-8e64-487d-bad5-4a47c58862ed';

update products
  set brand = 'Bali Curls',
      name = 'Bali Curls Deep Repair Mask'
  where id = 'c4b9eaef-dfeb-41ea-9d28-9901660406b7';

update products
  set name = 'OGX Bond Protein Repair Conditioner'
  where id = '1bfa5b02-26d9-457b-a5e6-445cc2284490';

update products
  set brand = 'Shiseido Fino',
      name = 'Shiseido Fino Premium Touch Penetrating Hair Oil Essence'
  where id = '663acf09-7090-40d8-9411-71154b9d60f3';

-- ──────────────────────────────────────────────────────────────────────────
-- Soft-delete: row has no viable SKU (Maria Nila True Soft line has no Leave-In)
-- ──────────────────────────────────────────────────────────────────────────

update products
  set is_active = false
  where id = '3c769f60-283f-48c3-9549-cf84b73115d7';

commit;
