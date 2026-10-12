"""Build the locked v1.6.2 package from the candidate + test round (run once; idempotent overwrite)."""
import hashlib,json,os,shutil,subprocess
DOCS="docs/research/shampoo-inci/v1.6.2"; DATA="data/research/shampoo-inci/v1.6.2"
os.makedirs(DOCS,exist_ok=True); os.makedirs(f"{DATA}/evidence",exist_ok=True)
def sha(p): return hashlib.sha256(open(p,"rb").read()).hexdigest()
def pin(p,extra=None):
    d={"path":p,"bytes":os.path.getsize(p),"sha256":sha(p)}
    if extra: d.update(extra)
    return d
# standard
shutil.copyfile("plans/shampoo-v162/candidate/classification-standard.md",f"{DOCS}/classification-standard.md")
# rule changes
rc=open("plans/shampoo-v162/candidate/rule-changes-v1.6.2.md").read()
rc=rc.replace("# Rule changes: v1.6.2 vs v1.6.1 (candidate)","# Rule changes: v1.6.2 vs v1.6.1")
rc=rc.replace("Target: `plans/shampoo-v162/candidate/classification-standard.md`.","Target: `classification-standard.md` in this directory (locked v1.6.2, 2026-10-12, Nick's decision after the test round). This ledger is the v1.6.2 candidate changelog at lock with file references re-pointed to the locked package; rows 138–143 are unchanged.")
rc=rc.replace("(`plans/shampoo-v16/rulings.md` R18, snapshot in `data/research/shampoo-inci/v1.6.2/rulings-ledger.md`)","(snapshot in `data/research/shampoo-inci/v1.6.2/rulings-ledger.md`)")
open(f"{DOCS}/rule-changes.md","w").write(rc)
# runbook
rb=open("docs/research/shampoo-inci/v1.6.1/runbook.md").read()
for a,b in [("# Shampoo v1.6.1 new-product research runbook","# Shampoo v1.6.2 new-product research runbook"),
 ("under the locked standard `shampoo-classification-v1.6.1`","under the locked standard `shampoo-classification-v1.6.2`"),
 ("It is the v1.6 runbook ([`../v1.6/runbook.md`](../v1.6/runbook.md)) with version, policy and path references updated to v1.6.1","It is the v1.6.1 runbook ([`../v1.6.1/runbook.md`](../v1.6.1/runbook.md)) with version, policy and path references updated to v1.6.2 and the stage-A normalization blinding added to step 3; the procedure is unchanged. The v1.6.1 runbook was the v1.6 runbook ([`../v1.6/runbook.md`](../v1.6/runbook.md)) with version, policy and path references updated to v1.6.1"),
 ("`data/research/shampoo-inci/v1.6.1/artifact-manifest.json`; verify it before a run (`npm run test:node` includes `tests/shampoo-research-v1-6-1-lock.test.ts`)","`data/research/shampoo-inci/v1.6.2/artifact-manifest.json`; verify it before a run (`npm run test:node` includes `tests/shampoo-research-v1-6-2-lock.test.ts`)"),
 ("The lane standard copy is built from the locked v1.6.1 standard by default;","The lane standard copy is built from the locked v1.6.2 standard by default, and every stage-A packet carries only the runbook normalization rule (never a freeze note);"),
 ("the v1.6.1 test round 96.9%;","the v1.6.1 test round 96.9%, the v1.6.2 test round 98.0%;"),
 ("Not fixable under v1.6.1:","Not fixable under v1.6.2:"),
 ("explicitly re-pinned to v1.6.1","explicitly re-pinned to v1.6.2"),
 ("before any v1.6.1 projection is applied","before any v1.6.2 projection is applied"),
 ("and `data/research/shampoo-inci/v1.6.1/test-round/`, are never","`data/research/shampoo-inci/v1.6.1/test-round/` and `data/research/shampoo-inci/v1.6.2/test-round/`, are never")]:
    assert a in rb,a; rb=rb.replace(a,b)
