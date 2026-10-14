import type { CanonicalRepairLevel, CanonicalWeight } from "@/lib/recommendation-engine/types"
import type { HairThickness } from "@/lib/vocabulary"

import type {
  OfferPreviewCategory,
  OfferPreviewCleansingIntensity,
  OfferPreviewNeedProfile,
  OfferPreviewProductModule,
  OfferPreviewScalpRoute,
} from "./offer-preview-types"

const PRODUCT_IMAGES = {
  dermaxCalm:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/088b1427-ed22-424e-8cfd-ea2578120ae6/17-088b1427-ed22-424e-8cfd-ea2578120ae6-head-shoulders-head-shoulders-dermaxpro-shampoo-beruhigende-pflege-a1907d591d0a.webp",
  panteneDandruff:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/5effc311-25d7-44dd-8c16-b93c182068d3/32-5effc311-25d7-44dd-8c16-b93c182068d3-pantene-pantene-anti-schuppen-f8506af74c89.webp",
  baleaUltraSensitive:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-03/a79513be-e34b-4a1e-b7eb-b3d4b58160be/02-a79513be-e34b-4a1e-b7eb-b3d4b58160be-balea-balea-ultra-sensitive-aac31110cf40.webp",
  baleaScalpSensitive:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d/06-eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d-balea-balea-kopfhaut-sensitive-shampoo-872a0c8267a6.webp",
  dermaxSensitive:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/d408aca9-cd16-4cb0-90e7-bab26a698000/16-d408aca9-cd16-4cb0-90e7-bab26a698000-head-shoulders-head-shoulders-dermaxpro-haarshampoo-sensitive-pflege-33dcf52e0426.webp",
  baleaAqua:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/ead1333b-6839-464d-b272-673d39bb95a4/02-ead1333b-6839-464d-b272-673d39bb95a4-balea-balea-aqua-hyaluron-f41a5b48efe1.webp",
  neqiMoisture:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/a7ff335a-7e81-4cf4-9c20-9209bff4386b/25-a7ff335a-7e81-4cf4-9c20-9209bff4386b-neqi-neqi-moisture-mystery-5cbb231612bf.webp",
  cantuShampoo:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/a1c3dc8d-2638-497f-8c7f-9b491c9003b0/05-a1c3dc8d-2638-497f-8c7f-9b491c9003b0-cantu-cantu-shampoo-locken-pflege-fe178388b19e.webp",
  panteneVolume:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/6fde3fe2-3850-4502-b9f2-ebb17eb13bad/35-6fde3fe2-3850-4502-b9f2-ebb17eb13bad-pantene-pantene-pro-v-volumen-pur-ebdab2bad574.webp",
  mondayVolume:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/6dc65df2-2466-43e4-bdc2-3a05803f305c/24-6dc65df2-2466-43e4-bdc2-3a05803f305c-monday-haircare-monday-haircare-volume-kraft-fulle-shampoo-8cc7e5f12706.webp",
  oatMilk:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33/49-0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33-wahre-schatze-wahre-schatze-sanfte-hafermilch-fa726da6d4e5.webp",
  haskArgan:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/17b6d50e-ca5b-4f66-bdd7-39bd19afe748/14-17b6d50e-ca5b-4f66-bdd7-39bd19afe748-hask-hask-shampoo-argan-oil-a399aef4727d.webp",
  neqiVolumeConditioner:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/952a4834-e451-4dc3-ba19-ebb8927eb5e4/35-952a4834-e451-4dc3-ba19-ebb8927eb5e4-neqi-neqi-volume-victory-7938d3f794f9.webp",
  garnierAloe:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/5516009a-eecb-42dd-87f6-07c560161136/17-5516009a-eecb-42dd-87f6-07c560161136-garnier-garnier-fructis-hair-food-aloe-vera-feuchtigkeits-spulung-84d29653e868.webp",
  jeanLen:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/e1ad37be-9330-49b4-8add-872a30324122/29-e1ad37be-9330-49b4-8add-872a30324122-jean-len-jean-len-repair-keratin-mandel-77390c5b0538.webp",
  lovelyLong:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/2a159694-6799-4be7-a0aa-572757c94801/31-2a159694-6799-4be7-a0aa-572757c94801-langhaarmadchen-langhaarmadchen-lovely-long-d30fd7fd3ec3.webp",
  herbalAloe:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6/27-4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6-herbal-essences-herbal-essences-aloe-vera-9520a33413fe.webp",
  neqiRepair:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/35ae622e-1458-42bf-a44d-1b23ecfd5516/34-35ae622e-1458-42bf-a44d-1b23ecfd5516-neqi-neqi-repair-reveal-aaf56fa55f86.webp",
  fiberBooster:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/d0180955-c3a0-4f53-8744-fbeb2c241688/12-d0180955-c3a0-4f53-8744-fbeb2c241688-elvital-elvital-fiber-booster-b8022be87e33.webp",
  haskCurl:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/37c65daf-cc2e-44ba-a976-ac0239c11f7d/25-37c65daf-cc2e-44ba-a976-ac0239c11f7d-hask-hask-curl-care-a4b09f2e628c.webp",
  baleaOilRepair:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/pilot-2026-06-10/e7cde77e-e9d5-4976-a8ed-830c8a30c62a/06-e7cde77e-e9d5-4976-a8ed-830c8a30c62a-balea-balea-oil-repair-662414bac91b.webp",
  proteinMask:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-02/22d41784-5fc6-40bb-a4dc-92841322f933/36-22d41784-5fc6-40bb-a4dc-92841322f933-neqi-neqi-peptide-power-75e130629bdc.webp",
  moistureMask:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-02/c7326c6b-6175-4ec2-865f-68baf476c986/17-c7326c6b-6175-4ec2-865f-68baf476c986-guhl-guhl-30-sec-feuchtigkeit-27b4f1343260.webp",
  leaveIn:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-02/0b21f996-bb42-4b10-89bd-4881c4346d53/22-0b21f996-bb42-4b10-89bd-4881c4346d53-isana-isana-feuchtigkeits-leave-in-hyaluron-ba1624f6c1eb.webp",
  curlLeaveIn:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-02/50951ef2-e16a-4a51-85c5-a709aa64c03a/29-50951ef2-e16a-4a51-85c5-a709aa64c03a-maria-nila-maria-nila-coils-curls-oil-in-cream-e0d91d141bec.webp",
  oil: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-03/7d8c0150-778d-4cb9-abf5-bfc16ad93b12/34-7d8c0150-778d-4cb9-abf5-bfc16ad93b12-olaplex-olaplex-no-7-bonding-oil-5dc5795db1a8.webp",
  bondbuilder:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/pilot-2026-06-10/3dc24d67-e6c0-4239-a273-058a87d13553/20-3dc24d67-e6c0-4239-a273-058a87d13553-olaplex-olaplex-no-3plus-complete-repair-treatment-654f51a2bea9.webp",
} as const

