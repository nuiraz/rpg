// Même scénario avec engine.js (node), même horloge et même flux de hasard.
const fs = require('fs');
const RPG = require('../js/engine.js');
const R = JSON.parse(fs.readFileSync(process.argv[2] || __dirname + '/rand.json')); let pos = 0;
const SRC_SAVE = '/workspace/rpg/save.json'; // lu seulement : copie en mémoire, l'original n'est jamais écrit
let store = fs.existsSync(SRC_SAVE) ? fs.readFileSync(SRC_SAVE, 'utf8') : (require('../js/default-save.js'), JSON.stringify(globalThis.RPG_DEFAULT_SAVE));
let clockMs = 0;
const eng = RPG.createEngine({ storage: { get: () => store, set: v => { store = v; } }, now: () => clockMs, random: () => R[pos++] });
const out = [];
for (const [ts, cmds] of JSON.parse(fs.readFileSync(__dirname + '/scenario.json'))) {
  clockMs = new Date(ts).getTime(); // heure locale (Europe/Brussels), comme Python
  for (const c of cmds) {
    const p = c.split(' '); const r = eng.run(p[0], p.slice(1));
    out.push({ t: ts, cmd: c, text: r.text, media: r.media });
  }
}
out.push({ final: JSON.parse(store) });
fs.writeFileSync(__dirname + '/out_js.json', JSON.stringify(out, null, 1));
console.log('js commands:', out.length - 1, 'randoms used:', pos);
