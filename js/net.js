// ============================================================
//  NET — multijugador online con WebRTC (PeerJS).
//  El "host" crea una sala con un código de 4 letras; el
//  "guest" se une con ese código. El host simula el juego y
//  envía el estado; el guest envía sus teclas y dibuja lo que
//  recibe (host autoritativo: ambos ven exactamente lo mismo).
// ============================================================

const NET_PREFIX = 'arena-amigos-';

const Net = {
  mode: 'local',          // 'local' | 'host' | 'guest'
  peer: null,
  conn: null,
  code: '',
  status: 'idle',         // idle | opening | waiting | connecting | connected | error | closed
  errorMsg: '',
  remoteKeys: {},         // teclas que el guest mantiene pulsadas (lado host)
  remoteKeyPressed: {},   // teclas que el guest acaba de pulsar (lado host)
  soundQueue: [],         // sonidos del host pendientes de enviar al guest
  lastState: null,        // último estado recibido (lado guest)

  reset() {
    if (this.conn) { try { this.conn.close(); } catch (e) {} }
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.mode = 'local';
    this.peer = null;
    this.conn = null;
    this.code = '';
    this.status = 'idle';
    this.errorMsg = '';
    this.remoteKeys = {};
    this.remoteKeyPressed = {};
    this.soundQueue = [];
    this.lastState = null;
  },

  randomCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para evitar confusiones
    let c = '';
    for (let i = 0; i < 4; i++) c += abc[Math.floor(Math.random() * abc.length)];
    return c;
  },

  // Crea una sala y espera a que alguien se una.
  host() {
    this.mode = 'host';
    this.status = 'opening';
    this.code = this.randomCode();
    this.peer = new Peer(NET_PREFIX + this.code.toLowerCase());
    this.peer.on('open', () => { this.status = 'waiting'; });
    this.peer.on('error', (e) => { this.status = 'error'; this.errorMsg = e.type; });
    this.peer.on('connection', (c) => {
      if (this.conn) { c.close(); return; } // sala llena
      this.conn = c;
      c.on('open', () => {
        this.status = 'connected';
        onPeerConnected(); // definida en game.js: arranca la selección
      });
      c.on('data', (d) => this.onHostData(d));
      c.on('close', () => { this.status = 'closed'; });
    });
  },

  // Se une a una sala existente con su código.
  join(code) {
    this.mode = 'guest';
    this.status = 'connecting';
    this.code = code.toUpperCase();
    this.peer = new Peer();
    this.peer.on('error', (e) => { this.status = 'error'; this.errorMsg = e.type; });
    this.peer.on('open', () => {
      const c = this.peer.connect(NET_PREFIX + code.toLowerCase());
      this.conn = c;
      c.on('open', () => { this.status = 'connected'; });
      c.on('data', (d) => this.onGuestData(d));
      c.on('close', () => { this.status = 'closed'; });
    });
  },

  // --- Lado host: recibe las teclas del guest ---
  onHostData(d) {
    if (d.t !== 'input') return;
    this.remoteKeys = d.keys || {};
    // los "pressed" se acumulan hasta que el bucle del host los consume
    for (const k in d.pressed) if (d.pressed[k]) this.remoteKeyPressed[k] = true;
  },

  // --- Lado guest: recibe el estado del juego y los sonidos ---
  onGuestData(d) {
    if (d.t !== 'state') return;
    this.lastState = d;
    (d.sounds || []).forEach(([name, voice]) => {
      if (AudioEngine[name]) AudioEngine[name](voice);
    });
  },

  sendState(snap) {
    if (!this.conn || !this.conn.open) return;
    snap.sounds = this.soundQueue;
    this.soundQueue = [];
    this.conn.send(snap);
  },

  sendInput(keysDown, pressed) {
    if (!this.conn || !this.conn.open) return;
    this.conn.send({ t: 'input', keys: keysDown, pressed });
  }
};
