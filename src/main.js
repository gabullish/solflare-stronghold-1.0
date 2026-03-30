import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { MainScene } from './mainScene.js';

let game = null;

function buildConfig() {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d2533',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      parent: 'game-container',
    },
    scene: [MainScene],
  };
}

function ensureGameStarted() {
  if (!game) {
    game = new Phaser.Game(buildConfig());
    window.game = game;
  }
}

function setupDomBridge() {
  const startBtn = document.getElementById('startButton');
  const restartBtn = document.getElementById('restartButton');
  const startScreen = document.getElementById('startScreen');
  const hiddenInput = document.getElementById('hiddenInput');
  const gameContainer = document.getElementById('game-container');

  window.hiddenInput = hiddenInput;

  const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    || window.matchMedia('(pointer: coarse)').matches;

  function focusInput() {
    if (hiddenInput) {
      hiddenInput.focus();
    }
  }

  function startFlow() {
    startScreen.style.display = 'none';
    restartBtn.style.display = 'none';
    ensureGameStarted();
    focusInput();
  }

  startBtn.addEventListener('click', startFlow);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && startScreen.style.display !== 'none') {
      event.preventDefault();
      startFlow();
    }
  });

  restartBtn.addEventListener('click', () => {
    if (window.currentScene) {
      window.currentScene.restartRound();
      focusInput();
    }
  });

  window.showRestartButton = () => {
    restartBtn.style.display = 'block';
    focusInput();
  };

  window.hideRestartButton = () => {
    restartBtn.style.display = 'none';
  };

  if (isMobile && hiddenInput) {
    hiddenInput.addEventListener('focus', () => {
      gameContainer.classList.add('keyboard-open');
    });

    hiddenInput.addEventListener('blur', () => {
      gameContainer.classList.remove('keyboard-open');
    });

    hiddenInput.addEventListener('input', (event) => {
      if (window.handleTyping) {
        window.handleTyping(event.target.value);
      }
      event.target.value = '';
    });

    hiddenInput.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace') {
        if (window.handleTyping) {
          window.handleTyping('\b');
        }
        event.preventDefault();
      }
    });
  }
}

setupDomBridge();
