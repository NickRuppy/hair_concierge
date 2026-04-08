import { expect, test } from "@playwright/test"
import {
  applyProductMemoryConstraints,
  buildMemoryPromptContext,
  deleteConversationSourcedMemories,
  deleteUserMemoryEntry,
  ensureUserMemorySettings,
  extractDislikedProductNames,
  insertExtractedMemories,
  loadUserMemoryContext,
  normalizeMemoryKey,
  normalizeMemoryToken,
  sanitizeMemoryCandidate,
  updateUserMemoryEntry,
} from "../src/lib/rag/user-memory"
import {
  MEMORY_EXTRACTION_JSON_PROMPT,
  parseMemoryExtractionResult,
} from "../src/lib/rag/memory-extractor"
import type { Product, UserMemoryEntry } from "../src/lib/types"

type TableRow = Record<string, unknown> & {
  id?: unknown
  user_id?: unknown
}
type Tables = Record<string, TableRow[]>
type QueryResult = { data: unknown; error: null | { code?: string; message?: string } }

const NOW = "2026-04-08T00:00:00.000Z"

function createMemoryEntry(
  overrides: Partial<UserMemoryEntry> = {}
): UserMemoryEntry & Record<string, unknown> {
  return {
    id: "memory-1",
    user_id: "user-1",
    kind: "preference",
    content: "Der Nutzer mag leichte Texturen.",
    normalized_key: "preference:textur",
    source: "chat",
    source_conversation_id: "conversation-1",
    evidence: "Ich mag leichte Texturen.",
    confidence: 0.9,
    metadata: {},
    status: "active",
    superseded_by: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as UserMemoryEntry & Record<string, unknown>
}

function createProduct(id: string, name: string): Product {
  return {
    id,
    name,
    brand: "Test",
    description: null,
    short_description: null,
    tom_take: null,
    category: "Oel",
    affiliate_link: null,
    image_url: null,
    price_eur: null,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: [],
    suitable_concerns: [],
    is_active: true,
    sort_order: 1,
    created_at: NOW,
    updated_at: NOW,
  }
}

class FakeSupabaseQuery {
  private filters: Array<{ column: string; value: unknown }> = []
  private operation: "select" | "insert" | "update" | "delete" = "select"
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null
  private maxRows: number | null = null
  private orderColumn: string | null = null

  constructor(
    private tables: Tables,
    private tableName: string
  ) {}

  select(columns?: string) {
    void columns
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    void options
    this.orderColumn = column
    return this
  }

  limit(count: number) {
    this.maxRows = count
    return this
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = "insert"
    this.payload = payload
    return this
  }

  update(payload: Record<string, unknown>) {
    this.operation = "update"
    this.payload = payload
    return this
  }

  delete() {
    this.operation = "delete"
    return this
  }

  async maybeSingle(): Promise<QueryResult> {
    const { data, error } = await this.execute()
    return {
      data: Array.isArray(data) ? data[0] ?? null : data,
      error,
    }
  }

  async single(): Promise<QueryResult> {
    const { data, error } = await this.execute()
    return {
      data: Array.isArray(data) ? data[0] ?? null : data,
      error,
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<QueryResult> {
    const rows = this.tables[this.tableName] ?? []

    if (this.operation === "insert") {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
      const inserted = payloads.map((payload, index) => ({
        id: typeof payload.id === "string"
          ? payload.id
          : `inserted-${rows.length + index + 1}`,
        ...(this.tableName === "user_memory_entries"
          ? { status: payload.status ?? "active" }
          : {}),
        created_at: typeof payload.created_at === "string" ? payload.created_at : NOW,
        updated_at: typeof payload.updated_at === "string" ? payload.updated_at : NOW,
        ...payload,
      }))

      this.tables[this.tableName] = [...rows, ...inserted]
      return { data: inserted, error: null }
    }

    const matchedRows = this.filterRows(rows)

    if (this.operation === "update") {
      const payload = this.payload && !Array.isArray(this.payload) ? this.payload : {}
      for (const row of matchedRows) {
        Object.assign(row, payload, { updated_at: NOW })
      }
      return { data: matchedRows, error: null }
    }

    if (this.operation === "delete") {
      this.tables[this.tableName] = rows.filter((row) => !matchedRows.includes(row))
      return { data: matchedRows, error: null }
    }

    return { data: matchedRows, error: null }
  }

  private filterRows(rows: TableRow[]): TableRow[] {
    let result = rows.filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value)
    )

    if (this.orderColumn) {
      result = [...result].sort((a, b) =>
        String(b[this.orderColumn!] ?? "").localeCompare(String(a[this.orderColumn!] ?? ""))
      )
    }

    if (this.maxRows != null) {
      result = result.slice(0, this.maxRows)
    }

    return result
  }
}

class FakeSupabase {
  constructor(public tables: Tables) {}

  from(tableName: string) {
    if (!this.tables[tableName]) {
      this.tables[tableName] = []
    }
    return new FakeSupabaseQuery(this.tables, tableName)
  }
}

function asSupabase(fake: FakeSupabase): Parameters<typeof insertExtractedMemories>[3] {
  return fake as unknown as Parameters<typeof insertExtractedMemories>[3]
}

test.describe("User memory extraction contracts", () => {
  test("documents the explicit hair-care-only extraction boundary", () => {
    expect(MEMORY_EXTRACTION_JSON_PROMPT).toContain("NUTZER explizit")
    expect(MEMORY_EXTRACTION_JSON_PROMPT).toContain("haarspezifische Erinnerungen")
    expect(MEMORY_EXTRACTION_JSON_PROMPT).toContain("Medizinisch angrenzende Fakten")
    expect(MEMORY_EXTRACTION_JSON_PROMPT).toContain("Negative sentiment")
  })

  test("parses valid structured JSON and rejects malformed or unsupported output", () => {
    const parsed = parseMemoryExtractionResult(JSON.stringify({
      memories: [
        {
          kind: "product_experience",
          memory_key: "product:heavy_oil",
          content: "Der Nutzer hat Heavy Oil nicht gut vertragen.",
          evidence: "Heavy Oil hat bei mir Juckreiz gemacht.",
          confidence: 0.91,
          product_names: ["Heavy Oil"],
          sentiment: "negative",
        },
      ],
    }))

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.kind).toBe("product_experience")
    expect(normalizeMemoryKey(parsed[0]!)).toBe("product_experience:product_heavy_oil")

    expect(parseMemoryExtractionResult("{not json")).toEqual([])
    expect(parseMemoryExtractionResult(JSON.stringify({
      memories: [{ kind: "unsupported", content: "Nope" }],
    }))).toEqual([])
  })
})