function shampooModule(input: {
  key: string
  id: string
  name: string
  imageUrl: string
  routes: OfferPreviewScalpRoute[]
  thicknesses: HairThickness[]
  intensity: OfferPreviewCleansingIntensity
  note: string
  priority: number
}): OfferPreviewProductModule {
  return {
    key: input.key,
    catalogProductId: input.id,
    category: "shampoo",
    name: input.name,
    imageUrl: input.imageUrl,
    priority: input.priority,
    shampooFit: {
      scalpRoutes: input.routes,
      thicknesses: input.thicknesses,
      cleansingIntensity: input.intensity,
    },
    approvedCopy: {
      categoryLabel: "Shampoo · Beispiel",
      productNote: input.note,
      provenance: "Catalog snapshot 2026-06-12 + reviewed shampoo fit export/migration",
    },
  }
}

function conditionerModule(input: {
  key: string
  id: string
  name: string
  imageUrl: string
  thickness: HairThickness
  weight: CanonicalWeight
  balance: "balanced" | "moisture" | "protein"
  repair: CanonicalRepairLevel
  note: string
  priority: number
}): OfferPreviewProductModule {
  return {
    key: input.key,
    catalogProductId: input.id,
    category: "conditioner",
    name: input.name,
    imageUrl: input.imageUrl,
    priority: input.priority,
    conditionerFit: {
      thicknesses: [input.thickness],
      weights: [input.weight],
      balances: [input.balance],
      repairLevels: [input.repair],
    },
    approvedCopy: {
      categoryLabel: "Conditioner · Beispiel",
      productNote: input.note,
      provenance: "Catalog snapshot 2026-06-12 + deterministic conditioner spec backfill",
    },
  }
}

