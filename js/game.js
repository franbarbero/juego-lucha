// ============================================================
//  GAME — bucle principal, escenas (menú / sala / selección /
//  pelea / KO), entrada de teclado, HUD y red.
//
//  Online: el host simula todo y envía el estado cada frame;
//  el guest envía sus teclas y dibuja el estado recibido.
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // pixel art nítido al escalar sprites
const W = canvas.width;
const H = canvas.height;

const ROUND_SECONDS = 60;
const INTRO_FRAMES = 210; // cuenta atrás 3-2-1-¡a pelear! (~3,5 s)

// --- Entrada de teclado ---
// keys: teclas mantenidas. keyPressed: solo el frame en que se pulsan.
const keys = {};
let keyPressed = {};

const P1_CONTROLS = {
  left: 'a', right: 'd',
  jump: ' ', jumpAlt: 'w',   // Espacio salta (W sigue funcionando)
  crouch: 's',
  attack: 'f', special: 'e',
  dash: 'shift',
  block: 'q'                 // también clic derecho (ver withMouseButtons)
};
const P2_CONTROLS = {
  left: 'arrowleft', right: 'arrowright',
  jump: 'arrowup',
  crouch: 'arrowdown',
  attack: 'k', special: 'l',
  dash: 'ñ',
  block: 'o'
};

window.addEventListener('keydown', (e) => {
  AudioEngine.init();
  const k = e.key.toLowerCase();
  if (!keys[k]) keyPressed[k] = true;
  keys[k] = true;
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// --- Entrada de ratón ---
// Coordenadas en el espacio del canvas (corrigiendo el escalado CSS).
const mouse = { x: -1, y: -1, clicked: false, moved: false, hoverUI: false };

function updateMousePos(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
}

canvas.addEventListener('mousemove', (e) => {
  updateMousePos(e);
  mouse.moved = true;
});
// Los botones del ratón entran al sistema de teclas como teclas
// virtuales: 'mouse0' (izquierdo) y 'mouse2' (derecho). Así el
// clic izquierdo golpea y el derecho lanza el especial.
canvas.addEventListener('mousedown', (e) => {
  AudioEngine.init();
  updateMousePos(e);
  if (e.button === 0) mouse.clicked = true; // solo el izquierdo activa botones de UI
  const mk = 'mouse' + e.button;
  if (!keys[mk]) keyPressed[mk] = true;
  keys[mk] = true;
});
window.addEventListener('mouseup', (e) => {
  keys['mouse' + e.button] = false;
});
// sin menú contextual del navegador al hacer clic derecho sobre el juego
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Envuelve una fuente de entrada para que el clic izquierdo cuente
// como la tecla de golpe y el derecho como la de bloqueo.
function withMouseButtons(base, controls) {
  return {
    down: (k) => base.down(k) ||
      (k === controls.attack && !!keys['mouse0']) ||
      (k === controls.block && !!keys['mouse2']),
    pressed: (k) => base.pressed(k) ||
      (k === controls.attack && !!keyPressed['mouse0']) ||
      (k === controls.block && !!keyPressed['mouse2'])
  };
}

// ¿Está el ratón sobre este rectángulo? (marca el cursor como "manita")
function mouseOver(r) {
  const over = mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
  if (over) mouse.hoverUI = true;
  return over;
}

function mouseClickedIn(r) {
  return mouse.clicked && mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
}

// Copiar texto al portapapeles. Usa la API moderna y, si no está
// disponible (p. ej. abierto como archivo local), un textarea oculto.
let copyFeedback = 0; // frames mostrando "¡Copiado!"
function copyText(text) {
  const ok = () => { copyFeedback = 110; };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
  } else {
    fallbackCopy(text, ok);
  }
}
function fallbackCopy(text, ok) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { if (document.execCommand('copy')) ok(); } catch (e) {}
  document.body.removeChild(ta);
}

// Botón clicable estándar (se resalta al pasar el ratón por encima).
function drawButton(r, label, accent) {
  const hover = mouseOver(r);
  ctx.fillStyle = hover ? '#3f3a4d' : '#1c1c2e';
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.strokeStyle = (accent || hover) ? '#fbbf24' : '#3f3a4d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
}

// Rectángulos de los elementos clicables fijos
const menuOptionRect = (i) => ({ x: W / 2 - 320, y: 250 + i * 60 - 34, w: 640, h: 48 });
const selectCardRect = (i) => {
  const cardW = 170;
  const gap = 40;
  const total = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
  return { x: (W - total) / 2 + i * (cardW + gap), y: 130, w: cardW, h: 270 };
};
const LOBBY_COPY = { x: W / 2 - 120, y: 380, w: 240, h: 44 };
const LOBBY_CANCEL = { x: W / 2 - 110, y: 470, w: 220, h: 40 };
const JOIN_GO = { x: W / 2 - 110, y: 360, w: 220, h: 44 };
const JOIN_BACK = { x: W / 2 - 110, y: 420, w: 220, h: 40 };
// botones de fin de combate, en una fila al borde inferior (no tapan
// al ganador durante la cinemática de victoria)
const KO_REMATCH = { x: W / 2 - 396, y: H - 58, w: 250, h: 42 };
const KO_SELECT = { x: W / 2 - 125, y: H - 58, w: 250, h: 42 };
const KO_MENU = { x: W / 2 + 146, y: H - 58, w: 250, h: 42 };
const SELECT_BACK = { x: 24, y: H - 64, w: 190, h: 40 };

