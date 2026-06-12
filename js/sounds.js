// ============================================================
//  MOTOR DE SONIDO
//  Genera todos los efectos con la Web Audio API: no hacen
//  falta archivos de audio. Cada personaje tiene una "voz"
//  (frecuencia base + tipo de onda, definida en characters.js)
//  que hace que sus saltos, golpes y gritos suenen distintos.
//
//  Cuando quieras sonidos reales (grabaciones de tus amigos),
//  este es el archivo a modificar: cada función de abajo puede
//  reemplazarse por un new Audio('ruta.mp3').play().
// ============================================================

const AudioEngine = {
  ctx: null,

  // El navegador exige un gesto del usuario antes de sonar:
  // se llama en el primer keydown.
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  },

  // Un tono simple. slideTo desliza la frecuencia (efecto retro).
  tone(freq, dur, wave = 'square', vol = 0.1, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },

  // Ráfaga de ruido blanco, para impactos.
  noise(dur, vol = 0.15) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  },

  // --- Efectos por personaje (usan su voz) ---
  jump(voice)    { this.tone(voice.base, 0.18, voice.wave, 0.07, voice.base * 1.8); },
  dash(voice)    { this.noise(0.08, 0.08); this.tone(voice.base * 1.2, 0.12, voice.wave, 0.07, voice.base * 2.6); },
  attack(voice)  { this.tone(voice.base * 1.4, 0.07, voice.wave, 0.08, voice.base * 0.7); },
  special(voice) { this.tone(voice.base * 0.8, 0.3, voice.wave, 0.11, voice.base * 2.4); },
  hit(voice) {
    this.noise(0.1, 0.18);
    this.tone(voice.base * 0.6, 0.15, voice.wave, 0.12, voice.base * 0.3);
  },
  ko(voice) {
    this.noise(0.3, 0.25);
    this.tone(voice.base, 0.7, voice.wave, 0.15, 40);
  },

  // --- Efectos generales ---
  select()  { this.tone(660, 0.06, 'square', 0.06, 880); },
  confirm() {
    this.tone(440, 0.1, 'square', 0.07);
    this.tone(660, 0.15, 'square', 0.07, null, 0.1);
  },
  fight() {
    this.tone(220, 0.12, 'sawtooth', 0.12, 440);
    this.tone(440, 0.25, 'sawtooth', 0.12, 880, 0.12);
  },
  victory() {
    this.tone(523, 0.12, 'square', 0.08, null, 0);
    this.tone(659, 0.12, 'square', 0.08, null, 0.13);
    this.tone(784, 0.3, 'square', 0.08, null, 0.26);
  }
};

// Reproduce un efecto y, si somos el host de una partida online,
// lo encola para que el invitado también lo escuche.
function playSfx(name, voice) {
  if (AudioEngine[name]) AudioEngine[name](voice);
  if (typeof Net !== 'undefined' && Net.mode === 'host') Net.soundQueue.push([name, voice]);
}
