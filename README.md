# ⚔️ RPG de Nathan — version navigateur

Le RPG textuel du chat, porté en site **100 % statique** (HTML/CSS/JS, aucun serveur nécessaire).
**v2** : combats animés (héros contre monstre, barres de PV, coups critiques, dragon qui crache du feu), récoltes animées
avec particules, pièces qui volent vers le compteur, passage de niveau avec confettis, carte animée du village,
calendrier des récompenses, fiche du héros, résumé d'absence, tutoriel, réglages (son, musique, vibrations, vidéos,
vitesse), bruitages et musique générés en direct (WebAudio).
Mine, fabrique, combats, donjons, dragon, tour infinie, pêche, expéditions en temps réel, marché du jour,
banque (+2 %/jour), atelier, récompense quotidienne, quêtes, succès, compagnon, enchantement, pari…

## Jouer
- En ligne : publier ce dossier sur GitHub Pages (Settings → Pages → branche `main`, dossier `/`).
- En local : `python3 -m http.server` dans ce dossier puis ouvrir http://localhost:8000
  (ouvrir `index.html` directement marche aussi, sauf le mode hors-ligne).

La partie démarre depuis la sauvegarde du chat (niveau 2) puis est enregistrée dans le navigateur
(localStorage, clé `rpg_nathan_save`, même format qu'en v1). Onglet **👤 Perso** / ⚙️ : exporter / importer la sauvegarde
(texte à copier-coller ou fichier .json), réglages, réinitialiser (avec confirmation).

## Structure
- `index.html`, `css/style.css` — interface (HUD du lobby, scène vidéo, récit, 6 onglets de commandes)
- `js/engine.js` — moteur du jeu, port fidèle de `game.py` (fonctionne aussi dans node)
- `js/app.js` — interface, récompenses animées, fenêtres (choix, calendrier, fiche, sac, réglages), tutoriel
- `js/scene.js` — carte du village, arène de combat et scènes de récolte animées
- `js/fx.js` — particules, pièces volantes, toasts, passage de niveau ; `js/sfx.js` — bruitages et musique WebAudio
- `img/sprites/` — héros, monstres et emblèmes de rang découpés dans les illustrations ; `fonts/` — Pixelify Sans (OFL)
- `js/default-save.js` — sauvegarde initiale
- `vid/` — une scène vidéo (avec son) par commande ; `img/` — fond du lobby, affiches des scènes (webp)
- `sw.js` — mode hors-ligne ; **après toute modification lancer `python3 tools/build.py`** : il met à jour les
  `?v=` de `index.html` et régénère `sw.js` (nouvelle version de cache, page en « réseau d'abord » → les joueurs
  reçoivent toujours la dernière version)
- `test/` — comparaison automatique avec le `game.py` d'origine (`test/run-compare.sh`), tests navigateur
  (`test/browser/v2.js` : migration, animations, tous les boutons…) et captures (`test/shots/`)
