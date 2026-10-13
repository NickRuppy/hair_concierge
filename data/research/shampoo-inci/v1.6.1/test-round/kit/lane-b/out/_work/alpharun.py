import json, sys, re
def key(name):
    s = name.lower()
    out=[]
    for ch in s:
        if ch.isalpha(): out.append((2,ch))
        elif ch.isdigit(): out.append((1,ch))
        else: out.append((0,ch))
    return out
def nodigits(n): return re.sub(r'\d','',n.lower())
def inorder(a,b):
    if nodigits(a)==nodigits(b): return True
    return key(a) <= key(b)
path=sys.argv[1]
d=json.load(open(path))
names=d['canonicalInci']
merge=[int(x) for x in sys.argv[2:]]  # raw 1-based positions to merge into previous
norm=[]
for i,n in enumerate(names,1):
    if i in merge: norm[-1]=norm[-1]+', '+n; continue
    norm.append(n)
first=[re.split(r'\s*/\s*|\s*\(',n)[0].strip() if False else n for n in norm]
# first-listed name of merged synonym entry: take part before ' / ' or '/' only for ID-2 synonyms; keep full name for compare
runs=[];start=0
for i in range(1,len(norm)+1):
    if i==len(norm) or not inorder(norm[i-1],norm[i]):
        if i-start>=7: runs.append((start+1,i))
        start=i
print(d['blindId'],len(norm),'runs:',runs)
for a,b in runs: print('  ',[ (k,norm[k-1]) for k in range(a,b+1)])
