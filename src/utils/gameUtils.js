import { POKEMON_NAMES, ALL_POKEMON_BY_RARITY, ENHANCE_CONFIG, POKEMON_POWER_BASE, POKEMON_TYPES, TYPE_META, TYPE_CHART, BALL_CONFIG } from '../data/pokemonData.js';
import { WILD_EXCLUDED } from '../data/evolutionData.js';

let _instanceCounter = 0;

// 포획 결과 사전 계산 (애니메이션과 실제 state 반영 시점 분리용)
export function rollCapture(ballType, pokemon, captureFailStreak) {
  const ballCfg = BALL_CONFIG[ballType];
  if (!ballCfg || !pokemon) return 'fail';
  const isMythical   = pokemon.rarity === 5;
  const arceusBlock  = isMythical && ballType !== 'master';
  const baseRate     = ballCfg.rates[pokemon.rarity] ?? 0;
  const catchRate    = arceusBlock ? 0
    : isMythical ? baseRate
    : Math.min(1, baseRate + Math.min(captureFailStreak, 10) * 0.01);
  const roll = Math.random();
  return arceusBlock ? 'fail'
    : roll < catchRate       ? 'success'
    : roll < catchRate + 0.18 ? 'near-miss'
    : 'fail';
}

export function getPokemonImageUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export function getPokemonShinyImageUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
}

export function getPokemonName(id) {
  return POKEMON_NAMES[id] || `포켓몬 #${id}`;
}

// 글로벌 여행 — 전체 풀에서 랜덤 추첨
// 출현 확률: ★5=0.5%, ★4=2%, ★3=16%, ★2=29.5%, ★1=52%
export function generateWildPokemon() {
  const roll = Math.random();
  let rarity;
  if (roll < 0.005)      rarity = 5;  // 0.5% 신화
  else if (roll < 0.025) rarity = 4;  // 2% 전설
  else if (roll < 0.185) rarity = 3;  // 16% 영웅
  else if (roll < 0.48)  rarity = 2;  // 29.5% 희귀
  else                   rarity = 1;  // 52% 일반

  // 진화로만 얻을 수 있는 포켓몬은 야생 출현 제외
  const pool = ALL_POKEMON_BY_RARITY[rarity].filter(id => !WILD_EXCLUDED.has(id));
  const pokemonId = pool[Math.floor(Math.random() * pool.length)];
  return createPokemonInstance(pokemonId, rarity);
}

export function createPokemonInstance(pokemonId, rarity) {
  const sizeGrades = ['S', 'A', 'B', 'C'];
  const sizeGrade = sizeGrades[Math.floor(Math.random() * 4)];
  const size = Math.floor(Math.random() * 100) + 1;
  const isGolden = Math.random() < 0.005;
  const isShiny  = Math.random() < 0.01;
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
    isShiny,
    capturedAt: Date.now(),
  };
}

export function calculatePower(pokemon) {
  const rarityDefault = { 1: 200, 2: 750, 3: 2600, 4: 12000, 5: 40000 }[pokemon.rarity] || 200;
  const rarityBase = POKEMON_POWER_BASE[pokemon.pokemonId] ?? rarityDefault;
  const sizeMult  = { S: 1.2, A: 1.1, B: 1.0, C: 0.9 }[pokemon.sizeGrade] || 1.0;
  const shinyMult = pokemon.isShiny ? 1.5 : 1;
  const lv = pokemon.enhanceLevel;
  const enhanceMult = lv <= 14
    ? 1 + lv * 0.2
    : (1 + 14 * 0.2) * Math.pow(2, lv - 14);
  return Math.floor(rarityBase * sizeMult * enhanceMult * shinyMult);
}

