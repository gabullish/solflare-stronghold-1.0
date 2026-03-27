const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

const DOOR_X = 1540;
const DOOR_ENTRY_OFFSET = 40;

const KING_WIDTH = 180;
const KING_HEIGHT = 220;

const ENEMY_WIDTH = 300;
const ENEMY_HEIGHT = 320;
const ENEMY_LABEL_OFFSET_Y = 70;

const ARROW_SPEED = 700;
const TYPED_TEXT_Y = 140;
const POWER_TEXT_Y = 200;

const POWER_STREAK = 5;
const MAX_POWER = 5;
const POWER_WORD = 'honda';
const CAR_SPEED = 1.85;

const ENEMY_MIN_Y = GAME_HEIGHT * 0.85;
const ENEMY_MAX_Y = GAME_HEIGHT * 0.93;
const ENEMY_DEFAULT_Y = (ENEMY_MIN_Y + ENEMY_MAX_Y) / 2;
const MIN_SPAWN_DISTANCE = ENEMY_WIDTH * 1.08;

const SAVE_KEY = 'solflare_stronghold_v2';

let archer;
let typed = '';
let typedText = null;
let feedbackText = null;

let lives = 5;
let score = 0;
let highScore = 0;
let livesIcons = [];

let scoreText;
let waveText;
let comboText;
let accuracyText;
let highScoreText;
let controlsHintText;

let wave = 1;
let kills = 0;
let killStreak = 0;
let combo = 0;
let bestCombo = 0;
let specialCharges = 0;
let powerText = null;
let powerTween = null;

let enemies = [];
let enemySpawnTimer = 0;
let enemySpawnInterval = 2000;
let lastEnemyId = 0;

let gameOverGroup = null;
let pauseOverlayGroup = null;
let gameOver = false;
let isPaused = false;
let isMuted = false;
window.gameOver = gameOver;

let totalTypedChars = 0;
let totalMistakes = 0;

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
        preload,
        create,
        update,
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

function loadSaveData() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(parsed.highScore)) {
            highScore = parsed.highScore;
        }
    } catch (err) {
        highScore = 0;
    }
}

function persistSaveData() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ highScore }));
    } catch (err) {
        // ignore storage write failures
    }
}

function validateWordBank() {
    const buckets = ['easy', 'medium', 'hard', 'insane'];
    const fallback = {
        easy: ['sol', 'tip', 'key', 'gas', 'fee'],
        medium: ['stake', 'guard', 'wallet', 'chain', 'safety'],
        hard: ['airdrop', 'private', 'confirm', 'monitor', 'defense'],
        insane: ['stronghold', 'validation', 'decentralized']
    };

    if (!window.WORD_BANK) {
        window.WORD_BANK = fallback;
        return;
    }

    for (const bucket of buckets) {
        const list = window.WORD_BANK[bucket];
        if (!Array.isArray(list) || list.length === 0) {
            window.WORD_BANK[bucket] = fallback[bucket];
            continue;
        }

        const cleaned = list
            .filter((word) => typeof word === 'string')
            .map((word) => word.trim().toLowerCase())
            .filter((word) => /^[a-z]+$/.test(word) && word.length >= 3)
            .filter((word, index, arr) => arr.indexOf(word) === index);

        window.WORD_BANK[bucket] = cleaned.length ? cleaned : fallback[bucket];
    }
}

function getDifficultyPool() {
    if (wave < 8) {
        return [...window.WORD_BANK.easy];
    }
    if (wave < 16) {
        return [...window.WORD_BANK.easy, ...window.WORD_BANK.medium];
    }
    if (wave < 28) {
        return [...window.WORD_BANK.medium, ...window.WORD_BANK.hard];
    }
    return [...window.WORD_BANK.medium, ...window.WORD_BANK.hard, ...window.WORD_BANK.insane];
}

function pickWord() {
    const words = getDifficultyPool();
    const activeWords = new Set(enemies.filter((e) => e.alive).map((e) => e.word));
    const uniquePool = words.filter((word) => !activeWords.has(word));
    const pool = uniquePool.length ? uniquePool : words;
    return pool[Math.floor(Math.random() * pool.length)];
}

function getEnemyProfile() {
    const baseSpeed = 1.8 + wave * 0.06;
    const eliteChance = Math.min(0.34, 0.08 + wave * 0.01);
    const elite = Math.random() < eliteChance;

    return {
        speed: elite ? baseSpeed * 1.35 : baseSpeed + Math.random() * 0.4,
        hp: elite ? 2 : 1,
        elite,
        scoreValue: elite ? 3 : 1
    };
}

