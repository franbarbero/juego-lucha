// ============================================================
//  FIGHTER — la clase de los luchadores, y los proyectiles.
//  La física y los estados viven aquí; los números de cada
//  personaje (daño, velocidad, etc.) vienen de characters.js.
// ============================================================

// Gravedad asimétrica estilo juego de lucha: subes flotando, caes con peso,
// y "flotas" un instante en el punto más alto (apex hang) para que el salto
// tenga sensación y control.
const GRAVITY_RISE = 0.46;   // mientras subes (suave: arco alto y flotante)
const GRAVITY_FALL = 0.72;   // al caer (algo más de peso, pero sin ser brusco)
const APEX_VY = 2.2;         // |vy| por debajo del cual estás "en la cima"
const APEX_FACTOR = 0.55;    // gravedad reducida en la cima (hang time)
const PREJUMP_FRAMES = 4;    // anticipación agachado antes de despegar
const AIR_CONTROL = 0.2;     // capacidad de redirigir en el aire (0 nada, 1 total)
const DEFAULT_FLOOR_Y = 490;
let FLOOR_Y = DEFAULT_FLOOR_Y; // cada escenario puede tener su línea de suelo
const STAGE_LEFT = 50;
const STAGE_RIGHT = 974;

// Dash universal: TODOS los personajes lo tienen, con los mismos
// números (es movilidad, no una estadística). Atraviesa rivales
// y proyectiles, y tiene su propio cooldown (barra cian del HUD).
const DASH_SPEED = 14;
const DASH_FRAMES = 12;
const DASH_COOLDOWN = 110;

const MAX_JUMPS = 2; // doble salto
const SHOUT_FX_FRAMES = 26; // duración de las ondas del grito
// SPECIAL_DURATION se define en sprites.js (se carga antes), porque
// spritePoseFor lo necesita; aquí solo lo usamos.

// Bloqueo: aguante máximo antes de la rotura de guardia, y frames
// iniciales del bloqueo en los que un golpe recibido cuenta como parry.
const GUARD_BREAK_AT = 20; // ajustado a los daños rebajados (~3 golpes seguidos)
const PARRY_WINDOW = 7;
const PARRY_STUN = 60; // 1 segundo incapacitado

