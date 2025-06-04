const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

const DOOR_X = 1540;
const DOOR_Y = 880;
const DOOR_ENTRY_OFFSET = 40;

const KING_WIDTH = 180;
const KING_HEIGHT = 220;

const ENEMY_WIDTH = 300;
const ENEMY_HEIGHT = 320;

const ENEMY_LABEL_OFFSET_Y = 70; // Label above enemy
const ARROW_SPEED = 700; // px/sec
const TYPED_TEXT_Y = 150; // vertical position of typed words
const POWER_TEXT_Y = 200;
const POWER_STREAK = 6;
const MAX_POWER = 4;
const POWER_WORD = 'honda';
const CAR_SPEED = 1.5; // slower for visible run over

const ENEMY_MIN_Y = GAME_HEIGHT * 0.85;
const ENEMY_MAX_Y = GAME_HEIGHT * 0.93;
const ENEMY_DEFAULT_Y = (ENEMY_MIN_Y + ENEMY_MAX_Y) / 2; // middle of the road

let archer, typed = "", typedText = null;

let lives = 3;
let score = 0;
let livesIcons = []; // Array for life icons
let scoreText;
let wave = 0;
let killStreak = 0;
let specialCharges = 0;
let powerText = null;
let powerTween = null;

let enemies = []; // Array of enemy objects
let enemySpawnTimer = 0;
let enemySpawnInterval = 2100; // ms
let lastEnemyId = 0;
let gameOverGroup = null;
let gameOver = false;
window.gameOver = gameOver;


const MIN_SPAWN_DISTANCE = ENEMY_WIDTH * 1.1; // Minimum horizontal distance between enemies

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#222',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container'
    },
    scene: {
        preload: preload,
        create: create,
        update: update,
    }
};

let game = null;
function startGame() {
    if (!game) {
        game = new Phaser.Game(config);
        window.game = game;
    }
}
window.startGame = startGame;

function preload() {
    this.load.image('background', 'assets/background.png');
    this.load.image('archer_idle', 'assets/archer_idle.png');
    this.load.image('archer_attack', 'assets/archer_attack.png');
    this.load.image('arrow', 'assets/arrow.png');
    this.load.image('enemy_1', 'assets/enemy_1.png');
    this.load.image('enemy_2', 'assets/enemy_2.png');
    this.load.image('solicon', 'assets/solicon.png');
    this.load.image('solflare_title', 'assets/solflare_title.png');
    this.load.image('honda', 'assets/honda.png');
    this.load.audio('arrow_shot', 'assets/audio/arrow_shot.wav');
    this.load.audio('enemy_death', 'assets/audio/enemy_death.wav');
}

function pickWord() {
    let words = [];
    if (wave < 8) {
        words = words.concat(window.WORD_BANK.easy);
    } else if (wave < 16) {
        words = words.concat(window.WORD_BANK.easy, window.WORD_BANK.medium);
    } else if (wave < 24) {
        words = words.concat(window.WORD_BANK.easy, window.WORD_BANK.medium, window.WORD_BANK.hard);
    } else {
        words = words.concat(
            window.WORD_BANK.easy,
            window.WORD_BANK.medium,
            window.WORD_BANK.hard,
            window.WORD_BANK.insane
        );
    }
    return words[Math.floor(Math.random() * words.length)];
}

function canSpawnNewEnemy() {
    const living = enemies.filter(e => e.alive);
    if (living.length === 0) return true;
    let rightmost = Math.max(...living.map(e => e.sprite.x));
    return rightmost > MIN_SPAWN_DISTANCE;
}

function spawnEnemy(scene) {
    let enemyStartX = -ENEMY_WIDTH / 10;
    let spawnY = ENEMY_MIN_Y + Math.random() * (ENEMY_MAX_Y - ENEMY_MIN_Y);
    let enemySprite = scene.add.sprite(enemyStartX, spawnY, 'enemy_1');
    enemySprite.play('enemy_walk');
    enemySprite.setDisplaySize(ENEMY_WIDTH, ENEMY_HEIGHT);
    enemySprite.setOrigin(0.5, 1);

    let word = pickWord();
    let text = scene.add.text(0, 0, word, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#fff200',
        stroke: '#333',
        strokeThickness: 6
    }).setOrigin(0.5);

    let speed = 2 + (wave * 0.05) + Math.random() * 0.25;

    let enemyObj = {
        id: lastEnemyId++,
        sprite: enemySprite,
        text: text,
        word: word,
        speed: speed,
        vertical: false,
        alive: true,
        arrowFiring: false
    };
    enemies.push(enemyObj);
}

