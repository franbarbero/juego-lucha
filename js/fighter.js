// ============================================================
//  FIGHTER — la clase de los luchadores, y los proyectiles.
//  La física y los estados viven aquí; los números de cada
//  personaje (daño, velocidad, etc.) vienen de characters.js.
// ============================================================

const GRAVITY = 0.8;
const FLOOR_Y = 490;
const STAGE_LEFT = 50;
const STAGE_RIGHT = 974;

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
  }

  get onGround() { return this.y >= FLOOR_Y; }

  get hurtbox() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  // Caja de golpe del ataque básico, delante del personaje.
  get attackHitbox() {
    const r = this.def.attack.range;
    const x = this.facing === 1 ? this.x + 10 : this.x - 10 - r;
    return { x, y: this.y - 100, w: r, h: 36 };
  }

  update(opponent, game) {
    if (this.flash > 0) this.flash--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.specialCooldown > 0) this.specialCooldown--;

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
      this.vx = this.facing * this.def.special.speed;
      if (!this.hitRegistered && rectsOverlap(this.hurtbox, opponent.hurtbox)) {
        this.hitRegistered = true;
        opponent.takeHit(this.def.special.damage, this.facing, game);
      }
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
    this.vx = 0;
    if (this.input.down(c.left)) this.vx = -this.def.speed;
    if (this.input.down(c.right)) this.vx = this.def.speed;

    // mirar siempre al oponente, como en los juegos de lucha clásicos
    if (this.onGround) this.facing = opponent.x >= this.x ? 1 : -1;

    if (this.input.pressed(c.jump) && this.onGround) {
      this.vy = -this.def.jumpPower;
      playSfx('jump', this.def.voice);
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
      this.hitRegistered = false;
      playSfx('special', this.def.voice);
      if (this.def.special.type === 'dash') {
        this.state = 'dash';
        this.stateTimer = this.def.special.durationFrames;
      } else if (this.def.special.type === 'projectile') {
        this.state = 'recover';
        this.stateTimer = 12;
        game.projectiles.push(new Projectile(this));
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

    // estela de la embestida
    if (this.state === 'dash') {
      ctx.fillStyle = this.def.color + '55';
      for (let i = 1; i <= 3; i++) {
        ctx.fillRect(this.x - this.facing * i * 18 - 20, this.y - 110, 40, 100);
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
    drawFighterFigure(ctx, this.def, {
      flash: this.flash,
      attacking: this.state === 'attack' && this.stateTimer <= 11,
      reach: this.def.attack.range - 15
    });
    ctx.restore();
  }
}

// Proyectil de la habilidad 'projectile'.
class Projectile {
  constructor(owner) {
    this.owner = owner;
    this.x = owner.x + owner.facing * 45;
    this.y = owner.y - 85;
    this.vx = owner.facing * owner.def.special.speed;
    this.damage = owner.def.special.damage;
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
      if (rectsOverlap(this.hitbox, f.hurtbox)) {
        this.alive = false;
        f.takeHit(this.damage, Math.sign(this.vx), game);
      }
    }
  }

  get hitbox() { return { x: this.x - 14, y: this.y - 14, w: 28, h: 28 }; }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.age * 0.25);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-12, -12, 24, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffffaa';
    ctx.beginPath();
    ctx.roundRect(-6, -6, 12, 12, 3);
    ctx.fill();
    ctx.restore();
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