const SHAMPOO_MODULES: OfferPreviewProductModule[] = [
  shampooModule({
    key: "sh-dandruff-fine-coarse",
    id: "088b1427-ed22-424e-8cfd-ea2578120ae6",
    name: "Head & Shoulders DERMAXPRO Beruhigende Pflege",
    imageUrl: PRODUCT_IMAGES.dermaxCalm,
    routes: ["dandruff"],
    thicknesses: ["fine", "coarse"],
    intensity: "regular",
    note: "Kopfhaut-Fokus bei Schuppen; die finale Anwendung klärt Chaarlie mit dir.",
    priority: 10,
  }),
  shampooModule({
    key: "sh-dandruff-normal",
    id: "5effc311-25d7-44dd-8c16-b93c182068d3",
    name: "Pantene Anti Schuppen",
    imageUrl: PRODUCT_IMAGES.panteneDandruff,
    routes: ["dandruff"],
    thicknesses: ["normal"],
    intensity: "regular",
    note: "Ein konkretes Anti-Schuppen-Beispiel für deine Pflegebasis.",
    priority: 20,
  }),
  shampooModule({
    key: "sh-irritated-fine",
    id: "a79513be-e34b-4a1e-b7eb-b3d4b58160be",
    name: "Balea Ultra Sensitive",
    imageUrl: PRODUCT_IMAGES.baleaUltraSensitive,
    routes: ["irritated"],
    thicknesses: ["fine"],
    intensity: "gentle",
    note: "Milde Reinigung als vorsichtiger Startpunkt für empfindliche Kopfhaut.",
    priority: 30,
  }),
  shampooModule({
    key: "sh-irritated-normal",
    id: "eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d",
    name: "Balea Kopfhaut Sensitive Shampoo",
    imageUrl: PRODUCT_IMAGES.baleaScalpSensitive,
    routes: ["irritated"],
    thicknesses: ["normal"],
    intensity: "gentle",
    note: "Milde Reinigung mit Kopfhaut-Fokus als Beispiel.",
    priority: 40,
  }),
  shampooModule({
    key: "sh-irritated-coarse",
    id: "d408aca9-cd16-4cb0-90e7-bab26a698000",
    name: "Head & Shoulders DERMAXPRO Sensitive Pflege",
    imageUrl: PRODUCT_IMAGES.dermaxSensitive,
    routes: ["irritated"],
    thicknesses: ["coarse"],
    intensity: "gentle",
    note: "Ein sensibles Reinigungsbeispiel für kräftigeres Haar.",
    priority: 50,
  }),
  shampooModule({
    key: "sh-balanced-fine",
    id: "ead1333b-6839-464d-b272-673d39bb95a4",
    name: "Balea Aqua Hyaluron",
    imageUrl: PRODUCT_IMAGES.baleaAqua,
    routes: ["balanced"],
    thicknesses: ["fine"],
    intensity: "regular",
    note: "Leichte, ausgewogene Reinigung für deine Pflegebasis.",
    priority: 60,
  }),
  shampooModule({
    key: "sh-balanced-normal-dry-fine",
    id: "a7ff335a-7e81-4cf4-9c20-9209bff4386b",
    name: "Neqi Moisture Mystery",
    imageUrl: PRODUCT_IMAGES.neqiMoisture,
    routes: ["balanced", "dry"],
    thicknesses: ["fine", "normal"],
    intensity: "gentle",
    note: "Ein mildes Beispiel, passend zur abgeleiteten Reinigungsrichtung.",
    priority: 70,
  }),
  shampooModule({
    key: "sh-balanced-coarse",
    id: "a1c3dc8d-2638-497f-8c7f-9b491c9003b0",
    name: "Cantu Shampoo Locken Pflege",
    imageUrl: PRODUCT_IMAGES.cantuShampoo,
    routes: ["balanced"],
    thicknesses: ["coarse"],
    intensity: "regular",
    note: "Ein ausgewogenes Reinigungsbeispiel für kräftigeres Haar.",
    priority: 80,
  }),
  shampooModule({
    key: "sh-oily-fine",
    id: "6fde3fe2-3850-4502-b9f2-ebb17eb13bad",
    name: "Pantene Pro-V Volumen Pur",
    imageUrl: PRODUCT_IMAGES.panteneVolume,
    routes: ["oily"],
    thicknesses: ["fine"],
    intensity: "regular",
    note: "Ein reguläres Reinigungsbeispiel für feines Haar und schneller fettenden Ansatz.",
    priority: 90,
  }),
  shampooModule({
    key: "sh-oily-normal",
    id: "6dc65df2-2466-43e4-bdc2-3a05803f305c",
    name: "Monday Volume Kraft & Fülle Shampoo",
    imageUrl: PRODUCT_IMAGES.mondayVolume,
    routes: ["oily"],
    thicknesses: ["normal"],
    intensity: "regular",
    note: "Ein konkretes Shampoo-Beispiel für regelmäßigere Reinigung.",
    priority: 100,
  }),
  shampooModule({
    key: "sh-dry-normal",
    id: "0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33",
    name: "Wahre Schätze Sanfte Hafermilch",
    imageUrl: PRODUCT_IMAGES.oatMilk,
    routes: ["dry"],
    thicknesses: ["normal"],
    intensity: "gentle",
    note: "Sanftere Reinigung als Startpunkt für trockene Kopfhaut.",
    priority: 110,
  }),
  shampooModule({
    key: "sh-dry-coarse",
    id: "17b6d50e-ca5b-4f66-bdd7-39bd19afe748",
    name: "Hask Shampoo Argan Oil",
    imageUrl: PRODUCT_IMAGES.haskArgan,
    routes: ["dry"],
    thicknesses: ["coarse"],
    intensity: "gentle",
    note: "Ein sanfteres Reinigungsbeispiel für kräftigeres Haar.",
    priority: 120,
  }),
]

