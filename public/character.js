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
        this.kickCooldown = false;
        this.isKicking = false;
        this.invisible = false;
        this.isBlinking = false;
        this.facing = 'right';
        this.attackCooldown = false;
        this.animationState = 'idle';
        this.onGround = false;
        this.targetX = undefined;
        this.targetY = undefined;
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
    
    update(deltaTime = 16.67) {
  
        this.velocity.y += this.gravity;
        
      
        this.x += this.velocity.x * (deltaTime / 16.67);
        this.y += this.velocity.y * (deltaTime / 16.67);
     
        if (this.y >= this.groundLevel) {
            this.y = this.groundLevel;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }
        

        this.x = Math.max(0, Math.min(1024 - this.width, this.x));
    }

    move(direction){
        const speed = 5;
        const jumpForce = 15;
        
        switch(direction) {
            case 'left':
                this.velocity.x = -speed;
                this.facing = 'left';
                break;
            case 'right':
                this.velocity.x = speed;
                this.facing = 'right';
                break;
            case 'up':
                if (this.onGround) {
                    this.velocity.y = -jumpForce;
                    this.onGround = false;
                }
                break;
            case 'stop':
                this.velocity.x = 0;
                break;
        }
    }

    attack() {
        if (!this.attackCooldown && !this.isAttacking) {
            this.isAttacking = true;
            this.attackCooldown = true;
            
            setTimeout(() => {
                this.isAttacking = false;
                setTimeout(() => {
                    this.attackCooldown = false;
                }, 300);
            }, 500);
            
            return this.getAttackHitbox();
        }
        return null;
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
    
        
    kick() {
        if (!this.kickCooldown) {
            this.isKicking = true;
            this.kickCooldown = true;
    
            setTimeout(() => {
                this.isKicking = false;
                setTimeout(() => {
                    this.kickCooldown = false;
                }, 300);
            }, 500);
    
            return this.getKickHitbox();
        }
        return null;
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
   
    getKickEffect() {
        return {
            x: this.facing === 'right' ? this.x + this.width : this.x - 30,
            y: this.y + this.height / 2 - 20,
            width: 90,
            height: 40,
            color: 'rgba(100, 100, 255, 0.7)',
            duration: 300
        };
    }
       
    blink() {
        if (this.isBlinking) return;
        this.isBlinking = true;
        let count = 0;
        const interval = setInterval(() => {
            this.invisible = !this.invisible;
            count++;
            if (count >= 6) {
                clearInterval(interval);
                this.invisible = false;
                this.isBlinking = false;
            }
        }, 100);
    }    

    getAttackEffect() {
        return {
            x: this.facing === 'right' ? this.x + this.width : this.x - 20,
            y: this.y + this.height/2 - 25,
            width: 80,
            height: 50,
            color: 'rgba(255, 100, 100, 0.7)',
            duration: 300
        };
    }

    block() {
        if (!this.isBlocking && !this.isDodging) {
            this.isBlocking = true;
            this.velocity.x *= 0.5; 
            setTimeout(() => {
                this.isBlocking = false;
            }, 300);
        }
    }

    dodge() {
        if (!this.isDodging && !this.isBlocking) {
            this.isDodging = true;
            this.velocity.x = this.facing === 'right' ? 15 : -15;
            setTimeout(() => {
                this.isDodging = false;
                this.velocity.x = 0;
            }, 400);
        }
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
            velocityX: this.velocity.x,
            velocityY: this.velocity.y,
            facing: this.facing
        };
    }
}
