// ============================================================
//  FIGHTER — la clase de los luchadores, y los proyectiles.
//  La física y los estados viven aquí; los números de cada
//  personaje (daño, velocidad, etc.) vienen de characters.js.
// ============================================================

const GRAVITY = 0.8;
const FLOOR_Y = 490;
const STAGE_LEFT = 50;
const STAGE_RIGHT = 974;

// Dash universal: TODOS los personajes lo tienen, con los mismos
// números (es movilidad, no una estadística). Atraviesa rivales
// y proyectiles, y tiene su propio cooldown (barra cian del HUD).
const DASH_SPEED = 14;
const DASH_FRAMES = 12;
const DASH_COOLDOWN = 110;

const MAX_JUMPS = 2; // doble salto

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

    if (this.state === 'ko') {
      this.applyPhysics();
      this.vx *= 0.92;
      return;
    }

    if (this.state === 'hit' || this.state === 'recover') {
      if (--this.stateTimer <= 0) this.state = 'idle';
    } else if (this.state === 'attack') {
      // frames activos del golpe: una ventana a mitad de la animación
      if (this.stateTimer <= 10 && this.stateTimer >= 5 && !this.hitRegistered) {
        if (rectsOverlap(this.attackHitbox, opponent.hurtbox)) {
          this.hitRegistered = true;
          opponent.takeHit(this.def.attack.damage, this.facing, game);
        }
      }
      if (--this.stateTimer <= 0) this.state = 'idle';
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

    this.vx = 0;
    if (this.input.down(leftKey)) this.vx = -speed;
    if (this.input.down(rightKey)) this.vx = speed;

    // mirar hacia donde te mueves (si estás quieto, conservas la dirección)
    if (this.vx > 0) this.facing = 1;
    else if (this.vx < 0) this.facing = -1;

    if (this.onGround) this.jumpsUsed = 0;

    const jumpPressed = this.input.pressed(c.jump) ||
      (c.jumpAlt && this.input.pressed(c.jumpAlt));
    if (jumpPressed && this.jumpsUsed < MAX_JUMPS) {
      this.vy = -this.def.jumpPower;
      this.jumpsUsed++;
      this.crouching = false;
      playSfx('jump', this.def.voice);
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

    if (this.input.pressed(c.attack) && this.attackCooldown <= 0) {
      this.state = 'attack';
      this.stateTimer = 14;
      this.hitRegistered = false;
      this.attackCooldown = this.def.attack.cooldownFrames;
      playSfx('attack', this.def.voice);
    }

    if (this.input.pressed(c.special) && this.specialCooldown <= 0) {
      this.specialCooldown = this.def.special.cooldownFrames;
      playSfx('special', this.def.voice);
      const type = this.def.special.type;
      if (type === 'projectile' || type === 'strings') {
        this.state = 'recover';
        this.stateTimer = 14;
        game.projectiles.push(new Projectile(this));
      } else if (type === 'shout') {
        // onda expansiva frontal: daño + empujón enorme
        this.state = 'recover';
        this.stateTimer = 18;
        this.shoutFx = 22;
        const range = this.def.special.range;
        const box = {
          x: this.facing === 1 ? this.x : this.x - range,
          y: this.y - this.h - 10,
          w: range,
          h: this.h + 20
        };
        // el dash también esquiva el grito (cuenta como ataque a distancia)
        if (opponent.state !== 'dash' && rectsOverlap(box, opponent.hurtbox)) {
          opponent.takeHit(this.def.special.damage, this.facing, game);
          opponent.vx = this.facing * 13;
          opponent.vy = -7;
        }
      }
    }
  }

  applyPhysics() {
    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > FLOOR_Y) {
      this.y = FLOOR_Y;
      this.vy = 0;
    }
    this.x = Math.max(STAGE_LEFT, Math.min(STAGE_RIGHT, this.x));
  }

  takeHit(damage, dir, game) {
    if (this.state === 'ko') return;
    this.health = Math.max(0, this.health - damage);
    this.flash = 8;
    this.vx = dir * 7;
    if (this.onGround) this.vy = -5;
    if (this.health <= 0) {
      this.state = 'ko';
      this.vy = -8;
      this.vx = dir * 4;
      playSfx('ko', this.def.voice);
      game.onKO(this);
    } else {
      this.state = 'hit';
      this.stateTimer = 16;
      playSfx('hit', this.def.voice);
    }
  }

  draw(ctx) {
    // sombra en el piso
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, FLOOR_Y + 6, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // estela del dash
    if (this.state === 'dash') {
      ctx.fillStyle = this.def.color + '55';
      for (let i = 1; i <= 3; i++) {
        ctx.fillRect(this.x - this.dashDir * i * 18 - 20, this.y - 110, 40, 100);
      }
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.state === 'ko') {
      // tirado en el piso
      ctx.rotate(this.facing * -Math.PI / 2);
      ctx.translate(0, 28);
    }
    if (this.facing === -1) ctx.scale(-1, 1);
    if (this.crouching) ctx.scale(1, 0.55);
    if (this.state === 'dash') ctx.globalAlpha = 0.6; // intangible

    const sprite = Sprites.get(this.def, spritePoseFor(this));
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
      const t = 22 - this.shoutFx;
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.shoutFx / 22})`;
      ctx.lineWidth = 3;
      const baseAngle = this.facing === 1 ? 0 : Math.PI;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(this.x + this.facing * 28, this.y - 118, 16 + t * 5 + i * 14,
          baseAngle - 0.65, baseAngle + 0.65);
        ctx.stroke();
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
        f.takeHit(this.damage, Math.sign(this.vx), game);
        // los hilos toman el control: izquierda y derecha invertidas
        if (this.reverseFrames && f.state !== 'ko') f.reversedTimer = this.reverseFrames;
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