function canSpawnNewEnemy() {
    const living = enemies.filter((e) => e.alive);
    if (living.length === 0) return true;
    const rightmost = Math.max(...living.map((e) => e.sprite.x));
    return rightmost > MIN_SPAWN_DISTANCE;
}

function spawnEnemy(scene) {
    const enemyStartX = -ENEMY_WIDTH / 10;
    const spawnY = ENEMY_MIN_Y + Math.random() * (ENEMY_MAX_Y - ENEMY_MIN_Y);
    const profile = getEnemyProfile();

    const enemySprite = scene.add.sprite(enemyStartX, spawnY, 'enemy_1');
    enemySprite.play('enemy_walk');
    enemySprite.setDisplaySize(ENEMY_WIDTH, ENEMY_HEIGHT);
    enemySprite.setOrigin(0.5, 1);
    enemySprite.setTint(profile.elite ? 0xffd08a : 0xffffff);

    const word = pickWord();
    const text = scene.add.text(0, 0, word, {
        fontFamily: 'monospace',
        fontSize: profile.elite ? '36px' : '32px',
        color: profile.elite ? '#ffb347' : '#fff200',
        stroke: '#2a1e00',
        strokeThickness: profile.elite ? 7 : 6
    }).setOrigin(0.5);

    const enemyObj = {
        id: lastEnemyId++,
        sprite: enemySprite,
        text,
        word,
        speed: profile.speed,
        hp: profile.hp,
        elite: profile.elite,
        scoreValue: profile.scoreValue,
        alive: true,
        arrowFiring: false,
        focus: false,
    };

    enemies.push(enemyObj);
}

function calculateMultiplier() {
    return 1 + Math.floor(combo / 5);
}

function updateHud() {
    if (scoreText) scoreText.setText(`Score: ${score}`);
    if (waveText) waveText.setText(`Wave: ${wave}`);
    if (comboText) comboText.setText(`Combo x${calculateMultiplier()} (${combo})`);

    const attempts = totalTypedChars + totalMistakes;
    const accuracy = attempts > 0 ? Math.round((totalTypedChars / attempts) * 100) : 100;
    if (accuracyText) accuracyText.setText(`Accuracy: ${accuracy}%`);

    if (highScoreText) {
        highScoreText.setText(`Best: ${highScore}`);
    }
}

function flashFeedback(scene, message, color = '#ffd34a') {
    if (!feedbackText) return;
    feedbackText.setText(message);
    feedbackText.setColor(color);
    scene.tweens.killTweensOf(feedbackText);
    feedbackText.alpha = 1;
    scene.tweens.add({
        targets: feedbackText,
        alpha: 0,
        duration: 700,
        ease: 'Cubic.easeOut'
    });
}

function updateEnemyTextStyles() {
    for (const enemyObj of enemies) {
        if (!enemyObj.alive) continue;
        const isPrefix = typed.length > 0 && enemyObj.word.startsWith(typed);
        const isExact = typed.length > 0 && enemyObj.word === typed;

        enemyObj.text.setStyle({
            color: isExact ? '#7fff8f' : isPrefix ? '#8ff5ff' : enemyObj.elite ? '#ffb347' : '#fff200',
            stroke: isPrefix ? '#003d46' : enemyObj.elite ? '#2a1e00' : '#333'
        });
    }
}

function chooseTargetEnemy() {
    const candidates = enemies
        .filter((e) => e.alive && !e.arrowFiring && e.word.startsWith(typed))
        .sort((a, b) => b.sprite.x - a.sprite.x);

    return candidates[0] || null;
}