// Salir al menú principal (cerrando la sala si estamos online).
function backToMenu() {
  if (Net.mode !== 'local') Net.reset();
  startMenu();
}

// Fuentes de entrada: el P2 lee del invitado cuando somos host.
const localInput = { down: (k) => !!keys[k], pressed: (k) => !!keyPressed[k] };
const remoteInput = { down: (k) => !!Net.remoteKeys[k], pressed: (k) => !!Net.remoteKeyPressed[k] };
const p2Input = () => (Net.mode === 'host' ? remoteInput : localInput);

// "¿Alguien (local o remoto) pulsó esta tecla?" — para revancha, etc.
function anyPressed(k) {
  return !!keyPressed[k] || (Net.mode === 'host' && !!Net.remoteKeyPressed[k]);
}

// El invitado manda sus teclas traducidas a los controles de P2.
// Puede usar WASD+F/G o flechas+K/L indistintamente.
const GUEST_KEY_MAP = [
  ['arrowleft', ['a', 'arrowleft']],
  ['arrowright', ['d', 'arrowright']],
  ['arrowup', ['w', ' ', 'arrowup']],
  ['arrowdown', ['s', 'arrowdown']],
  ['k', ['f', 'k', 'mouse0']],
  ['l', ['e', 'g', 'l']],
  ['ñ', ['shift', 'ñ', 'm']],
  ['o', ['q', 'o', 'mouse2']],
  ['r', ['r']],
  ['enter', ['enter']]
];

function collectGuestInput() {
  const down = {};
  const pressed = {};
  for (const [target, sources] of GUEST_KEY_MAP) {
    down[target] = sources.some((s) => keys[s]);
    pressed[target] = sources.some((s) => keyPressed[s]);
  }
  return { down, pressed };
}

// --- Estado global ---
let scene = 'menu'; // menu | join | lobby | select | stage | fight | ko
let menuIndex = 0;
let joinCode = '';
let netNotice = '';
let select = null;
let stageSel = 0;
let game = null;
let matchId = 0;

const MENU_OPTIONS = ['Jugar en local (2 en este teclado)', 'Crear sala online', 'Unirse con código'];

function startMenu() {
  scene = 'menu';
  menuIndex = 0;
  joinCode = '';
  game = null;
  FLOOR_Y = DEFAULT_FLOOR_Y; // los menús usan la ciudad por defecto
}

function startSelect() {
  scene = 'select';
  FLOOR_Y = DEFAULT_FLOOR_Y;
  select = {
    p1: 0,
    p2: Math.min(1, CHARACTERS.length - 1),
    p1Ready: false,
    p2Ready: false
  };
}

// La llama Net cuando un invitado entra a nuestra sala.
function onPeerConnected() {
  startSelect();
}

function startFight(p1Index, p2Index, stageIndex) {
  scene = 'fight';
  matchId++;
  const sIdx = stageIndex !== undefined ? stageIndex : 0;
  FLOOR_Y = STAGES[sIdx].floorY || DEFAULT_FLOOR_Y;
  game = {
    matchId,
    stageIndex: sIdx,
    fighters: [
      // P1 es el jugador local: su golpe/especial también sale con el ratón
      new Fighter(CHARACTERS[p1Index], 280, 1, P1_CONTROLS, withMouseButtons(localInput, P1_CONTROLS)),
      new Fighter(CHARACTERS[p2Index], W - 280, -1, P2_CONTROLS, p2Input())
    ],
    projectiles: [],
    timer: ROUND_SECONDS * 60,
    hitstop: 0, // frames de pausa dramática al conectar un golpe
    intro: INTRO_FRAMES,
    winner: null,
    koTime: 0, // frames transcurridos desde el KO (dirige la cinemática)
    p1Index,
    p2Index,
    onKO(loser) {
      this.winner = this.fighters.find((f) => f !== loser);
      this.koTime = 0;
      scene = 'ko';
    }
  };
}

// --- Escena: menú principal ---
function chooseMenuOption(i) {
  menuIndex = i;
  playSfx('confirm');
  netNotice = '';
  if (i === 0) {
    startSelect();
  } else if (i === 1) {
    scene = 'lobby';
    Net.host();
  } else {
    scene = 'join';
    joinCode = '';
  }
}

function updateMenu() {
  if (keyPressed['arrowup'] || keyPressed['w']) {
    menuIndex = (menuIndex + MENU_OPTIONS.length - 1) % MENU_OPTIONS.length;
    playSfx('select');
  }
  if (keyPressed['arrowdown'] || keyPressed['s']) {
    menuIndex = (menuIndex + 1) % MENU_OPTIONS.length;
    playSfx('select');
  }
  if (keyPressed['enter'] || keyPressed['f']) {
    chooseMenuOption(menuIndex);
    return;
  }

  // ratón: pasar por encima resalta la opción, clic la elige
  MENU_OPTIONS.forEach((_, i) => {
    const r = menuOptionRect(i);
    if (mouseOver(r)) {
      if (mouse.moved && menuIndex !== i) {
        menuIndex = i;
        playSfx('select');
      }
      if (mouse.clicked) chooseMenuOption(i);
    }
  });
}

