#!/usr/bin/env python3
"""Facultatif (le site marche sans) : met à jour le numéro de version des fichiers (?v=...) dans index.html
et régénère sw.js (liste hors-ligne + nom du cache) pour que les joueurs reçoivent la nouvelle version."""
import os, re, json, hashlib
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
CODE = ['css/style.css', 'js/default-save.js', 'js/engine.js', 'js/sfx.js', 'js/fx.js', 'js/scene.js', 'js/app.js']
MEDIA = ['fonts/pixelify.woff2', 'img/lobby_bg.webp', 'img/icon-192.png'] + ['img/sprites/' + f for f in sorted(os.listdir('img/sprites'))] \
    + ['img/scenes/' + f for f in sorted(os.listdir('img/scenes'))] + ['vid/' + f for f in sorted(os.listdir('vid'))]
h = hashlib.sha1()
for f in CODE + MEDIA + ['manifest.webmanifest']: h.update(f.encode()); h.update(open(f, 'rb').read())
ver = h.hexdigest()[:10]
html = open('index.html', encoding='utf8').read()
html = re.sub(r'\?v=[A-Za-z0-9_]+', '?v=' + ver, html)
open('index.html', 'w', encoding='utf8').write(html)
assets = ['./', 'index.html', 'manifest.webmanifest'] + [f + '?v=' + ver for f in CODE] + MEDIA
sw = open('tools/sw.template.js', encoding='utf8').read().replace('__CACHE__', 'rpg-nathan-' + ver).replace('__ASSETS__', json.dumps(assets, indent=0))
open('sw.js', 'w', encoding='utf8').write(sw)
print('version', ver, '-', len(assets), 'fichiers en cache')