function killEnemyWithArrow(scene, enemyObj) {
    if (enemyObj.arrowFiring || !enemyObj.alive) return;

    enemyObj.arrowFiring = true;
    archer.setTexture('archer_attack');

    const arrowStartX = archer.x - 30;
    const arrowStartY = archer.y - 18;
    const arrowTargetX = enemyObj.sprite.x;
    const arrowTargetY = enemyObj.sprite.y - ENEMY_HEIGHT / 2;

    const dx = arrowTargetX - arrowStartX;
    const dy = arrowTargetY - arrowStartY;
    const angleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));

    const arrow = scene.add.sprite(arrowStartX, arrowStartY, 'arrow');
    arrow.setOrigin(0.3, 0.5);
    arrow.scaleX = -1;
    arrow.displayWidth = 250;
    arrow.displayHeight = 150;
    arrow.angle = angleDeg;
    scene.sound.play('arrow_shot', { volume: 0.4 });

    const duration = Math.max(
        280,
        (Phaser.Math.Distance.Between(arrowStartX, arrowStartY, arrowTargetX, arrowTargetY) / (ARROW_SPEED * 4)) * 1000
    );

    scene.tweens.add({
        targets: arrow,
        x: arrowTargetX,
        y: arrowTargetY,
        duration,
        onComplete: () => {
            arrow.destroy();

            enemyObj.hp -= 1;
            enemyObj.arrowFiring = false;

            if (enemyObj.hp > 0) {
                scene.sound.play('enemy_death', { volume: 0.3 });
                enemyObj.sprite.setTint(0xff6666);
                scene.tweens.add({
                    targets: enemyObj.sprite,
                    duration: 140,
                    onComplete: () => {
                        if (enemyObj.sprite) {
                            enemyObj.sprite.setTint(enemyObj.elite ? 0xffd08a : 0xffffff);
                        }
                    }
                });
                archer.setTexture('archer_idle');
                return;
            }

            enemyObj.alive = false;
            enemyObj.sprite.destroy();
            enemyObj.text.destroy();
            scene.sound.play('enemy_death', { volume: 0.6 });

            kills += 1;
            combo += 1;
            killStreak += 1;
            bestCombo = Math.max(bestCombo, combo);

            const gained = enemyObj.scoreValue * calculateMultiplier();
            score += gained;
            wave = 1 + Math.floor(kills / 4);

            if (killStreak % POWER_STREAK === 0 && specialCharges < MAX_POWER) {
                specialCharges += 1;
                flashFeedback(scene, '+1 Honda Charge!', '#8be9fd');
            }

            if (score > highScore) {
                highScore = score;
                persistSaveData();
            }

            updatePowerText(scene);
            updateHud();
            adjustSpawnRate();
            archer.setTexture('archer_idle');
        }
    });
}

function create() {
    const scene = this;
    window.currentScene = scene;

    loadSaveData();
    validateWordBank();

    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'background');
    bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setOrigin(0.5, 0.5);

    this.anims.create({
        key: 'enemy_walk',
        frames: [{ key: 'enemy_1' }, { key: 'enemy_2' }],
        frameRate: 4,
        repeat: -1
    });

    archer = this.add.image(GAME_WIDTH - 660, 310, 'archer_idle');
    archer.setDisplaySize(KING_WIDTH, KING_HEIGHT);
    archer.setOrigin(0.5, 0.9);

    this.add.image(GAME_WIDTH / 2, 80, 'solflare_title').setOrigin(0.5).setScale(0.3);

    typedText = this.add.text(GAME_WIDTH / 2, TYPED_TEXT_Y, '', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: '#fffbe8',
        backgroundColor: 'rgba(28,28,28,0.78)',
        fontStyle: 'bold',
        shadow: {
            offsetX: 0,
            offsetY: 3,
            color: '#000',
            blur: 8,
            stroke: false,
            fill: true
        },
        align: 'center',
        padding: { x: 32, y: 10 }
    }).setOrigin(0.5);

    feedbackText = this.add.text(GAME_WIDTH / 2, TYPED_TEXT_Y + 64, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffd34a',
        stroke: '#151515',
        strokeThickness: 5
    }).setOrigin(0.5);

    for (let i = 0; i < 5; i++) {
        const icon = this.add.image(GAME_WIDTH - 190 + i * 38, 40, 'solicon');
        icon.setDisplaySize(30, 30);
        livesIcons.push(icon);
    }

    scoreText = this.add.text(80, 32, 'Score: 0', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#fff'
    });

    waveText = this.add.text(80, 70, 'Wave: 1', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#9fe8ff'
    });

    comboText = this.add.text(80, 108, 'Combo x1 (0)', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#9bffaf'
    });

    accuracyText = this.add.text(80, 146, 'Accuracy: 100%', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffd68a'
    });

    highScoreText = this.add.text(80, 184, `Best: ${highScore}`, {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ff92a6'
    });

    controlsHintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26, 'SPACE = restart • P = pause • M = mute • type words to defend the gate', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f4f4f4',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 12, y: 5 }
    }).setOrigin(0.5, 1);

    powerText = this.add.text(GAME_WIDTH / 2, POWER_TEXT_Y, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ff0000',
        stroke: '#000',
        strokeThickness: 6
    }).setOrigin(0.5);

    spawnEnemy(this);
    setTimeout(() => spawnEnemy(this), 800);

    enemySpawnTimer = 0;
    enemySpawnInterval = 2000;

    updatePowerText(this);
    updateHud();

    window.handleTyping = (text) => {
        for (const ch of text) {
            handleKeyInput(scene, ch);
        }
    };

    this.input.keyboard.on('keydown', (event) => {
        if (event.key === 'p' || event.key === 'P') {
            togglePause(scene);
            return;
        }

        if (event.key === 'm' || event.key === 'M') {
            toggleMute(scene);
            return;
        }

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

    if (gameOver || isPaused) return;

    enemies = enemies.filter((enemy) => {
        if (!enemy.alive) {
            if (enemy.sprite) enemy.sprite.destroy();
            if (enemy.text) enemy.text.destroy();
            return false;
        }
        return true;
    });

    for (const enemyObj of enemies) {
        if (enemyObj.alive) {
            enemyObj.text.x = enemyObj.sprite.x;
            enemyObj.text.y = enemyObj.sprite.y - ENEMY_HEIGHT + ENEMY_LABEL_OFFSET_Y;
        }
    }

    for (const enemyObj of enemies) {
        if (!enemyObj.alive) continue;

        if (enemyObj.sprite.x < DOOR_X) {
            enemyObj.sprite.x += enemyObj.speed;
            if (enemyObj.sprite.x >= DOOR_X) {
                enemyReachedDoor(this, enemyObj);
            }
        }
    }

    enemySpawnTimer += delta;
    if (enemySpawnTimer > enemySpawnInterval && lives > 0) {
        if (canSpawnNewEnemy()) {
            spawnEnemy(this);
            enemySpawnTimer = 0;
        }
    }
}

function showGameOverScreen(scene) {
    gameOverGroup = scene.add.group();
    window.gameOver = true;

    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 700, 420, 0x181825, 0.97);
    const text1 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#fffbe8'
    }).setOrigin(0.5);

    const text2 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 36, `Scammers defeated: ${kills}`, {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#ffa600'
    }).setOrigin(0.5);

    const text3 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, `Best Combo: ${bestCombo} • Accuracy: ${accuracyText ? accuracyText.text.replace('Accuracy: ', '') : '100%'}`,
        {
            fontFamily: 'monospace',
            fontSize: '30px',
            color: '#7de5ff'
        }).setOrigin(0.5);

    const text4 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 86, `Final Score: ${score} • Best Score: ${highScore}`, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ff94b8'
    }).setOrigin(0.5);

    const text5 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 146, 'Press SPACE or tap restart', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ff9600'
    }).setOrigin(0.5);

    const restartBtn = document.getElementById('restartButton');
    if (restartBtn) restartBtn.style.display = 'block';
    if (window.showRestartButton) window.showRestartButton();

    gameOverGroup.addMultiple([overlay, text1, text2, text3, text4, text5]);
}