function drawMenu() {
  drawStage();
  ctx.fillStyle = 'rgba(13, 13, 25, 0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 58px "Segoe UI", sans-serif';
  ctx.fillText('Niños con problemas: Fighting game', W / 2, 130);

  MENU_OPTIONS.forEach((opt, i) => {
    const y = 250 + i * 60;
    const active = i === menuIndex;
    ctx.fillStyle = active ? '#fff' : '#9ca3af';
    ctx.font = (active ? 'bold ' : '') + '26px "Segoe UI", sans-serif';
    ctx.fillText((active ? '▶  ' : '') + opt, W / 2, y);
  });

  ctx.fillStyle = '#6b7280';
  ctx.font = '17px "Segoe UI", sans-serif';
  ctx.fillText('Haz clic en una opción · o W/S y ENTER', W / 2, 480);

  if (netNotice) {
    ctx.fillStyle = '#f87171';
    ctx.font = '19px "Segoe UI", sans-serif';
    ctx.fillText(netNotice, W / 2, 525);
  }
}

// --- Escena: escribir código para unirse ---
function updateJoin() {
  for (const k in keyPressed) {
    if (/^[a-z]$/.test(k) && joinCode.length < 4) {
      joinCode += k.toUpperCase();
      playSfx('select');
    }
  }
  if (keyPressed['backspace']) joinCode = joinCode.slice(0, -1);
  if (keyPressed['escape'] || mouseClickedIn(JOIN_BACK)) {
    startMenu();
    return;
  }
  if ((keyPressed['enter'] || mouseClickedIn(JOIN_GO)) && joinCode.length === 4) {
    playSfx('confirm');
    Net.join(joinCode); // a partir de aquí corre el bucle de invitado
  }
}

function drawJoin() {
  drawStage();
  ctx.fillStyle = 'rgba(13, 13, 25, 0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px "Segoe UI", sans-serif';
  ctx.fillText('CÓDIGO DE LA SALA', W / 2, 170);

  // las 4 casillas del código
  for (let i = 0; i < 4; i++) {
    const x = W / 2 - 150 + i * 80;
    ctx.fillStyle = '#1c1c2e';
    ctx.beginPath();
    ctx.roundRect(x, 230, 64, 80, 10);
    ctx.fill();
    ctx.strokeStyle = i === joinCode.length ? '#fbbf24' : '#3f3a4d';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (joinCode[i]) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 46px "Segoe UI", sans-serif';
      ctx.fillText(joinCode[i], x + 32, 288);
    }
  }

  ctx.fillStyle = '#9ca3af';
  ctx.font = '19px "Segoe UI", sans-serif';
  ctx.fillText('Escribe las 4 letras del código', W / 2, 345);

  if (joinCode.length === 4) drawButton(JOIN_GO, 'CONECTAR (ENTER)', true);
  drawButton(JOIN_BACK, '← Volver (ESC)');
}

// --- Escena: sala de espera (host) ---
function updateLobby() {
  if (Net.status === 'waiting' && (mouseClickedIn(LOBBY_COPY) || keyPressed['c'])) {
    copyText(Net.code);
    playSfx('select');
  }
  if (keyPressed['escape'] || mouseClickedIn(LOBBY_CANCEL)) {
    Net.reset();
    startMenu();
  }
}

function drawLobby(message) {
  drawStage();
  ctx.fillStyle = 'rgba(13, 13, 25, 0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';

  if (message) {
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.fillText(message, W / 2, H / 2 - 20);
  } else if (Net.status === 'opening') {
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.fillText('Creando sala...', W / 2, H / 2 - 20);
  } else if (Net.status === 'waiting') {
    ctx.font = '26px "Segoe UI", sans-serif';
    ctx.fillText('Comparte este código con tu amigo:', W / 2, 175);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 104px "Segoe UI", sans-serif';
    ctx.fillText(Net.code.split('').join(' '), W / 2, 300);
    // botón de copiar (con feedback "¡Copiado!")
    drawButton(LOBBY_COPY, copyFeedback > 0 ? '✓ ¡Copiado!' : '⧉ Copiar código', copyFeedback > 0);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '20px "Segoe UI", sans-serif';
    ctx.fillText('Esperando a que se una... (tú serás el Jugador 1)', W / 2, 450);
  }

  drawButton(LOBBY_CANCEL, 'Cancelar (ESC)');
}

// Aviso pequeño con la sala y tu rol, durante partidas online.
function drawNetRoleHint() {
  if (Net.mode === 'local' || Net.status !== 'connected') return;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '14px "Segoe UI", sans-serif';
  const role = Net.mode === 'host' ? 'Eres P1' : 'Eres P2';
  ctx.fillText(`Sala ${Net.code} · ${role}`, W / 2, H - 12);
}

