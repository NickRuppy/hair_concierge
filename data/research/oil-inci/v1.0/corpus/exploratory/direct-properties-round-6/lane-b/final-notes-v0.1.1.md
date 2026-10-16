# Lane B controlled-unblind source correction v0.1.1

This is a separate source-only corrected derivation. The run_id and method_revision remain unchanged because the classifier rules and blind inputs have not changed. All original blind and final files were left untouched; every blind record field and every source-unaffected final field was preserved exactly.

Five current derivation inputs, actual bytes read and SHA256:

- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/method.md — d4cb051f53bcd1e9fd46b8d041b10253245c127d5f62d046ef43de4491a1ac72
- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/blind-packet.json — 802edeb887c93f00a4f9194219e55c7695fb7e89f3ea01e697df93b91060bf48
- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/blind-lexicon.json — 7840fe6645b08ab24248463f7cc6abf575fe081c8775ff607dfba7e7298c88ca
- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/unblinded-packet-v0.1.1.json — 433db0f3b0dafb529491b49e504c29b7efb8dff69de59cc3ca7697e12ac82e35
- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/blind-stage-seal.json — 12b32292260574d81596fe0d7cded389c595662c7c9a8bbd3ac9b9c71bce3ddc

Own output reads for lineage and preservation, excluded from the five input entries:
- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/lane-b/final-records.json — 15ab282ef29c6cea6372f2408faa3b35b59075e0ee60412c65190524ab43c3a2
- /Users/nick/AI_work/hair_conscierge/.worktrees/oil-inci/data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6/lane-b/blind-records.json — f21624c7fdee1c2126e479198e28d7cfc766744918c1423bc69b3ae89992206a

Seal chronology and limitation: the first authorized Stage 2 read observed the original seal at 2026-10-05T09:03:35.165338+00:00, SHA256 12b32292260574d81596fe0d7cded389c595662c7c9a8bbd3ac9b9c71bce3ddc. Root subsequently rewrote only the timestamp during verifier bookkeeping. Initial final generation read that transient seal and recorded SHA256 41902e851f279faea88223928a7bb077a15a9110c88e95437a841523155ce644. The initial final receipt is preserved rather than rewritten. Root restored the original seal; this revision actually re-read its bytes and verified the original SHA256. The transient seal bytes are no longer available to this lane, so their content beyond the retained digest and root bookkeeping report cannot be reconstructed or independently rechecked here. The exact own blind hash matches the restored seal, and the original blind record fields remain equal.

Corrected source-dependent results:
- D03 heat protection is true from the accepted explicit maker claim Hitzeschutz bis 230°C. The temperature stays in source text; no formula field changes.
- D03 adds the independently stated prewash hair oil-bath route. Supported uses are pre_wash_fibre_treatment, leave_on_fibre_conditioning and dry_finish. Both current directions retain their exact no-direct-scalp restrictions. No new dose, contact time, scalp permission or pump-to-drop conversion is supplied.
- D03 French camellia and wild camellia each have unknown prominence and empty matched_ranks because the current source has identity_unresolved=true with no unique exact-INCI mapping. They are not labelled absent. Marula remains supporting. There are now three D03 source heroes.
- D03 dispenser remains pump; its evidence now follows explicit maker pump/refill instructions.
- D06 Amla macerate now matches only rank 8 EMBLICA OFFICINALIS FRUIT POWDER. Prominence stays unknown because its frozen role is unresolved and its specific macerate carrier is unestablished. Castor is not inferred as that carrier. The seven individual oil heroes are unchanged.

Current totals: six records, eleven separate source directions, nineteen source hero items, sixty fit cells unknown/policy_not_defined. Every direction has copied source_id, direction_id, site, stage, dose, contact_time, removal and restrictions. Direction-role unions equal supported_uses. D01/D02/D04/D05 records are unchanged; D06 changes only the Amla hero item; D03 changes only the six source-dependent fields listed below.
{"D01": [], "D02": [], "D03": ["application_scenarios", "dispenser", "named_oils", "provides_heat_protection", "supported_uses", "use_evidence"], "D04": [], "D05": [], "D06": ["named_oils"]}

Remaining uncertainty: unresolved French/wild camellia exact identities; Gardenia Monoi compound-role conflict; Rosemary auxiliary prominence outside a qualified suffix; Amla powder function/carrier; D04 and D06 dispenser mechanisms; every inherited blind gap remains unchanged. No new formula evidence, fit policy, physical pack/batch verification or measured performance claim is introduced.

Access and independence: only permitted inputs and own lineage outputs were read. No browsing, memory files, other repository files, peer classifications, source-packet files or reviewers were accessed. The authorized seal exposes peer hashes and administrative text only. No product identity was consciously recognized in the blind stage; product identities were then supplied by the authorized Stage 2 packet. General ingredient familiarity and the methods disclosed prior development exposure remain. This is a self-reported prompt scope, not an enforced sandbox or unseen holdout. The root seal timestamp incident is disclosed above and is not hidden by editing an earlier receipt.

Verification was local and in memory: actual five-input digests, restored seal/own blind hash, every blind field preserved, allowed corrected-field scope, all current source heroes and directions accounted for, exact factual scenario equality, use-role unions, property/hero schemas, unknown metadata and all fit cells. No root verifier was run. Only lane-b/final-records-v0.1.1.json and lane-b/final-notes-v0.1.1.md were written.
