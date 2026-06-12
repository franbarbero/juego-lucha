// ============================================================
//  PERSONAJES — ¡Este es TU archivo para personalizar!
//
//  Para agregar a un amigo: copia uno de los objetos de abajo,
//  pégalo al final de la lista (antes del corchete de cierre),
//  cambia sus valores y listo: aparecerá en la pantalla de
//  selección automáticamente.
//
//  Campos:
//   name        → nombre que se muestra en pantalla
//   color       → color principal del cuerpo (hex), placeholder
//                 hasta que tengan sprites propios
//   skinColor   → color de la cabeza
//   hairColor   → color del pelo
//   maxHealth   → vida (100 es normal; más = aguanta más golpes)
//   speed       → velocidad al caminar (4 a 6 es razonable)
//   jumpPower   → fuerza del salto (13 a 17)
//   attack      → golpe básico:
//                   damage: daño por golpe
//                   range: alcance en píxeles
//                   cooldownFrames: frames de espera entre golpes (60 = 1 seg)
//   special     → habilidad característica. Tipos disponibles:
//                   'dash'       → embestida veloz hacia adelante
//                   'projectile' → lanza un proyectil
//   voice       → la "voz" del personaje: cambia cómo suenan sus
//                 saltos, golpes y gritos. base = tono (grave 120,
//                 agudo 600). wave: 'square' | 'sawtooth' |
//                 'triangle' | 'sine'
//   winPhrase   → frase que dice al ganar
// ============================================================

const CHARACTERS = [
  {
    name: 'RAYO',
    color: '#3b82f6',
    skinColor: '#fcd9b8',
    hairColor: '#27272a',
    maxHealth: 100,
    speed: 5.5,
    jumpPower: 16,
    attack: { damage: 7, range: 75, cooldownFrames: 22 },
    special: {
      type: 'dash',
      damage: 15,
      speed: 16,
      durationFrames: 14,
      cooldownFrames: 150
    },
    voice: { base: 520, wave: 'square' },
    winPhrase: '¡Demasiado lento, pana!'
  },
  {
    name: 'MURO',
    color: '#ef4444',
    skinColor: '#e8b88a',
    hairColor: '#5b3a1e',
    maxHealth: 130,
    speed: 3.8,
    jumpPower: 13,
    attack: { damage: 11, range: 65, cooldownFrames: 30 },
    special: {
      type: 'projectile',
      damage: 12,
      speed: 9,
      cooldownFrames: 180
    },
    voice: { base: 170, wave: 'sawtooth' },
    winPhrase: 'Por aquí no pasa nadie.'
  }
];