// Dibuja la figura placeholder de un personaje, de pie, mirando
// a la derecha, con los pies en el origen (0, 0). La usan tanto
// los luchadores como la pantalla de selección.
function drawFighterFigure(ctx, def, opts = {}) {
  const flash = opts.flash > 0;
  const body = flash ? '#ffffff' : def.color;
  const skin = flash ? '#ffffff' : def.skinColor;
  const hair = flash ? '#ffffff' : def.hairColor;

  // piernas
  ctx.fillStyle = body;
  ctx.fillRect(-18, -34, 14, 34);
  ctx.fillRect(4, -34, 14, 34);

  // torso
  ctx.beginPath();
  ctx.roundRect(-26, -104, 52, 74, 10);
  ctx.fill();

  // brazo de golpe (se extiende durante el ataque)
  if (opts.attacking) {
    ctx.fillStyle = skin;
    ctx.fillRect(18, -92, opts.reach || 50, 14);
    ctx.beginPath();
    ctx.arc(18 + (opts.reach || 50), -85, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  // cabeza
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -126, 22, 0, Math.PI * 2);
  ctx.fill();

  // pelo
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -130, 22, Math.PI, Math.PI * 2);
  ctx.fill();

  // ojos (mirando a la derecha)
  if (!flash) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(7, -126, 2.6, 0, Math.PI * 2);
    ctx.arc(16, -126, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Fighter {
  // input: de dónde leer las teclas. Por defecto el teclado local;
  // en partidas online el P2 del host lee las teclas del invitado.
  constructor(def, x, facing, controls, input) {
    this.def = def;
    this.input = input || { down: (k) => !!keys[k], pressed: (k) => !!keyPressed[k] };
    this.x = x;
    this.y = FLOOR_Y;            // posición de los pies
    this.vx = 0;
    this.vy = 0;
    this.w = 56;
    this.h = 130;
    this.facing = facing;        // 1 = derecha, -1 = izquierda
    this.health = def.maxHealth;
    this.controls = controls;
    this.state = 'idle';         // idle | attack | dash | recover | hit | ko
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.specialCooldown = 0;
    this.hitRegistered = false;  // para que cada golpe pegue una sola vez
    this.flash = 0;              // frames de parpadeo blanco al recibir daño
    this.jumpsUsed = 0;          // saltos gastados (máx. MAX_JUMPS)
    this.comboStage = 0;         // golpe actual de la cadena (0..3)
    this.comboWindow = 0;        // frames restantes para encadenar el siguiente
    this.swingDuration = 0;      // duración del golpe en curso
    this.attackBuffer = 0;       // pulsación de golpe guardada (sale en cuanto se pueda)
    this.blockStrain = 0;        // tensión acumulada del bloqueo (rotura al llegar al tope)
    this.parryWindow = 0;        // frames iniciales del bloqueo que cuentan como parry
    this.parryFx = 0;            // destello del parry
    this.crouching = false;
    this.dashCooldown = 0;
    this.dashDir = facing;
    this.reversedTimer = 0;      // frames con los controles invertidos (hilos del titiritero)
    this.shoutFx = 0;            // frames de la onda expansiva del grito
  }

  get onGround() { return this.y >= FLOOR_Y; }

  // Agachado la caja es más baja: los proyectiles pasan por encima.
  get hurtbox() {
    const h = this.crouching ? 66 : this.h;
    return { x: this.x - this.w / 2, y: this.y - h, w: this.w, h };
  }

  // Caja de golpe del ataque básico, delante del personaje.
  // Agachado se pega bajo (sirve para alcanzar a rivales agachados).
  get attackHitbox() {
    const r = this.def.attack.range;
    const x = this.facing === 1 ? this.x + 10 : this.x - 10 - r;
    const y = this.crouching ? this.y - 62 : this.y - 100;
    return { x, y, w: r, h: 36 };
  }

  update(opponent, game) {
    if (this.flash > 0) this.flash--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.reversedTimer > 0) this.reversedTimer--;
    if (this.shoutFx > 0) this.shoutFx--;
    if (this.comboWindow > 0 && --this.comboWindow === 0) this.comboStage = 0;
    if (this.parryFx > 0) this.parryFx--;
    if (this.blockStrain > 0) this.blockStrain = Math.max(0, this.blockStrain - 0.12);

    // buffer de ataque: la pulsación se guarda aunque llegue a mitad de
    // un golpe, y se dispara en cuanto el personaje vuelve a estar libre
    if (this.state !== 'ko' && this.input.pressed(this.controls.attack)) {
      this.attackBuffer = 12;
    } else if (this.attackBuffer > 0) {
      this.attackBuffer--;
    }

    if (this.state === 'ko') {
      this.applyPhysics();
      this.vx *= 0.92;
      return;
    }

    if (this.state === 'hit' || this.state === 'recover' || this.state === 'stunned') {
      if (--this.stateTimer <= 0) this.state = 'idle';
    } else if (this.state === 'prejump') {
      // breve anticipación agachado; al acabar, despega con el impulso
      // horizontal según la dirección que estés manteniendo (salto
      // adelante / neutro / atrás, como en los juegos de lucha clásicos)
      this.vx = 0;
      if (--this.stateTimer <= 0) {
        const c = this.controls;
        const rev = this.reversedTimer > 0;
        const wantLeft = this.input.down(rev ? c.right : c.left);
        const wantRight = this.input.down(rev ? c.left : c.right);
        this.state = 'idle';
        this.vy = -this.def.jumpPower;
        this.vx = wantLeft ? -this.def.speed * 1.1 : wantRight ? this.def.speed * 1.1 : 0;
        this.jumpsUsed = 1;
        playSfx('jump', this.def.voice);
      }
    } else if (this.state === 'block') {
      // puedes desplazarte (despacio) sin bajar la guardia
      const c = this.controls;
      const rev = this.reversedTimer > 0;
      const blockSpeed = this.def.speed * 0.45;
      this.vx = 0;
      if (this.input.down(rev ? c.right : c.left)) this.vx = -blockSpeed;
      if (this.input.down(rev ? c.left : c.right)) this.vx = blockSpeed;
      if (this.vx > 0) this.facing = 1;
      else if (this.vx < 0) this.facing = -1;
      if (this.parryWindow > 0) this.parryWindow--;
      if (!this.input.down(c.block)) this.state = 'idle';
    } else if (this.state === 'attack') {
      this.vx *= 0.85; // frenar la embestida del golpe poco a poco
      // el frame de impacto empieza en el 50% del swing; la ventana activa
      // son los primeros 6 frames de ese impacto (coincide con el sprite)
      const strikeAt = this.swingDuration * 0.5;
      if (this.stateTimer <= strikeAt && this.stateTimer >= strikeAt - 6 && !this.hitRegistered) {
        if (rectsOverlap(this.attackHitbox, opponent.hurtbox)) {
          this.hitRegistered = true;
          const finisher = this.comboStage === 3;
          const mult = [1, 1, 1.25, 1.75][this.comboStage];
          const result = opponent.takeHit(
            Math.round(this.def.attack.damage * mult), this.facing, game,
            // los golpes intermedios apenas empujan (mantienen el combo);
            // el remate lanza al rival por los aires
            finisher ? { push: 12, lift: 7 } : { push: 3.5, lift: 2 }
          );
          if (result === 'parried') this.stun(PARRY_STUN);
        }
      }
      if (--this.stateTimer <= 0) {
        this.state = 'idle';
        this.vx = 0;
        if (this.comboStage < 3) {
          this.comboWindow = 24; // margen para encadenar el siguiente golpe
        } else {
          this.comboStage = 0;   // tras el remate, la cadena empieza de cero
          this.comboWindow = 0;
        }
      }
    } else if (this.state === 'dash') {
      // ráfaga horizontal sin gravedad; atraviesa todo (sin daño)
      this.vx = this.dashDir * DASH_SPEED;
      this.vy = 0;
      if (--this.stateTimer <= 0) {
        this.state = 'idle';
        this.vx = 0;
      }
    } else {
      this.handleInput(opponent, game);
    }

    this.applyPhysics();
  }

  handleInput(opponent, game) {
    const c = this.controls;

    // hilos del titiritero: izquierda y derecha obedecen al revés
    const rev = this.reversedTimer > 0;
    const leftKey = rev ? c.right : c.left;
    const rightKey = rev ? c.left : c.right;

    this.crouching = this.onGround && this.input.down(c.crouch);
    const speed = this.crouching ? this.def.speed * 0.5 : this.def.speed;
    const wantLeft = this.input.down(leftKey);
    const wantRight = this.input.down(rightKey);

    if (this.onGround) {
      // en tierra: control total
      this.vx = wantLeft ? -speed : wantRight ? speed : 0;
      if (this.vx > 0) this.facing = 1;
      else if (this.vx < 0) this.facing = -1;
      this.jumpsUsed = 0;
    } else {
      // en el aire: puedes redirigir libremente (primer salto y doble salto)
      const target = wantLeft ? -this.def.speed : wantRight ? this.def.speed : 0;
      this.vx += (target - this.vx) * AIR_CONTROL;
      if (this.vx > 0.2) this.facing = 1;
      else if (this.vx < -0.2) this.facing = -1;
    }

    // bloquear: mantén pulsado para cubrirte; los primeros frames son parry
    if (this.input.down(c.block) && this.onGround) {
      this.state = 'block';
      this.parryWindow = PARRY_WINDOW;
      this.crouching = false;
      this.vx = 0;
      return;
    }

    const jumpPressed = this.input.pressed(c.jump) ||
      (c.jumpAlt && this.input.pressed(c.jumpAlt));
    if (jumpPressed) {
      if (this.onGround) {
        // salto en tierra: anticipación (el despegue ocurre al acabar el prejump)
        this.state = 'prejump';
        this.stateTimer = PREJUMP_FRAMES;
        this.crouching = false;
        this.vx = 0;
        return;
      } else if (this.jumpsUsed < MAX_JUMPS) {
        // doble salto aéreo: instantáneo y permite redirigir el impulso
        this.vy = -this.def.jumpPower * 0.92;
        this.vx = wantLeft ? -this.def.speed * 1.1 : wantRight ? this.def.speed * 1.1 : this.vx;
        this.jumpsUsed++;
        playSfx('jump', this.def.voice);
      }
    }

    if (this.input.pressed(c.dash) && this.dashCooldown <= 0) {
      this.state = 'dash';
      this.stateTimer = DASH_FRAMES;
      this.dashCooldown = DASH_COOLDOWN;
      // hacia la dirección pulsada, o hacia donde miras
      this.dashDir = this.input.down(leftKey) ? -1
        : this.input.down(rightKey) ? 1
        : this.facing;
      this.crouching = false;
      playSfx('dash', this.def.voice);
      return;
    }

    if (this.attackBuffer > 0 && this.attackCooldown <= 0) {
      this.attackBuffer = 0;
      // encadenar dentro de la ventana avanza la secuencia 1→2→3→4
      this.comboStage = this.comboWindow > 0 ? Math.min(this.comboStage + 1, 3) : 0;
      this.comboWindow = 0;
      this.state = 'attack';
      // más largos para que la animación de cada golpe se aprecie;
      // los encadenados salen algo más rápido
      this.swingDuration = this.comboStage > 0 ? 28 : 36;
      this.stateTimer = this.swingDuration;
      this.hitRegistered = false;
      this.vx = this.facing * 3; // pequeña embestida hacia delante
      // entre golpes de la cadena casi no hay espera; tras el remate, la completa
      this.attackCooldown = this.comboStage === 3 ? this.def.attack.cooldownFrames + 10 : 8;
      // el tono del golpe sube con cada eslabón del combo
      playSfx('attack', {
        base: this.def.voice.base * (1 + this.comboStage * 0.18),
        wave: this.def.voice.wave
      });
    }

    if (this.input.pressed(c.special) && this.specialCooldown <= 0) {
      this.specialCooldown = this.def.special.cooldownFrames;
      playSfx('special', this.def.voice);
      const type = this.def.special.type;
      if (type === 'projectile' || type === 'strings') {
        this.state = 'recover';
        this.stateTimer = SPECIAL_DURATION;
        game.projectiles.push(new Projectile(this));
      } else if (type === 'shout') {
        // onda expansiva frontal: daño + empujón enorme
        this.state = 'recover';
        this.stateTimer = SPECIAL_DURATION;
        this.shoutFx = SHOUT_FX_FRAMES;
        const range = this.def.special.range;
        const box = {
          x: this.facing === 1 ? this.x : this.x - range,
          y: this.y - this.h - 10,
          w: range,
          h: this.h + 20
        };
        // el dash también esquiva el grito (cuenta como ataque a distancia)
        if (opponent.state !== 'dash' && rectsOverlap(box, opponent.hurtbox)) {
          const result = opponent.takeHit(this.def.special.damage, this.facing, game);
          if (result === 'parried') {
            this.stun(PARRY_STUN);
          } else if (result === 'hit' || result === 'ko') {
            opponent.vx = this.facing * 13;
            opponent.vy = -7;
          }
        }
      }
    }
  }

  applyPhysics() {
    // gravedad por fase: ligera al subir, fuerte al caer, mínima en la cima
    let g = this.vy < 0 ? GRAVITY_RISE : GRAVITY_FALL;
    if (Math.abs(this.vy) < APEX_VY) g *= APEX_FACTOR;
    this.vy += g;
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > FLOOR_Y) {
      this.y = FLOOR_Y;
      this.vy = 0;
    }
    this.x = Math.max(STAGE_LEFT, Math.min(STAGE_RIGHT, this.x));
  }

  // Aturdido e indefenso (castigo del parry).
  stun(frames) {
    if (this.state === 'ko') return;
    this.state = 'stunned';
    this.stateTimer = frames;
    this.vx = 0;
    this.comboStage = 0;
    this.comboWindow = 0;
  }

  // Devuelve cómo terminó el golpe: 'ignored' | 'parried' | 'blocked' | 'ko' | 'hit'
  takeHit(damage, dir, game, kb) {
    if (this.state === 'ko') return 'ignored';

    if (this.state === 'block') {
      if (this.parryWindow > 0) {
        // ¡PARRY! sin daño, destello y el atacante queda incapacitado
        this.parryFx = 30;
        if (game.hitstop !== undefined) game.hitstop = Math.max(game.hitstop, 14);
        playSfx('parry', this.def.voice);
        return 'parried';
      }
      // bloqueo normal: sin daño, pero la guardia acumula tensión
      this.blockStrain += damage;
      this.vx = dir * 3;
      this.flash = 3;
      if (this.blockStrain >= GUARD_BREAK_AT) {
        // ¡guardia rota! aturdido largo y expuesto
        this.blockStrain = 0;
        this.state = 'hit';
        this.stateTimer = 50;
        this.vx = dir * 6;
        this.flash = 10;
        if (game.hitstop !== undefined) game.hitstop = Math.max(game.hitstop, 10);
        playSfx('guardbreak', this.def.voice);
      } else {
        playSfx('block', this.def.voice);
      }
      return 'blocked';
    }

    const push = kb && kb.push !== undefined ? kb.push : 7;
    const lift = kb && kb.lift !== undefined ? kb.lift : 5;
    this.health = Math.max(0, this.health - damage);
    this.flash = 8;
    this.vx = dir * push;
    if (this.onGround) this.vy = -lift;
    // recibir un golpe corta tu propia cadena de combo
    this.comboStage = 0;
    this.comboWindow = 0;
    // hitstop: micro-pausa al conectar, más larga cuanto más fuerte el golpe
    if (game.hitstop !== undefined) {
      game.hitstop = Math.max(game.hitstop, this.health <= 0 ? 16 : damage >= 12 ? 9 : 6);
    }
    if (this.health <= 0) {
      this.state = 'ko';
      this.vy = -8;
      this.vx = dir * 4;
      playSfx('ko', this.def.voice);
      game.onKO(this);
      return 'ko';
    }
    this.state = 'hit';
    this.stateTimer = 16;
    playSfx('hit', this.def.voice);
    return 'hit';
  }

  draw(ctx) {
    // estela del dash
    if (this.state === 'dash') {
      ctx.fillStyle = this.def.color + '55';
      for (let i = 1; i <= 3; i++) {
        ctx.fillRect(this.x - this.dashDir * i * 18 - 20, this.y - 110, 40, 100);
      }
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    // si no hay sprite de KO propio (ya tumbado), giramos el de pie 90°
    if (this.state === 'ko' && !Sprites.exact(this.def, 'ko')) {
      ctx.rotate(this.facing * -Math.PI / 2);
      ctx.translate(0, 28);
    }
    if (this.facing === -1) ctx.scale(-1, 1);
    const pose = spritePoseFor(this);
    // aplastar la figura al agacharse solo si NO hay sprite real de agachado
    if (this.crouching && !Sprites.exact(this.def, pose)) ctx.scale(1, 0.55);
    if (this.state === 'dash') ctx.globalAlpha = 0.6; // intangible

    const sprite = Sprites.get(this.def, pose);
    if (sprite) {
      const sh = this.def.spriteHeight || 150;
      const sw = sh * sprite.width / sprite.height;
      if (this.flash > 0) ctx.filter = 'brightness(2.5)';
      ctx.drawImage(sprite, -sw / 2, -sh, sw, sh);
      ctx.filter = 'none';
    } else {
      drawFighterFigure(ctx, this.def, {
        flash: this.flash,
        attacking: this.state === 'attack' && this.stateTimer <= 11,
        reach: this.def.attack.range - 15
      });
    }
    ctx.restore();

    // ondas del grito
    if (this.shoutFx > 0) {
      const t = SHOUT_FX_FRAMES - this.shoutFx; // 0 → crece con el tiempo
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.shoutFx / SHOUT_FX_FRAMES})`;
      ctx.lineWidth = 3;
      const baseAngle = this.facing === 1 ? 0 : Math.PI;
      for (let i = 0; i < 3; i++) {
        const radius = Math.max(0, 16 + t * 5 + i * 14);
        ctx.beginPath();
        ctx.arc(this.x + this.facing * 28, this.y - 118, radius,
          baseAngle - 0.65, baseAngle + 0.65);
        ctx.stroke();
      }
    }

    // destello del parry: anillo dorado expandiéndose
    if (this.parryFx > 0) {
      const t = 30 - this.parryFx;
      ctx.strokeStyle = `rgba(253, 224, 71, ${this.parryFx / 30})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 75, 34 + t * 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // estrellitas dando vueltas: aturdido tras un parry
    if (this.state === 'stunned') {
      const t = performance.now() / 150;
      ctx.fillStyle = '#fde047';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const a = t + i * (Math.PI * 2 / 3);
        ctx.fillText('✦', this.x + Math.cos(a) * 26, this.y - 148 + Math.sin(a) * 8);
      }
    }

    // marioneta sobre la cabeza: controles invertidos por los hilos
    if (this.reversedTimer > 0 && this.state !== 'ko') {
      const cy = this.y - 168 + Math.sin(this.reversedTimer * 0.15) * 3;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x - 16, cy);
      ctx.lineTo(this.x + 16, cy);
      ctx.stroke();
      ctx.beginPath();
      for (const off of [-12, 0, 12]) {
        ctx.moveTo(this.x + off, cy);
        ctx.lineTo(this.x + off * 0.5, cy + 26);
      }
      ctx.stroke();
    }
  }
}

