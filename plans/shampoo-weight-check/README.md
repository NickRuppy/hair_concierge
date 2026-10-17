# Shampoo weight check — Nick ruling, 2026-10-13

Settled contract: scalp cells show a real T7 weight/Haardicke check; R19 keeps verdict, fit steps and ranking independent of that row. Balanced cells retain existing behavior. Exact German copy follows the handoff `weight-ruling.md`; no open product decisions.

T7: fine accepts light; normal accepts light/moderate; coarse accepts heavy. Scalp-only copy:

- Fits: ✓ `Entspricht deinem Bedarf.`
- Lighter than needed: ! `Eher leicht für dein Haar. Nur auf die Kopfhaut auftragen, Längen mit Conditioner pflegen.`
- Heavier than needed: ! `Eher reichhaltig für dein Haar. Nur auf die Kopfhaut auftragen, Längen mit Conditioner pflegen.`
- Unknown weight/thickness: ? `Noch nicht geprüft.`

Verification and file inventory: [verification.md](verification.md).

Source: `data/research/shampoo-inci/v1.6-track-a/run-2-v1.6.2/kit-W{1,2,3,4}/blind-mapping.json` and each mapped `lane-a/out/<blindId>.json`, `lane-b/out/<blindId>.json`. `plans/shampoo-v16-rollout/track-a/consolidate_run2.py` merges shared contextual rows using **max weight** (`light < moderate < heavy`), the same merge consumed by `build_apply.py`. Every merged row of each product has the same weight; no single-lane values were used. Names come from the corresponding `data/research/shampoo-inci/v1.6-track-a/packets/*.json`.

Membership: exactly the 73 product IDs in `plans/shampoo-v16-rollout/track-a/apply/apply-plan.json` → `target`, plus A50 Sebamed Anti Schuppen Plus (`7e95671b-41a7-4f5c-9188-e535e46678ba`, merged **light**). A50's role/bucket hold does not block storing its product weight; this migration changes no roles or buckets.

Storage follows the existing category spec-column pattern (Leave-in/Mask `weight`, Shampoo nullable route/intensity additions): nullable `public.product_shampoo_specs.weight`, repeated identically across a product's contextual rows. The loader derives one product-level weight from the full row set; inconsistent, absent or invalid data stays unknown. No new table or policy. Unresearched spec rows remain NULL. Migration is atomic, locks before validating target products and specs, and asserts all 74 products, every affected row, and weight totals.

Counts: **41 light, 30 moderate, 3 heavy** (74 products). Track A alone: **40 light, 30 moderate, 3 heavy** (73).

