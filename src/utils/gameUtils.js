import { POKEMON_NAMES, ALL_POKEMON_BY_RARITY, ENHANCE_CONFIG } from '../data/pokemonData.js';

let _instanceCounter = 0;

export function getPokemonImageUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export function getPokemonName(id) {
  return POKEMON_NAMES[id] || `포켓몬 #${id}`;
}

// 글로벌 여행 — 전체 풀에서 랜덤 추첨
// 출현 확률: ★1=52%, ★2=30%, ★3=16%, ★4=2%
export function generateWildPokemon() {
  const roll = Math.random();
  let rarity;
  if (roll < 0.02)       rarity = 4;  // 2% 전설
  else if (roll < 0.18)  rarity = 3;  // 16% 영웅
  else if (roll < 0.48)  rarity = 2;  // 30% 희귀
  else                   rarity = 1;  // 52% 일반

  const pool = ALL_POKEMON_BY_RARITY[rarity];
  const pokemonId = pool[Math.floor(Math.random() * pool.length)];
  return createPokemonInstance(pokemonId, rarity);
}

export function createPokemonInstance(pokemonId, rarity) {
  const sizeGrades = ['S', 'A', 'B', 'C'];
  const sizeGrade = sizeGrades[Math.floor(Math.random() * 4)];
  const size = Math.floor(Math.random() * 100) + 1;
  const isGolden = Math.random() < 0.005;
  const gender = Math.random() < 0.5 ? '♂' : '♀';

  return {
    instanceId: `${Date.now()}-${++_instanceCounter}-${Math.random().toString(36).slice(2)}`,
    pokemonId,
    rarity,
    gender,
    size,
    sizeGrade,
    enhanceLevel: 0,
    isGolden,
    capturedAt: Date.now(),
  };
}

export function calculatePower(pokemon) {
  // 희귀도별 기준 전투력 (기존 스탯 합산 평균과 동일한 스케일 유지)
  const rarityBase = { 1: 200, 2: 750, 3: 2600, 4: 12000 }[pokemon.rarity] || 200;
  const sizeMult = { S: 1.2, A: 1.1, B: 1.0, C: 0.9 }[pokemon.sizeGrade] || 1.0;
  const lv = pokemon.enhanceLevel;
  // +14까지: 선형 증가 / +15부터: 성공마다 전투력 2배
  const enhanceMult = lv <= 14
    ? 1 + lv * 0.2
    : (1 + 14 * 0.2) * Math.pow(2, lv - 14); // 3.8 × 2^(lv-14)
  return Math.floor(rarityBase * sizeMult * enhanceMult);
}

export function calculateSellPrice(pokemon) {
  const basePrice = { 1: 200, 2: 3000, 3: 25000, 4: 100000 }[pokemon.rarity] || 200;
  const sizeMult = { S: 2.0, A: 1.5, B: 1.0, C: 0.7 }[pokemon.sizeGrade];
  const lv = pokemon.enhanceLevel;
  const enhanceMult = lv <= 14
    ? 1 + lv * 0.2
    : (1 + 14 * 0.2) * Math.pow(2, lv - 14); // +15부터 2배씩
  const goldenMult = pokemon.isGolden ? 5 : 1;
  return Math.floor(basePrice * sizeMult * enhanceMult * goldenMult);
}

export function getEnhanceConfig(currentLevel) {
  return ENHANCE_CONFIG.find(c => currentLevel >= c.range[0] && currentLevel <= c.range[1]);
}
export function getEnhanceCost(currentLevel)       { return getEnhanceConfig(currentLevel)?.cost ?? 0; }
export function getEnhanceRate(currentLevel)       { return getEnhanceConfig(currentLevel)?.rate ?? 0; }
export function getEnhanceFailEffect(currentLevel) { return getEnhanceConfig(currentLevel)?.fail ?? 'none'; }

export function getRarityStars(rarity) {
  if (rarity === 4) return '★★★★';
  return '★'.repeat(rarity) + '☆'.repeat(3 - rarity);
}

export function getRarityColor(rarity) {
  return { 1: '#9e9e9e', 2: '#42a5f5', 3: '#ffd600', 4: '#e040fb' }[rarity] || '#fff';
}

export function formatCoins(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function formatCooldown(ms) {
  if (ms <= 0) return '준비됨';
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}