const CONDITIONER_MODULES: OfferPreviewProductModule[] = [
  conditionerModule({
    key: "co-fine-balanced",
    id: "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
    name: "Neqi Volume Victory Conditioner",
    imageUrl: PRODUCT_IMAGES.neqiVolumeConditioner,
    thickness: "fine",
    weight: "light",
    balance: "balanced",
    repair: "low",
    note: "Leichte, ausgewogene Pflege als Beispiel für feines Haar.",
    priority: 10,
  }),
  conditionerModule({
    key: "co-fine-moisture",
    id: "5516009a-eecb-42dd-87f6-07c560161136",
    name: "Garnier Hair Food Aloe Vera Feuchtigkeits-Spülung",
    imageUrl: PRODUCT_IMAGES.garnierAloe,
    thickness: "fine",
    weight: "light",
    balance: "moisture",
    repair: "low",
    note: "Leichtes Feuchtigkeits-Beispiel für deine Längen.",
    priority: 20,
  }),
  conditionerModule({
    key: "co-fine-protein",
    id: "e1ad37be-9330-49b4-8add-872a30324122",
    name: "Jean&Len Conditioner Keratin/Mandel",
    imageUrl: PRODUCT_IMAGES.jeanLen,
    thickness: "fine",
    weight: "light",
    balance: "protein",
    repair: "medium",
    note: "Leichter Struktur-Fokus als Conditioner-Beispiel.",
    priority: 30,
  }),
  conditionerModule({
    key: "co-normal-balanced",
    id: "2a159694-6799-4be7-a0aa-572757c94801",
    name: "Langhaarmädchen Lovely Long Conditioner",
    imageUrl: PRODUCT_IMAGES.lovelyLong,
    thickness: "normal",
    weight: "medium",
    balance: "balanced",
    repair: "medium",
    note: "Ausgewogene Pflege mit mittlerem Gewicht als Beispiel.",
    priority: 40,
  }),
  conditionerModule({
    key: "co-normal-moisture",
    id: "4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6",
    name: "Herbal Essences Aloe Vera Conditioner",
    imageUrl: PRODUCT_IMAGES.herbalAloe,
    thickness: "normal",
    weight: "medium",
    balance: "moisture",
    repair: "low",
    note: "Feuchtigkeits-Pflege mit mittlerem Gewicht als Beispiel.",
    priority: 50,
  }),
  conditionerModule({
    key: "co-normal-protein",
    id: "35ae622e-1458-42bf-a44d-1b23ecfd5516",
    name: "Neqi Repair Reveal Conditioner",
    imageUrl: PRODUCT_IMAGES.neqiRepair,
    thickness: "normal",
    weight: "medium",
    balance: "protein",
    repair: "high",
    note: "Struktur-Fokus mit mittlerem Pflegegewicht als Beispiel.",
    priority: 60,
  }),
  conditionerModule({
    key: "co-coarse-balanced",
    id: "d0180955-c3a0-4f53-8744-fbeb2c241688",
    name: "Elvital Fiber Booster Conditioner",
    imageUrl: PRODUCT_IMAGES.fiberBooster,
    thickness: "coarse",
    weight: "medium",
    balance: "balanced",
    repair: "medium",
    note: "Ausgewogene Pflege als Beispiel für kräftigeres Haar.",
    priority: 70,
  }),
  conditionerModule({
    key: "co-coarse-moisture",
    id: "37c65daf-cc2e-44ba-a976-ac0239c11f7d",
    name: "Hask Curl Care Conditioner",
    imageUrl: PRODUCT_IMAGES.haskCurl,
    thickness: "coarse",
    weight: "rich",
    balance: "moisture",
    repair: "medium",
    note: "Reichhaltigeres Feuchtigkeits-Beispiel für kräftigere Längen.",
    priority: 80,
  }),
  conditionerModule({
    key: "co-coarse-protein",
    id: "e7cde77e-e9d5-4976-a8ed-830c8a30c62a",
    name: "Balea Professional Oil Repair Intensiv Spülung",
    imageUrl: PRODUCT_IMAGES.baleaOilRepair,
    thickness: "coarse",
    weight: "rich",
    balance: "protein",
    repair: "high",
    note: "Reichhaltigerer Struktur-Fokus als Conditioner-Beispiel.",
    priority: 90,
  }),
]

