"""Build the Track A live apply (v1.6.2 run 2 + Nick's rulings R18-R20) as a reviewed SQL migration.

Projection into today's live schema (no weight / tier column yet):
- no-scalp-issue bucket `normal`: write only T7 full-fit thicknesses (fine: light; normal: light|moderate;
  coarse: heavy). The live fit evaluator scores missing thicknesses by distance (1 step = Passt bedingt,
  2 steps = Passt nicht), which reproduces T7's amber/red without storing tiers.
- scalp buckets: every researched thickness (thickness is ignored in scalp cells, R19 / #674).
- route = the bucket's primary route; intensity = the researched observed intensity.
Overrides (Nick): Monday coarse x oily (X1 kept, 2026-10-12); Balea Tiefenreinigung oily (R20.1);
Garnier Honig applied despite the stale-claim research flag (R20.2); H&S DERMAXPRO Sensitive Pflege not
recommended (discontinued); Hask row re-pointed to the 473 ml successor (rename + GTIN); L'Oréal rename.
"""
import json,glob,hashlib,io,contextlib,runpy,sys,os
from collections import defaultdict
D="data/research/shampoo-inci/v1.6-track-a"; OUT="plans/shampoo-v16-rollout/track-a/apply"
os.makedirs(OUT,exist_ok=True)
sys.argv=["x","data/research/shampoo-inci/v1.6-track-a/run-2-v1.6.2"]  # committed sealed lane records
with contextlib.redirect_stdout(io.StringIO()): ns=runpy.run_path("plans/shampoo-v16-rollout/track-a/consolidate_run2.py")
final=ns["final"]
packets={json.load(open(p))["slot"]:json.load(open(p)) for p in glob.glob(f"{D}/packets/*.json")}
live=json.load(open(f"{D}/live-rows-2026-10-12.json"))
ROUTE={"normal":"balanced","dehydriert-fettig":"oily","trocken":"dry","irritationen":"irritated","schuppen":"dandruff"}
ORDER={"fine":0,"normal":1,"coarse":2}
MONDAY,BALEA_TR,GARNIER,DERMAX,HASK,LOREAL="A29","U1","A09","A17","A15b","A25"
# Held back: Sebamed Anti Schuppen Plus moves to schuppen, which needs a shampoo_dandruff protocol it does not have yet
# (live role shampoo_everyday) -> follow-up with the protocol; its live rows stay untouched here.
HOLD={"A50"}
target={}; notes=defaultdict(list)
for s,f in final.items():
    if s in HOLD: continue
    pid=f["productId"]; rows=[]
    if f["needsResearch"]:
        assert s==GARNIER, f"unexpected needs_research {s}"; notes[pid].append("R20.2 newest formula: research flag from stale old-formula claim resolved")
    src=list(f["rows"].values())
    if s==BALEA_TR:
        src=[{**r,"shampoo_bucket":"dehydriert-fettig"} for r in src]; notes[pid].append("R20.1 oily-scalp lexicon gap override")
    for r in src:
        b=r["shampoo_bucket"]
        if b=="normal" and r["t7Tier"]!="ideal": continue
        rows.append((r["thickness"],b,ROUTE[b],r["cleansing_intensity"]))
    if s==MONDAY:
        rows.append(("coarse","dehydriert-fettig","oily","regular")); notes[pid].append("X1 kept by Nick: coarse x oily override")
    rows=sorted(set(rows),key=lambda x:(ORDER[x[0]],x[1]))
    keys=[(x[0],x[1]) for x in rows]; assert len(keys)==len(set(keys)), (s,rows)
    assert rows, s
    target[pid]={"slot":s,"name":packets[s]["name"].split(" (")[0],"rows":rows,"suitable":sorted({x[0] for x in rows},key=ORDER.get)}
# live (fingerprint-verified 2026-10-13: 102 rows, md5 b6885a73fac70975cd93d28c9ebc0665)
guard_ids={f["productId"] for f in final.values()}
old=defaultdict(list); rec={}; guard_rows=[]
for pid,r,th,b,route,i in live["rows"]:
    if pid in guard_ids: guard_rows.append((pid,th,b,route or "",i or "")); rec[pid]=r
    if pid in target: old[pid].append((th,b,route or "",i or ""))