export function calculateSellPrice(pokemon) {
  const basePrice = { 1: 200, 2: 3000, 3: 25000, 4: 100000, 5: 500000 }[pokemon.rarity] || 200;
  const sizeMult  = { S: 2.0, A: 1.5, B: 1.0, C: 0.7 }[pokemon.sizeGrade];
  const lv = pokemon.enhanceLevel;
  const enhanceMult = lv <= 14
    ? 1 + lv * 0.2
    : (1 + 14 * 0.2) * Math.pow(2, lv - 14);
  const goldenMult = pokemon.isGolden ? 5 : 1;
  const shinyMult  = pokemon.isShiny  ? 1.5 : 1;
  return Math.floor(basePrice * sizeMult * enhanceMult * goldenMult * shinyMult);
}

export function getEnhanceConfig(currentLevel) {
  return ENHANCE_CONFIG.find(c => currentLevel >= c.range[0] && currentLevel <= c.range[1]);
}
export function getEnhanceCost(currentLevel)       { return getEnhanceConfig(currentLevel)?.cost ?? 0; }
export function getEnhanceRate(currentLevel)       { return getEnhanceConfig(currentLevel)?.rate ?? 0; }
export function getEnhanceFailEffect(currentLevel) { return getEnhanceConfig(currentLevel)?.fail ?? 'none'; }

export function getRarityStars(rarity) {
  if (rarity === 5) return '★★★★★';
  if (rarity === 4) return '★★★★';
  return '★'.repeat(rarity) + '☆'.repeat(3 - rarity);
}

export function getRarityColor(rarity) {
  return { 1: '#9e9e9e', 2: '#42a5f5', 3: '#ffd600', 4: '#e040fb', 5: '#FF6B00' }[rarity] || '#fff';
}

export function formatCoins(n) {
  const v = n ?? 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toLocaleString();
}

// ── 타입 상성 계산 ────────────────────────────────────────────────────────────
export function getTypeAdvantage(attackerTypes, defenderTypes) {
  for (const atk of attackerTypes) {
    const effective = TYPE_CHART[atk] || [];
    if (defenderTypes.some(def => effective.includes(def)))
      return { multiplier: 1.25, label: '효과 좋음 ✨' };
  }
  for (const def of defenderTypes) {
    const effective = TYPE_CHART[def] || [];
    if (attackerTypes.some(atk => effective.includes(atk)))
      return { multiplier: 0.8,  label: '효과 나쁨 💨' };
  }
  return { multiplier: 1, label: null };
}

// ── 배틀 조합 시너지 ──────────────────────────────────────────────────────────
const FIXED_SYNERGIES = [
  {
    id: 'legendary_birds', name: '전설의 새', icon: '🦅',
    desc: '썬더 · 파이어 · 프리저',
    requiredIds: [145, 146, 144],
    multiplier: 1.5, kind: 'fixed_all',
  },
  {
    id: 'gen1_starters', name: '1세대 삼인방', icon: '1️⃣',
    desc: '이상해풀 · 거북왕 · 리자몽',
    requiredIds: [3, 6, 9],
    multiplier: 3, kind: 'fixed_all',
  },
  {
    id: 'gen2_starters', name: '2세대 삼인방', icon: '2️⃣',
    desc: '메가니움 · 장크로다일 · 블레이범',
    requiredIds: [154, 160, 157],
    multiplier: 3, kind: 'fixed_all',
  },
  {
    id: 'divine_blessing', name: '신의 가호', icon: '✨',
    desc: '아르세우스 포함 + 임의 2마리',
    arceusId: 493,
    multiplier: 2, kind: 'arceus',
  },
];

