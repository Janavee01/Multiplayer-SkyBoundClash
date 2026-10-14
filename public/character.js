const ATTACK_ACTIVE_MS = 500;
const ATTACK_READY_MS = 800;
const KICK_ACTIVE_MS = 500;
const KICK_READY_MS = 800;
const BLOCK_MS = 300;
const DODGE_MS = 400;
const BLINK_MS = 600;
const BLINK_STEP_MS = 100;

export default class Character {
    constructor(id, x, y, color, gravity = 0.7, groundLevel = 400) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 150;
        this.color = color;
        this.health = 100;
        this.gravity = gravity;
        this.groundLevel = groundLevel;
        this.velocity = { x: 0, y: 0 };
        this.isAttacking = false;
        this.isBlocking = false;
        this.isDodging = false;
        this.isKicking = false;
        this.invisible = false;
        this.isBlinking = false;
        this.facing = 'right';
        this.onGround = false;
        this.targetX = x;
        this.targetY = y;
        this.attackUntil = 0;
        this.attackReadyAt = 0;
        this.kickUntil = 0;
        this.kickReadyAt = 0;
        this.blockUntil = 0;
        this.dodgeUntil = 0;
        this.blinkStart = -Infinity;
        this.blinkUntil = 0;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    draw(c) {
        if (this.invisible) return;
    
        c.fillStyle = this.color;
        c.fillRect(this.x, this.y, this.width, this.height);
    
        if (this.isAttacking) {
            const effect = this.getAttackHitbox();
            c.fillStyle = this.color;
            c.fillRect(effect.x, effect.y, effect.width, effect.height);
        }
    
        if (this.isKicking) {
            const effect = this.getKickHitbox();
            c.fillStyle = this.color;
            c.fillRect(effect.x, effect.y, effect.width, effect.height);
        }

        if (this.isBlocking) {
            c.fillStyle = 'rgba(0, 0, 255, 0.4)';
            c.fillRect(this.x, this.y, this.width, this.height);
        }
        if (this.isDodging) {
            c.fillStyle = 'rgba(128, 0, 128, 0.4)';
            c.fillRect(this.x, this.y, this.width, this.height);
        }

        c.fillStyle = 'black';
        const indicatorX = this.facing === 'right'
            ? this.x + this.width - 10
            : this.x + 10;
        c.fillRect(indicatorX, this.y + 10, 5, 5);
    }    

    attack(now = Date.now()) {
        if (now < this.attackReadyAt || now < this.kickUntil) return null;
        this.attackUntil = now + ATTACK_ACTIVE_MS;
        this.attackReadyAt = now + ATTACK_READY_MS;
        this.isAttacking = true;
        return this.getAttackHitbox();
    }

    getAttackHitbox() {
        const attackRange = 50;
        return {
            x: this.facing === 'right' ? this.x + this.width : this.x - attackRange,
            y: this.y + 20,
            width: attackRange,
            height: 30
        };
    }

    kick(now = Date.now()) {
        if (now < this.kickReadyAt || now < this.attackUntil) return null;
        this.kickUntil = now + KICK_ACTIVE_MS;
        this.kickReadyAt = now + KICK_READY_MS;
        this.isKicking = true;
        return this.getKickHitbox();
    }

    getKickHitbox() {
        const range = 60;
        return {
            x: this.facing === 'right' ? this.x + this.width : this.x - range,
            y: this.y + this.height - 50,
            width: range,
            height: 40
        };
    }

    blink(now = Date.now()) {
        if (now < this.blinkUntil) return;
        this.blinkStart = now;
        this.blinkUntil = now + BLINK_MS;
        this.isBlinking = true;
    }

    updateBlink(now = Date.now()) {
        const active = now < this.blinkUntil;
        this.isBlinking = active;
        this.invisible = active &&
            Math.floor((now - this.blinkStart) / BLINK_STEP_MS) % 2 === 1;
    }

    update(now = Date.now()) {
        this.isAttacking = now < this.attackUntil;
        this.isKicking = now < this.kickUntil;
        this.isBlocking = now < this.blockUntil;
        this.isDodging = now < this.dodgeUntil;
        this.updateBlink(now);
    }

    block(now = Date.now()) {
        if (now < this.blockUntil || now < this.dodgeUntil) return;
        this.blockUntil = now + BLOCK_MS;
        this.isBlocking = true;
    }

    dodge(now = Date.now()) {
        if (now < this.dodgeUntil || now < this.blockUntil) return;
        this.dodgeUntil = now + DODGE_MS;
        this.isDodging = true;
    }

    takeDamage(amount) {
        if (this.isBlocking) {
            this.health = Math.max(0, this.health - (amount * 0.3));
        } else if (!this.isDodging) {
            this.health = Math.max(0, this.health - amount);
        }
        return this.health > 0; 
    }

    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            color: this.color,
            health: this.health,
            isAttacking: this.isAttacking,
            isBlocking: this.isBlocking,
            isDodging: this.isDodging,
            isKicking: this.isKicking,
            velocityX: this.velocity.x,
            velocityY: this.velocity.y,
            facing: this.facing
        };
    }
}
