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
//   title       → apodo/título que sale en su carta de selección
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
//                   'projectile' → lanza un proyectil que hace daño
//                   'strings'    → hilos de titiritero: poco daño, pero
//                                  invierte los controles del rival
//                                  durante reverseFrames (60 = 1 seg)
//                   'shout'      → grito de área frontal: daño y un
//                                  empujón enorme (alcance = range)
//   voice       → la "voz" del personaje: cambia cómo suenan sus
//                 saltos, golpes y gritos. base = tono (grave 120,
//                 agudo 600). wave: 'square' | 'sawtooth' |
//                 'triangle' | 'sine'
//   winPhrase   → frase que dice al ganar
//
//  Nota: el dash NO se configura aquí: todos los personajes lo
//  tienen igual (Shift / Ñ), con su propio cooldown. Es movilidad,
//  no una estadística.
// ============================================================

const CHARACTERS = [
  {
    name: 'BARBERO',
    title: 'El Titiritero',
    spriteFolder: 'img/barbero',
    spriteHeight: 460,  // alto del lienzo del sprite en pantalla (cuerpo ≈165px)
    // poses de la victoria cinemática: entra con una y se congela en la otra
    victoryBuild: 'special3',
    victoryFinal: 'special4',  // el maestro de marionetas con sus títeres
    color: '#8b5cf6',
    skinColor: '#fcd9b8',
    hairColor: '#27272a',
    maxHealth: 100,
    speed: 4.9,
    jumpPower: 16,
    attack: { damage: 5, range: 72, cooldownFrames: 24 },
    special: {
      type: 'strings',
      damage: 4,
      speed: 7,
      cooldownFrames: 240,
      reverseFrames: 180   // 3 segundos haciendo lo que él diga
    },
    voice: { base: 340, wave: 'triangle' },
    winPhrase: 'Al final siempre se hace lo que yo digo.'
  },
  {
    name: 'MERYG',
    title: 'La Voz del Pueblo',
    spriteFolder: 'img/meryg',
    spriteHeight: 426,  // alto del lienzo del sprite en pantalla (cuerpo ≈165px)
    victoryBuild: 'special4',
    victoryFinal: 'special3',  // el ángel de la justicia
    color: '#ec4899',
    skinColor: '#f3c6a5',
    hairColor: '#7c2d12',
    maxHealth: 115,
    speed: 4.6,
    jumpPower: 15,
    attack: { damage: 7, range: 65, cooldownFrames: 26 },
    special: {
      type: 'shout',
      damage: 11,
      range: 220,
      cooldownFrames: 200
    },
    voice: { base: 620, wave: 'sawtooth' },
    winPhrase: '¡Lo dije, lo digo y lo mantengo!'
  }
];