function killEnemyWithArrow(scene, enemyObj) {
    if (enemyObj.arrowFiring || !enemyObj.alive) return;

    enemyObj.arrowFiring = true;
    archer.setTexture('archer_attack');

    let arrowStartX = archer.x - 30;
    let arrowStartY = archer.y - 18;
    let arrowTargetX = enemyObj.sprite.x;
    let arrowTargetY = enemyObj.sprite.y - ENEMY_HEIGHT / 2;

    let dx = arrowTargetX - arrowStartX;
    let dy = arrowTargetY - arrowStartY;
    let angleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));

    let arrow = scene.add.sprite(arrowStartX, arrowStartY, 'arrow');
    arrow.setOrigin(0.3, 0.5);
    arrow.scaleX = -1;
    arrow.displayWidth = 250;
    arrow.displayHeight = 150;
    arrow.angle = angleDeg;
    scene.sound.play('arrow_shot', { volume: 0.4 });

    let duration = Math.max(300, Phaser.Math.Distance.Between(arrowStartX, arrowStartY, arrowTargetX, arrowTargetY) / (ARROW_SPEED * 4) * 1000);

    scene.tweens.add({
        targets: arrow,
        x: arrowTargetX,
        y: arrowTargetY,
        duration: duration,
        onComplete: () => {
            enemyObj.sprite.destroy();
            enemyObj.text.destroy();
            arrow.destroy();
            scene.sound.play('enemy_death', { volume: 0.6 });
            
            enemyObj.alive = false;
            enemies = enemies.filter(e => e.alive || e.id !== enemyObj.id);
            
            score += 1;
            wave += 1;
            killStreak += 1;
            if (killStreak % POWER_STREAK === 0 && specialCharges < MAX_POWER) {
                specialCharges += 1;
                updatePowerText(scene);
            }
            if (scoreText) scoreText.setText("Score: " + score);
            
            archer.setTexture('archer_idle');
        }
    });
}

function create() {
    const scene = this;
    window.currentScene = scene;
    let bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'background');
    bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setOrigin(0.5, 0.5);

    this.anims.create({
        key: 'enemy_walk',
        frames: [
            { key: 'enemy_1' },
            { key: 'enemy_2' }
        ],
        frameRate: 4,
        repeat: -1
    });

    archer = this.add.image(GAME_WIDTH - 660, 310, 'archer_idle');
    archer.setDisplaySize(KING_WIDTH, KING_HEIGHT);
    archer.setOrigin(0.5, 0.9);

    // Add Solflare title image instead of text
    this.add.image(GAME_WIDTH / 2, 80, 'solflare_title')
    .setOrigin(0.5)
    .setScale(0.3); // 1.25x bigger than default, change this value as you wish


    typedText = this.add.text(
        GAME_WIDTH / 2, TYPED_TEXT_Y, "", {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#fffbe8',
            backgroundColor: 'rgba(28,28,28,0.78)',
            fontStyle: 'bold',
            shadow: {
                offsetX: 0, offsetY: 3, color: '#000',
                blur: 8, stroke: false, fill: true
            },
            align: 'center',
            padding: { x: 32, y: 10 }
        }
    ).setOrigin(0.5);

    // Create life icons
    for (let i = 0; i < 3; i++) {
        let icon = this.add.image(GAME_WIDTH - 120 + (i * 40), 40, 'solicon');
        icon.setDisplaySize(30, 30);
        livesIcons.push(icon);
    }

    scoreText = this.add.text(120, 40, "Score: " + score, {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#fff'
    }).setOrigin(0.5);

    powerText = this.add.text(GAME_WIDTH / 2, POWER_TEXT_Y, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ff0000',
        stroke: '#000',
        strokeThickness: 6
    }).setOrigin(0.5);


    // Debug lines