// --- Escena: selección de personaje ---
function updateSelect() {
  if (keyPressed['escape'] || mouseClickedIn(SELECT_BACK)) {
    backToMenu();
    return;
  }

  const moveCursor = (player, dir) => {
    select[player] = (select[player] + dir + CHARACTERS.length) % CHARACTERS.length;
    playSfx('select');
  };

  if (!select.p1Ready) {
    if (localInput.pressed(P1_CONTROLS.left)) moveCursor('p1', -1);
    if (localInput.pressed(P1_CONTROLS.right)) moveCursor('p1', 1);
    if (localInput.pressed(P1_CONTROLS.attack)) { select.p1Ready = true; playSfx('confirm'); }
  }
  const p2 = p2Input();
  if (!select.p2Ready) {
    if (p2.pressed(P2_CONTROLS.left)) moveCursor('p2', -1);
    if (p2.pressed(P2_CONTROLS.right)) moveCursor('p2', 1);
    if (p2.pressed(P2_CONTROLS.attack)) { select.p2Ready = true; playSfx('confirm'); }
  }

  // ratón: un clic elige la carta, otro clic en la misma confirma.
  // En local primero elige P1 y luego P2; online el host solo maneja a P1.
  CHARACTERS.forEach((_, i) => {
    const r = selectCardRect(i);
    mouseOver(r);
    if (!mouseClickedIn(r)) return;
    if (!select.p1Ready) {
      if (select.p1 === i) { select.p1Ready = true; playSfx('confirm'); }
      else { select.p1 = i; playSfx('select'); }
    } else if (Net.mode === 'local' && !select.p2Ready) {
      if (select.p2 === i) { select.p2Ready = true; playSfx('confirm'); }
      else { select.p2 = i; playSfx('select'); }
    }
  });

  if (select.p1Ready && select.p2Ready) {
    scene = 'stage'; // ambos listos: a elegir escenario
  }
}

// --- Escena: selección de escenario (elige P1 / el host) ---
// Carrusel: la carta seleccionada se centra y las demás flanquean.
// stageScroll sigue a stageSel con suavizado para deslizar.
let stageScroll = 0;
const stageCardRect = (i) => {
  const cardW = 290;
  const gap = 36;
  return { x: W / 2 - cardW / 2 + (i - stageScroll) * (cardW + gap), y: 170, w: cardW, h: 200 };
};

function updateStageSelect() {
  if (keyPressed['escape'] || mouseClickedIn(SELECT_BACK)) {
    startSelect();
    return;
  }
  const leftArrow = { x: 30, y: 250, w: 60, h: 60 };
  const rightArrow = { x: W - 90, y: 250, w: 60, h: 60 };
  mouseOver(leftArrow); mouseOver(rightArrow);
  if (keyPressed['a'] || keyPressed['arrowleft'] || mouseClickedIn(leftArrow)) {
    stageSel = (stageSel + STAGES.length - 1) % STAGES.length;
    playSfx('select');
  }
  if (keyPressed['d'] || keyPressed['arrowright'] || mouseClickedIn(rightArrow)) {
    stageSel = (stageSel + 1) % STAGES.length;
    playSfx('select');
  }
  if (keyPressed['f'] || keyPressed['enter']) {
    playSfx('confirm');
    startFight(select.p1, select.p2, stageSel);
    return;
  }
  STAGES.forEach((_, i) => {
    const r = stageCardRect(i);
    mouseOver(r);
    if (!mouseClickedIn(r)) return;
    if (stageSel === i) {
      playSfx('confirm');
      startFight(select.p1, select.p2, stageSel);
    } else {
      stageSel = i;
      playSfx('select');
    }
  });
}

function drawStageSelect() {
  // deslizamiento suave del carrusel hacia la carta seleccionada
  stageScroll += (stageSel - stageScroll) * 0.22;
  if (Math.abs(stageScroll - stageSel) < 0.002) stageScroll = stageSel;

  paintStage(stageSel); // el escenario elegido de fondo, a tamaño completo
  ctx.fillStyle = 'rgba(13, 13, 25, 0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px "Segoe UI", sans-serif';
  ctx.fillText('ELIGE EL ESCENARIO', W / 2, 90);

  STAGES.forEach((s, i) => {
    const r = stageCardRect(i);
    if (r.x + r.w < -20 || r.x > W + 20) return; // fuera de pantalla: no dibujar
    // miniatura del escenario dentro de la carta
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.clip();
    ctx.translate(r.x, r.y);
    ctx.scale(r.w / W, r.h / H);
    paintStage(i);
    ctx.restore();

    const sel = stageSel === i;
    ctx.strokeStyle = sel ? '#fbbf24' : '#3f3a4d';
    ctx.lineWidth = sel ? 5 : 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.stroke();

    ctx.fillStyle = sel ? '#fbbf24' : '#d1d5db';
    ctx.font = (sel ? 'bold ' : '') + '20px "Segoe UI", sans-serif';
    ctx.fillText(s.name, r.x + r.w / 2, r.y + r.h + 32);
  });

  // flechas indicando que hay más escenarios a los lados
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px "Segoe UI", sans-serif';
  if (STAGES.length > 1) {
    ctx.fillText('‹', 60, 280);
    ctx.fillText('›', W - 60, 280);
  }
  ctx.fillStyle = '#9ca3af';
  ctx.font = '15px "Segoe UI", sans-serif';
  ctx.fillText(`${stageSel + 1} / ${STAGES.length}`, W / 2, 410);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '18px "Segoe UI", sans-serif';
  const who = Net.mode === 'guest' ? 'Elige el anfitrión...' : 'A/D o ←/→ para moverte · F o ENTER para pelear · o haz clic';
  ctx.fillText(who, W / 2, 460);

  drawButton(SELECT_BACK, '← Personajes (ESC)');
}

