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
- **Hair texture labels** (column A) must be: "Feine Haare", "Normale Haare", or "Dicke Haare"
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
- `data/markdown/products/<slug>/` — one markdown file per hair_texture x concern cell
- `data/products-from-excel/<slug>.json` — product catalog entries

### 3. Ingest into vector DB (content_chunks)
```bash
npx tsx scripts/ingest-markdown.ts --source product_list
```
Each cell-based file becomes exactly 1 chunk with metadata (`hair_texture`, `concern`, `category`).

### 4. Ingest into product catalog (products table)
```bash
npx tsx scripts/ingest-products.ts
```
Reads all JSON from `data/products-from-excel/*.json`. Upserts by product name.

### 5. Verify
- `content_chunks`: one row per non-empty cell with `source_type = 'product_list'`
- `products`: products with correct `suitable_hair_types` and `suitable_concerns`

## Architecture Notes

### Cell-based chunking
- 1 chunk = 1 matrix cell = hair_texture x concern (e.g. "fein + schuppen")
- Each chunk ~100-400 chars with descriptive natural language for good embeddings
- Metadata in JSONB column: `{hair_texture, concern, category, ...}`

### Hybrid search
- `match_content_chunks` accepts `metadata_filter jsonb` parameter
- Pipeline passes `{hair_texture: user_profile.hair_texture}` for product intents
- GIN index on `metadata` column enables fast `@>` containment filtering

### Hair texture mapping (Excel -> DB)
| Excel Label | DB Value | HairTexture enum |
|---|---|---|
| Feine Haare | fein | fein |
| Normale Haare | mittel | mittel |
| Dicke Haare | dick | dick |

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
- `scripts/ingest-markdown.ts` — chunks + embeds -> `content_chunks`
- `scripts/ingest-products.ts` — products -> `products` table
- `src/lib/rag/retriever.ts` — passes `metadataFilter` to RPC
- `src/lib/rag/pipeline.ts` — applies hair_texture filter for product intents
