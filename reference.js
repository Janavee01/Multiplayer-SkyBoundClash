class Character {
    constructor({ position, velocity, color, offset, healthBar }) {
        this.position = position;
        this.velocity = velocity;
        this.height = 150;
        this.width = 50;
        this.color = color;
        this.isAttacking = false;
        this.isKicking = false;
        this.isBlocking = false;
        this.isDodging = false;
        this.health = 100;
        this.healthBar = document.querySelector(healthBar);
        
        this.isBlinking = false;
        this.invisible = false;

        this.attackBox = {
            position: { x: this.position.x, y: this.position.y },
            offset,
            width: 40,
            height: 20
        };

        this.kickBox = {
            position: { x: this.position.x, y: this.position.y },
            offset,
            width: 60,
            height: 30
        };
    }

    draw() {
        if (this.invisible) return;
        
        c.fillStyle = this.color;
        c.fillRect(this.position.x, this.position.y, this.width, this.height);

        if (this.isAttacking) {
            c.fillStyle = 'red';
            c.fillRect(
                this.attackBox.position.x,
                this.attackBox.position.y,
                this.attackBox.width,
                this.attackBox.height
            );
        }

        if (this.isKicking) {
            c.fillStyle = 'orange';
            c.fillRect(
                this.kickBox.position.x,
                this.kickBox.position.y,
                this.kickBox.width,
                this.kickBox.height
            );
        }

        if (this.isBlocking) {
            c.fillStyle = 'yellow';
            c.fillRect(this.position.x, this.position.y, this.width, this.height);
        }

        if (this.isDodging) {
            c.fillStyle = 'gray';
            c.fillRect(this.position.x, this.position.y, this.width, this.height);
        }
    }

    update() {
        this.draw();

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        this.attackBox.position.y = this.position.y + 50;

        this.kickBox.position.x = this.position.x + this.kickBox.offset.x;
        this.kickBox.position.y = this.position.y + 80;

        if (this.position.y + this.height + this.velocity.y >= canvas.height) {
            this.velocity.y = 0;
        } else {
            this.velocity.y += gravity;
        }
    }

    attack() {
        this.isAttacking = true;
        setTimeout(() => { this.isAttacking = false; }, 200);
    }

    kick() {
        this.isKicking = true;
        setTimeout(() => { this.isKicking = false; }, 200);
    }

    block() {
        this.isBlocking = true;
        setTimeout(() => { this.isBlocking = false; }, 500);
    }

    dodge() {
        this.isDodging = true;
        setTimeout(() => { this.isDodging = false; }, 300);
    }

    takeHit(damage) {
        
    
        if (this.isBlocking) {
            damage /= 2;
        }
    
        this.health -= damage;
        this.healthBar.style.width = `${this.health}%`;
    
        this.showDamageEffect("DAMAGE+");
    
        if (this.health <= 0) {
            endGame();
        }
    }
    
    showDamageEffect(text) {
        const effect = document.createElement("div");
        effect.innerText = text;
    
        effect.style.position = "absolute";
        effect.style.left = `${this.position.x + canvas.getBoundingClientRect().left + this.width / 2}px`;
        effect.style.top = `${this.position.y + canvas.getBoundingClientRect().top - 40}px`;        
        effect.style.transform = "translateX(-50%)";
        effect.style.pointerEvents = "none";
    
        effect.style.color = "red"; 
        effect.style.fontSize = "24px";
        effect.style.fontWeight = "bold";
        effect.style.fontFamily = "'Poppins', 'Arial', sans-serif";
    
        effect.style.textShadow = "2px 2px 4px rgba(0, 0, 0, 0.5)";
        effect.style.opacity = "1";
        effect.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    
        document.body.appendChild(effect);
    
        setTimeout(() => {
            effect.style.opacity = "0";
            effect.style.transform = "translateX(-50%) translateY(-15px)";
            setTimeout(() => effect.remove(), 600);
        }, 400);
    }
   
    blink() {
        if (this.isBlinking) return;
        
        this.isBlinking = true;
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            this.invisible = !this.invisible; 
            blinkCount++;
            if (blinkCount >= 6) { 
                clearInterval(blinkInterval);
                this.isBlinking = false;
                this.invisible = false; 
            }
        }, 100);
    }
}

export function isColliding({ attacker, target, type }) {
    const hitBox = type === 'kick' ? attacker.kickBox : attacker.attackBox;

    return (
        hitBox.position.x + hitBox.width >= target.position.x &&
        hitBox.position.x <= target.position.x + target.width &&
        hitBox.position.y + hitBox.height >= target.position.y &&
        hitBox.position.y <= target.position.y + target.height
    );
}

export function endGame() {
    document.getElementById("winner-text").innerText = player.health > 0 ? "Player Wins!" : "Enemy Wins!";
    document.getElementById("winner-text").style.display = "block";
}

const player = new Character({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 10 },
    color: 'darkgreen',
    offset: { x: 50 },
    healthBar: '.player-health'
});

const enemy = new Character({
    position: { x: 900, y: 100 },
    velocity: { x: 0, y: 0 },
    color: 'red',
    offset: { x: -40 },
    healthBar: '.enemy-health'
});

let rockSpawnStart = null;

export class Rock {
    constructor() {
        const baseRadius = 15;
        let elapsedSeconds = rockSpawnStart ? (Date.now() - rockSpawnStart) / 1000 : 0;
        const growthRate = 1;
        this.radius = baseRadius + elapsedSeconds * growthRate;
        this.position = {
            x: Math.random() * (canvas.width - this.radius * 2) + this.radius,
            y: -this.radius
        };
        this.velocity = { x: 0, y: 0 };
        this.color = 'brown';
        this.offScreen = false;
    }

