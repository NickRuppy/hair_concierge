import json,sys,re
def key(s):
    s=s.lower().replace('*','')
    out=[]
    for ch in s:
        if ch.isalpha(): out.append((2,ch))
        elif ch.isdigit(): out.append((1,ch))
        else: out.append((0,ch))
    return out
def nodig(s): return re.sub(r'\d','',s.lower())
def le(a,b):
    if nodig(a)==nodig(b): return True
    return key(a)<=key(b)
for p in sys.argv[1:]:
    d=json.load(open(p)); L=d['canonicalInci']
    if p.endswith('VT05.json'): L=['Aqua (Water, Eau)']+L[2:]
    names=[x.split('/')[0].split('(')[0].strip() if False else x for x in L]
    best=[];i=0
    while i<len(L):
        j=i
        while j+1<len(L) and le(L[j],L[j+1]): j+=1
        if j-i+1>=5: best.append((i+1,j+1,j-i+1))
        i=j+1
    print(d['blindId'],len(L),best)
