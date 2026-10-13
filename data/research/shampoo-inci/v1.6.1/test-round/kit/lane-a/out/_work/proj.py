# Mechanical projection helpers (Section 13) for lane-a final records.
ORDER={'not_suited':0,'acceptable':1,'ideal':2}
CONF={'low':0,'moderate':1,'high':2}
def minconf(*c): return min(c,key=lambda x:CONF[x])
def t1(th,W,C):
    if W=='low': return {'fine':'ideal','normal':'ideal','coarse':'ideal' if C=='high' else 'acceptable'}[th]
    if W=='moderate': return {'fine':'acceptable','normal':'ideal','coarse':'ideal' if C=='high' else 'acceptable'}[th]
    return {'fine':'not_suited','normal':'acceptable','coarse':'ideal'}[th]
def final_fit(th,W,C,concern):
    f=t1(th,W,C)
    if concern and f=='not_suited': f='acceptable'
    return f
BUCKET={'ordinary':('normal','balanced','regular'),'oily':('dehydriert-fettig','oily','regular'),'dry':('trocken','dry','gentle'),'sensitive':('irritationen','irritated','gentle'),'dandruff':('schuppen','dandruff','regular')}
def i1(cs,d1):
    return {'low':'gentle','moderate':'regular'}.get(cs,'clarifying' if d1 else 'regular')
def project(p):
    W,Wc,Wn=p['W'];C,Cc,Cn=p['C'];CS,CSc,CSn=p['CS']
    targets=[p['primary']]+([p['secondary']] if p.get('secondary') else [])
    concern=p['primary']!='ordinary'
    fits={};fc={};flags=[];notes=list(p.get('notes',[]))
    lifted=[]
    for th in ['fine','normal','coarse']:
        f=final_fit(th,W,C,concern); fits[th]=f
        if concern and t1(th,W,C)=='not_suited': lifted.append(th)
        fc[th]=Wc if th!='coarse' else minconf(Wc,Cc)
        alts=[]
        if Wn!='none': alts.append(final_fit(th,Wn,C,concern))
        if th=='coarse' and Cn!='none': alts.append(final_fit(th,W,Cn,concern))
        if any(ORDER[a]<ORDER[f] for a in alts): flags.append('review_thickness_boundary:'+th)
    if lifted: notes.append('scalp_concern_floor_applied:'+','.join(lifted))
    inten=i1(CS,p['D1'])
    if CSn!='none':
        ni=i1(CSn,p['D1'])
        for t in targets:
            exp=BUCKET[t][2]
            if inten==exp and ni!=exp: flags.append('review_intensity_boundary:'+BUCKET[t][0])
    weight={'low':'light','moderate':'moderate','high':'heavy'}[W]
    rows=[]
    for th in ['fine','normal','coarse']:
        if fits[th]=='not_suited': continue
        for t in targets:
            b,r,_=BUCKET[t]
            rows.append({'thickness':th,'shampoo_bucket':b,'scalp_route':r,'cleansing_intensity':inten,'weight':weight,'tier':fits[th]})
    roles=[]
    if any(r['shampoo_bucket']=='schuppen' for r in rows): roles.append('shampoo_dandruff')
    if any(r['shampoo_bucket']!='schuppen' for r in rows): roles.append('shampoo_everyday')
    flags+=p.get('extraFlags',[])
    return dict(fits=fits,fc=fc,flags=flags,notes=notes,inten=inten,weight=weight,rows=rows,roles=roles)