    draw() {
        c.beginPath();
        c.fillStyle = this.color;
        c.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        c.fill();
        c.closePath();
    }

    update() {
        this.draw();
        this.velocity.y += gravity * 0.5;
        this.position.y += this.velocity.y;
        if (this.position.y - this.radius > canvas.height) {
            this.offScreen = true;
        }
    }
}

const rocks = [];
let rockSpawnInterval;
let fireSpawnInterval;

export function startRockSpawning() {
    rockSpawnStart = Date.now();
    rocks.push(new Rock());

    rockSpawnInterval = setInterval(() => {
        rocks.push(new Rock());
    }, 2000);

    setTimeout(() => {
        clearInterval(rockSpawnInterval);
        startFireHazard();
    }, 10000);
}

export function startFireHazard() {
    fireSpawnInterval = setInterval(() => {
        fires.push(new FireWall());
    }, 3000);
}
export class FireWall {
    constructor() {
        this.width = 110; 
        this.height = 230; 
        this.x = Math.random() * (canvas.width - this.width);
        this.y = canvas.height - this.height;
        this.lifetime = 4000;
        this.spawnTime = Date.now();
        this.flickerFrame = 0;
    }

    draw(ctx) {
        this.flickerFrame++;
        let flickerIntensity = Math.random() * 30;
        let gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, `rgb(255, ${100 + flickerIntensity}, 0)`);
        gradient.addColorStop(0.3, `rgb(255, ${140 + flickerIntensity}, 50)`);        
        gradient.addColorStop(0.6, `rgb(255, 69, 0)`); 
        gradient.addColorStop(1, `rgba(255, 0, 0, 0.8)`);  

        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        ctx.moveTo(this.x, this.y + this.height);
        ctx.quadraticCurveTo(this.x + this.width / 2, this.y - 20, this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }

    isExpired() {
        return Date.now() - this.spawnTime > this.lifetime;
    }

    checkCollision(character) {
        if (
            character.position.x < this.x + this.width &&
            character.position.x + character.width > this.x &&
            character.position.y < this.y + this.height &&
            character.position.y + character.height > this.y
        ) {
            character.takeHit(0.1);
            character.blink();
        }
    }
}

const firewalls = [];
const spawnRate = 2000;

export function spawnFireWalls() {
    let fw1 = new FireWall();
    let fw2 = new FireWall();
    fw2.x = (fw1.x + canvas.width / 2) % canvas.width;

    firewalls.push(fw1, fw2);
}

setInterval(spawnFireWalls, spawnRate);

export function isCollidingRock(rock, character) {
    const rectX = character.position.x;
    const rectY = character.position.y;
    const rectWidth = character.width;
    const rectHeight = character.height;
    const closestX = Math.max(rectX, Math.min(rock.position.x, rectX + rectWidth));
    const closestY = Math.max(rectY, Math.min(rock.position.y, rectY + rectHeight));
    const distanceX = rock.position.x - closestX;
    const distanceY = rock.position.y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (rock.radius * rock.radius);
}

export function updateTimer() {
    if (timeLeft > 0) {
        timerDisplay.innerText = `Time Left: ${timeLeft}s`;
        timeLeft--;
        setTimeout(updateTimer, 1000);
    } else {
        timerDisplay.innerText = "Time's up!";
        shakeCanvas(startRockSpawning);
    }
}

export function shakeCanvas(callback) {
    let initialIntensityX = 20;
    let initialIntensityY = 2;
    let sustainedIntensityX = 5; 
    let sustainedIntensityY = 1;
    let duration = 1000;
    let startTime = Date.now();
    let isSustainedShake = false;

    function shake() {
        let elapsed = Date.now() - startTime;
        
        if (!isSustainedShake && elapsed < duration){
            let offsetX = (Math.random() * initialIntensityX * 2) - initialIntensityX;
            let offsetY = (Math.random() * initialIntensityY * 2) - initialIntensityY;
            canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            requestAnimationFrame(shake);
        } else{
            isSustainedShake = true;
            startSustainedShake();
            if (callback) callback();
        }
    }

    function startSustainedShake() {
        let sustainedShakeInterval = setInterval(() => {
            let offsetX = (Math.random() * sustainedIntensityX * 2) - sustainedIntensityX;
            let offsetY = (Math.random() * sustainedIntensityY * 2) - sustainedIntensityY;
            canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }, 50); 

        setTimeout(() => {
            clearInterval(sustainedShakeInterval);
            canvas.style.transform = "translate(0, 0)";
        }, 10000); 
    }

    shake();
}

// in animate
    // player.update();
    // enemy.update();
    // for (let i = rocks.length - 1; i >= 0; i--) {
    //     let rock = rocks[i];
    //     rock.update();

    //     if (isCollidingRock(rock, player)) {
    //         player.takeHit(20);
    //         rocks.splice(i, 1);
    //         continue;
    //     }
    //     if (isCollidingRock(rock, enemy)) {
    //         enemy.takeHit(20);
    //         rocks.splice(i, 1);
    //         continue;
    //     }
    //     if (rock.offScreen) {
    //         rocks.splice(i, 1);
    //     }
    // }

    // rocks.forEach(rock => rock.draw(c)); 
    // fires.forEach(fire => {
    //     fire.draw(c);
    //     fire.checkCollision(player);
    //     fire.checkCollision(enemy);
    // });
    // fires = fires.filter(fire => !fire.isExpired());
