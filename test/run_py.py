# Lance game.py (copie modifiée en mémoire) sur une copie de la sauvegarde, horloge et hasard contrôlés.
import json, sys, io, contextlib, datetime, random, shutil, os, time
SRC=open('/workspace/rpg/game.py').read()
TMP='/tmp/rpgcmp_py/save.json'; os.makedirs('/tmp/rpgcmp_py',exist_ok=True)
shutil.copy('/workspace/rpg/save.json',TMP)
SRC=SRC.replace('F="/workspace/rpg/save.json"','F="%s"'%TMP)
SRC=SRC.replace('NOW=time.time(); TODAY=datetime.date.today().isoformat()','NOW=__NOW; TODAY=__TODAY')
SRC=SRC.replace('datetime.date.today()','datetime.date.fromisoformat(TODAY)')
assert '__NOW' in SRC
R=json.load(open(sys.argv[1] if len(sys.argv)>1 else 'rand.json')); pos=[0]
def nxt():
    v=R[pos[0]]; pos[0]+=1; return v
random.random=nxt
random.randint=lambda a,b: a+int(nxt()*(b-a+1))
random.uniform=lambda a,b: a+(b-a)*nxt()
out=[]
for ts,cmds in json.load(open('scenario.json')):
    dt=datetime.datetime.fromisoformat(ts)
    for c in cmds:
        parts=c.split(); buf=io.StringIO()
        sys.argv=['game.py']+parts
        with contextlib.redirect_stdout(buf):
            exec(compile(SRC,'game.py','exec'),{'__NOW':dt.timestamp(),'__TODAY':dt.date().isoformat(),'__name__':'g'})
        txt=buf.getvalue().rstrip('\n').split('\n')
        img=[l[4:] for l in txt if l.startswith('IMG:')]; txt=[l for l in txt if not l.startswith('IMG:')]
        out.append({'t':ts,'cmd':c,'text':'\n'.join(txt),'img':os.path.basename(img[0]).split('.')[0] if img else None})
out.append({'final':json.load(open(TMP))})
json.dump(out,open('out_py.json','w'),ensure_ascii=False,indent=1)
print('py commands:',len(out)-1,'randoms used:',pos[0])