function resetGame(scene) {
    if (gameOverGroup) {
        gameOverGroup.clear(true, true);
        gameOverGroup = null;
    }

    if (pauseOverlayGroup) {
        pauseOverlayGroup.clear(true, true);
        pauseOverlayGroup = null;
    }

    enemies.forEach((e) => {
        if (e.sprite) e.sprite.destroy();
        if (e.text) e.text.destroy();
    });

    enemies = [];
    lives = 5;
    score = 0;
    wave = 1;
    kills = 0;
    combo = 0;
    killStreak = 0;
    bestCombo = 0;
    specialCharges = 0;
    totalTypedChars = 0;
    totalMistakes = 0;
    typed = '';
    isPaused = false;

    if (powerText) powerText.setText('');
    if (powerTween) {
        powerTween.remove();
        powerTween = null;
    }

    for (let i = 0; i < livesIcons.length; i++) {
        livesIcons[i].setVisible(true);
    }

    if (typedText) typedText.setText('');
    if (feedbackText) feedbackText.setText('');

    enemySpawnTimer = 0;
    enemySpawnInterval = 2000;
    lastEnemyId = 0;

    spawnEnemy(scene);
    setTimeout(() => spawnEnemy(scene), 800);

    gameOver = false;
    window.gameOver = gameOver;

    const restartBtn = document.getElementById('restartButton');
    if (restartBtn) restartBtn.style.display = 'none';
    if (window.hideRestartButton) window.hideRestartButton();
    if (window.hiddenInput) window.hiddenInput.focus();

    updatePowerText(scene);
    updateHud();
}

function adjustSpawnRate() {
    const attempts = totalTypedChars + totalMistakes;
    const accuracy = attempts > 0 ? totalTypedChars / attempts : 1;

    const base = 2200 - wave * 35;
    const comboBonus = Math.min(360, combo * 15);
    const accuracyPenalty = accuracy < 0.8 ? 320 : accuracy < 0.9 ? 180 : 0;

    enemySpawnInterval = Phaser.Math.Clamp(base - comboBonus + accuracyPenalty, 760, 2400);
}