function drawSelect() {
  drawStage();
  ctx.fillStyle = 'rgba(13, 13, 25, 0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px "Segoe UI", sans-serif';
  ctx.fillText('ELIGE TU LUCHADOR', W / 2, 80);

  const cardW = 170;
  const gap = 40;
  const total = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
  const startX = (W - total) / 2;

  CHARACTERS.forEach((def, i) => {
    const x = startX + i * (cardW + gap);
    const y = 130;

    ctx.fillStyle = '#1c1c2e';
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, 270, 12);
    ctx.fill();

    // bordes de cursor: azul P1, rojo P2
    if (select.p1 === i) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 6, y - 6, cardW + 12, 282);
    }
    if (select.p2 === i) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, cardW - 4, 266);
    }

    // figura del personaje (sprite si lo tiene, muñeco si no)
    const cardSprite = Sprites.get(def, 'idle1');
    if (cardSprite) {
      // proporcional al tamaño en combate (el lienzo trae aire arriba)
      const sh = def.spriteHeight ? def.spriteHeight * 0.85 : 175;
      const sw = sh * cardSprite.width / cardSprite.height;
      ctx.drawImage(cardSprite, x + cardW / 2 - sw / 2, y + 200 - sh, sw, sh);
    } else {
      ctx.save();
      ctx.translate(x + cardW / 2, y + 200);
      ctx.scale(0.95, 0.95);
      drawFighterFigure(ctx, def, {});
      ctx.restore();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText(def.name, x + cardW / 2, y + 228);
    if (def.title) {
      ctx.fillStyle = def.color;
      ctx.font = 'italic 13px "Segoe UI", sans-serif';
      ctx.fillText(def.title, x + cardW / 2, y + 246);
    }
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px "Segoe UI", sans-serif';
    const SPECIAL_NAMES = {
      projectile: 'Proyectil',
      strings: 'Hilos de control',
      shout: 'Grito demoledor'
    };
    const specialName = SPECIAL_NAMES[def.special.type] || def.special.type;
    ctx.fillText(`❤ ${def.maxHealth} · ✦ ${specialName}`, x + cardW / 2, y + 262);
  });

  ctx.font = '18px "Segoe UI", sans-serif';
  ctx.fillStyle = select.p1Ready ? '#4ade80' : '#3b82f6';
  ctx.fillText(select.p1Ready ? 'P1 ¡LISTO!' : 'P1: A/D y F para confirmar · o haz clic en una carta', W / 2, 460);
  ctx.fillStyle = select.p2Ready ? '#4ade80' : '#ef4444';
  const p2Hint = Net.mode === 'local' && select.p1Ready
    ? 'P2: ←/→ y K para confirmar · o haz clic en una carta'
    : 'P2: ←/→ para moverte, K para confirmar';
  ctx.fillText(select.p2Ready ? 'P2 ¡LISTO!' : p2Hint, W / 2, 495);

  drawButton(SELECT_BACK, '← Menú (ESC)');
}

// --- Escena: pelea ---
function updateFight() {
  if (game.intro > 0) {
    // pitidos de la cuenta atrás al entrar en cada fase
    if (game.intro === 210 || game.intro === 158 || game.intro === 106) playSfx('count');
    if (game.intro === 54) playSfx('fight');
    game.intro--;
    return;
  }

  // hitstop: el mundo se congela unos frames tras un impacto, pero las
  // pulsaciones de golpe siguen entrando al buffer (que no se pierdan)
  if (game.hitstop > 0) {
    game.hitstop--;
    game.fighters.forEach((f) => {
      if (f.state !== 'ko' && f.input.pressed(f.controls.attack)) f.attackBuffer = 12;
    });
    return;
  }

  if (game.timer > 0) game.timer--;
  if (game.timer === 0) {
    const [a, b] = game.fighters;
    game.winner = a.health === b.health ? null : (a.health > b.health ? a : b);
    game.koTime = 0;
    scene = 'ko';
    return;
  }

  const [f1, f2] = game.fighters;
  f1.update(f2, game);
  f2.update(f1, game);
  separateFighters(f1, f2);

  game.projectiles.forEach((p) => p.update(game));
  game.projectiles = game.projectiles.filter((p) => p.alive);
}

// Evita que los luchadores se atraviesen (salvo durante un dash,
// que atraviesa al rival a propósito).
function separateFighters(a, b) {
  if (a.state === 'ko' || b.state === 'ko') return;
  if (a.state === 'dash' || b.state === 'dash') return;
  const boxA = a.hurtbox;
  const boxB = b.hurtbox;
  if (!rectsOverlap(boxA, boxB)) return;
  const overlap = (boxA.x < boxB.x)
    ? boxA.x + boxA.w - boxB.x
    : boxB.x + boxB.w - boxA.x;
  const push = overlap / 2 + 1;
  if (a.x < b.x) { a.x -= push; b.x += push; }
  else { a.x += push; b.x -= push; }
}

function drawFight() {
  ctx.save();
  // sacudida sutil de pantalla durante el hitstop
  if (game.hitstop > 0) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  }
  drawStage();
  game.projectiles.forEach((p) => p.draw(ctx));
  game.fighters.forEach((f) => f.draw(ctx));
  ctx.restore();
  drawHUD();

  if (game.intro > 0) {
    drawCountdown();
  }
}