open(f"{DOCS}/runbook.md","w").write(rb)
# evidence + test round
for f in os.listdir("plans/shampoo-v162/inputs"): shutil.copyfile(f"plans/shampoo-v162/inputs/{f}",f"{DATA}/evidence/{f}")
if os.path.exists(f"{DATA}/test-round"): shutil.rmtree(f"{DATA}/test-round")
shutil.copytree("plans/shampoo-v162/test",f"{DATA}/test-round",ignore=shutil.ignore_patterns(".DS_Store","__pycache__"))
# rulings ledger
open(f"{DATA}/rulings-ledger.md","w").write("""# Shampoo v1.6.2 — Nick's rulings ledger

Snapshot at lock (2026-10-12) of every ruling Nick made for v1.6.2, taken from the living ledger `plans/shampoo-v16/rulings.md` (R18) on the Track A rollout branch, the plan `plans/shampoo-v162/plan.md` and the test-round run log. One entry per decision.

## P — Plan: v1.6.2 as its own version (2026-10-12)

Nick: "yes approve both, then do the v1.6.2 + re-check". The R16.4 closed-list batch, deferred by v1.6.1, becomes v1.6.2 with its own test round and lock receipt; v1.6.1 and v1.6 stay frozen and pinned. The Track A re-check of all 73 live shampoos then runs on locked v1.6.2.

## R18 — Irritated-scalp formula check: listed ingredient OR mild surfactant base (2026-10-12)

Two cited evidence checks (`evidence/comfort-route-audit-2026-10-12.md`, `evidence/sensitive-scalp-levers-2026-10-12.md`) found no independent rinse-off evidence that any E4 comfort ingredient soothes the scalp on its own; the rejected candidates sit at a similar level (`evidence/closed-list-candidates-2026-10-12.md`). Dermatology reviews name a mild surfactant system as the main lever (consensus-level evidence).

1. Marketing claims alone never pass a scalp gate (Nick: "I think generally we don't just trust marketing claims"). The formula must show something.
2. Option C (Nick: "I guess then C is the cleanest rule"): the S-SENSITIVE formula gate passes on a prominent listed comfort ingredient OR a mild surfactant base. Main-session precision inside the ruling: mild base = `cleansingStrength` low or moderate and no prominent strong anionic of either C3 type (rows 139–140).
3. The closed lists stay closed; no candidate is added (aloe juice, Lactococcus ferment lysate, arginine, lauryl lactate, PEG-18 glyceryl oleate/cocoate, glycosphingolipids). `Laureth-9` is the INCI name of the listed `Polidocanol` (rows 141–142).
4. The list is a plausibility filter, not proof: research never supports "soothes" in user copy (row 143).
5. Scope: S-SENSITIVE only; S-DRY unchanged.

## Lock — test-round adjudication and lock (2026-10-12)

Test round: two sealed Opus lanes, 9 Track A products, 150/153 = 98.0%. The registered move (Sebamed Every-Day → `sensitive` via MB) happened in both lanes; every control held. Nick ("yes to both"): A21 ISANA MED Totes Meer weight boundary (low → moderate in both lanes, not a v1.6.2 rule) is resolved in the Track A re-check, cautious `moderate` per R14 if it stays split; A43 Sante conditioning variance is research-only, no action. Lock v1.6.2.
""")
# README (docs)
open(f"{DOCS}/README.md","w").write("""# Shampoo classification v1.6.2

Status: **LOCKED v1.6.2 (2026-10-12, Nick's decision after the test round: "yes to both"). Active research method. Not production-active.**

| Field | Value |
| --- | --- |
| Policy ID | `shampoo-classification-v1.6.2` |
| Analysis model version | `shampoo-inci-v1.6.2` |
| Lock receipt | [`data/research/shampoo-inci/v1.6.2/v1.6.2-logic-lock-receipt.json`](../../../../data/research/shampoo-inci/v1.6.2/v1.6.2-logic-lock-receipt.json) |
| Artifact manifest | [`data/research/shampoo-inci/v1.6.2/artifact-manifest.json`](../../../../data/research/shampoo-inci/v1.6.2/artifact-manifest.json) (bytes + SHA-256 of every locked file) |
| CI pin check | `tests/shampoo-research-v1-6-2-lock.test.ts` (runs in `npm run test:node`) |
| Base | [v1.6.1](../v1.6.1/README.md), locked 2026-10-12, byte-frozen and unchanged; still guarded by `tests/shampoo-research-v1-6-1-lock.test.ts` (and v1.6 by `tests/shampoo-research-v1-6-lock.test.ts`) |

## Files

| File | Purpose |
| --- | --- |
| [`classification-standard.md`](./classification-standard.md) | The normative locked standard: the full v1.6.1 text plus the v1.6.2 changes (marked "(v1.6.2)"). Self-contained. |
| [`rule-changes.md`](./rule-changes.md) | Rows 138–143, every change from v1.6.1, with its source and whether it could change a live value. Rows 1–137 stay in the v1.6 and v1.6.1 ledgers. |
| [`runbook.md`](./runbook.md) | How to research a new German shampoo under v1.6.2: the v1.6.1 procedure with version and path references updated. |

## Authority

- The standard in this directory is the only normative v1.6.2 text. It is byte-frozen; a rule change is a new version with its own test round and lock receipt.
- v1.6.1 and v1.6 are not edited.
- Locking approves the research method only. Product Intake reconciliation, catalog or Supabase writes, recommendation changes and user-facing copy each need their own approval (standard Section 16).
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is still pinned to v1.4. Re-pinning it to v1.6.2 is a separate, reviewed change.
- The candidate and the plan (`plans/shampoo-v162/`) show how the standard got here; they are not normative. The receipt pins a snapshot of the rulings and copies of the evidence and the test round.

## What changed vs v1.6.1 (ruling R18)

- **Mild-base route (MB).** A sensitive-scalp claim now passes the formula check when the formula has a listed comfort ingredient before the perfume **or** a mild surfactant base: no strong anionic surfactant (alkyl sulfates, alkyl ether sulfates, olefin/alkylbenzene sulfonates) before the perfume and cleansing strength low or moderate. Claims alone still never pass. Dry scalp is unchanged.
- **Closed-list batch decided.** No ingredient is added to any list; six candidates are rejected for lack of rinse-off evidence.
- **Laureth-9 = Polidocanol.** The listed comfort ingredient is now also recognised under its INCI name.
- **Evidence boundary.** The lists and MB are plausibility filters, not proof of soothing; research never supports "soothes" in user copy.

## Test-round evidence

Under [`data/research/shampoo-inci/v1.6.2/test-round/`](../../../../data/research/shampoo-inci/v1.6.2/test-round/): two sealed Opus lanes, two-stage kit, 9 Track A products, expected outcomes pre-registered before any lane ran. 150/153 = 98.0% agreement. The one registered move (Sebamed Every-Day to `sensitive` via MB) happened in both lanes; every control held. Two departures, neither touching a v1.6.2 rule, were adjudicated by Nick (run log).

## Open after lock

1. Track A re-check: all 73 live shampoos plus three corrected packets on v1.6.2 (rollout worktree), then Nick's review of the changes only.
2. Production Light re-pin to v1.6.2 and the app weight / three-tier PR (with the R19 live-display rule: scalp concern decides the fit colour).
""")
# receipt
std=f"{DOCS}/classification-standard.md"
r161=json.load(open("data/research/shampoo-inci/v1.6.1/v1.6.1-logic-lock-receipt.json"))
TR=f"{DATA}/test-round"
receipt={"schema_version":"shampoo-research-logic-lock-receipt.v1.6.2","locked_standard_version":"1.6.2","policy_id":"shampoo-classification-v1.6.2","model_version":"shampoo-inci-v1.6.2","locked_at":"2026-10-12","decision":"approved_and_locked_for_reuse","decision_ruling":"Lock","decision_quote":"yes to both","decision_basis":"Nick's decision after the sealed two-lane test round (run log, 'Adjudication'); ledger entry 'Lock — test-round adjudication and lock (2026-10-12)'",
 "normative_standard":pin(std),
 "base_method":{"policy_id":"shampoo-classification-v1.6.1","path":"docs/research/shampoo-inci/v1.6.1/classification-standard.md","sha256":sha("docs/research/shampoo-inci/v1.6.1/classification-standard.md")},
 "base_lineage":{"policy_id":"shampoo-classification-v1.6","path":"docs/research/shampoo-inci/v1.6/classification-standard.md","sha256":sha("docs/research/shampoo-inci/v1.6/classification-standard.md")},
 "candidate_working_record":{"path":"plans/shampoo-v162/candidate/classification-standard.md","sha256_at_lock":sha("plans/shampoo-v162/candidate/classification-standard.md"),"sha256_tested":subprocess.check_output(["git","show","41eac740:plans/shampoo-v162/candidate/classification-standard.md"]).decode() and hashlib.sha256(subprocess.check_output(["git","show","41eac740:plans/shampoo-v162/candidate/classification-standard.md"])).hexdigest(),"note":"Not normative and not pinned. The test round's lane kits were built from the candidate as committed in 41eac740 (sha256_tested). The locked text differs from it only in the Version block (Status LOCKED, Lock receipt and Test-round evidence rows); no rule text changed after the test."},
 "approved_scope":r161["approved_scope"],
 "rulings":{"ledger_snapshot":pin(f"{DATA}/rulings-ledger.md"),"living_ledger_path":"plans/shampoo-v16/rulings.md (codex/shampoo-v16-rollout)","base_rulings":"v1.6 rulings R1-R17 and v1.6.1 rulings S1-S4, D1-D6, R1-R4 stay in force unchanged","applied":["R18.1","R18.2","R18.3","R18.4","R18.5"]},
 "test_round_evidence":{"corpus_root":f"{TR}/","copied_from":"plans/shampoo-v162/test/","evidence_root":f"{DATA}/evidence/","evidence_copied_from":"plans/shampoo-v162/inputs/","lanes_per_run":2,
   "lane_design":"two independent sealed Opus lanes; two-stage kit (scripts/shampoo-research/build-lane-kit.ts with --standard pointing at the candidate): blind formula packets first (stage-A normalization carries only the runbook rule), reveal packets released only after both lanes' formula-pass records were committed (c3adc93d); scrubbed standard copy without worked examples; no web",
   "runs":[{"id":"v1.6.2-test-round","products":9,"composition":"9 Track A freeze packets not touched by v1.6.1 (mechanical screen): the R18 mover G03, sulfate-base controls A43/A24/A21, listed-route passes A05/A03/A40, dandruff-path combination controls G01/A06; blind ids VS01-VS09, seed 20261013","agreement":"150/153","raw_agreement":0.98,"report":f"{TR}/run-log.md","compare_output":f"{TR}/compare-output.txt","pre_registration":f"{TR}/pre-registration.md"}],
   "adjudications":[{"product":"A21 ISANA MED Totes Meer","field":"weightPotential","value":"resolved in the Track A re-check; cautious moderate if still split (R14)","cause":"boundary_variance_not_v1.6.2"},{"product":"A43 Sante Sensitive Care","field":"conditioningLevel","value":"no action (research-only, no projected change)","cause":"research_only_variance"}]},
 "post_test_rulings":{"applied":["A21 to the Track A re-check","A43 no action"],"rule_changes":[],"recalibrated":False,"basis":"the test round passed; Nick adjudicated the two departures cause-coded without tuning and without changing a rule"},
 "known_limits_retained":["One sealed two-lane test round on 9 products; there is no separate unseen re-run for v1.6.2. The cohort products were known to the rule authors (Track A).","MB rests on consensus-level evidence (mild surfactant system), not controlled shampoo trials; the E4 lists likewise have no independent rinse-off soothing evidence (evidence/).","The first kit build carried a retailer name in the stage-A normalization text; it was rebuilt with the fix before any lane ran (run log)."],
 "separate_gates":{"production_light_adapter_repin":False,"live_weight_column_and_authority_rule":False,"track_a_recheck_applied":False,"n1_no_gap_preflight":False,"individual_product_review_completed":False,"catalog_activation":False,"production_database_write":False,"user_facing_copy_change":False},
 "separate_gates_note":"Every gate is false: none is authorized or done by this lock. The Production Light adapter stays pinned to v1.4; the Track A re-check, the N1 preflight and every catalog apply need their own approval.",
 "production_writes":False}
