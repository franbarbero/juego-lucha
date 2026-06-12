// ============================================================
//  SPRITES — carga de imágenes de los personajes.
//
//  Convención: cada personaje con campo spriteFolder busca ahí
//  archivos PNG con estos nombres (los que falten no pasan nada:
//  se usa el muñeco vectorial de siempre como respaldo):
//
//    idle1/2.png               → quieto (alternan)
//    crouch1/2.png             → agachado (alternan)
//    walk1/2/3/4.png           → ciclo de caminar
//    attack1/2/3/4.png         → golpe (preparación → impacto → final)
//    special1/2.png            → habilidad especial
//    jump.png                  → en el aire (también el dash)
//    hurt.png                  → recibir golpe (también el KO, tumbado)
//
//  Las imágenes deben mirar a la DERECHA; el motor las voltea.
// ============================================================

const SPRITE_POSES = [
  'idle1', 'idle2', 'crouch1', 'crouch2',
  'walk1', 'walk2', 'walk3', 'walk4',
  'attack1', 'attack2', 'attack3', 'attack4',
  'special1', 'special2', 'jump', 'hurt',
  'block' // opcional: pose de guardia; si falta se usa idle1 + el escudo
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

  // Devuelve la imagen de la pose. Si falta, prueba con el frame 1 de
  // la misma familia (attack3 → attack1), luego con idle1, y si no hay
  // nada devuelve null (→ muñeco vectorial).
  get(def, pose) {
    const set = this.cache[def.name];
    if (!set) return null;
    return set[pose] || set[pose.replace(/\d+$/, '1')] || set['idle1'] || null;
  },

  // ¿Existe exactamente esa pose? (sin contar el respaldo de idle1)
  exact(def, pose) {
    const set = this.cache[def.name];
    return !!(set && set[pose]);
  }
};

// Qué pose corresponde al estado actual de un luchador.
function spritePoseFor(f) {
  const tick = Math.floor(performance.now() / 180) % 2;
  if (f.state === 'ko') return 'hurt';
  // recibir daño y el aturdido usan idle (el parpadeo blanco ya lo marca);
  // cuando haya un sprite de daño propio, se cambia aquí
  if (f.state === 'hit' || f.state === 'stunned') return tick ? 'idle2' : 'idle1';
  // la pose HURT/BLOCK de la hoja es en realidad la guardia: se usa para
  // bloquear, salvo que exista un block.png dedicado
  if (f.state === 'block') return Sprites.exact(f.def, 'block') ? 'block' : 'hurt';
  // cada golpe de la cadena de combo usa su propio frame: 1→2→3→4
  if (f.state === 'attack') return 'attack' + (f.comboStage + 1);
  if (f.state === 'recover') return f.stateTimer > 12 ? 'special1' : 'special2';
  if (f.state === 'dash' || !f.onGround) return 'jump';
  if (f.crouching) return tick ? 'crouch2' : 'crouch1';
  if (f.vx !== 0) return 'walk' + (Math.floor(performance.now() / 140) % 4 + 1);
  return tick ? 'idle2' : 'idle1';
}

Sprites.loadAll();