// Cuenta atrás de inicio: 3, 2, 1, ¡A PELEAR! Cada cifra crece y se
// desvanece para dar el efecto típico de juego de lucha.
function drawCountdown() {
  const t = game.intro;
  let label, phaseStart, phaseLen, big;
  if (t > 158) { label = '3'; phaseStart = 210; phaseLen = 52; big = true; }
  else if (t > 106) { label = '2'; phaseStart = 158; phaseLen = 52; big = true; }
  else if (t > 54) { label = '1'; phaseStart = 106; phaseLen = 52; big = true; }
  else { label = '¡A PELEAR!'; phaseStart = 54; phaseLen = 54; big = false; }

  const into = phaseStart - t;            // frames dentro de la fase
  const p = into / phaseLen;              // 0→1 progreso de la fase
  const appear = Math.min(1, into / 8);   // aparición rápida
  const alpha = 1 - Math.max(0, (p - 0.7) / 0.3) * 0.85; // se desvanece al final

  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = alpha;
  if (big) {
    const size = 150 - appear * 40; // entra grande y se asienta
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
    ctx.strokeText(label, W / 2, H / 2 + size * 0.32);
    ctx.fillText(label, W / 2, H / 2 + size * 0.32);
  } else {
    const size = 56 + appear * 18;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 5;
    ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
    ctx.strokeText('¡A PELEAR!', W / 2, H / 2 + 18);
    ctx.fillText('¡A PELEAR!', W / 2, H / 2 + 18);
  }
  ctx.restore();
}

// --- Escena: KO / victoria cinemática ---
const KO_IMPACT = 55;   // frames de impacto/caída antes de la cinemática
const CINE_SP3 = 46;    // frames mostrando special3 (entrada épica)
const CINE_BUTTONS = 34; // tras pasar a special4, aparecen los botones

// ¿Se puede ya interactuar con los botones de fin de combate?
function victoryReady() {
  return !game.winner || game.koTime > KO_IMPACT + CINE_SP3 + CINE_BUTTONS;
}

function updateKO() {
  // el hitstop del golpe de KO también congela la caída un instante
  if (game.hitstop > 0) {
    game.hitstop--;
    return;
  }
  game.koTime++;

  // fase de impacto: el perdedor cae con física normal
  if (game.koTime <= KO_IMPACT) {
    const [f1, f2] = game.fighters;
    f1.update(f2, game);
    f2.update(f1, game);
    game.projectiles.forEach((p) => p.update(game));
    game.projectiles = game.projectiles.filter((p) => p.alive);
    return;
  }
  // arranque de la cinemática: grito de victoria
  if (game.koTime === KO_IMPACT + 1 && game.winner) playSfx('victory');

  if (victoryReady()) {
    if (anyPressed('r') || mouseClickedIn(KO_REMATCH)) startFight(game.p1Index, game.p2Index, game.stageIndex);
    else if (anyPressed('enter') || mouseClickedIn(KO_SELECT)) startSelect();
    else if (keyPressed['escape'] || mouseClickedIn(KO_MENU)) backToMenu();
  }
}

// Dibuja un sprite estático de un personaje centrado en (cx) con los
// pies en feetY y altura sh (para la cinemática de victoria).
function drawPoseSprite(def, pose, cx, feetY, sh) {
  const sprite = Sprites.get(def, pose);
  if (!sprite) return;
  const sw = sh * sprite.width / sprite.height;
  ctx.drawImage(sprite, cx - sw / 2, feetY - sh, sw, sh);
}

function drawKO() {
  // fase de impacto: vista normal del combate con el perdedor cayendo
  if (game.winner && game.koTime <= KO_IMPACT) {
    drawFight();
    return;
  }
  if (!game.winner) {
    // empate: sin cinemática
    drawFight();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H / 2 - 130, W, 290);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px "Segoe UI", sans-serif';
    ctx.fillText('¡EMPATE!', W / 2, H / 2 - 20);
    drawButton(KO_REMATCH, 'REVANCHA (R)', true);
    drawButton(KO_SELECT, 'ELEGIR PERSONAJES (ENTER)');
    drawButton(KO_MENU, 'MENÚ PRINCIPAL (ESC)');
    return;
  }
  drawVictoryCinematic();
}

function drawVictoryCinematic() {
  const win = game.winner;
  const c = game.koTime - KO_IMPACT; // frames desde el inicio de la cinemática

  // fondo: escenario muy oscurecido
  paintStage(game.stageIndex);
  ctx.fillStyle = 'rgba(8, 6, 16, 0.82)';
  ctx.fillRect(0, 0, W, H);

  // rayos giratorios del color del personaje detrás del ganador
  ctx.save();
  ctx.translate(W / 2, H * 0.52);
  ctx.rotate(performance.now() / 2600);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    ctx.fillStyle = win.def.color + '22';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(820, -42);
    ctx.lineTo(820, 42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // el ganador entra con su pose de "build" y se congela en la "final"
  const reveal = Math.min(1, c / 14);          // 0→1 al aparecer
  const pose = c < CINE_SP3 ? (win.def.victoryBuild || 'special3')
                            : (win.def.victoryFinal || 'special4');
  const baseH = (win.def.spriteHeight || 320) * 1.25;
  const sh = baseH * (0.88 + 0.12 * reveal);   // leve zoom de entrada
  const floatY = Math.sin(performance.now() / 600) * 6;
  ctx.save();
  ctx.globalAlpha = reveal;
  drawPoseSprite(win.def, pose, W / 2, H * 0.96 + floatY, sh);
  ctx.restore();
  ctx.globalAlpha = 1;

  // destello al cambiar a special4
  if (c >= CINE_SP3 && c < CINE_SP3 + 8) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (c - CINE_SP3) / 8)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // textos: nombre y frase aparecen con la pose final
  ctx.textAlign = 'center';
  if (c > 6) {
    const a = Math.min(1, (c - 6) / 16);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 30px "Segoe UI", sans-serif';
    ctx.fillText('VICTORIA', W / 2, 70);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 62px "Segoe UI", sans-serif';
    ctx.fillText(win.def.name, W / 2, 130);
    ctx.globalAlpha = 1;
  }
  if (c > CINE_SP3) {
    const a = Math.min(1, (c - CINE_SP3) / 16);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fde047';
    ctx.font = 'italic 28px "Segoe UI", sans-serif';
    ctx.fillText(`"${win.def.winPhrase}"`, W / 2, 180);
    ctx.globalAlpha = 1;
  }

  // botones cuando la cinemática ha asentado
  if (victoryReady()) {
    drawButton(KO_REMATCH, 'REVANCHA (R)', true);
    drawButton(KO_SELECT, 'ELEGIR PERSONAJES (ENTER)');
    drawButton(KO_MENU, 'MENÚ PRINCIPAL (ESC)');
  }
}

