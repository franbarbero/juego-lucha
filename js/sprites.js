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
  'idle1', 'idle2', 'idle3', 'idle4',
  'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6',
  'crouch1', 'crouch2',
  'attack1', 'attack2', 'attack3', 'attack4', 'attack5', 'attack6', 'attack7', 'attack8',
  'special1', 'special2', 'special3', 'special4',
  'jump1', 'jump2', 'dash',
  'hurt1', 'hurt2', 'block', 'ko'
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
  const now = performance.now();
  if (f.state === 'ko') return 'ko';
  // recibir daño: 2 frames; el aturdido usa el primero (con estrellitas aparte)
  if (f.state === 'hit') return (Math.floor(now / 90) % 2) ? 'hurt2' : 'hurt1';
  if (f.state === 'stunned') return 'hurt1';
  if (f.state === 'block') return 'block';
  if (f.state === 'attack') {
    // cada golpe del combo son 2 frames: anticipación → impacto (al 50%)
    const sub = f.stateTimer > f.swingDuration * 0.5 ? 1 : 2;
    return 'attack' + (f.comboStage * 2 + sub);
  }
  if (f.state === 'recover') {
    // el especial recorre sus 4 frames a lo largo de la animación (36f)
    const idx = Math.min(3, Math.floor((SPECIAL_DURATION - f.stateTimer) / (SPECIAL_DURATION / 4)));
    return 'special' + (idx + 1);
  }
  if (f.state === 'dash') return 'dash';
  if (!f.onGround) return f.vy < 0 ? 'jump1' : 'jump2'; // subiendo / cayendo
  if (f.crouching) return (Math.floor(now / 280) % 2) ? 'crouch2' : 'crouch1';
  if (f.vx !== 0) return 'walk' + (Math.floor(now / 130) % 6 + 1); // ciclo de 6
  return 'idle' + (Math.floor(now / 280) % 4 + 1); // respiración de 4
}

Sprites.loadAll();
