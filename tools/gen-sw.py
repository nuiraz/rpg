#!/usr/bin/env python3
"""Régénère sw.js (liste des fichiers + version du cache). Facultatif : à relancer après modification du site."""
import os, json, hashlib
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
files = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'js/default-save.js', 'js/engine.js', 'js/app.js', 'img/lobby_bg.webp', 'img/icon-192.png']
files += ['img/scenes/' + f for f in sorted(os.listdir('img/scenes'))] + ['vid/' + f for f in sorted(os.listdir('vid'))]
h = hashlib.md5()
for f in files[1:]: h.update(open(f, 'rb').read())
src = open('sw.js', encoding='utf8').read()
head, rest = src.split("const CACHE = '", 1)
rest = rest.split('\n', 1)[1]
before_assets, after = rest.split('const ASSETS = ', 1)
after = after.split('];', 1)[1]
out = head + "const CACHE = 'rpg-nathan-%s';\n" % h.hexdigest()[:8] + before_assets + 'const ASSETS = ' + json.dumps(files, indent=0)[:-1] + '];' + after
open('sw.js', 'w', encoding='utf8').write(out)
print('sw.js mis à jour, cache', h.hexdigest()[:8], len(files), 'fichiers')