// --- Escenario y HUD ---
// Pinta el escenario i a pantalla completa (imagen si la tiene,
// o la ciudad nocturna dibujada por código).
function paintStage(i) {
  const img = StageArt.images[i];
  if (img) {
    ctx.drawImage(img, 0, 0, W, H);
    return;
  }
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1e1b4b');
  sky.addColorStop(0.7, '#4c1d95');
  sky.addColorStop(1, '#7c2d12');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // luna
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(840, 100, 38, 0, Math.PI * 2);
  ctx.fill();

  // siluetas de edificios
  ctx.fillStyle = '#16122b';
  [[0, 300, 90], [70, 250, 110], [160, 330, 70], [780, 280, 100], [870, 320, 80], [930, 260, 95]]
    .forEach(([x, y, w]) => ctx.fillRect(x, y, w, FLOOR_Y - y + 20));

  // piso (el borde superior coincide con la línea donde pisan los pies)
  ctx.fillStyle = '#292433';
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.fillStyle = '#3f3a4d';
  ctx.fillRect(0, FLOOR_Y, W, 6);
}

// El escenario de la partida en curso (o el primero, en los menús).
function drawStage() {
  paintStage(game && game.stageIndex !== undefined ? game.stageIndex : 0);
}

function drawHealthBar(f, x, mirrored) {
  const barW = 380;
  const pct = f.health / f.def.maxHealth;
  ctx.fillStyle = '#111';
  ctx.fillRect(x, 24, barW, 26);
  ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#ef4444';
  const fillW = barW * pct;
  ctx.fillRect(mirrored ? x + barW - fillW : x, 24, fillW, 26);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, 24, barW, 26);

  // mini-barras de cooldown: especial (amarilla) y dash (cian)
  const miniBar = (y, frac, color) => {
    const bw = barW * 0.6;
    const bx = mirrored ? x + barW - bw : x;
    ctx.fillStyle = '#111';
    ctx.fillRect(bx, y, bw, 7);
    ctx.fillStyle = frac >= 1 ? color : '#6b7280';
    const fw = bw * Math.min(1, frac);
    ctx.fillRect(mirrored ? bx + bw - fw : bx, y, fw, 7);
  };
  miniBar(55, 1 - f.specialCooldown / f.def.special.cooldownFrames, '#fbbf24');
  miniBar(65, 1 - f.dashCooldown / DASH_COOLDOWN, '#22d3ee');

  // tensión de la guardia: aparece al bloquear, si se llena te la rompen
  if (f.blockStrain > 0) {
    const bw = barW * 0.6;
    const bx = mirrored ? x + barW - bw : x;
    ctx.fillStyle = '#111';
    ctx.fillRect(bx, 75, bw, 5);
    ctx.fillStyle = '#f87171';
    const fw = bw * Math.min(1, f.blockStrain / GUARD_BREAK_AT);
    ctx.fillRect(mirrored ? bx + bw - fw : bx, 75, fw, 5);
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.textAlign = mirrored ? 'right' : 'left';
  ctx.fillText(f.def.name, mirrored ? x + barW : x, 92);
}

function drawHUD() {
  drawHealthBar(game.fighters[0], 30, false);
  drawHealthBar(game.fighters[1], W - 30 - 380, true);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(game.timer / 60), W / 2, 52);
}

// --- Red: snapshots (host → guest) ---
function buildSnapshot() {
  const snap = { t: 'state', scene, matchId };
  if (scene === 'select' && select) {
    snap.select = { p1: select.p1, p2: select.p2, p1Ready: select.p1Ready, p2Ready: select.p2Ready };
  }
  if (scene === 'stage') snap.stageSel = stageSel;
  if ((scene === 'fight' || scene === 'ko') && game) {
    snap.game = {
      p1Index: game.p1Index,
      p2Index: game.p2Index,
      stageIndex: game.stageIndex,
      timer: game.timer,
      intro: game.intro,
      koTime: game.koTime,
      hitstop: game.hitstop,
      winner: game.winner ? game.fighters.indexOf(game.winner) : -1,
      fighters: game.fighters.map((f) => ({
        x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing,
        state: f.state, stateTimer: f.stateTimer, health: f.health,
        flash: f.flash, specialCooldown: f.specialCooldown,
        crouching: f.crouching, dashDir: f.dashDir, dashCooldown: f.dashCooldown,
        reversedTimer: f.reversedTimer, shoutFx: f.shoutFx, comboStage: f.comboStage,
        blockStrain: f.blockStrain, parryWindow: f.parryWindow, parryFx: f.parryFx
      })),
      projectiles: game.projectiles.map((p) => ({ x: p.x, y: p.y, vx: p.vx, age: p.age, color: p.color, kind: p.kind }))
    };
  }
  return snap;
}