// let graphics = this.add.graphics();
// graphics.lineStyle(3, 0xff0000, 1);
// graphics.lineBetween(DOOR_X, 0, DOOR_X, GAME_HEIGHT);
// graphics.lineStyle(3, 0x00ff00, 1);
// graphics.lineBetween(0, DOOR_Y, GAME_WIDTH, DOOR_Y);


    // Start with two enemies spaced out
    spawnEnemy(this);
    setTimeout(() => spawnEnemy(this), 900);

    enemySpawnTimer = 0;
    enemySpawnInterval = 2100;
    updatePowerText(this);

    window.handleTyping = (text) => {
        for (const ch of text) {
            handleKeyInput(scene, ch);
        }
    };

    this.input.keyboard.on('keydown', (event) => {
        handleKeyInput(scene, event.key);
    });

    this.input.keyboard.on('keydown-SPACE', () => {
        if (gameOver) {
            resetGame(scene);
            if (window.hideRestartButton) window.hideRestartButton();
            if (window.hiddenInput) window.hiddenInput.focus();
        }
    });

	
}

function update(time, delta) {
    if (lives === 0 && !gameOver) {
        showGameOverScreen(this);
        gameOver = true;
        window.gameOver = gameOver;
        return;
    }
    if (gameOver) return;

    // Clean up dead enemies first
    enemies = enemies.filter(enemy => {
        if (!enemy.alive) {
            if (enemy.sprite) enemy.sprite.destroy();
            if (enemy.text) enemy.text.destroy();
            return false;
        }
        return true;
    });

    // Sync labels
    for (const enemyObj of enemies) {
        if (enemyObj.alive) {
            enemyObj.text.x = enemyObj.sprite.x;
            enemyObj.text.y = enemyObj.sprite.y - ENEMY_HEIGHT + ENEMY_LABEL_OFFSET_Y;
        }
    }

    // Move and update all enemies
    for (const enemyObj of enemies) {
        if (!enemyObj.alive) continue;
        if (enemyObj.sprite.x < DOOR_X) {
            enemyObj.sprite.x += enemyObj.speed;
            if (enemyObj.sprite.x >= DOOR_X) {
                enemyReachedDoor(this, enemyObj);
            }
        }
    }

    // Spawn new enemies
    enemySpawnTimer += delta;
    if (enemySpawnTimer > enemySpawnInterval && lives > 0) {
        if (canSpawnNewEnemy()) {
            spawnEnemy(this);
            enemySpawnTimer = 0;
            enemySpawnInterval = Math.max(800, 2200 - wave * 40);
        }
    }
}

