Evidence captured read-only on 2026-10-09 by the r4 research pass.
- dm-mcp/<gtin>.json: raw response of the public dm MCP tool getProductDetails (https://mcp.dm.de/mcp) for each GTIN. `found:false` for 4015100860429 (Syoss Fullness), 8700216939140 (Pantene 800 ml) and 4262401735639 (Jean&Len mask) means dm does not list them.
- Scripts are the exact generators used; they read only (web, repo) and write only into this folder.