// Proyectiles de los especiales 'projectile' y 'strings'.
class Projectile {
  constructor(owner) {
    const sp = owner.def.special;
    this.kind = sp.type;
    this.owner = owner;
    this.x = owner.x + owner.facing * 45;
    this.y = owner.y - 86;
    this.vx = owner.facing * sp.speed;
    this.damage = sp.damage;
    this.reverseFrames = sp.reverseFrames || 0;
    this.color = owner.def.color;
    this.alive = true;
    this.age = 0;
  }

  update(game) {
    this.x += this.vx;
    this.age++;
    if (this.x < -30 || this.x > 1054) this.alive = false;
    for (const f of game.fighters) {
      if (f === this.owner || f.state === 'ko') continue;
      if (f.state === 'dash') continue; // el dash atraviesa proyectiles
      if (rectsOverlap(this.hitbox, f.hurtbox)) {
        this.alive = false;
        const result = f.takeHit(this.damage, Math.sign(this.vx), game);
        // los hilos toman el control... salvo que se bloqueen o parreen
        if (this.reverseFrames && result === 'hit') f.reversedTimer = this.reverseFrames;
      }
    }
  }

  get hitbox() { return { x: this.x - 14, y: this.y - 14, w: 28, h: 28 }; }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.kind === 'strings') {
      // cruceta de marioneta con hilos colgando
      const sway = Math.sin(this.age * 0.3) * 5;
      ctx.rotate(Math.sin(this.age * 0.12) * 0.3);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-15, -3, 30, 6);
      ctx.fillRect(-3, -15, 6, 30);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const off of [-11, 0, 11]) {
        ctx.moveTo(off, 3);
        ctx.quadraticCurveTo(off + sway, 14, off - sway, 26);
      }
      ctx.stroke();
    } else {
      ctx.rotate(this.age * 0.25);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(-12, -12, 24, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffffaa';
      ctx.beginPath();
      ctx.roundRect(-6, -6, 12, 12, 3);
      ctx.fill();
    }
    ctx.restore();
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
