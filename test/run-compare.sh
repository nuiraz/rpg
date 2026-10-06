#!/bin/sh
# Compare le moteur JS au game.py original (copie de la sauvegarde dans /tmp, l'original n'est jamais modifié).
cd "$(dirname "$0")" && TZ=Europe/Brussels python3 run_py.py && TZ=Europe/Brussels node run_js.js && python3 compare.py