json.dump(receipt,open(f"{DATA}/v1.6.2-logic-lock-receipt.json","w"),indent=2,ensure_ascii=False); open(f"{DATA}/v1.6.2-logic-lock-receipt.json","a").write("\n")
def files(root):
    out=[]
    for dp,dn,fn in os.walk(root):
        for f in fn:
            if f==".DS_Store": continue
            out.append(os.path.join(dp,f))
    return sorted(out)
ev=[pin(p) for p in files(f"{DATA}/evidence")]; tr=[pin(p) for p in files(TR)]
manifest={"schema_version":"shampoo-research-artifact-manifest.v1.6.2","created_at":"2026-10-12","policy_id":"shampoo-classification-v1.6.2","model_version":"shampoo-inci-v1.6.2",
 "normative_source":pin(std,{"verification":"tests/shampoo-research-v1-6-2-lock.test.ts"}),
 "base_standard":pin("docs/research/shampoo-inci/v1.6.1/classification-standard.md",{"verification":"tests/shampoo-research-v1-6-1-lock.test.ts"}),
 "runbook":pin(f"{DOCS}/runbook.md",{"verification":"tests/shampoo-research-v1-6-2-lock.test.ts"}),
 "rule_change_ledger":pin(f"{DOCS}/rule-changes.md",{"verification":"tests/shampoo-research-v1-6-2-lock.test.ts"}),
 "readme":pin(f"{DOCS}/README.md",{"verification":"tests/shampoo-research-v1-6-2-lock.test.ts"}),
 "rulings_ledger":pin(f"{DATA}/rulings-ledger.md",{"verification":"tests/shampoo-research-v1-6-2-lock.test.ts"}),
 "logic_lock_receipt":pin(f"{DATA}/v1.6.2-logic-lock-receipt.json"),
 "evidence":{"root":f"{DATA}/evidence/","copied_from":"plans/shampoo-v162/inputs/","files":len(ev),"artifacts":ev},
 "test_round":{"root":f"{TR}/","copied_from":"plans/shampoo-v162/test/","files":len(tr),"key_reports":[pin(f"{TR}/{f}") for f in ["pre-registration.md","pre-registration.json","compare-output.txt","preregistration-check.txt","run-log.md"]],"note":"Full test-round corpus: packets, kit (formula, reveal, held, both lanes' formula-pass and final records), baseline, pre-registration, comparison and run log.","artifacts":tr},
 "production_writes":False}
json.dump(manifest,open(f"{DATA}/artifact-manifest.json","w"),indent=2,ensure_ascii=False); open(f"{DATA}/artifact-manifest.json","a").write("\n")
print("manifest",sha(f"{DATA}/artifact-manifest.json")); print("standard",sha(std)); print("base",sha("docs/research/shampoo-inci/v1.6.1/classification-standard.md")); print("tr files",len(tr),"ev",len(ev))