function updatePowerText(scene) {
    if (!powerText) return;

    if (specialCharges > 0) {
        powerText.setText(`type ${POWER_WORD} to unleash the beast! x${specialCharges}`);
        if (powerTween) powerTween.remove();

        powerTween = scene.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 3500,
            repeat: -1,
            onUpdate: (tw) => {
                const h = tw.getValue() / 360;
                const c = Phaser.Display.Color.HSLToColor(h, 1, 0.5);
                powerText.setColor(c.rgba);
            }
        });
        return;
    }

    powerText.setText('');
    if (powerTween) {
        powerTween.remove();
        powerTween = null;
    }
}

function killEnemyWithCar(scene, enemyObj) {
    if (!enemyObj.alive) return;

    enemyObj.sprite.destroy();
    enemyObj.text.destroy();
    enemyObj.alive = false;

    scene.sound.play('enemy_death', { volume: 0.6 });

    kills += 1;
    combo += 1;
    const gained = enemyObj.scoreValue * calculateMultiplier();
    score += gained;
    wave = 1 + Math.floor(kills / 4);

    if (score > highScore) {
        highScore = score;
        persistSaveData();
    }

    updateHud();
    adjustSpawnRate();
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
            enemies.forEach((e) => {
                if (e.alive && car.x <= e.sprite.x) {
                    killEnemyWithCar(scene, e);
                }
            });
        },
        onComplete: () => car.destroy()
    });

    flashFeedback(scene, 'ROAD RAGE ACTIVATED!', '#ff9f4a');
}

function enemyReachedDoor(scene, enemyObj) {
    scene.tweens.add({
        targets: enemyObj.sprite,
        y: enemyObj.sprite.y - DOOR_ENTRY_OFFSET,
        alpha: 0,
        duration: 230,
        onComplete: () => {
            enemyObj.alive = false;
            enemyObj.sprite.destroy();
            enemyObj.text.destroy();
        }
    });

    lives -= 1;
    combo = 0;
    killStreak = 0;

    if (livesIcons[lives]) {
        livesIcons[lives].setVisible(false);
    }

    flashFeedback(scene, 'Gate Hit! Combo reset.', '#ff7c7c');
    updatePowerText(scene);
    updateHud();
}

function togglePause(scene) {
    if (gameOver) return;

    isPaused = !isPaused;

    if (isPaused) {
        pauseOverlayGroup = scene.add.group();
        const rect = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 600, 220, 0x111111, 0.86);
        const txt = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'PAUSED', {
            fontFamily: 'monospace',
            fontSize: '72px',
            color: '#fff'
        }).setOrigin(0.5);

        const txt2 = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 56, 'Press P to resume', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#9fe8ff'
        }).setOrigin(0.5);

        pauseOverlayGroup.addMultiple([rect, txt, txt2]);
        return;
    }

    if (pauseOverlayGroup) {
        pauseOverlayGroup.clear(true, true);
        pauseOverlayGroup = null;
    }
}

function toggleMute(scene) {
    isMuted = !isMuted;
    scene.sound.mute = isMuted;
    flashFeedback(scene, isMuted ? 'Muted' : 'Sound On', isMuted ? '#ffcf7c' : '#7cffb0');
}

window.togglePauseGame = () => {
    if (window.currentScene) togglePause(window.currentScene);
};

window.toggleMuteGame = () => {
    if (window.currentScene) toggleMute(window.currentScene);
};

window.resetGame = resetGame;

function handleKeyInput(scene, key) {
    if (lives === 0 || gameOver || isPaused) return;

    if (/^[a-zA-Z]$/.test(key)) {
        typed += key.toLowerCase();
        totalTypedChars += 1;
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

    const targetEnemy = chooseTargetEnemy();
    const hasPrefixMatch = Boolean(targetEnemy);
    const pwPrefix = POWER_WORD.startsWith(typed);

    if (!hasPrefixMatch && !pwPrefix && typed.length > 0) {
        totalMistakes += typed.length;
        combo = 0;
        typed = '';
        if (window.hiddenInput) window.hiddenInput.value = '';
        flashFeedback(scene, 'Miss! Combo reset.', '#ff7d7d');
    }

    if (typedText) typedText.setText(typed);

    updateEnemyTextStyles();
    updateHud();

    const matchedEnemy = enemies.find((e) => e.alive && !e.arrowFiring && typed === e.word);
    if (matchedEnemy) {
        killEnemyWithArrow(scene, matchedEnemy);
        typed = '';
        if (typedText) typedText.setText('');
        if (window.hiddenInput) window.hiddenInput.value = '';
        updateEnemyTextStyles();
    }
}
