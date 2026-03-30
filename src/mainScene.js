import {
  ARCHER,
  DOOR_ENTRY_OFFSET,
  DOOR_X,
  ENEMY,
  GAME_HEIGHT,
  GAME_WIDTH,
  LIVES_MAX,
  SCORING,
  STORAGE_KEY,
  TYPING,
} from './constants.js';
import { getSanitizedWordBank, pickEnemyWord } from './wordBank.js';
import {
  canAdvancePowerWord,
  findEnemyCandidates,
  findLockedEnemy,
  isPowerWordComplete,
} from './typing.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('main');
    this.wordBank = getSanitizedWordBank();
    this.highScore = this.loadHighScore();
    this.resetRuntime();
  }

  preload() {
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

  create() {
    this.resetRuntime();

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'background')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5, 0.5);

    this.anims.create({
      key: 'enemy_walk',
      frames: [{ key: 'enemy_1' }, { key: 'enemy_2' }],
      frameRate: 4,
      repeat: -1,
    });

    this.archer = this.add.image(ARCHER.x, ARCHER.y, 'archer_idle')
      .setDisplaySize(ARCHER.width, ARCHER.height)
      .setOrigin(0.5, 0.9);

    this.add.image(GAME_WIDTH / 2, 80, 'solflare_title').setOrigin(0.5).setScale(0.3);

    this.typedText = this.add.text(GAME_WIDTH / 2, TYPING.typedTextY, '', {
      fontFamily: 'monospace',
      fontSize: '44px',
      color: '#fffbe8',
      backgroundColor: 'rgba(28,28,28,0.78)',
      fontStyle: 'bold',
      padding: { x: 32, y: 10 },
    }).setOrigin(0.5);

    this.feedbackText = this.add.text(GAME_WIDTH / 2, TYPING.feedbackTextY, '', {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: '#ffd34a',
      stroke: '#151515',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.powerText = this.add.text(GAME_WIDTH / 2, 244, '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ff8c42',
      stroke: '#111',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.buildHud();

    this.input.keyboard.on('keydown', (event) => {
      this.handleInputKey(event.key);
    });

    this.spawnEnemy();
    this.time.delayedCall(900, () => this.spawnEnemy());

    this.updateHud();
    this.updateEnemyWordStyles();
    this.updatePowerText();

    window.currentScene = this;
    window.handleTyping = (value) => {
      for (const char of value) {
        this.handleInputKey(char);
      }
    };
  }

  update(_, delta) {
    if (this.gameOver) return;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.label.x = enemy.sprite.x;
      enemy.label.y = enemy.sprite.y - ENEMY.height + ENEMY.labelOffsetY;

      if (enemy.sprite.x < DOOR_X) {
        enemy.sprite.x += enemy.speed * (delta / 16.666);
        if (enemy.sprite.x >= DOOR_X) {
          this.onEnemyReachedGate(enemy);
        }
      }
    }

    this.enemies = this.enemies.filter((enemy) => enemy.alive);

    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval && this.lives > 0) {
      if (this.canSpawnEnemy()) {
        this.spawnEnemy();
        this.spawnTimer = 0;
      }
    }

    if (this.lives <= 0 && !this.gameOver) {
      this.showGameOver();
    }
  }

  resetRuntime() {
    this.typed = '';
    this.lockedEnemyId = null;
    this.powerInput = '';

    this.lives = LIVES_MAX;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.killStreak = 0;
    this.specialCharges = 0;

    this.correctChars = 0;
    this.mistakes = 0;

    this.lastEnemyId = 0;
    this.spawnTimer = 0;
    this.spawnInterval = SCORING.baseSpawnInterval;

    this.enemies = [];
    this.gameOver = false;
    this.gameOverGroup = null;
  }

  buildHud() {
    this.lifeIcons = [];
    for (let i = 0; i < LIVES_MAX; i += 1) {
      const icon = this.add.image(GAME_WIDTH - 190 + i * 38, 40, 'solicon');
      icon.setDisplaySize(30, 30);
      this.lifeIcons.push(icon);
    }

    this.scoreText = this.add.text(80, 32, 'Score: 0', { fontFamily: 'monospace', fontSize: '30px', color: '#fff' });
    this.waveText = this.add.text(80, 70, 'Wave: 1', { fontFamily: 'monospace', fontSize: '28px', color: '#9fe8ff' });
    this.comboText = this.add.text(80, 108, 'Combo x1 (0)', { fontFamily: 'monospace', fontSize: '28px', color: '#9bffaf' });
    this.accuracyText = this.add.text(80, 146, 'Accuracy: 100%', { fontFamily: 'monospace', fontSize: '28px', color: '#ffd68a' });
    this.highScoreText = this.add.text(80, 184, `Best: ${this.highScore}`, { fontFamily: 'monospace', fontSize: '28px', color: '#ff92a6' });

    this.hintText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 26,
      'Type words to lock targets, BACKSPACE to edit, SPACE to restart on game over',
      {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f4f4f4',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 12, y: 5 },
      },
    ).setOrigin(0.5, 1);
  }

  calculateMultiplier() {
    return 1 + Math.floor(this.combo / 4);
  }

  getAccuracy() {
    const attempts = this.correctChars + this.mistakes;
    if (attempts === 0) return 100;
    return Math.round((this.correctChars / attempts) * 100);
  }

  updateHud() {
    this.scoreText.setText(`Score: ${this.score}`);
    this.waveText.setText(`Wave: ${this.wave}`);
    this.comboText.setText(`Combo x${this.calculateMultiplier()} (${this.combo})`);
    this.accuracyText.setText(`Accuracy: ${this.getAccuracy()}%`);
    this.highScoreText.setText(`Best: ${this.highScore}`);
  }

  flashFeedback(message, color = '#ffd34a') {
    this.feedbackText.setText(message);
    this.feedbackText.setColor(color);
    this.tweens.killTweensOf(this.feedbackText);
    this.feedbackText.alpha = 1;
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 680,
      ease: 'Cubic.easeOut',
    });
  }

  updatePowerText() {
    if (this.specialCharges > 0) {
      this.powerText.setText(`Power ready: type ${TYPING.powerWord} (${this.specialCharges})`);
      this.powerText.setColor('#ffb347');
      return;
    }
    this.powerText.setText('');
  }

  canSpawnEnemy() {
    const alive = this.enemies.filter((enemy) => enemy.alive);
    if (alive.length === 0) return true;
    const rightMost = Math.max(...alive.map((enemy) => enemy.sprite.x));
    return rightMost > ENEMY.minSpawnDistance;
  }

  getEnemyProfile() {
    const baseSpeed = 1.7 + this.wave * 0.09;
    const eliteChance = Math.min(0.3, 0.07 + this.wave * 0.012);
    const elite = Math.random() < eliteChance;

    return {
      elite,
      speed: elite ? baseSpeed * 1.28 : baseSpeed + Math.random() * 0.4,
      hp: elite ? 2 : 1,
      scoreValue: elite ? 3 : 1,
    };
  }

  spawnEnemy() {
    const profile = this.getEnemyProfile();
    const activeWords = new Set(this.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.word));
    const word = pickEnemyWord(this.wordBank, this.wave, activeWords);

    const y = ENEMY.minY + Math.random() * (ENEMY.maxY - ENEMY.minY);
    const sprite = this.add.sprite(-ENEMY.width / 12, y, 'enemy_1')
      .setDisplaySize(ENEMY.width, ENEMY.height)
      .setOrigin(0.5, 1)
      .setTint(profile.elite ? 0xffd08a : 0xffffff);
    sprite.play('enemy_walk');

    const label = this.add.text(sprite.x, sprite.y - ENEMY.height + ENEMY.labelOffsetY, word, {
      fontFamily: 'monospace',
      fontSize: profile.elite ? '36px' : '32px',
      color: profile.elite ? '#ffb347' : '#fff200',
      stroke: '#2a1e00',
      strokeThickness: profile.elite ? 7 : 6,
    }).setOrigin(0.5);

    this.enemies.push({
      id: this.lastEnemyId += 1,
      sprite,
      label,
      word,
      hp: profile.hp,
      speed: profile.speed,
      scoreValue: profile.scoreValue,
      elite: profile.elite,
      alive: true,
      dying: false,
    });
  }

  adjustSpawnRate() {
    const accuracy = this.getAccuracy() / 100;
    const base = SCORING.baseSpawnInterval - this.wave * 45;
    const comboBonus = Math.min(360, this.combo * 13);
    const accuracyPenalty = accuracy < 0.8 ? 240 : accuracy < 0.9 ? 120 : 0;
    const crowdControl = Math.min(150, this.enemies.filter((enemy) => enemy.alive).length * 18);

    this.spawnInterval = Phaser.Math.Clamp(
      base - comboBonus + accuracyPenalty + crowdControl,
      SCORING.minSpawnInterval,
      SCORING.maxSpawnInterval,
    );
  }

  updateEnemyWordStyles() {
    const lockedEnemy = findLockedEnemy(this.enemies, this.lockedEnemyId);

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      const prefixMatch = this.typed.length > 0 && enemy.word.startsWith(this.typed);
      const isLocked = lockedEnemy && enemy.id === lockedEnemy.id;
      const exact = this.typed.length > 0 && enemy.word === this.typed;

      enemy.label.setStyle({
        color: exact ? '#7fff8f' : isLocked ? '#7de5ff' : prefixMatch ? '#b5f5ff' : enemy.elite ? '#ffb347' : '#fff200',
        stroke: isLocked ? '#00394f' : enemy.elite ? '#2a1e00' : '#333333',
      });
    }
  }

  clearTypedInput() {
    this.typed = '';
    this.powerInput = '';
    this.lockedEnemyId = null;
    this.typedText.setText('');
    if (window.hiddenInput) {
      window.hiddenInput.value = '';
    }
  }

  registerMistake() {
    this.mistakes += 1;
    this.combo = 0;
    this.killStreak = 0;
    this.flashFeedback('Erro de digitação. Combo resetado.', '#ff7d7d');
    this.clearTypedInput();
    this.updateHud();
    this.updateEnemyWordStyles();
  }

  handleInputKey(rawKey) {
    if (this.gameOver) {
      if (rawKey === ' ' || rawKey === 'Spacebar') {
        this.restartRound();
      }
      return;
    }

    if (typeof rawKey !== 'string') return;

    if (rawKey === 'Backspace' || rawKey === '\b') {
      if (this.typed.length > 0) {
        this.typed = this.typed.slice(0, -1);
        this.powerInput = this.powerInput.slice(0, -1);

        if (this.typed.length === 0) {
          this.lockedEnemyId = null;
        }

        this.typedText.setText(this.typed);
        this.updateEnemyWordStyles();
      }
      return;
    }

    if (!/^[a-zA-Z]$/.test(rawKey)) return;

    const char = rawKey.toLowerCase();
    const lockedEnemy = findLockedEnemy(this.enemies, this.lockedEnemyId);

    if (lockedEnemy) {
      const nextInput = this.typed + char;
      if (!lockedEnemy.word.startsWith(nextInput)) {
        this.registerMistake();
        return;
      }

      this.typed = nextInput;
      this.correctChars += 1;
    } else {
      const nextInput = this.typed + char;
      const candidates = findEnemyCandidates(this.enemies, nextInput);

      if (candidates.length > 0) {
        this.lockedEnemyId = candidates[0].id;
        this.typed = nextInput;
        this.correctChars += 1;
      } else if (canAdvancePowerWord(this.powerInput, char)) {
        this.powerInput += char;
        this.typed = this.powerInput;
        this.correctChars += 1;
      } else {
        this.registerMistake();
        return;
      }
    }

    this.typedText.setText(this.typed);
    this.updateEnemyWordStyles();
    this.updateHud();

    if (isPowerWordComplete(this.powerInput)) {
      this.tryActivatePower();
      return;
    }

    const enemyToKill = findLockedEnemy(this.enemies, this.lockedEnemyId);
    if (enemyToKill && enemyToKill.word === this.typed) {
      this.killEnemyWithArrow(enemyToKill);
      this.clearTypedInput();
      this.updateEnemyWordStyles();
      this.updateHud();
    }
  }

  tryActivatePower() {
    if (this.specialCharges <= 0) {
      this.flashFeedback('Sem carga disponível.', '#ffcf7c');
      this.clearTypedInput();
      return;
    }

    this.specialCharges -= 1;
    this.powerInput = '';
    this.clearTypedInput();
    this.killStreak = 0;
    this.updatePowerText();

    const car = this.add.sprite(GAME_WIDTH + 140, ENEMY.maxY, 'honda').setOrigin(0.5, 1).setScale(0.4);
    car.scaleX = -Math.abs(car.scaleX);

    this.tweens.add({
      targets: car,
      x: -260,
      duration: 1400,
      onUpdate: () => {
        for (const enemy of this.enemies) {
          if (enemy.alive && !enemy.dying && car.x <= enemy.sprite.x) {
            this.finishEnemy(enemy, true);
          }
        }
      },
      onComplete: () => car.destroy(),
    });

    this.flashFeedback('Poder ativado!', '#8be9fd');
  }

  killEnemyWithArrow(enemy) {
    if (!enemy.alive || enemy.dying) return;
    enemy.dying = true;

    this.archer.setTexture('archer_attack');

    const arrowStartX = this.archer.x - 30;
    const arrowStartY = this.archer.y - 18;
    const arrowTargetX = enemy.sprite.x;
    const arrowTargetY = enemy.sprite.y - ENEMY.height / 2;

    const dx = arrowTargetX - arrowStartX;
    const dy = arrowTargetY - arrowStartY;

    const arrow = this.add.sprite(arrowStartX, arrowStartY, 'arrow');
    arrow.setOrigin(0.3, 0.5);
    arrow.scaleX = -1;
    arrow.displayWidth = 250;
    arrow.displayHeight = 150;
    arrow.angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));

    this.sound.play('arrow_shot', { volume: 0.4 });

    const duration = Math.max(250, Phaser.Math.Distance.Between(arrowStartX, arrowStartY, arrowTargetX, arrowTargetY) / 3.2);

    this.tweens.add({
      targets: arrow,
      x: arrowTargetX,
      y: arrowTargetY,
      duration,
      onComplete: () => {
        arrow.destroy();

        enemy.hp -= 1;
        if (enemy.hp > 0) {
          enemy.dying = false;
          enemy.sprite.setTint(0xff6666);
          this.tweens.add({
            targets: enemy.sprite,
            duration: 130,
            onComplete: () => {
              if (enemy.sprite) {
                enemy.sprite.setTint(enemy.elite ? 0xffd08a : 0xffffff);
              }
            },
          });
          this.sound.play('enemy_death', { volume: 0.3 });
          this.archer.setTexture('archer_idle');
          return;
        }

        this.finishEnemy(enemy, false);
        this.archer.setTexture('archer_idle');
      },
    });
  }

  finishEnemy(enemy, byPower) {
    if (!enemy.alive) return;

    enemy.alive = false;
    enemy.dying = false;
    enemy.sprite.destroy();
    enemy.label.destroy();

    this.sound.play('enemy_death', { volume: byPower ? 0.45 : 0.6 });

    this.kills += 1;
    this.combo += 1;
    this.killStreak += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    const gained = enemy.scoreValue * this.calculateMultiplier();
    this.score += gained;
    this.wave = 1 + Math.floor(this.kills / 5);

    if (this.killStreak % TYPING.chargeEveryKills === 0 && this.specialCharges < TYPING.maxCharges) {
      this.specialCharges += 1;
      this.flashFeedback('+1 carga especial', '#8be9fd');
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }

    this.adjustSpawnRate();
    this.updateHud();
    this.updatePowerText();
  }

  onEnemyReachedGate(enemy) {
    if (!enemy.alive) return;

    this.tweens.add({
      targets: enemy.sprite,
      y: enemy.sprite.y - DOOR_ENTRY_OFFSET,
      alpha: 0,
      duration: 220,
      onComplete: () => {
        enemy.alive = false;
        enemy.sprite.destroy();
        enemy.label.destroy();
      },
    });

    if (this.lockedEnemyId === enemy.id) {
      this.clearTypedInput();
    }

    this.lives -= 1;
    this.combo = 0;
    this.killStreak = 0;

    if (this.lifeIcons[this.lives]) {
      this.lifeIcons[this.lives].setVisible(false);
    }

    this.flashFeedback('Portão atingido.', '#ff7c7c');
    this.updateHud();
    this.updatePowerText();
  }

  showGameOver() {
    this.gameOver = true;

    this.gameOverGroup = this.add.group();

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 430, 0x181825, 0.97);
    const line1 = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'GAME OVER', {
      fontFamily: 'monospace',
      fontSize: '72px',
      color: '#fffbe8',
    }).setOrigin(0.5);

    const line2 = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 36, `Scammers defeated: ${this.kills}`, {
      fontFamily: 'monospace',
      fontSize: '40px',
      color: '#ffa600',
    }).setOrigin(0.5);

    const line3 = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, `Best combo: ${this.bestCombo} | Accuracy: ${this.getAccuracy()}%`, {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#7de5ff',
    }).setOrigin(0.5);

    const line4 = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 84, `Final score: ${this.score} | Best: ${this.highScore}`, {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ff94b8',
    }).setOrigin(0.5);

    const line5 = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 148, 'Press SPACE or click restart', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ff9600',
    }).setOrigin(0.5);

    this.gameOverGroup.addMultiple([overlay, line1, line2, line3, line4, line5]);

    if (window.showRestartButton) {
      window.showRestartButton();
    }
  }

  restartRound() {
    if (this.gameOverGroup) {
      this.gameOverGroup.clear(true, true);
      this.gameOverGroup = null;
    }

    for (const enemy of this.enemies) {
      if (enemy.sprite) enemy.sprite.destroy();
      if (enemy.label) enemy.label.destroy();
    }

    this.resetRuntime();

    for (const icon of this.lifeIcons) {
      icon.setVisible(true);
    }

    this.feedbackText.setText('');
    this.typedText.setText('');

    this.spawnEnemy();
    this.time.delayedCall(900, () => this.spawnEnemy());

    this.updateHud();
    this.updateEnemyWordStyles();
    this.updatePowerText();

    if (window.hideRestartButton) {
      window.hideRestartButton();
    }
  }

  loadHighScore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (parsed && Number.isFinite(parsed.highScore)) {
        return parsed.highScore;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ highScore: this.highScore }));
    } catch {
      // Storage can fail in private mode; gameplay should continue.
    }
  }
}