function applySnapshot(s) {
  scene = s.scene;
  if (s.select) select = s.select;
  if (s.stageSel !== undefined) stageSel = s.stageSel;
  if (s.game) {
    if (!game || game.matchId !== s.matchId) {
      // partida nueva: crear los luchadores espejo
      FLOOR_Y = STAGES[s.game.stageIndex || 0].floorY || DEFAULT_FLOOR_Y;
      game = {
        matchId: s.matchId,
        p1Index: s.game.p1Index,
        p2Index: s.game.p2Index,
        stageIndex: s.game.stageIndex || 0,
        fighters: [
          new Fighter(CHARACTERS[s.game.p1Index], 280, 1, P1_CONTROLS, localInput),
          new Fighter(CHARACTERS[s.game.p2Index], W - 280, -1, P2_CONTROLS, localInput)
        ],
        projectiles: []
      };
    }
    game.timer = s.game.timer;
    game.intro = s.game.intro;
    game.koTime = s.game.koTime || 0;
    game.hitstop = s.game.hitstop || 0;
    game.winner = s.game.winner >= 0 ? game.fighters[s.game.winner] : null;
    s.game.fighters.forEach((fd, i) => Object.assign(game.fighters[i], fd));
    game.projectiles = s.game.projectiles.map((pd) => Object.assign(Object.create(Projectile.prototype), pd));
  }
}

// --- Bucles por modo ---
function hostOrLocalTick() {
  // si el invitado se fue (o falló la sala), volver al menú avisando
  if (Net.mode === 'host' && (Net.status === 'closed' || Net.status === 'error')) {
    netNotice = Net.status === 'error'
      ? `Error de conexión (${Net.errorMsg})`
      : 'El otro jugador se desconectó.';
    Net.reset();
    startMenu();
  }

  // 1) actualizar — la escena puede cambiar aquí (p. ej. ESC en el KO)
  if (scene === 'menu') updateMenu();
  else if (scene === 'join') updateJoin();
  else if (scene === 'lobby') updateLobby();
  else if (scene === 'select') updateSelect();
  else if (scene === 'stage') updateStageSelect();
  else if (scene === 'fight') updateFight();
  else if (scene === 'ko') updateKO();

  // 2) dibujar la escena ACTUAL — si el update la cambió, dibujamos
  // ya la nueva; dibujar la vieja crashearía (su estado ya no existe)
  if (scene === 'menu') drawMenu();
  else if (scene === 'join') drawJoin();
  else if (scene === 'lobby') drawLobby();
  else if (scene === 'select') drawSelect();
  else if (scene === 'stage') drawStageSelect();
  else if (scene === 'fight') drawFight();
  else if (scene === 'ko') drawKO();

  if (Net.mode === 'host' && Net.status === 'connected' &&
      (scene === 'select' || scene === 'stage' || scene === 'fight' || scene === 'ko')) {
    Net.sendState(buildSnapshot());
  }
  drawNetRoleHint();
}

function guestTick() {
  if (Net.status === 'closed' || Net.status === 'error') {
    netNotice = Net.status === 'error'
      ? (Net.errorMsg === 'peer-unavailable'
          ? 'No se encontró ninguna sala con ese código.'
          : `Error de conexión (${Net.errorMsg})`)
      : 'El anfitrión cerró la sala.';
    Net.reset();
    startMenu();
    return;
  }

  // salir al menú: ESC siempre, o clic en los botones de volver
  const clickedBack =
    (scene === 'select' && mouseClickedIn(SELECT_BACK)) ||
    (scene === 'ko' && game && victoryReady() && mouseClickedIn(KO_MENU));
  if (keyPressed['escape'] || clickedBack) {
    Net.reset();
    startMenu();
    return;
  }

  if (Net.status !== 'connected') {
    if (mouseClickedIn(LOBBY_CANCEL)) {
      Net.reset();
      startMenu();
      return;
    }
    drawLobby(`Conectando a la sala ${Net.code}...`);
    return;
  }

  const input = collectGuestInput();
  Net.sendInput(input.down, input.pressed);

  if (Net.lastState) applySnapshot(Net.lastState);

  if (scene === 'select' && select) drawSelect();
  else if (scene === 'stage') drawStageSelect();
  else if ((scene === 'fight' || scene === 'ko') && game) {
    if (scene === 'fight') drawFight();
    else drawKO();
  } else {
    drawLobby('Esperando al anfitrión...');
  }
  drawNetRoleHint();
}

// --- Bucle principal ---
function loop() {
  try {
    if (copyFeedback > 0) copyFeedback--;
    mouse.hoverUI = false;
    if (Net.mode === 'guest') guestTick();
    else hostOrLocalTick();
    canvas.style.cursor = mouse.hoverUI ? 'pointer' : 'default';
    keyPressed = {};
    mouse.clicked = false;
    mouse.moved = false;
    if (Net.mode === 'host') Net.remoteKeyPressed = {};
  } catch (err) {
    // en vez de congelarse en silencio, mostrar el error en pantalla
    console.error(err);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Se ha producido un error', W / 2, H / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.fillText(String(err && err.message ? err.message : err), W / 2, H / 2 + 6);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText('Pulsa F5 para reiniciar (y cuéntame este mensaje)', W / 2, H / 2 + 40);
    return; // detener el bucle para no spamear
  }
  requestAnimationFrame(loop);
}

startMenu();
loop();
