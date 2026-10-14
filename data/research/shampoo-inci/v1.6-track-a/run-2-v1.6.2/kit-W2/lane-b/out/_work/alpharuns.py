import json,sys,re
K='/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/formula/'
def key(s):
    s=s.replace('*','').strip().lower()
    out=[]
    for c in s:
        if c.isalpha(): out.append((2,c))
        elif c.isdigit(): out.append((1,c))
        else: out.append((0,c))
    return out
def inorder(a,b):
    if re.sub(r'\d','',a.lower())==re.sub(r'\d','',b.lower()): return True
    return key(a)>=key(b) if False else key(b)>key(a)
for bid in sys.argv[1:]:
    d=json.load(open(K+bid+'.json'))
    L=d['canonicalInci']
    if bid=='W212': L=['Aqua (Water, Eau)']+L[2:]
    # first-listed name for merged synonyms
    names=[re.split(r'[/(\[]',x)[0].strip() for x in L]
    runs=[];start=0
    for i in range(1,len(names)+1):
        if i<len(names) and inorder(names[i-1],names[i]): continue
        if i-start>=7: runs.append((start+1,i))
        start=i
    print(bid,len(L),'runs:',runs, [names[a-1:b] for a,b in runs])
