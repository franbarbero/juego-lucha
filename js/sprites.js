// ============================================================
//  SPRITES — carga de imágenes de los personajes.
//
//  Convención: cada personaje con campo spriteFolder busca ahí
//  archivos PNG con estos nombres (los que falten no pasan nada:
//  se usa el muñeco vectorial de siempre como respaldo):
//
//    idle1.png  idle2.png      → quieto (alternan)
//    walk1.png  walk2.png      → caminando (alternan)
//    attack1.png attack2.png   → golpe (preparación / impacto)
//    special1.png special2.png → habilidad especial
//    jump.png                  → en el aire (también el dash)
//    hurt.png                  → recibir golpe (también el KO, tumbado)
//
//  Las imágenes deben mirar a la DERECHA; el motor las voltea.
// ============================================================

const SPRITE_POSES = [
  'idle1', 'idle2', 'walk1', 'walk2',
  'attack1', 'attack2', 'special1', 'special2',
  'jump', 'hurt'
];

const Sprites = {
  cache: {}, // nombre del personaje → { pose: Image }

  loadAll() {
    for (const def of CHARACTERS) {
      if (!def.spriteFolder) continue;
      const set = {};
      this.cache[def.name] = set;
      for (const pose of SPRITE_POSES) {
        const img = new Image();
        img.onload = () => { set[pose] = img; };
        // si el archivo no existe, simplemente no se añade
        img.src = `${def.spriteFolder}/${pose}.png`;
      }
    }
  },

  // Devuelve la imagen de la pose, la de idle1 si falta esa pose,
  // o null si el personaje aún no tiene sprites (→ muñeco vectorial).
  get(def, pose) {
    const set = this.cache[def.name];
    if (!set) return null;
    return set[pose] || set['idle1'] || null;
  }
};

// Qué pose corresponde al estado actual de un luchador.
function spritePoseFor(f) {
  const tick = Math.floor(performance.now() / 180) % 2;
  if (f.state === 'ko' || f.state === 'hit') return 'hurt';
  if (f.state === 'attack') return f.stateTimer > 10 ? 'attack1' : 'attack2';
  if (f.state === 'recover') return f.stateTimer > 7 ? 'special1' : 'special2';
  if (f.state === 'dash' || !f.onGround) return 'jump';
  if (f.vx !== 0) return tick ? 'walk2' : 'walk1';
  return tick ? 'idle2' : 'idle1';
}

Sprites.loadAll();
