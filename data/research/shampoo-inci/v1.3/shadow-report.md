# Shampoo v1 shadow report

- Release: `c76ee4696ed8d7177bc8ca7d88f81b93e0622e89ad6cd270b51636cf78db8f16`
- Catalog snapshot: `0683ba88d0b2ff26968eca6a0da7ceb7f56e4b2e1e60f9f6c828880a3ed17b6a`
- Report: `17e81ea0b74af8b360b58efb664ddd8ea78b8be1a4e147073400b3def934d960`
- Generated: 2026-08-26T14:39:35.832Z
- Status: internal research only; no catalog or recommendation activation

## Coverage

- 50 approved ingredient analyses
- 1 blocked identity outcome
- 50 current catalog baselines
- 18 deterministic profile replays

## Direct legacy-signal comparison

- Agreements: 50
- Divergences: 54
- Deliberately not projected: 46
- No legacy baseline: 0

A divergence is descriptive. The current catalog label is not treated as ground truth, and the ingredient model does not invent a scalp route where its properties do not support one.

## Profile replay

| Profile | Thickness | Current bucket | Ingredient top 5 | Current top 5 | Overlap | Abstentions |
|---|---|---|---:|---:|---:|---:|
| Fein · geringe Dichte · fettige Kopfhaut · Volumen | fine | dehydriert-fettig | 5 | 4 | 1 | 1 |
| Fein · behandelt · ausgeglichene Kopfhaut · Glanz | fine | normal | 5 | 5 | 0 | 1 |
| Fein · trockenes Kopfhautgefühl · Frizz | fine | trocken | 5 | 3 | 1 | 1 |
| Normal · ausgeglichene Kopfhaut · allgemein | normal | normal | 5 | 4 | 0 | 1 |
| Normal · fettige Kopfhaut · hohe Produktlast | normal | dehydriert-fettig | 5 | 4 | 0 | 1 |
| Normal · wenig Volumen · häufiges Waschen | normal | normal | 5 | 4 | 0 | 1 |
| Grob · trocken · geschädigt · Glättung | coarse | trocken | 5 | 2 | 1 | 1 |
| Grob · lockig · Frizz · Definition | coarse | normal | 5 | 4 | 0 | 1 |
| Behandelt · Haarbruch · Reparatur | normal | normal | 5 | 4 | 1 | 1 |
| Leicht empfindlich · Juckreiz | normal | irritationen | 5 | 3 | 2 | 1 |
| Fettige Kopfhaut · fettige Schuppen | normal | schuppen + dehydriert-fettig | 5 | 5 | 1 | 1 |
| Trockene Kopfhaut · trockene Schüppchen | coarse | trocken | 5 | 2 | 0 | 1 |
| Ölige Kopfhaut · leicht empfindlich | normal | irritationen | 5 | 3 | 2 | 1 |
| Ausgeglichen · leicht empfindlich | normal | irritationen | 5 | 3 | 2 | 1 |
| Medizinische Grenze | normal | irritationen | 0 | 3 | 0 | 51 |
| Forschungsprofil · Duftstoffe vermeiden | normal | irritationen | 2 | 3 | 0 | 49 |
| Glatt · ausgeglichen · wenig Glanz | normal | normal | 5 | 4 | 1 | 1 |
| Kraus · trocken · Definition | coarse | trocken | 5 | 2 | 0 | 1 |

## Products with direct divergences

- guhl-kopfhaut-sensitive: shampooBucket, scalpRoute, cleansingIntensity
- salthouse-anti-fett: cleansingIntensity
- head-shoulders-dermaxpro-shampoo-beruhigende-pflege: cleansingIntensity
- wahre-schatze-sanfte-hafermilch: shampooBucket, scalpRoute, cleansingIntensity
- langhaarmaedchen-beautiful-curls: cleansingIntensity
- guhl-hyaluron-plus: shampooBucket, scalpRoute, cleansingIntensity
- hask-argan-oil: cleansingIntensity
- salthouse-anti-juckreiz: cleansingIntensity
- ogx-renewing: cleansingIntensity
- lavera-basis-sensitiv: cleansingIntensity
- syoss-intense-curls: cleansingIntensity
- swiss-o-par-teebaumol: shampooBucket, scalpRoute
- sebamed-urea-5: cleansingIntensity
- sante-sensitive-care: cleansingIntensity
- head-shoulders-sensitive: cleansingIntensity
- pantene-grow-abundance: shampooBucket, scalpRoute, cleansingIntensity
- ogx-rosemary: shampooBucket, scalpRoute, cleansingIntensity
- sebamed-anti-schuppen-plus: shampooBucket, scalpRoute, cleansingIntensity
- loreal-elvital-glycolic-gloss: cleansingIntensity
- guhl-kraft-und-fuelle: cleansingIntensity
- hair-biology-revitalize-soothe: shampooBucket, scalpRoute, cleansingIntensity
- cantu-locken-pflege: cleansingIntensity
- balea-ultra-sensitive: cleansingIntensity
- neqi-moisture-mystery: cleansingIntensity
- balea-2-in-1-urea-5: shampooBucket, scalpRoute, cleansingIntensity
- ogx-keratin-oil: cleansingIntensity
- hask-curl-care: cleansingIntensity
- guhl-frische-und-leichtigkeit: shampooBucket, scalpRoute, cleansingIntensity
- head-shoulders-dermaxpro-haarshampoo-sensitive-pflege: shampooBucket, scalpRoute, cleansingIntensity
- balea-aqua-hyaluron: cleansingIntensity
- balea-kopfhaut-sensitive: cleansingIntensity
- syoss-intense-volume-shampoo: cleansingIntensity
- pantene-hydra-glow: cleansingIntensity

The JSON artifact contains exact product IDs, current value sets, projected values, ranking hashes, and per-profile product lists.