assert set(old)==set(target), set(old)^set(target)
fp_rows=sorted(guard_rows)
FP=hashlib.md5("\n".join("|".join(r) for r in fp_rows).encode()).hexdigest()
assert FP=="b6885a73fac70975cd93d28c9ebc0665", FP
rec_after=dict(rec); dermax=final[DERMAX]["productId"]; rec_after[dermax]=False
# N1 (same contract as the SQL assertion): every profile cell has a recommended pick that is at least
# Passt bedingt (<= 1 step). Evaluator semantics (#669/#674): `normal` bucket = nearest-thickness steps +
# intensity steps vs `regular`; scalp buckets = intensity steps vs the bucket default (thickness ignored).
INT={"gentle":0,"regular":1,"clarifying":2}; DEF={"normal":"regular","dehydriert-fettig":"regular","schuppen":"regular","irritationen":"gentle","trocken":"gentle"}
# Candidate set = the whole live shampoo catalog (as the SQL check): target + held Track A products + the products
# outside Track A from the committed catalog-status file; filters = recommended AND active AND lifecycle active.
status=json.load(open(f"{D}/catalog-status-2026-10-13.json"))
inactive={x["id"] for x in status["inactive"]}
held_rows=defaultdict(list)
for pid,r,th,b,route,i in live["rows"]:
    if pid in guard_ids and pid not in target: held_rows[pid].append((th,b,route,i))
for x in status["outsideTrackA"]:
    held_rows[x["id"]]=[tuple(r) for r in x["rows"]]; rec_after[x["id"]]=x["is_chaarlie_recommended"]
for pid in inactive: rec_after[pid]=False
cells={}
for th in ORDER:
    for b in DEF:
        best=None
        for pid in list(target)+list(held_rows):
            if not rec_after.get(pid): continue
            rows=[x for x in (target[pid]["rows"] if pid in target else held_rows[pid]) if x[1]==b]
            if not rows: continue
            if b=="normal":
                d=min(abs(ORDER[th]-ORDER[x[0]]) for x in rows); near=[x for x in rows if abs(ORDER[th]-ORDER[x[0]])==d]
                assert len({x[3] for x in near})==1, (pid,near); steps=d+abs(INT[near[0][3]]-INT[DEF[b]])
            else:
                steps=min(abs(INT[x[3]]-INT[DEF[b]]) for x in rows)
            best=steps if best is None else min(best,steps)
        cells[f"{th}x{b}"]=best
n1=[c for c,v in cells.items() if v is None or v>1]
assert not n1, n1
cov={tuple(k.split("x",1)):v for k,v in cells.items()}
# change list
changes=[]
for pid,t in sorted(target.items(),key=lambda kv:kv[1]["slot"]):
    o=sorted(old[pid],key=lambda x:(ORDER[x[0]],x[1])); n=[tuple(x) for x in t["rows"]]
    if o!=n or rec.get(pid)!=rec_after.get(pid):
        changes.append({"slot":t["slot"],"name":t["name"],"productId":pid,"recommended":rec.get(pid),"recommendedAfter":rec_after.get(pid),"old":o,"new":n,"notes":notes[pid]})
