-- Conservative first-pass retagging for the new concern taxonomy.
-- These rows were updated in Supabase during implementation and are captured here for reproducibility.
begin;

update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '9b664b11-fd11-47e3-9b7e-76e34736b43e'; -- Acina Hyaluron 2.0 (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = 'f9595d2c-d86d-4bdb-9758-c98d1e213f3c'; -- alverde Leave-In Sprühkur Express 7in1
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '43cb9fbf-4b04-4554-a86a-7cb168536233'; -- Authentic Beauty Concept Hydrate Spray (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'd5d67009-7aac-4299-938b-7218b8635a0c'; -- Balea 3 in 1 Intensivmaske
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '55727898-2a5e-4f01-ace1-bd91521d98ab'; -- Balea Aqua Hyaluron 3 in 1
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = 'c6e80f39-20ba-401e-b041-6ee7c89a5996'; -- Balea Aqua Hyaluron 3in1
update products set suitable_concerns = array['feuchtigkeit', 'performance', 'dryness']::text[] where id = 'f212a8ff-0a03-404a-aad5-773d5bb6f7c9'; -- Balea Natural Beauty 3in1 Locken
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '007a0b35-2372-4836-9aa5-fd089cd588d4'; -- Balea Natural Beauty Hibiskus
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '29fc985e-3b7e-4567-b7bc-b416583139fe'; -- Balea Natural Beauty reparierend.
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = 'e7cde77e-e9d5-4976-a8ed-830c8a30c62a'; -- Balea Oil Repair
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '9d7141bf-bb7e-41e8-a206-38ee5c42fdc6'; -- Balea Plex Care
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = 'c4b9eaef-dfeb-41ea-9d28-9901660406b7'; -- Bali Curls Bond Repair
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'; -- Bali Curls Deep Hydration (Kokos)
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '43232fe6-28b6-4f45-a09f-b1354e47b0be'; -- Bali Curls SOS Protein Treatment
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling', 'breakage']::text[] where id = 'e3c4b607-8f81-462c-8a2b-e45c8b3a2976'; -- Cantu Leave-In Conditioning Repair Cream (Kokos)
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling', 'breakage']::text[] where id = '7db2bb60-0af6-4198-adec-28fad13251a6'; -- Cantu Leave-In Repair Cream (Kokos)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '7539ab79-f4f6-49d7-9269-08034ef4de96'; -- Cantu Repair Cream (Kokos)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '11a099f7-eabe-4bdb-bfd3-995f35cb6ee4'; -- Color WOW Money Mist (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '648ba537-5180-440e-81ad-2b310b447d87'; -- Curlsmith Hydrate & Plump Leave-In
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '2bafeb7e-6610-4efc-a8e8-a402071b2ed9'; -- Curlsmith Multitasking Conditioner 3 in 1
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '8715f0f5-9104-46ec-b450-e73f1441c1fa'; -- Curlsmith Weightless Protein Leave-In Conditioner
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '6b01025d-9e72-4514-b42e-bbb6065fbe1c'; -- Elvital Öl Magique Serum (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = 'b139d4e8-6f26-4096-a1b9-d9efcb02d2ec'; -- EVO Day of Grace Leave-In (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '42b9eba7-d0e3-4d02-ae2b-7a1612a561fe'; -- EVO Happy Campers (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'; -- EVO Head Mistress (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '52264c47-f339-49db-9fb2-207d1ad3b470'; -- Fructis Hair Food Aloe Vera
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '9e1442c9-4ab8-4819-a851-66859a98ed80'; -- Fructis Hair Food Papaya
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '0307c903-84f9-46b4-8f1f-a51c2b1f38ff'; -- Garnier Hair Food Aloe Vera
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = 'a72d630d-547a-465f-9846-3006b38af0a2'; -- Garnier Hair Food Macadamia
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '8c3eda97-5009-40bb-959b-1a7d90f48b09'; -- Garnier Hair Food Macadamia (Kokos)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '5516009a-eecb-42dd-87f6-07c560161136'; -- Garnier Wahre Schätze Aloe Vera Spülung
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '02113cc7-80c4-45a5-a56b-738ac96f4f02'; -- Gliss Kur Aqua Revive (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'; -- Gliss Ultimate Repair Spülung (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '4e76bb70-b521-48e1-9708-4edc48b17c73'; -- Glisskur Liquid Silk (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'c7326c6b-6175-4ec2-865f-68baf476c986'; -- Guhl 30 sec. Feuchtigkeit
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '9f8da740-87b6-45e0-ab86-d77d63f2e22b'; -- Guhl Bond+ (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '8ef172f7-8e95-4ac7-a6a9-235ad760155b'; -- Guhl Panthenol +
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '11d42d9d-b8d8-42ae-a432-9a3d0f9d3504'; -- Guhl Panthenol*
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '7c057f58-3e9b-4347-b4c1-f04cc4213f94'; -- Hask Argan Deep Conditioning Treatment
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '37c65daf-cc2e-44ba-a976-ac0239c11f7d'; -- Hask Curl Care
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = '5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3'; -- HASK Keratin 5-in-1 Spray
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = 'b4bcb392-22a7-4642-bcdf-1949ca959f67'; -- Hask Repairing Argan Oil (Kokos)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6'; -- Herbal Essences Aloe Vera (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '47795618-40e7-4ef6-8034-0fd8eb747575'; -- Isana 3in1 Michprotein & Mandel
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '0b21f996-bb42-4b10-89bd-4881c4346d53'; -- Isana Feuchtigkeits Leave-In (Hyaluron)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '696401be-16b5-4261-836f-28b57c1ecd59'; -- It’s a 10 Miracle Leave-In  (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '7d65ed50-898c-40c3-8865-ebe5688774c8'; -- It’s a 10 Miracle Leave-In Lite (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = 'e1ad37be-9330-49b4-8add-872a30324122'; -- Jean&Len Repair Keratin/Mandel
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '8f84eae5-222d-4bbf-9ab0-f30361882a95'; -- K18 Hair Professional Molecular Repair Hair Mist
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '6ad82861-d68e-4e70-a976-78c0f35d087b'; -- Kevin Murphy Young Again (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '35d81c4a-dbb0-474b-a068-2e1562adb0a8'; -- Langhaarmädchen Beautiful Curls
update products set suitable_concerns = array['performance', 'tangling', 'breakage']::text[] where id = '0756a919-5fab-4b6c-a5da-8cb810869b6f'; -- Living Proof Restore Instant Repair
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '50951ef2-e16a-4a51-85c5-a709aa64c03a'; -- Maria Nila Coils & Curls Oil in Cream
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '996eaa2a-ea4c-4dfb-b455-2782e82d9a44'; -- Maria Nila Structure Repair (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '695414e1-3435-4304-943b-76677408980c'; -- Maria Nila Structure Repair Leave-In (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '3c769f60-283f-48c3-9549-cf84b73115d7'; -- Maria Nila True Soft Leave-In
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'ffd37427-0cb6-4d6a-8b83-ea904bf2b1d7'; -- Monday Moisture (Silikone / Kokos)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '7a3d1d99-2ff4-49b9-b021-d5ec2bdb0fe6'; -- Moroccanoil All In One Leave In Conditioner (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = 'bc6ab308-7b6e-4d72-92aa-313a43c9c77d'; -- Neqi Build Boost
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = 'e6896862-523b-42b3-967d-41cbd16acf64'; -- Neqi Moisture Mystery (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '95e47992-b45b-4847-ba87-b8c3e608fc63'; -- Neqi Moisture Mystery (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage']::text[] where id = '22d41784-5fc6-40bb-a4dc-92841322f933'; -- Neqi Peptide Power
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = 'd33543b0-6011-45f1-9bb2-125289ac849a'; -- Neqi Repair Reveal
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '35ae622e-1458-42bf-a44d-1b23ecfd5516'; -- Neqi Repair Reveal  (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '215522e5-95a6-469f-bc34-1fa74b311a23'; -- Nivea Repair
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '1bfa5b02-26d9-457b-a5e6-445cc2284490'; -- OGX Keratin & Protein (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '7bd5f94a-fb02-4505-a53a-2b100c265a5b'; -- OGX Renewing (Silikone / Kokos)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'c2d7eb89-9a2e-4476-bb89-c0f33a2aa501'; -- OGX Renewing Argan Oil (Silikone /Kokos)
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = '4827c174-92e9-4121-ab70-843d5c037ad0'; -- Olaplex No.5 Leave-In (Silikone)
update products set suitable_concerns = array['performance', 'tangling', 'breakage']::text[] where id = '4e99706a-2232-4ee6-ba1b-9ca1029a7364'; -- Olaplex No.6 Bond Smoother (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '993f0e55-2450-4557-853d-e6e23ec0d1a9'; -- OUAI Leave In Conditioner (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '7c1f2f42-3729-49fe-9f0d-e007b93a05c8'; -- Pantene Bond Repair
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = '35a372b6-c7ef-45cb-be0b-99cef476f247'; -- Pantene Bonding Leave-In (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'a17d3783-2854-4911-bbfa-b2f3ef7f95a8'; -- Pantene Hydra Glow
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '98d08c22-97d2-4e06-872f-9f9447530452'; -- Pantene Hydra Glow (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = 'e781ca9e-886d-40a1-bfe1-48177cfbf381'; -- Pantene Hydra Glow Leave-In (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '077a94ae-fede-4773-9435-17022c2b89c0'; -- Pantene Keratin Repair & Care
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '71d9bccb-74c7-499c-b5de-13ceef57ecde'; -- Pantene Miracles Bond Repair (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = 'f8f3b51d-8e64-487d-bad5-4a47c58862ed'; -- Pantene Pro-V Keratin Protect 10-in-1 Spray (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '915aa362-6479-41f2-bb59-0260493b3d58'; -- Paul Mitchell Full Circle Leave-In
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '970aff48-a7a7-46e8-bad5-4f0600631329'; -- Pomelo Molecular Repair (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling']::text[] where id = 'a3b21686-fe35-46f1-b560-b8a563dc96ae'; -- Redken Acidic Color Gloss Leave-In (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness', 'tangling']::text[] where id = '0d5a4af5-d046-4378-b608-515c9d1d66ec'; -- Redken All Soft Mega Curls Leave-In (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = '2b7db7e3-2058-4178-8a03-7d05f4a1d447'; -- Redken Extreme Anti-Snap (Silikone)
update products set suitable_concerns = array['performance', 'tangling']::text[] where id = '39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'; -- Redken One United (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '01b11043-5c87-43d2-95b5-f1cabd845423'; -- SANTE Deep Repair Conditioner (Kokos)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'd2bb79a8-add1-4b74-9d4f-c03449175147'; -- Sante Intense Hydrating Conditioner
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = '869abd97-a499-4f39-97e5-2722773e46ae'; -- Sante Intense Hydration
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'a62ae91c-69c6-466e-827e-350f518d73b5'; -- Syoss Intense Curls (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = '961e3935-f823-44e7-8601-900c62855d3d'; -- Syoss Intense Keratin
update products set suitable_concerns = array['protein', 'hair_damage', 'breakage']::text[] where id = 'ed382d40-6166-4d39-be2d-eab5a24793a6'; -- Syoss Intense Keratin (Silikone)
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = '45f4fe15-c439-476d-8a86-3b2aac5053bd'; -- Urban Alchemy Repair (Silikone)
update products set suitable_concerns = array['feuchtigkeit', 'dryness']::text[] where id = 'ea353b65-544d-48a8-a057-c3e733b66326'; -- WAHRE SCHÄTZE 1-MINUTE HAARKUR Argan
update products set suitable_concerns = array['feuchtigkeit', 'performance', 'dryness']::text[] where id = 'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75'; -- Wahre Schätze Avocado
update products set suitable_concerns = array['protein', 'hair_damage', 'tangling', 'breakage']::text[] where id = '94cf6959-a53b-421b-9f0f-05efc239171c'; -- Wella Ultimate Repair Leave-In (Silikone)

commit;