// 조합표 카탈로그 (UI 표시용)
export const SYNERGY_CATALOG = [
  { fixedId: 'legendary_birds', name: '전설의 새',    icon: '🦅', desc: '썬더 + 파이어 + 프리저',          bonus: '전체 ×1.5',       color: '#4fc3f7' },
  { fixedId: 'gen1_starters',   name: '1세대 삼인방', icon: '1️⃣', desc: '이상해풀 + 거북왕 + 리자몽',       bonus: '전체 ×3',         color: '#81c784' },
  { fixedId: 'gen2_starters',   name: '2세대 삼인방', icon: '2️⃣', desc: '메가니움 + 장크로다일 + 블레이범', bonus: '전체 ×3',         color: '#4db6ac' },
  { fixedId: 'divine_blessing', name: '신의 가호',    icon: '✨', desc: '아르세우스 + 임의 2마리',          bonus: '나머지 ×2',       color: '#ffb74d' },
  { fixedId: 'type3',           name: '삼색 공명',    icon: '🔱', desc: '3마리 모두 같은 타입',             bonus: '전체 ×1.5',       color: '#ce93d8' },
  { fixedId: 'type2',           name: '듀오 공명',    icon: '🔗', desc: '2마리가 같은 타입 보유',           bonus: '해당 2마리 ×1.2', color: '#90caf9' },
];

export function getTeamSynergies(team) {
  // team: [p, p, p] — pokemon object or null per slot
  const multipliers = [1.0, 1.0, 1.0];
  const active = [];
  const partial = [];

  const ids = team.map(p => p?.pokemonId ?? null);
  const filled = ids.filter(id => id !== null).length;

  // ── 고정 시너지 (전설의새, 스타터, 신의가호) ─────────────────
  for (const syn of FIXED_SYNERGIES) {
    if (syn.kind === 'arceus') {
      const arcIdx = ids.indexOf(syn.arceusId);
      if (arcIdx !== -1 && filled === 3) {
        // appliedSlots: 아르세우스 제외 슬롯 인덱스 배열 (boolean이 아닌 숫자)
        const nonArcSlots = ids.reduce((acc, id, i) => {
          if (i !== arcIdx && id !== null) acc.push(i);
          return acc;
        }, []);
        active.push({ ...syn, appliedSlots: nonArcSlots });
        nonArcSlots.forEach(i => { multipliers[i] *= syn.multiplier; });
      } else {
        const missing = [];
        if (arcIdx === -1) missing.push('아르세우스');
        if (filled < 3) missing.push(`슬롯 ${3 - filled}개 비어있음`);
        partial.push({ ...syn, foundCount: filled + (arcIdx !== -1 ? 0 : 0), missing });
      }
    } else {
      const slots = syn.requiredIds.map(reqId => ids.indexOf(reqId));
      const foundSlots = slots.filter(i => i !== -1);
      if (foundSlots.length === syn.requiredIds.length) {
        active.push({ ...syn, appliedSlots: foundSlots });
        foundSlots.forEach(i => { multipliers[i] *= syn.multiplier; });
      } else {
        const missingNames = syn.requiredIds
          .filter(reqId => !ids.includes(reqId))
          .map(id => POKEMON_NAMES[id] || `#${id}`);
        partial.push({ ...syn, foundCount: foundSlots.length, missing: missingNames });
      }
    }
  }

  // ── 타입 시너지 (누적 곱셈으로 중복 적용) ───────────────────────
  const typeToSlots = {};
  team.forEach((p, i) => {
    if (!p) return;
    (POKEMON_TYPES[p.pokemonId] || ['normal']).forEach(t => {
      if (!typeToSlots[t]) typeToSlots[t] = [];
      typeToSlots[t].push(i);
    });
  });

  for (const [type, slots] of Object.entries(typeToSlots)) {
    const meta = TYPE_META[type] || { label: type, color: '#888' };
    if (slots.length >= 3) {
      const mult = 1.5;
      active.push({ id: `type3_${type}`, name: `${meta.label} 삼색 공명`, icon: '🔱',
        desc: `3마리 모두 ${meta.label} 타입`, multiplier: mult, appliedSlots: slots, color: meta.color });
      slots.forEach(i => { multipliers[i] *= mult; });
    } else if (slots.length === 2) {
      const mult = 1.2;
      active.push({ id: `type2_${type}`, name: `${meta.label} 듀오`, icon: '🔗',
        desc: `${meta.label} 타입 공명`, multiplier: mult, appliedSlots: slots, color: meta.color });
      slots.forEach(i => { multipliers[i] *= mult; });
    }
  }

  return { multipliers, active, partial };
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