json.dump({"fingerprint":FP,"target":target,"changes":changes,"coverageBestSteps":cells,"held":sorted(HOLD)},open(f"{OUT}/apply-plan.json","w"),indent=1,ensure_ascii=False)
# SQL
ids=",".join(f"'{p}'" for p in sorted(target))
guard_ids_sql=",".join(f"'{p}'" for p in sorted(guard_ids))
L=[]
L.append("""-- Shampoo v1.6.2 Track A apply (73 live products + the Hask 473 ml successor), Nick 2026-10-12/13.
-- Source: data/research/shampoo-inci/v1.6-track-a/run-2-v1.6.2 (sealed two-lane research, locked v1.6.2),
-- plans/shampoo-v16-rollout/track-a/build_apply.py, rulings plans/shampoo-v16/rulings.md R18-R20.
-- Projection: no-scalp rows only for T7 full-fit thicknesses (distance gives Passt bedingt/nicht);
-- scalp rows for every researched thickness (thickness ignored in scalp cells, R19).
-- Guard: aborts unless the live rows of these products still match the reviewed snapshot.
-- Rollback: public.shampoo_v162_apply_backup_specs / _products hold the previous state.
""")
L.append("""LOCK TABLE public.product_shampoo_specs, public.products, public.product_thickness_eligibility,
  public.product_concern_eligibility, public.product_identifiers IN SHARE ROW EXCLUSIVE MODE;
""")
L.append(f"""DO $$
DECLARE fp text; n int;
BEGIN
  SELECT count(*), md5(string_agg(product_id::text||'|'||thickness||'|'||shampoo_bucket||'|'||coalesce(scalp_route,'')||'|'||coalesce(cleansing_intensity,''), E'\\n'
         ORDER BY product_id::text COLLATE "C", thickness COLLATE "C", shampoo_bucket COLLATE "C", coalesce(scalp_route,'') COLLATE "C", coalesce(cleansing_intensity,'') COLLATE "C"))
    INTO n, fp FROM public.product_shampoo_specs WHERE product_id IN ({guard_ids_sql});
  IF n <> {len(fp_rows)} OR fp <> '{FP}' THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: live rows changed since review (n=%, fp=%)', n, fp;
  END IF;
END $$;
""")
L.append(f"""CREATE TABLE public.shampoo_v162_apply_backup_specs AS
  SELECT * FROM public.product_shampoo_specs WHERE product_id IN ({ids});
CREATE TABLE public.shampoo_v162_apply_backup_products AS
  SELECT id, name, suitable_thicknesses, is_chaarlie_recommended FROM public.products WHERE id IN ({ids});
CREATE TABLE public.shampoo_v162_apply_backup_thickness_elig AS
  SELECT * FROM public.product_thickness_eligibility WHERE category_key = 'shampoo' AND product_id IN ({ids});
CREATE TABLE public.shampoo_v162_apply_backup_concern_elig AS
  SELECT * FROM public.product_concern_eligibility WHERE category_key = 'shampoo' AND product_id IN ({ids});
ALTER TABLE public.shampoo_v162_apply_backup_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_thickness_elig ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_concern_elig ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shampoo_v162_apply_backup_specs, public.shampoo_v162_apply_backup_products,
  public.shampoo_v162_apply_backup_thickness_elig, public.shampoo_v162_apply_backup_concern_elig FROM anon, authenticated;
""")
L.append(f"DELETE FROM public.product_shampoo_specs WHERE product_id IN ({ids});\n")
vals=[]
for pid,t in sorted(target.items()):
    for th,b,route,i in t["rows"]: vals.append(f"  ('{pid}','shampoo','{th}','{b}','{route}','{i}')")
for pid,t in sorted(target.items()):
    arr=",".join(f"'{x}'" for x in t["suitable"])
    L.append(f"UPDATE public.products SET suitable_thicknesses = ARRAY[{arr}]::text[] WHERE id = '{pid}';")
