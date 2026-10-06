# ⚔️ RPG de Nathan — version navigateur

Le RPG textuel du chat, porté en site **100 % statique** (HTML/CSS/JS, aucun serveur, aucune étape de build).
Mine, fabrique, combats, donjons, dragon, tour infinie, pêche, expéditions en temps réel, marché du jour,
banque (+2 %/jour), atelier, récompense quotidienne, quêtes, succès, compagnon, enchantement, pari…

## Jouer
- En ligne : publier ce dossier sur GitHub Pages (Settings → Pages → branche `main`, dossier `/`).
- En local : `python3 -m http.server` dans ce dossier puis ouvrir http://localhost:8000
  (ouvrir `index.html` directement marche aussi, sauf le mode hors-ligne).

La partie démarre depuis la sauvegarde du chat (niveau 2) puis est enregistrée dans le navigateur
(localStorage). Onglet **👤 Perso** : exporter / importer la sauvegarde (texte à copier-coller ou fichier .json),
couper le son, réinitialiser (avec confirmation).

## Structure
- `index.html`, `css/style.css` — interface (HUD du lobby, scène vidéo, récit, 6 onglets de commandes)
- `js/engine.js` — moteur du jeu, port fidèle de `game.py` (fonctionne aussi dans node)
- `js/app.js` — interface, lecteur vidéo, sélecteurs d'arguments
- `js/default-save.js` — sauvegarde initiale
- `vid/` — une scène vidéo (avec son) par commande ; `img/` — fond du lobby, affiches des scènes (webp)
- `sw.js` — mode hors-ligne après la première visite (`tools/gen-sw.py` le régénère si des fichiers changent)
- `test/` — comparaison automatique avec le `game.py` d'origine (`test/run-compare.sh`) et tests navigateur
