# Solflare Stronghold v2

A typing-defense browser game where you protect the Solflare Stronghold from waves of scammers.

## What's new in v2

- **Typing-first controls:** no gameplay hotkeys that conflict with normal word typing.
- **Target lock input model:** once your prefix matches, the game locks to the highest-threat enemy for reliable kills.
- **Smoother pacing:** adaptive spawn interval based on wave, combo, current crowd pressure, and accuracy.
- **Stable architecture:** modular ES modules with separated constants, word-bank logic, typing helpers, and main scene.
- **Validated word bank:** runtime sanitization + safe fallback lists for robust sessions.

## Controls

- Type enemy words to fire arrows.
- Type `honda` when charged to unleash the car power.
- `BACKSPACE` edits typed input.
- `SPACE` starts game on start screen and restarts after game over.
- Mobile users can use on-screen keyboard input with focus auto-handling.

## Code structure

- `src/constants.js`: gameplay constants and tuning values.
- `src/wordBank.js`: word bank sanitization and wave pools.
- `src/typing.js`: target selection and typing helper rules.
- `src/mainScene.js`: Phaser scene and core game loop.
- `src/main.js`: browser/DOM bootstrap and mobile input bridge.

## Run locally

Open `index.html` in a browser (or serve with a simple static server) and press **Start**.
