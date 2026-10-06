import json
P=json.load(open('out_py.json')); J=json.load(open('out_js.json'))
diff=0
for p,j in zip(P[:-1],J[:-1]):
    if p['text']!=j['text']:
        diff+=1; print('TEXT DIFF',p['t'],p['cmd'],'\nPY:',p['text'],'\nJS:',j['text'],'\n')
    pi=p['img']; last=j['media'][-1] if j['media'] else None
    if pi!=last and not (p['cmd']=='tour'): print('MEDIA note',p['cmd'],'py=',pi,'js=',j['media'])
pf,jf=P[-1]['final'],J[-1]['final']
for k in set(pf)|set(jf):
    a,b=pf.get(k),jf.get(k)
    if isinstance(a,float) or isinstance(b,float):
        if abs((a or 0)-(b or 0))>1e-3: diff+=1; print('FINAL DIFF',k,a,b)
    elif a!=b: diff+=1; print('FINAL DIFF',k,a,b)
print(f'{len(P)-1} commandes comparées, {diff} différence(s)')