test.describe("User memory pure rules", () => {
  test("normalizes stable keys and sanitizes candidate payloads", () => {
    expect(normalizeMemoryToken("Öl & Duft / Heavy!")).toBe("ol_und_duft_heavy")

    expect(
      sanitizeMemoryCandidate({
        kind: "preference",
        content: "  Der Nutzer mag leichte Texturen.  ",
        evidence: "  mag leichte Texturen  ",
        confidence: 0.8,
        product_names: ["  Produkt A  ", ""],
      })
    ).toEqual({
      kind: "preference",
      content: "Der Nutzer mag leichte Texturen.",
      evidence: "mag leichte Texturen",
      confidence: 0.8,
      product_names: ["Produkt A"],
      sentiment: null,
    })

    expect(
      sanitizeMemoryCandidate({
        kind: "preference",
        content: "Der Nutzer mag Duft.",
        confidence: 0.4,
      })
    ).toBeNull()
  })

  test("builds compact prompt context from active memories only", () => {
    const prompt = buildMemoryPromptContext([
      createMemoryEntry({ content: "Der Nutzer mag leichte Leave-ins." }),
      createMemoryEntry({
        id: "memory-2",
        content: "Archiviert",
        status: "archived",
      }),
    ])

    expect(prompt).toContain("Der Nutzer mag leichte Leave-ins.")
    expect(prompt).not.toContain("Archiviert")
  })

  test("downranks exact disliked products only when memory is enabled", () => {
    const memories = [
      createMemoryEntry({
        kind: "product_experience",
        content: "Der Nutzer mochte Heavy Oil nicht.",
        metadata: {
          sentiment: "negative",
          product_names: ["Heavy Oil"],
        },
      }),
    ]

    const products = [
      createProduct("heavy", "Heavy Oil"),
      createProduct("heavy-plus", "Heavy Oil Plus"),
      createProduct("light", "Light Leave-in"),
    ]

    expect(extractDislikedProductNames(memories)).toEqual(["Heavy Oil"])
    expect(
      applyProductMemoryConstraints(products, {
        enabled: true,
        dislikedProductNames: ["Heavy Oil"],
      }).map((product) => product.id)
    ).toEqual(["heavy-plus", "light", "heavy"])

    expect(
      applyProductMemoryConstraints(products, {
        enabled: false,
        dislikedProductNames: ["Heavy Oil"],
      }).map((product) => product.id)
    ).toEqual(["heavy", "heavy-plus", "light"])
  })
})