const OPTIONAL_MODULES: OfferPreviewProductModule[] = [
  {
    key: "extra-protein-mask",
    catalogProductId: "22d41784-5fc6-40bb-a4dc-92841322f933",
    category: "protein_mask",
    name: "Neqi Peptide Power",
    imageUrl: PRODUCT_IMAGES.proteinMask,
    priority: 10,
    approvedCopy: {
      categoryLabel: "Protein-Maske · Vorschlag",
      productNote: "Gezielter Struktur-Schritt in größeren Abständen.",
      provenance: "Catalog snapshot + mask spec backfill",
    },
  },
  {
    key: "extra-moisture-mask",
    catalogProductId: "c7326c6b-6175-4ec2-865f-68baf476c986",
    category: "moisture_mask",
    name: "Guhl 30 sec. Feuchtigkeit",
    imageUrl: PRODUCT_IMAGES.moistureMask,
    priority: 20,
    approvedCopy: {
      categoryLabel: "Feuchtigkeitsmaske · Vorschlag",
      productNote: "Gezielter Feuchtigkeits-Schritt zwischen normalen Wäschen.",
      provenance: "Catalog snapshot + mask spec backfill",
    },
  },
  {
    key: "extra-leave-in",
    catalogProductId: "0b21f996-bb42-4b10-89bd-4881c4346d53",
    category: "leave_in",
    name: "Isana Feuchtigkeits Leave-In (Hyaluron)",
    imageUrl: PRODUCT_IMAGES.leaveIn,
    priority: 30,
    approvedCopy: {
      categoryLabel: "Leave-in · Vorschlag",
      productNote: "Leichter Schutz und bessere Kämmbarkeit nach der Wäsche.",
      provenance: "Catalog snapshot + leave-in spec backfill",
    },
  },
  {
    key: "extra-curl-leave-in",
    catalogProductId: "50951ef2-e16a-4a51-85c5-a709aa64c03a",
    category: "leave_in",
    name: "Maria Nila Coils & Curls Oil in Cream",
    imageUrl: PRODUCT_IMAGES.curlLeaveIn,
    priority: 40,
    approvedCopy: {
      categoryLabel: "Curl Leave-in · Vorschlag",
      productNote:
        "Feuchtigkeit, Frizz-Kontrolle und Definition als Beispiel für Wellen und Locken.",
      provenance: "Catalog snapshot + leave-in spec backfill",
    },
  },
  {
    key: "extra-oil",
    catalogProductId: "7d8c0150-778d-4cb9-abf5-bfc16ad93b12",
    category: "oil",
    name: "Olaplex No.7 Bonding Oil",
    imageUrl: PRODUCT_IMAGES.oil,
    priority: 50,
    approvedCopy: {
      categoryLabel: "Haaröl · Vorschlag",
      productNote: "Als sparsames Finish für Längen und Spitzen – nicht als Reparaturversprechen.",
      provenance: "Catalog snapshot + oil eligibility backfill",
    },
  },
  {
    key: "extra-bondbuilder",
    catalogProductId: "3dc24d67-e6c0-4239-a273-058a87d13553",
    category: "bondbuilder",
    name: "OLAPLEX No.3PLUS Complete Repair Treatment",
    imageUrl: PRODUCT_IMAGES.bondbuilder,
    priority: 60,
    approvedCopy: {
      categoryLabel: "Bondbuilder · Vorschlag",
      productNote:
        "Intensiver Zusatzschritt vor der Haarwäsche; Rhythmus folgt dem Produktprotokoll.",
      provenance: "Catalog snapshot + bondbuilder seed specification",
    },
  },
]

