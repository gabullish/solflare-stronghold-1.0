export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export const LIVES_MAX = 5;
export const DOOR_X = 1540;
export const DOOR_ENTRY_OFFSET = 40;

export const ARCHER = {
  x: GAME_WIDTH - 660,
  y: 310,
  width: 180,
  height: 220,
};

export const ENEMY = {
  width: 300,
  height: 320,
  labelOffsetY: 70,
  minY: GAME_HEIGHT * 0.85,
  maxY: GAME_HEIGHT * 0.93,
  minSpawnDistance: 315,
};

export const TYPING = {
  typedTextY: 140,
  feedbackTextY: 204,
  powerWord: 'honda',
  maxCharges: 3,
  chargeEveryKills: 6,
};

export const SCORING = {
  baseSpawnInterval: 1800,
  minSpawnInterval: 700,
  maxSpawnInterval: 2400,
};

export const STORAGE_KEY = 'solflare_stronghold_v2';