function showGameOverScreen(scene) {
    gameOverGroup = scene.add.group();
    window.gameOver = true;
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 600, 340, 0x181825, 0.97);
    const text1 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, "GAME OVER", {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#fffbe8'
    }).setOrigin(0.5);

    const text2 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Scammers defeated: ${score}`, {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ffa600'
    }).setOrigin(0.5);

    const text3 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 'Press SPACE or tap restart', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ff9600'
    }).setOrigin(0.5);

    const restartBtn = document.getElementById('restartButton');
    if (restartBtn) restartBtn.style.display = 'block';
    if (window.showRestartButton) window.showRestartButton();

    gameOverGroup.addMultiple([overlay, text1, text2, text3]);
}
function resetGame(scene) {
    // Clean up
    if (gameOverGroup) {
        gameOverGroup.clear(true, true);
        gameOverGroup = null;
    }
    // Destroy all enemies and arrows
    enemies.forEach(e => {
        if (e.sprite) e.sprite.destroy();
        if (e.text) e.text.destroy();
    });
    enemies = [];
    // Reset lives, score, wave, icons
    lives = 3;
    score = 0;
    wave = 0;
    killStreak = 0;
    specialCharges = 0;
    if (powerText) powerText.setText('');
    if (powerTween) { powerTween.remove(); powerTween = null; }
    for (let i = 0; i < livesIcons.length; i++) {
        livesIcons[i].setVisible(true);
    }
    if (scoreText) scoreText.setText("Score: " + score);
    if (typedText) typedText.setText("");
    typed = "";
    // Restart enemy spawn
    enemySpawnTimer = 0;
    enemySpawnInterval = 2100;
    spawnEnemy(scene);
    setTimeout(() => spawnEnemy(scene), 900);
    // Reset game over flag
    gameOver = false;
    window.gameOver = gameOver;
    const restartBtn = document.getElementById('restartButton');
    if (restartBtn) restartBtn.style.display = 'none';
    if (window.hideRestartButton) window.hideRestartButton();
    if (window.hiddenInput) window.hiddenInput.focus();
}

function updatePowerText(scene) {
    if (!powerText) return;
    if (specialCharges > 0) {
        powerText.setText(`type ${POWER_WORD} to unleash the beast! x${specialCharges}`);
        if (powerTween) powerTween.remove();
        powerTween = scene.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 4000,
            repeat: -1,
            onUpdate: (tw) => {
                const h = tw.getValue() / 360;
                const c = Phaser.Display.Color.HSLToColor(h, 1, 0.5);
                powerText.setColor(c.rgba);
            }
        });
    } else {
        powerText.setText('');
        if (powerTween) {
            powerTween.remove();
            powerTween = null;
        }
    }
}

function killEnemyWithCar(scene, enemyObj) {
    if (!enemyObj.alive) return;
    enemyObj.sprite.destroy();
    enemyObj.text.destroy();
    enemyObj.alive = false;
    scene.sound.play('enemy_death', { volume: 0.6 });
    score += 1;
    wave += 1;
    if (scoreText) scoreText.setText("Score: " + score);
    updatePowerText(scene);
}

function activateCarPower(scene) {
    const car = scene.add.sprite(GAME_WIDTH + 100, ENEMY_DEFAULT_Y, 'honda');
    car.setOrigin(0.5, 1);
    car.setScale(0.4);
    car.scaleX = -Math.abs(car.scaleX);
    scene.tweens.add({
        targets: car,
        x: -200,
        duration: (GAME_WIDTH + 300) / CAR_SPEED,
        onUpdate: () => {
            enemies.forEach(e => {
                if (e.alive && car.x <= e.sprite.x) {
                    killEnemyWithCar(scene, e);
                }
            });
        },
        onComplete: () => car.destroy()
    });
}

function enemyReachedDoor(scene, enemyObj) {
    scene.tweens.add({
        targets: enemyObj.sprite,
        y: enemyObj.sprite.y - DOOR_ENTRY_OFFSET,
        alpha: 0,
        duration: 250,
        onComplete: () => {
            enemyObj.alive = false;
            enemyObj.sprite.destroy();
            enemyObj.text.destroy();
        }
    });
    lives -= 1;
    killStreak = 0;
    if (livesIcons[lives]) {
        livesIcons[lives].setVisible(false);
    }
    updatePowerText(scene);
}

window.resetGame = resetGame;

function handleKeyInput(scene, key) {
    if (lives === 0) return;

    if (/^[a-zA-Z]$/.test(key)) {
        typed += key.toLowerCase();
    } else if (key === 'Backspace' || key === '\b') {
        typed = '';
        if (window.hiddenInput) window.hiddenInput.value = '';
    } else {
        return;
    }

    if (typed === POWER_WORD) {
        if (specialCharges > 0) {
            activateCarPower(scene);
            specialCharges -= 1;
            killStreak = 0;
            updatePowerText(scene);
        }
        typed = '';
        if (typedText) typedText.setText('');
        if (window.hiddenInput) window.hiddenInput.value = '';
        return;
    }

    if (typed.length >= POWER_WORD.length) {
        const matchAny = enemies.some(e => e.alive && e.word === typed);
        const pwPrefix = POWER_WORD.startsWith(typed);
        if (!matchAny && !pwPrefix) {
            typed = '';
            if (window.hiddenInput) window.hiddenInput.value = '';
        }
    }

    if (typedText) typedText.setText(typed);

    const matchedEnemy = enemies.find(e => e.alive && !e.arrowFiring && typed === e.word);
    if (matchedEnemy) {
        killEnemyWithArrow(scene, matchedEnemy);
        typed = '';
        if (typedText) typedText.setText('');
        if (window.hiddenInput) window.hiddenInput.value = '';
    }
}