export const OFFER_PREVIEW_PRODUCT_MODULES: readonly OfferPreviewProductModule[] = [
  ...SHAMPOO_MODULES,
  ...CONDITIONER_MODULES,
  ...OPTIONAL_MODULES,
]

function distance<T extends string>(value: T, candidate: T, order: readonly T[]): number {
  return Math.abs(order.indexOf(value) - order.indexOf(candidate))
}

function selectConditioner(needs: OfferPreviewNeedProfile): OfferPreviewProductModule {
  const candidates = CONDITIONER_MODULES.filter(
    (module) =>
      module.conditionerFit?.thicknesses.includes(needs.shampoo.thickness) &&
      module.conditionerFit.balances.includes(needs.conditioner.balance),
  )
  if (candidates.length === 0) throw new Error("offer preview conditioner coverage missing")

  const weightOrder: CanonicalWeight[] = ["light", "medium", "rich"]
  return [...candidates].sort((left, right) => {
    const leftFit = left.conditionerFit!
    const rightFit = right.conditionerFit!
    const weightDelta =
      distance(needs.conditioner.weight, leftFit.weights[0]!, weightOrder) -
      distance(needs.conditioner.weight, rightFit.weights[0]!, weightOrder)
    return weightDelta || left.priority - right.priority || left.key.localeCompare(right.key)
  })[0]!
}

export function selectOfferPreviewProduct(
  category: OfferPreviewCategory,
  needs: OfferPreviewNeedProfile,
): OfferPreviewProductModule {
  if (category === "shampoo") {
    const exact = SHAMPOO_MODULES.find(
      (module) =>
        module.shampooFit?.scalpRoutes.includes(needs.shampoo.scalpRoute) &&
        module.shampooFit.thicknesses.includes(needs.shampoo.thickness),
    )
    if (exact) return exact

    // The checked-in fit matrix has no coarse + oily cell. Keep the product identity concrete but
    // remove the unsupported fit claim; Chaarlie finalizes that choice after purchase.
    if (needs.shampoo.scalpRoute === "oily" && needs.shampoo.thickness === "coarse") {
      return {
        ...SHAMPOO_MODULES.find((module) => module.key === "sh-oily-normal")!,
        key: "sh-oily-coarse-neutral",
        approvedCopy: {
          categoryLabel: "Shampoo · vorläufiges Beispiel",
          productNote: "Für diese Kombination finalisiert Chaarlie das konkrete Shampoo mit dir.",
          provenance: "Explicit neutral fallback for uncovered coarse + oily fit cell",
        },
      }
    }
    throw new Error("offer preview shampoo coverage missing")
  }

  if (category === "conditioner") return selectConditioner(needs)

  if (category === "leave_in") {
    const key = needs.extra?.variant === "curl" ? "extra-curl-leave-in" : "extra-leave-in"
    return OPTIONAL_MODULES.find((module) => module.key === key)!
  }

  const productModule = OPTIONAL_MODULES.find((candidate) => candidate.category === category)
  if (!productModule) throw new Error(`offer preview category coverage missing: ${category}`)
  return productModule
}
