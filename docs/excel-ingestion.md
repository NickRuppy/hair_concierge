# Excel Product Matrix Ingestion Workflow

## Expected Excel Format

Each `.xlsx` file in `data/` represents one product category (e.g. `Leave-In.xlsx`, `Shampoo.xlsx`).

Two layouts are auto-detected:

### Format A (e.g. Leave-In.xlsx)
Row 1 has concern headers directly in columns B+, data starts row 2.

```
     | Protein         | Feuchtigkeit       | Nix/Performance
Feine| Product A       | Product D          | Product G
     | Product B       | Product E          | Product H
Norm.| Product C       | Product F          | Product I
```

### Format B (e.g. Produktliste Shampoo.xlsx)
Row 1 has a category title in A1, row 2 has concern headers, data starts row 3.
Products are comma-separated within cells.

```
Shampoo
     | Schuppen              | Irritationen         | Normal    | ...
Feine| ProdA, ProdB, ProdC   | ProdD, ProdE         | ProdF     | ...
Norm.| ProdG, ProdH          | ProdI                | ProdJ     | ...
```

### Rules
- **Thickness labels** (column A) must be: "Feine Haare", "Normale Haare", or "Dicke Haare"
- **Concern headers** can be anything — known ones get clean slugs (Protein -> `protein`), unknown ones get auto-slugified (Dehydriert / Fettig -> `dehydriert-fettig`)
- **Category name**: taken from A1 title cell (Format B) or filename (Format A)
- Cells with `"-"` or empty cells are skipped
- Products can be one-per-cell or comma-separated

## Steps to Add a New Category

### 1. Place the Excel file
Drop the `.xlsx` into `data/` or `data/product_lists/` (both are scanned). The category name comes from either the A1 title cell (Format B) or the filename (Format A).

### 2. Run conversion
```bash
python3 scripts/convert_sources.py
```
Generates:
- `data/markdown/products/<slug>/` — legacy markdown product files per thickness x concern cell
- `data/products-from-excel/<slug>.json` — product catalog entries

### 3. Ingest product-list chunks (content_chunks)
```bash
npx tsx scripts/ingest-product-chunks.ts
```
Reads `data/products-from-excel/*.json`, builds grouped `category x thickness x concern` chunks, embeds them, and stores them in `content_chunks` with `source_type = 'product_list'`.

### 4. Ingest into product catalog (products table)
```bash
npx tsx scripts/ingest-products.ts
```
Reads all JSON from `data/products-from-excel/*.json`. Upserts by product name.

### 5. Verify
- `content_chunks`: grouped product-list rows with `source_type = 'product_list'`
- `products`: products with correct `suitable_thicknesses` and `suitable_concerns`

## Architecture Notes

### Grouped product-list chunking
- 1 chunk = grouped `category x thickness x concern` product list.
- Each chunk contains descriptive German prose plus the matching product names for that category/thickness/concern combination.
- Metadata in JSONB column includes `category`, `thickness`, `concern`, `product_count`, `product_names`, and `language`.

### Retrieval and product-list chunks
- `src/lib/product-matching/product-list-chunks.ts` builds grouped product-list chunks from product catalog rows for ingestion into `content_chunks`.
- `scripts/ingest-product-chunks.ts` writes current product-list chunks with category, thickness, concern, and product-name metadata.
- `scripts/eval-retrieval.ts` evaluates dense and hybrid retrieval metrics against the Supabase match RPCs and the retrieval gold set.

### Thickness mapping (Excel -> DB)
| Excel Label | DB Value | Thickness enum |
|---|---|---|
| Feine Haare | fine | fine |
| Normale Haare | normal | normal |
| Dicke Haare | coarse | coarse |

### Known concern slug overrides
| Excel Header | DB Slug |
|---|---|
| Protein | protein |
| Feuchtigkeit | feuchtigkeit |
| Nix/Performance | performance |
| Dehydriert / Fettig | dehydriert-fettig |
| *(anything else)* | *(auto-slugified)* |

### Key files
- `scripts/convert_sources.py` — Step 4: Excel conversion
- `scripts/ingest-product-chunks.ts` — current product-list chunk ingestion into `content_chunks`
- `scripts/ingest-products.ts` — products -> `products` table
- `src/lib/product-matching/product-list-chunks.ts` — builds product-list chunks for ingestion
- `scripts/eval-retrieval.ts` — evaluates retrieval metrics against Supabase RPCs
- `scripts/ingest-markdown.ts` — general/legacy markdown ingestion, not the current product-list chunk workflow