L.append("\nINSERT INTO public.product_shampoo_specs (product_id, category_key, thickness, shampoo_bucket, scalp_route, cleansing_intensity) VALUES\n"+",\n".join(vals)+";\n")
hask=final[HASK]["productId"]; lor=final[LOREAL]["productId"]
L.append(f"""UPDATE public.products SET is_chaarlie_recommended = false WHERE id = '{dermax}'; -- H&S DERMAXPRO Sensitive Pflege: discontinued (Nick 2026-10-12)
UPDATE public.products SET name = 'Hask Shampoo Repair + Argan Oil' WHERE id = '{hask}'; -- 473 ml successor of the 355 ml Argan Oil row
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14 = '00071164341469' AND product_id <> '{hask}') THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: GTIN 071164341469 belongs to another product';
  END IF;
END $$;
INSERT INTO public.product_identifiers (product_id, identifier_type, identifier_value, source)
  SELECT '{hask}', 'ean', '071164341469', 'shampoo-v162-track-a-2026-10-13'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14 = '00071164341469');
UPDATE public.products SET name = 'L''Oréal Paris Elvital Glycolic Gloss Shampoo' WHERE id = '{lor}'; -- catalog placeholder name 'Ultimate Shampoo'
""")
L.append("""-- N1 (same contract as build_apply.py): every thickness x bucket cell has an active recommended pick that is at
-- least Passt bedingt: `normal` = nearest-thickness steps + intensity steps vs 'regular'; scalp buckets = intensity
-- steps vs the bucket default (thickness ignored, R19).
DO $$
BEGIN
  IF EXISTS (
    WITH ti(th, i) AS (VALUES ('fine',0),('normal',1),('coarse',2)),
         ii(intensity, i) AS (VALUES ('gentle',0),('regular',1),('clarifying',2)),
         dflt(bucket, intensity) AS (VALUES ('normal','regular'),('dehydriert-fettig','regular'),('schuppen','regular'),('irritationen','gentle'),('trocken','gentle')),
         rows AS (
           SELECT s.product_id, s.shampoo_bucket, t.i AS t_i, x.i AS int_i
           FROM public.product_shampoo_specs s
           JOIN public.products p ON p.id = s.product_id AND p.is_chaarlie_recommended AND p.is_active AND p.lifecycle_status = 'active'
           JOIN ti t ON t.th = s.thickness JOIN ii x ON x.intensity = s.cleansing_intensity),
         cell AS (SELECT t.th, t.i AS want_t, d.bucket, di.i AS want_int FROM ti t CROSS JOIN dflt d JOIN ii di ON di.intensity = d.intensity),
         normal_steps AS (
           SELECT c.th, c.bucket, r.product_id,
                  min(abs(r.t_i - c.want_t)) AS dist
           FROM cell c JOIN rows r ON r.shampoo_bucket = c.bucket AND c.bucket = 'normal'
           GROUP BY c.th, c.bucket, r.product_id),
         normal_best AS (
           SELECT n.th, n.bucket, min(n.dist + (SELECT min(abs(r.int_i - 1)) FROM rows r WHERE r.product_id = n.product_id AND r.shampoo_bucket = 'normal'
                                                AND abs(r.t_i - (SELECT i FROM ti WHERE th = n.th)) = n.dist)) AS steps
           FROM normal_steps n GROUP BY n.th, n.bucket),
         scalp_best AS (
           SELECT c.th, c.bucket, min(abs(r.int_i - c.want_int)) AS steps
           FROM cell c JOIN rows r ON r.shampoo_bucket = c.bucket AND c.bucket <> 'normal'
           GROUP BY c.th, c.bucket),
         best AS (SELECT * FROM normal_best UNION ALL SELECT * FROM scalp_best)
    SELECT 1 FROM cell c LEFT JOIN best b ON b.th = c.th AND b.bucket = c.bucket
    WHERE b.steps IS NULL OR b.steps > 1
  ) THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: N1 no-gap check failed';
  END IF;
END $$;
""")
open(f"{OUT}/migration.sql","w").write("\n".join(L))
open(f"{OUT}/rollback.sql","w").write(f"""-- Rollback of the shampoo v1.6.2 Track A apply: restores specs, product fields, both eligibility tables and
-- identifiers from the backup tables written by the migration. Backup tables are dropped only by a later cleanup
-- migration after the apply has been verified (they hold no user data).
BEGIN;
LOCK TABLE public.product_shampoo_specs, public.products, public.product_thickness_eligibility,
  public.product_concern_eligibility, public.product_identifiers IN SHARE ROW EXCLUSIVE MODE;
DELETE FROM public.product_shampoo_specs WHERE product_id IN ({ids});
UPDATE public.products p SET name = b.name, suitable_thicknesses = b.suitable_thicknesses, is_chaarlie_recommended = b.is_chaarlie_recommended
  FROM public.shampoo_v162_apply_backup_products b WHERE p.id = b.id;
DELETE FROM public.product_thickness_eligibility WHERE category_key = 'shampoo' AND product_id IN ({ids});
INSERT INTO public.product_thickness_eligibility SELECT * FROM public.shampoo_v162_apply_backup_thickness_elig ON CONFLICT DO NOTHING;
DELETE FROM public.product_concern_eligibility WHERE category_key = 'shampoo' AND product_id IN ({ids});
INSERT INTO public.product_concern_eligibility SELECT * FROM public.shampoo_v162_apply_backup_concern_elig ON CONFLICT DO NOTHING;
INSERT INTO public.product_shampoo_specs SELECT * FROM public.shampoo_v162_apply_backup_specs;
DELETE FROM public.product_identifiers WHERE source = 'shampoo-v162-track-a-2026-10-13';
COMMIT;
""")
print("target products",len(target),"rows",len(vals),"changed products",len(changes),"N1 ok; fp",FP)
