import json,sys,re
def key(s):
    s=s.lower()
    out=[]
    for c in s:
        if c.isdigit(): out.append((1,c))
        elif c.isalpha(): out.append((2,c))
        else: out.append((0,c))
    return out
def inorder(a,b):
    if re.sub(r'\d','',a.lower())==re.sub(r'\d','',b.lower()): return True
    return key(a)<=key(b)
def first(n):
    # merged synonym entry: first-listed name
    return re.split(r'\s*[/(]\s*',n)[0].strip()
for p in sys.argv[1:]:
    d=json.load(open(p)); L=d["canonicalInci"]
    if d["blindId"]=="W411":
        L=["Aqua (Water, Eau)"]+L[2:]
    names=[first(x) for x in L]
    runs=[];s=0
    for i in range(1,len(names)+1):
        if i==len(names) or not inorder(names[i-1],names[i]):
            if i-s>=7: runs.append((s+1,i))
            s=i
    print(d["blindId"],len(L),"runs:",runs, [names[a-1:b] for a,b in runs])