test.describe("User memory persistence with fake Supabase", () => {
  test("ensures default settings and respects disabled memory context", async () => {
    const fake = new FakeSupabase({
      user_memory_settings: [],
      user_memory_entries: [
        createMemoryEntry({
          kind: "product_experience",
          metadata: { sentiment: "negative", product_names: ["Heavy Oil"] },
        }),
      ],
    })

    await expect(ensureUserMemorySettings("user-1", asSupabase(fake))).resolves.toBe(true)
    expect(fake.tables.user_memory_settings).toEqual([
      expect.objectContaining({ user_id: "user-1", memory_enabled: true }),
    ])

    fake.tables.user_memory_settings = [{ user_id: "user-1", memory_enabled: false }]
    await expect(loadUserMemoryContext("user-1", asSupabase(fake))).resolves.toEqual({
      enabled: false,
      entries: [],
      promptContext: null,
      dislikedProductNames: [],
    })
  })

  test("latest-wins insert archives the old memory and rebuilds the prompt cache", async () => {
    const fake = new FakeSupabase({
      user_memory_entries: [
        createMemoryEntry({
          id: "old-memory",
          kind: "preference",
          content: "Der Nutzer mag Duftstoffe.",
          normalized_key: "preference:preference_duft",
        }),
      ],
      hair_profiles: [{ user_id: "user-1", conversation_memory: null }],
    })

    await insertExtractedMemories(
      "user-1",
      "conversation-2",
      [
        {
          kind: "preference",
          memory_key: "preference:duft",
          content: "Der Nutzer bevorzugt duftfreie Produkte.",
          evidence: "Ich will lieber ohne Duft.",
          confidence: 0.93,
        },
      ],
      asSupabase(fake)
    )

    expect(fake.tables.user_memory_entries).toEqual([
      expect.objectContaining({
        id: "old-memory",
        status: "archived",
        superseded_by: "inserted-2",
      }),
      expect.objectContaining({
        id: "inserted-2",
        status: "active",
        content: "Der Nutzer bevorzugt duftfreie Produkte.",
        source_conversation_id: "conversation-2",
      }),
    ])
    expect(fake.tables.hair_profiles?.[0]).toEqual(
      expect.objectContaining({
        conversation_memory: "- Der Nutzer bevorzugt duftfreie Produkte.",
      })
    )
  })

  test("manual edits clear hidden product metadata and rebuild cache", async () => {
    const fake = new FakeSupabase({
      user_memory_entries: [
        createMemoryEntry({
          id: "memory-1",
          kind: "product_experience",
          metadata: { sentiment: "negative", product_names: ["Heavy Oil"] },
        }),
      ],
      hair_profiles: [{ user_id: "user-1", conversation_memory: null }],
    })

    await updateUserMemoryEntry(
      "user-1",
      "memory-1",
      "Der Nutzer mag inzwischen leichte Oele.",
      asSupabase(fake)
    )

    expect(fake.tables.user_memory_entries?.[0]).toEqual(
      expect.objectContaining({
        content: "Der Nutzer mag inzwischen leichte Oele.",
        source: "manual",
        source_conversation_id: null,
        evidence: null,
        metadata: {},
      })
    )
    expect(fake.tables.hair_profiles?.[0]).toEqual(
      expect.objectContaining({
        conversation_memory: "- Der Nutzer mag inzwischen leichte Oele.",
      })
    )
  })

  test("deletes single memories and conversation-sourced memories without touching manual rows", async () => {
    const fake = new FakeSupabase({
      user_memory_entries: [
        createMemoryEntry({
          id: "delete-me",
          source: "chat",
          source_conversation_id: "conversation-1",
        }),
        createMemoryEntry({
          id: "manual-keep",
          content: "Manuell gepflegte Erinnerung.",
          source: "manual",
          source_conversation_id: null,
        }),
        createMemoryEntry({
          id: "other-conversation",
          source: "chat",
          source_conversation_id: "conversation-2",
        }),
      ],
      hair_profiles: [{ user_id: "user-1", conversation_memory: null }],
    })

    await expect(deleteUserMemoryEntry("user-1", "delete-me", asSupabase(fake))).resolves.toBe(true)
    expect(fake.tables.user_memory_entries?.map((entry) => entry.id)).toEqual([
      "manual-keep",
      "other-conversation",
    ])

    await deleteConversationSourcedMemories("user-1", "conversation-2", asSupabase(fake))
    expect(fake.tables.user_memory_entries?.map((entry) => entry.id)).toEqual([
      "manual-keep",
    ])
    expect(fake.tables.hair_profiles?.[0]).toEqual(
      expect.objectContaining({
        conversation_memory: "- Manuell gepflegte Erinnerung.",
      })
    )
  })
})
