# Oil fresh intake v1

Fresh Product Intake oil research uses method `intake_research` with engine
`oil-standard`, methodology `v0.8`, adapter `oil-production-adapter-v1`, and
the complete pinned policy tuple in `OIL_INTAKE_METHOD`.

The researcher records the actual identity, raw INCI, ordered literal
ingredients, source evidence, profile, trace, fit and source-method evidence.
Do not supply formula hashes, normalized hashes, an original-record copy or
any digest. `assembleFreshOilResearchEnvelope` derives those values from the
authored raw declaration, ordered ranks and profile before storage.

The fresh envelope must have a non-null Product Intake submission identifier,
`provenance.import_kind: current`, declared source method `v0.8`, and a
complete-declaration admission receipt where applicable. A historical
consolidation envelope is never converted into a current intake record.

Persist with `createOilStorage`. It writes a readable envelope mirror and the
exact JSON body plus SHA-256. Read with `resolveOilStorage(payload,
{ requireFresh: true })`; this validates the exact body hash, schema, current
method/source binding, and structural mirror equality while permitting the key
reordering that PostgreSQL JSONB performs. The exact body remains authoritative
for byte-sensitive provenance digests.

The worker also retains `oil_admission_context_json`, its SHA-256 and the readable
`oil_admission_context` mirror. It updates all three together after receiving the
persisted identity-artifact UUID. The Lab exporter validates the exact bytes and
mirror; SQL hashes those stored UTF-8 bytes rather than serializing JSONB again.
Likewise, receipt import sends both `p_snapshot_json` and its parsed `p_snapshot`,
checks equality and hashes/measures the exact JSON string (maximum 128 KiB).

The engine projects only oil weight, supported fibre roles and heat protection.
Any matching suggestions remain manual review material in the Research Lab.
