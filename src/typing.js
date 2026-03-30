import { TYPING } from './constants.js';

function sortByThreat(a, b) {
  return b.sprite.x - a.sprite.x;
}

export function findLockedEnemy(enemies, lockedEnemyId) {
  if (lockedEnemyId == null) return null;
  return enemies.find((enemy) => enemy.alive && enemy.id === lockedEnemyId) || null;
}

export function findEnemyCandidates(enemies, prefix) {
  return enemies
    .filter((enemy) => enemy.alive && !enemy.dying && enemy.word.startsWith(prefix))
    .sort(sortByThreat);
}

export function canAdvancePowerWord(current, nextChar) {
  return TYPING.powerWord.startsWith(current + nextChar);
}

export function isPowerWordComplete(current) {
  return current === TYPING.powerWord;
}
