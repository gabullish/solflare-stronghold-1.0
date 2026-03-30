const FALLBACK_BANK = {
  easy: ['sol', 'tip', 'key', 'gas', 'fee', 'mint', 'send'],
  medium: ['stake', 'guard', 'wallet', 'chain', 'safety', 'vault'],
  hard: ['airdrop', 'private', 'confirm', 'monitor', 'defense'],
  insane: ['stronghold', 'validation', 'decentralized'],
};

function sanitizeBucket(words, fallback) {
  if (!Array.isArray(words) || words.length === 0) {
    return fallback;
  }

  const unique = new Set();
  for (const value of words) {
    if (typeof value !== 'string') continue;
    const clean = value.trim().toLowerCase();
    if (!/^[a-z]+$/.test(clean)) continue;
    if (clean.length < 3) continue;
    unique.add(clean);
  }

  return unique.size > 0 ? [...unique] : fallback;
}

export function getSanitizedWordBank() {
  const source = window.WORD_BANK || {};

  return {
    easy: sanitizeBucket(source.easy, FALLBACK_BANK.easy),
    medium: sanitizeBucket(source.medium, FALLBACK_BANK.medium),
    hard: sanitizeBucket(source.hard, FALLBACK_BANK.hard),
    insane: sanitizeBucket(source.insane, FALLBACK_BANK.insane),
  };
}

export function buildDifficultyPool(bank, wave) {
  if (wave < 6) {
    return [...bank.easy];
  }
  if (wave < 12) {
    return [...bank.easy, ...bank.medium];
  }
  if (wave < 20) {
    return [...bank.medium, ...bank.hard];
  }
  return [...bank.medium, ...bank.hard, ...bank.insane];
}

export function pickEnemyWord(bank, wave, activeWords) {
  const pool = buildDifficultyPool(bank, wave);
  const filtered = pool.filter((word) => !activeWords.has(word));
  const targetPool = filtered.length > 0 ? filtered : pool;
  return targetPool[Math.floor(Math.random() * targetPool.length)];
}