| Slot | Product ID | Name | Weight |
| --- | --- | --- | --- |
| A01 | b000d235-1fc6-434c-9ba1-f1207d36cded | Balea 2 in 1 Urea 5% | light |
| A02 | ead1333b-6839-464d-b272-673d39bb95a4 | Balea PROFESSIONAL Shampoo Aqua Hyaluron | light |
| A03 | eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d | Balea PROFESSIONAL Shampoo Kopfhaut Sensitive | light |
| A04 | 1311e51c-7941-4d2c-b9b4-7a450ee37f15 | Balea Professional Shampoo Hydra Volume, 250 ml | light |
| A05 | a79513be-e34b-4a1e-b7eb-b3d4b58160be | Balea Ultra Sensitive | light |
| A06 | f184aef4-d8f9-4956-bcd6-ba1bf1ebeace | Balea Med Anti Schuppen | light |
| A07 | 4a45948b-53a6-48ac-9c02-20718c1d19c4 | Being Big Hair Shampoo | moderate |
| A08 | 1f51a69f-c946-4898-9091-2fd2c59fb467 | Dejan Garz The Foundation Shampoo | moderate |
| A09 | 0017381a-84ba-46dd-9b6e-7ef457e8b5b4 | Garnier Wahre Schätze Shampoo Honig Schätze | light |
| A10 | cd7461cc-7fde-40dd-8d39-fca1aa8f30bf | Guhl Frische und Leichtigkeit | light |
| A11 | 02afbd03-1c7d-467c-8a07-a8b226d6f535 | Guhl Kopfhaut Sensitive | light |
| A12 | 9bfad335-a086-45a0-9af7-f26b36b4ecff | Guhl Kraft & Fülle Shampoo | light |
| A13 | a06cfc4d-c4f5-457e-a94e-26559f96f0e9 | hair biology Shampoo Revitalize & Soothe | moderate |
| A14 | c07a181b-3d55-4d47-ad68-9c1e324d4496 | Hask Curl Care Shampoo | moderate |
| A15b | 17b6d50e-ca5b-4f66-bdd7-39bd19afe748 | Hask Repair + Argan Oil Shampoo | moderate |
| A16 | 716a4f4e-6ba4-4742-a1cf-75e90ae1da3f | Head & Shoulders Anti Schuppen Sensitive | light |
| A17 | d408aca9-cd16-4cb0-90e7-bab26a698000 | Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege | moderate |
| A18 | 2e887538-3b92-4344-9bbd-1761383ba4a6 | Herbal Essences Shampoo Fiji | light |
| A19 | a836ef4f-f406-4557-b908-0155919e2c4f | ISANA MED Shampoo Anti Schuppen, 200 ml | light |
| A20 | a1451c9b-fb55-406d-a81f-c513cc4ddcdf | ISANA MED Shampoo Jeden Tag | light |
| A21 | 8a90f0fa-9cb1-458a-93f3-c2374e6d8f16 | ISANA MED Shampoo Totes Meer, 200 ml | moderate |
| A22 | 94829f16-b21d-4061-9dcc-cbd43dcb4274 | ISANA MED Shampoo pH 5,5 hautneutral | light |
| A23 | 34697aec-761c-45e7-9a92-986f786dd022 | ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo, 200 ml | light |
| A24 | 86f44889-b2c9-40a1-9190-58d7f738b6ca | ISANA Shampoo Sensitiv Baumwoll- & Kornblume | light |
| A25 | 88c230c5-1020-4648-a10e-c2a1e8c87e0e | Ultimate Shampoo | light |
| A26 | cc9318d2-13af-4c83-8b5e-7effb687c92f | L'Oréal Paris Elvital Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo | moderate |
| A27 | 1623a993-3ff4-43be-82c1-95a1ee57ec52 | LANGHAARMÄDCHEN Shampoo Beautiful Curls | light |
| A28 | e76e0ed4-bd20-40cd-84ae-e93030610d40 | LANGHAARMÄDCHEN Shampoo Lovely Long, 300 ml | moderate |
| A29 | 6dc65df2-2466-43e4-bdc2-3a05803f305c | Monday Haircare Volume Kraft & Fülle Shampoo | moderate |
| A30 | a7ff335a-7e81-4cf4-9c20-9209bff4386b | Neqi Moisture Mystery | light |
| A31 | 64fb44d5-8701-46ab-bcba-f1747f071e48 | Neqi Volume Victory | light |
| A32 | eb99d805-20d4-4dbb-9651-17c9e954a769 | NIVEA Power Repair Reparatur Shampoo | moderate |
| A33 | f033afbe-281a-419e-a245-3ad83d721bd0 | NIVEA 2in1 Express Shampoo & Spülung, 400 ml | moderate |
| A34 | 3f3c7d89-9e7b-4e91-85f7-d3c58d304918 | OGX Biotin & Collagen Shampoo | moderate |
| A35 | 2ecd3c9d-90f6-45a3-a72c-daefed50be10 | OGX Renewing + Argan Oil of Morocco Shampoo | heavy |
| A36 | 7b5ec424-d21f-4eb8-999e-7aed98e94b86 | OGX Rosemary Mint Shampoo | moderate |
| A37 | 5effc311-25d7-44dd-8c16-b93c182068d3 | PANTENE PRO-V Shampoo Anti Schuppen Active Nutri-Plex | moderate |
| A38 | fcbc469f-93c8-4be5-85db-e789b09189c7 | PANTENE PRO-V Shampoo miracles Hydra Glow, 250 ml | moderate |
| A39 | 6fde3fe2-3850-4502-b9f2-ebb17eb13bad | Pantene Pro-V Volumen Pur Shampoo | light |
| A40 | 1ef2be82-259c-4a1f-af2e-3ac3403f9731 | Salthouse Anti Juckreiz | light |
| A41 | 261e5c9f-d312-4206-82da-fbd0ab6f3614 | Salthouse Anti Schuppen | light |
| A42 | 57bae8c8-0ebd-4722-b955-c760d8ffcdbb | SANTE Glossy Shine Shampoo Birke + 3-fach Protein Komplex | light |
| A43 | 678119a0-9070-4faf-b9ed-7c0ac008767e | SANTE Sensitive Care Shampoo Probiotika + 3-fach Protein Komplex, 250 ml | light |
| A44 | 9d8d4709-4041-495e-98ee-e0261fa30e27 | Schauma Anti-Schuppen Classic Shampoo | moderate |
| A45 | e4e4fd05-33fd-4048-9553-76815bff5d43 | schauma Shampoo Repair & Pflege | heavy |
| A46 | e859d6e0-e991-4081-84b5-b81862c82475 | Schwarzkopf GLISS Sealing Miracle Versiegelndes Shampoo | light |
| A47 | 3405f33b-ae5f-4185-b72b-68c9a87f7c06 | Schwarzkopf GLISS Shampoo Liquid Silk | moderate |
| A48 | bb1b029f-a8fa-4276-8268-f6ce418128c7 | Schwarzkopf GLISS Shampoo Total Repair, 250 ml | moderate |
| A49 | 303b4c0c-53a4-46de-883d-c29e448ee590 | Sebamed Anti-Schuppen Shampoo | light |
| A50 | 7e95671b-41a7-4f5c-9188-e535e46678ba | Sebamed Anti Schuppen Plus | light |
| A51 | 51a0b647-2794-49a3-96e1-e7695432561e | Sebamed Urea 5% | light |
| A52 | 515de93c-1c77-465d-ae0d-2a8d6ddb3d73 | Swiss-O-Par Teebaumöl Shampoo | light |
| A53 | b761256d-c0d2-4413-9fa5-8ab950ef69bf | Syoss Intense Fullness Kräftigendes Shampoo | moderate |
| A54 | f8a8fd56-aeb0-4096-8d9d-5af484e3889f | Syoss Intense Volume Shampoo | light |
| A55 | 0ab645f9-d46d-4cf2-96a5-b5e00f74cae2 | Syoss Shampoo Intense Keratin | moderate |
| G01 | 744de604-d266-453b-a56b-eea92c5ca565 | Guhl Anti Schuppen | light |
| G02 | 088b1427-ed22-424e-8cfd-ea2578120ae6 | Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege | moderate |
| G03 | e7bfd306-b128-4735-a9f8-0eeacdbd5013 | Sebamed Every-Day Shampoo | light |
| G04 | 7373656d-5fd7-46e8-81a3-2ef29e3c4c18 | Pantene Grow Abundance | moderate |
| G05 | 0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33 | Wahre Schätze Sanfte Hafermilch | moderate |
| G06 | 03b847e5-01b9-40e5-950a-98efc73abb3a | Salthouse Totes Meer Therapie Anti-Fett Shampoo | light |
| G07 | 22f95dcb-12de-4d62-b206-f03dbd6e94a0 | ISANA Shampoo & Spülung 2in1 Volumen | light |
| G08 | a1c3dc8d-2638-497f-8c7f-9b491c9003b0 | Cantu Shampoo Locken Pflege | moderate |
| G09 | 4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946 | Syoss Intense Curls Locken Shampoo | moderate |
| G10 | 286071ba-9c9a-4c60-979c-7e51df949fbf | Garnier Fructis Locken Methode Feuchtigkeitsauffüllendes Shampoo | light |
| G11 | 16ebefbe-48d8-4c7f-9c81-b903651a6e03 | Guhl Hyaluron+ Pflege Feuchtigkeits-Shampoo | moderate |
| G12 | d01de47e-e360-4b31-9924-e3e5bc31ccdc | Balea Professional Shampoo Ultimate Volume, 250 ml | light |
| G13 | 3d94c017-9edb-4ba0-accd-4772e262f012 | Lavera Basis Sensitiv | moderate |
| U1 | 0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c | Balea PROFESSIONAL Shampoo Tiefenreinigung, 250 ml | light |
| U2 | 41b99629-5a1c-402f-a486-d41780e89e66 | Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft | light |
| U3 | 0d341836-96b3-4364-9319-a7f0884b3da9 | Plantur 39 Phyto-Coffein-Shampoo für feines, brüchiges Haar | light |
| U4 | 7200bb0b-7463-433b-86c8-744f5c1431de | Garnier Wahre Schätze Ausgleichendes Shampoo Anziehende Aktivkohle & Schwarzkümmelöl | moderate |
| U5 | 1e61a644-94b0-4356-ab55-f58572fa1e18 | head & shoulders Anti-Schuppen Shampoo Classic Clean | moderate |
| U6 | bef4f219-2c1f-4e02-8e3a-93056b95465a | OGX Strength & Length + Keratin Oil Shampoo | heavy |
