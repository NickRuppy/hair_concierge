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
sys.argv=["x","tmp/tracka-run2"]
with contextlib.redirect_stdout(io.StringIO()): ns=runpy.run_path("plans/shampoo-v16-rollout/track-a/consolidate_run2.py")
final=ns["final"]
packets={json.load(open(p))["slot"]:json.load(open(p)) for p in glob.glob(f"{D}/packets/*.json")}
live=json.load(open(f"{D}/live-rows-2026-10-12.json"))
ROUTE={"normal":"balanced","dehydriert-fettig":"oily","trocken":"dry","irritationen":"irritated","schuppen":"dandruff"}
ORDER={"fine":0,"normal":1,"coarse":2}
MONDAY,BALEA_TR,GARNIER,DERMAX,HASK,LOREAL="A29","U1","A09","A17","A15b","A25"
target={}; notes=defaultdict(list)
for s,f in final.items():
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
old=defaultdict(list); rec={}
for pid,r,th,b,route,i in live["rows"]:
    if pid in target: old[pid].append((th,b,route or "",i or "")); rec[pid]=r
assert set(old)==set(target), set(old)^set(target)
fp_rows=sorted((pid,)+x for pid in old for x in old[pid])
FP=hashlib.md5("\n".join("|".join(r) for r in fp_rows).encode()).hexdigest()
assert FP=="b6885a73fac70975cd93d28c9ebc0665", FP
rec_after=dict(rec); dermax=final[DERMAX]["productId"]; rec_after[dermax]=False
# N1: no-scalp cell needs a recommended full fit per thickness; scalp cells need >=1 recommended product
cov=defaultdict(set)
for pid,t in target.items():
    if not rec_after.get(pid): continue
    for th,b,_,_ in t["rows"]: cov[(th,b)].add(t["slot"])
n1=[]
for th in ORDER:
    if not cov[(th,"normal")]: n1.append(f"{th} x normal")
for b in ["dehydriert-fettig","trocken","irritationen","schuppen"]:
    if not any(cov[(th,b)] for th in ORDER): n1.append(f"any x {b}")
assert not n1, n1
# change list
changes=[]
for pid,t in sorted(target.items(),key=lambda kv:kv[1]["slot"]):
    o=sorted(old[pid],key=lambda x:(ORDER[x[0]],x[1])); n=[tuple(x) for x in t["rows"]]
    if o!=n or rec.get(pid)!=rec_after.get(pid):
        changes.append({"slot":t["slot"],"name":t["name"],"productId":pid,"recommended":rec.get(pid),"recommendedAfter":rec_after.get(pid),"old":o,"new":n,"notes":notes[pid]})
json.dump({"fingerprint":FP,"target":target,"changes":changes,"coverage":{f"{k[0]}x{k[1]}":sorted(v) for k,v in cov.items()}},open(f"{OUT}/apply-plan.json","w"),indent=1,ensure_ascii=False)
# SQL
ids=",".join(f"'{p}'" for p in sorted(target))
L=[]
L.append("""-- Shampoo v1.6.2 Track A apply (73 live products + the Hask 473 ml successor), Nick 2026-10-12/13.
-- Source: data/research/shampoo-inci/v1.6-track-a/run-2-v1.6.2 (sealed two-lane research, locked v1.6.2),
-- plans/shampoo-v16-rollout/track-a/build_apply.py, rulings plans/shampoo-v16/rulings.md R18-R20.
-- Projection: no-scalp rows only for T7 full-fit thicknesses (distance gives Passt bedingt/nicht);
-- scalp rows for every researched thickness (thickness ignored in scalp cells, R19).
-- Guard: aborts unless the live rows of these products still match the reviewed snapshot.
-- Rollback: public.shampoo_v162_apply_backup_specs / _products hold the previous state.
""")
L.append(f"""DO $$
DECLARE fp text; n int;
BEGIN
  SELECT count(*), md5(string_agg(product_id::text||'|'||thickness||'|'||shampoo_bucket||'|'||coalesce(scalp_route,'')||'|'||coalesce(cleansing_intensity,''), E'\\n'
         ORDER BY product_id::text, thickness, shampoo_bucket, coalesce(scalp_route,''), coalesce(cleansing_intensity,'')))
    INTO n, fp FROM public.product_shampoo_specs WHERE product_id IN ({ids});
  IF n <> {len(fp_rows)} OR fp <> '{FP}' THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: live rows changed since review (n=%, fp=%)', n, fp;
  END IF;
END $$;
""")
L.append(f"""CREATE TABLE public.shampoo_v162_apply_backup_specs AS
  SELECT * FROM public.product_shampoo_specs WHERE product_id IN ({ids});
CREATE TABLE public.shampoo_v162_apply_backup_products AS
  SELECT id, name, suitable_thicknesses, is_chaarlie_recommended FROM public.products WHERE id IN ({ids});
ALTER TABLE public.shampoo_v162_apply_backup_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shampoo_v162_apply_backup_specs, public.shampoo_v162_apply_backup_products FROM anon, authenticated;
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
INSERT INTO public.product_identifiers (product_id, identifier_type, identifier_value, normalized_identifier_value, canonical_gtin14, source)
  SELECT '{hask}', 'ean', '071164341469', '071164341469', '00071164341469', 'shampoo-v162-track-a-2026-10-13'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_identifiers WHERE normalized_identifier_value = '071164341469');
UPDATE public.products SET name = 'L''Oréal Paris Elvital Glycolic Gloss Shampoo' WHERE id = '{lor}'; -- catalog placeholder name 'Ultimate Shampoo'
""")
L.append(f"""DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES ('fine'),('normal'),('coarse')) t(th)
    WHERE NOT EXISTS (SELECT 1 FROM public.product_shampoo_specs s JOIN public.products p ON p.id = s.product_id
                      WHERE s.thickness = t.th AND s.shampoo_bucket = 'normal' AND p.is_chaarlie_recommended AND p.is_active AND p.lifecycle_status = 'active')
  ) OR EXISTS (
    SELECT 1 FROM (VALUES ('dehydriert-fettig'),('trocken'),('irritationen'),('schuppen')) b(bucket)
    WHERE NOT EXISTS (SELECT 1 FROM public.product_shampoo_specs s JOIN public.products p ON p.id = s.product_id
                      WHERE s.shampoo_bucket = b.bucket AND p.is_chaarlie_recommended AND p.is_active AND p.lifecycle_status = 'active')
  ) THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: N1 no-gap check failed';
  END IF;
END $$;
""")
open(f"{OUT}/migration.sql","w").write("\n".join(L))
open(f"{OUT}/rollback.sql","w").write(f"""-- Rollback of the shampoo v1.6.2 Track A apply (restores the backup tables written by the migration).
BEGIN;
DELETE FROM public.product_shampoo_specs WHERE product_id IN ({ids});
UPDATE public.products p SET name = b.name, suitable_thicknesses = b.suitable_thicknesses, is_chaarlie_recommended = b.is_chaarlie_recommended
  FROM public.shampoo_v162_apply_backup_products b WHERE p.id = b.id;
INSERT INTO public.product_shampoo_specs SELECT * FROM public.shampoo_v162_apply_backup_specs;
DELETE FROM public.product_identifiers WHERE source = 'shampoo-v162-track-a-2026-10-13';
COMMIT;
""")
print("target products",len(target),"rows",len(vals),"changed products",len(changes),"N1 ok; fp",FP)
