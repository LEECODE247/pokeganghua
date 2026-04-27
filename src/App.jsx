import React, { useReducer, useEffect, useState, useRef, useCallback, createContext, useContext, Component } from 'react';
import { generateWildPokemon, calculateSellPrice, getEnhanceRate, getEnhanceFailEffect, getEnhanceCost, createPokemonInstance, SELL_ENHANCE_BONUS } from './utils/gameUtils.js';
import { BALL_CONFIG, POKEMON_NAMES, ALL_POKEMON_BY_RARITY, GEN1_IDS, GEN2_IDS, POKEMON_RARITY_MAP, GYM_CONFIG } from './data/pokemonData.js';
import { EVOLUTIONS } from './data/evolutionData.js';
import { loadGameState, saveGameState, saveGameStateOnUnload, setSessionToken, getSessionToken } from './supabase.js';
import HUD from './components/HUD.jsx';
import MainScreen from './components/MainScreen.jsx';
import CaptureScreen from './components/CaptureScreen.jsx';
import InventoryScreen from './components/InventoryScreen.jsx';
import EnhancementScreen from './components/EnhancementScreen.jsx';
import GymScreen from './components/GymScreen.jsx';
import BattleScreen from './components/BattleScreen.jsx';
import PokedexScreen from './components/PokedexScreen.jsx';
import LoginScreen from './components/LoginScreen.jsx';

export const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

const INITIAL_STATE = {
  coins: 10000,
  inventory: [],
  fragments: 0,
  screen: 'main',
  wildPokemon: null,
  captureResult: null,
  captureFailStreak: 0,
  enhancingPokemonId: null,
  enhanceResult: null,
  enhanceFailStack: 0,
  battleTeam: [null, null, null], // [instanceId|null, instanceId|null, instanceId|null]
  dayBattleTeams: [[null,null,null],[null,null,null],[null,null,null],[null,null,null],[null,null,null],[null,null,null],[null,null,null]],
  gymTeam: [null, null, null],   // 체육관 전용 팀 (미사용, 하위호환)
  gymMap: 'forest',
  gymSelectedPokemonId: null,
  gymBattleResult: null,
  gymCooldowns: {},              // { [gymMapId]: cooldownEndTimestamp }
  gymPokemonCooldowns: {},       // { [instanceId]: cooldownEndTimestamp } — 포켓몬별 일일 1회 제한
  totalCaptured: 0,
  totalEnhanced: 0,
  totalBattles: 0,
  totalWins: 0,
  pvpBattles: 0,
  pvpWins: 0,
  lastCoinClaim: 0,
  dailyBattleCount: 0,
  battleResetDate: '',
  pokedex: [],
  pokedexRewarded: false,
  pokedex1HalfRewarded: false,
  pokedex1Rewarded: false,
  pokedex2HalfRewarded: false,
  pokedex2Rewarded: false,
  shinyPokedex: [],
  shinyPokedexHalfRewarded: false,
  shinyPokedexRewarded: false,
  lastEvolution: null,
};

// 이로치 도감 대상: 1~3성 1·2세대 포켓몬
const GEN_ALL_SET = new Set([...GEN1_IDS, ...GEN2_IDS]);
const SHINY_TARGET_IDS = new Set(
  [...(ALL_POKEMON_BY_RARITY[1] || []), ...(ALL_POKEMON_BY_RARITY[2] || []), ...(ALL_POKEMON_BY_RARITY[3] || [])]
    .filter(id => GEN_ALL_SET.has(id))
);

function gameReducer(state, action) {
  switch (action.type) {

    case 'NAVIGATE':
      return { ...state, screen: action.screen };

    case 'START_ROULETTE': {
      const pokemon = generateWildPokemon();
      return { ...state, wildPokemon: pokemon, captureResult: null, screen: 'capture' };
    }

    case 'GENERATE_WILD_POKEMON': {
      const pokemon = generateWildPokemon();
      return { ...state, wildPokemon: pokemon, captureResult: null };
    }

    case 'ATTEMPT_CAPTURE': {
      const { ballType, result: preResult } = action;
      const ballCfg = BALL_CONFIG[ballType];
      if (!ballCfg || state.coins < ballCfg.cost || !state.wildPokemon) return state;

      // 컴포넌트에서 사전 계산한 결과 사용 (애니메이션과 state 반영 시점 분리)
      const result   = preResult ?? 'fail';
      const captured = result === 'success';

      const newPokedex = captured && !state.pokedex.includes(state.wildPokemon.pokemonId)
        ? [...state.pokedex, state.wildPokemon.pokemonId]
        : state.pokedex;

      const newShinyPokedex = captured && state.wildPokemon.isShiny
        && !state.shinyPokedex.includes(state.wildPokemon.pokemonId)
        ? [...(state.shinyPokedex || []), state.wildPokemon.pokemonId]
        : (state.shinyPokedex || []);

      return {
        ...state,
        coins: state.coins - ballCfg.cost,
        captureResult: result,
        captureFailStreak: captured ? 0 : state.captureFailStreak + 1,
        inventory: captured ? [...state.inventory, state.wildPokemon] : state.inventory,
        totalCaptured: captured ? state.totalCaptured + 1 : state.totalCaptured,
        pokedex: newPokedex,
        shinyPokedex: newShinyPokedex,
      };
    }

    case 'DISMISS_CAPTURE':
      return { ...state, captureResult: null, wildPokemon: null };

    case 'SELECT_FOR_ENHANCE':
      return { ...state, enhancingPokemonId: action.pokemonId, enhanceResult: null, screen: 'enhancement' };

    case 'ATTEMPT_ENHANCE': {
      const pokemon = state.inventory.find(p => p.instanceId === state.enhancingPokemonId);
      if (!pokemon) return state;
      const cost = getEnhanceCost(pokemon.enhanceLevel);
      if (state.coins < cost) return state;

      const successRate = Math.min(0.95, getEnhanceRate(pokemon.enhanceLevel) + state.enhanceFailStack * 0.05);
      const success     = Math.random() < successRate;

      let newInventory = [...state.inventory];
      let newFragments = state.fragments;
      let newFailStack = state.enhanceFailStack;
      let result;

      let evolutionInfo = null;
      if (success) {
        const newLevel = pokemon.enhanceLevel + 1;
        const evoData  = EVOLUTIONS[pokemon.pokemonId];

        if (evoData && evoData.at === newLevel) {
          // 진화 발동!
          const targets    = Array.isArray(evoData.to) ? evoData.to : [evoData.to];
          const targetId   = targets[Math.floor(Math.random() * targets.length)];
          const targetRarity = POKEMON_RARITY_MAP[targetId] ?? pokemon.rarity;
          newInventory = newInventory.map(p =>
            p.instanceId === pokemon.instanceId
              ? { ...p, enhanceLevel: newLevel, pokemonId: targetId, rarity: targetRarity }
              : p
          );
          if (!state.pokedex.includes(targetId)) {
            newFragments = state.fragments; // fragments 유지 (아래서 덮어쓰기 방지)
          }
          evolutionInfo = { from: pokemon.pokemonId, to: targetId, isShiny: pokemon.isShiny };
          result = 'evolved';
        } else {
          result = 'success';
          newInventory = newInventory.map(p =>
            p.instanceId === pokemon.instanceId ? { ...p, enhanceLevel: newLevel } : p
          );
        }
        newFailStack = 0;
      } else {
        newFailStack++;
        const failEffect = getEnhanceFailEffect(pokemon.enhanceLevel);
        if (failEffect === 'destroy') {
          const shieldCost = (pokemon.enhanceLevel - 14) * 1000; // 15강→1000, 16강→2000, ...
          if (action.useShield && state.fragments >= shieldCost) {
            result = 'shielded';
            newFragments -= shieldCost;
          } else {
            result = 'destroyed';
            newInventory = newInventory.filter(p => p.instanceId !== pokemon.instanceId);
            const destroyBonus = SELL_ENHANCE_BONUS[pokemon.enhanceLevel] ?? 0;
            newFragments += destroyBonus * 2; // 15강 이상 파괴 시 판매 파편의 2배
          }
        } else if (failEffect === 'minus1') {
          result = 'decreased';
          newInventory = newInventory.map(p =>
            p.instanceId === pokemon.instanceId ? { ...p, enhanceLevel: Math.max(0, p.enhanceLevel - 1) } : p
          );
          newFragments += 8;
        } else {
          result = 'fail';
          newFragments += 3;
        }
      }

      const newPokedex = evolutionInfo && !state.pokedex.includes(evolutionInfo.to)
        ? [...state.pokedex, evolutionInfo.to]
        : state.pokedex;

      const newShinyPokedexAfterEvo = evolutionInfo?.isShiny && !(state.shinyPokedex || []).includes(evolutionInfo.to)
        ? [...(state.shinyPokedex || []), evolutionInfo.to]
        : (state.shinyPokedex || []);

      return {
        ...state,
        coins: state.coins - cost,
        inventory: newInventory,
        fragments: newFragments,
        enhanceResult: result,
        enhanceFailStack: newFailStack,
        enhancingPokemonId: result === 'destroyed' ? null : state.enhancingPokemonId,
        totalEnhanced: state.totalEnhanced + 1,
        lastEvolution: evolutionInfo ?? state.lastEvolution,
        pokedex: newPokedex,
        shinyPokedex: newShinyPokedexAfterEvo,
      };
    }

    case 'CLEAR_ENHANCE_RESULT':
      return { ...state, enhanceResult: null, lastEvolution: null };

    case 'SET_BATTLE_SLOT': {
      const newTeam = [...state.battleTeam];
      newTeam[action.slot] = action.pokemonId; // null이면 슬롯 해제
      return { ...state, battleTeam: newTeam };
    }

    case 'SET_DAY_BATTLE_SLOT': {
      const { day, slot, pokemonId } = action;
      const newDayTeams = state.dayBattleTeams.map((t, d) =>
        d === day ? t.map((id, s) => s === slot ? pokemonId : id) : t
      );
      return { ...state, dayBattleTeams: newDayTeams };
    }

    case 'CLAIM_DAY_BATTLE_REWARD':
      return { ...state, fragments: state.fragments + action.fragments };

    case 'CLAIM_WEEKLY_BATTLE_REWARD': {
      const { fragments, pokemon } = action;
      const newInv = pokemon ? [...state.inventory, pokemon] : state.inventory;
      const newDex = pokemon && !state.pokedex.includes(pokemon.pokemonId)
        ? [...state.pokedex, pokemon.pokemonId] : state.pokedex;
      return { ...state, fragments: state.fragments + fragments, inventory: newInv, pokedex: newDex };
    }

    case 'SET_GYM_SLOT': {
      const newTeam = [...state.gymTeam];
      newTeam[action.slot] = action.pokemonId;
      return { ...state, gymTeam: newTeam };
    }

    case 'BATTLE_WIN': {
      const today = new Date().toDateString();
      const prevCount = state.battleResetDate === today ? state.dailyBattleCount : 0;
      return {
        ...state,
        coins: state.coins + action.coins,
        totalBattles: state.totalBattles + 1,
        totalWins: state.totalWins + 1,
        pvpBattles: (state.pvpBattles || 0) + 1,
        pvpWins: (state.pvpWins || 0) + 1,
        dailyBattleCount: prevCount + 1,
        battleResetDate: today,
      };
    }

    case 'BATTLE_LOSE': {
      const today = new Date().toDateString();
      const prevCount = state.battleResetDate === today ? state.dailyBattleCount : 0;
      return {
        ...state,
        totalBattles: state.totalBattles + 1,
        pvpBattles: (state.pvpBattles || 0) + 1,
        dailyBattleCount: prevCount + 1,
        battleResetDate: today,
      };
    }

    case 'SELL_POKEMON': {
      const pokemon = state.inventory.find(p => p.instanceId === action.pokemonId);
      if (!pokemon) return state;
      const newGymPokemonCooldowns = { ...state.gymPokemonCooldowns };
      delete newGymPokemonCooldowns[action.pokemonId];
      const sellFragmentBonus = SELL_ENHANCE_BONUS[pokemon.enhanceLevel] ?? 0;
      const isArceus = pokemon.pokemonId === 493;
      const isLegendaryBonus = !isArceus && pokemon.rarity === 4 && pokemon.enhanceLevel >= 15;
      const legendaryFragBonus = isArceus ? 5000 : isLegendaryBonus ? (Math.floor(Math.random() * 1901) + 100) : 0;
      return {
        ...state,
        coins: state.coins + calculateSellPrice(pokemon),
        fragments: state.fragments + sellFragmentBonus + legendaryFragBonus,
        inventory: state.inventory.filter(p => p.instanceId !== action.pokemonId),
        enhancingPokemonId:   state.enhancingPokemonId   === action.pokemonId ? null : state.enhancingPokemonId,
        gymSelectedPokemonId: state.gymSelectedPokemonId === action.pokemonId ? null : state.gymSelectedPokemonId,
        battleTeam: state.battleTeam.map(id => id === action.pokemonId ? null : id),
        gymTeam: state.gymTeam.map(id => id === action.pokemonId ? null : id),
        gymPokemonCooldowns: newGymPokemonCooldowns,
        dayBattleTeams: state.dayBattleTeams.map(t => t.map(id => id === action.pokemonId ? null : id)),
      };
    }

    case 'SELL_BULK': {
      const idSet      = new Set(action.pokemonIds);
      const soldPokemon = state.inventory.filter(p => idSet.has(p.instanceId));
      const totalCoins = soldPokemon.reduce((sum, p) => sum + calculateSellPrice(p), 0);
      const totalFragBonus = soldPokemon.reduce((sum, p) => {
        const base = SELL_ENHANCE_BONUS[p.enhanceLevel] ?? 0;
        const isArc = p.pokemonId === 493;
        const legendary = isArc ? 5000 : (p.rarity === 4 && p.enhanceLevel >= 15 ? (Math.floor(Math.random() * 1901) + 100) : 0);
        return sum + base + legendary;
      }, 0);
      const newGymPokemonCooldowns2 = Object.fromEntries(
        Object.entries(state.gymPokemonCooldowns).filter(([k]) => !idSet.has(k))
      );
      return {
        ...state,
        coins: state.coins + totalCoins,
        fragments: state.fragments + totalFragBonus,
        inventory: state.inventory.filter(p => !idSet.has(p.instanceId)),
        enhancingPokemonId:   idSet.has(state.enhancingPokemonId)   ? null : state.enhancingPokemonId,
        gymSelectedPokemonId: idSet.has(state.gymSelectedPokemonId) ? null : state.gymSelectedPokemonId,
        battleTeam: state.battleTeam.map(id => idSet.has(id) ? null : id),
        gymTeam: state.gymTeam.map(id => idSet.has(id) ? null : id),
        gymPokemonCooldowns: newGymPokemonCooldowns2,
        dayBattleTeams: state.dayBattleTeams.map(t => t.map(id => idSet.has(id) ? null : id)),
      };
    }

    case 'SET_GYM_MAP':
      return { ...state, gymMap: action.mapId };

    case 'SELECT_GYM_POKEMON':
      return { ...state, gymSelectedPokemonId: action.pokemonId };

    case 'GYM_BATTLE_RESOLVE': {
      const { won, coinReward } = action;
      const gymCfg = GYM_CONFIG[state.gymMap];
      // 포켓몬 일일 쿨다운: 오늘 자정까지
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return {
        ...state,
        coins: state.coins + coinReward,
        gymCooldowns: { ...state.gymCooldowns, [state.gymMap]: Date.now() + gymCfg.cooldown },
        gymPokemonCooldowns: {
          ...state.gymPokemonCooldowns,
          [state.gymSelectedPokemonId]: tomorrow.getTime(),
        },
        totalBattles: state.totalBattles + 1,
        totalWins: won ? state.totalWins + 1 : state.totalWins,
      };
    }

    case 'CLEAR_GYM_RESULT':
      return { ...state, gymBattleResult: null };

    case 'RESET_COINS':
      return { ...state, coins: INITIAL_STATE.coins };

    case 'CLAIM_POKEDEX_REWARD': {
      // legacy (하위호환 — 구버전 클라이언트 대응용, 실제로는 CLAIM_POKEDEX1_REWARD 사용)
      const totalPokemon = Object.keys(POKEMON_NAMES).length;
      if (state.pokedex.length < totalPokemon || state.pokedexRewarded) return state;
      return { ...state, fragments: state.fragments + 10000, pokedexRewarded: true };
    }

    case 'CLAIM_POKEDEX1_HALF_REWARD': {
      // 1세대 80마리 → 💎 파편 5,000개
      if (state.pokedex1HalfRewarded) return state;
      const caught1h = new Set(state.pokedex);
      const gen1HalfCount = GEN1_IDS.filter(id => caught1h.has(id)).length;
      if (gen1HalfCount < 80) return state;
      return { ...state, fragments: state.fragments + 5000, pokedex1HalfRewarded: true };
    }

    case 'CLAIM_POKEDEX1_REWARD': {
      // 1세대 완성(151마리) → 💎 파편 10,000개
      if (state.pokedex1Rewarded) return state;
      const caught1 = new Set(state.pokedex);
      const gen1Complete = GEN1_IDS.every(id => caught1.has(id));
      if (!gen1Complete) return state;
      return { ...state, fragments: state.fragments + 10000, pokedex1Rewarded: true };
    }

    case 'CLAIM_POKEDEX2_HALF_REWARD': {
      // 2세대 50마리 → 랜덤 18강 ★3 포켓몬
      if (state.pokedex2HalfRewarded) return state;
      const caught2h = new Set(state.pokedex);
      const gen2HalfCount = GEN2_IDS.filter(id => caught2h.has(id)).length;
      if (gen2HalfCount < 50) return state;
      const rarity3Pool = ALL_POKEMON_BY_RARITY[3];
      const rewardId2h = rarity3Pool[Math.floor(Math.random() * rarity3Pool.length)];
      const rewardPokemon2h = {
        ...createPokemonInstance(rewardId2h, 3),
        sizeGrade: 'S',
        enhanceLevel: 18,
      };
      return {
        ...state,
        inventory: [...state.inventory, rewardPokemon2h],
        pokedex: caught2h.has(rewardId2h) ? state.pokedex : [...state.pokedex, rewardId2h],
        pokedex2HalfRewarded: true,
      };
    }

    case 'CLAIM_POKEDEX2_REWARD': {
      // 2세대 완성(100마리) → 랜덤 15강 S급 ★4 포켓몬
      if (state.pokedex2Rewarded) return state;
      const caught2 = new Set(state.pokedex);
      const gen2Complete = GEN2_IDS.every(id => caught2.has(id));
      if (!gen2Complete) return state;
      const rarity4Pool = ALL_POKEMON_BY_RARITY[4];
      const rewardId = rarity4Pool[Math.floor(Math.random() * rarity4Pool.length)];
      const rewardPokemon = {
        ...createPokemonInstance(rewardId, 4),
        sizeGrade: 'S',
        enhanceLevel: 15,
      };
      return {
        ...state,
        inventory: [...state.inventory, rewardPokemon],
        pokedex: caught2.has(rewardId) ? state.pokedex : [...state.pokedex, rewardId],
        pokedex2Rewarded: true,
      };
    }

    case 'CLAIM_SHINY_HALF_REWARD': {
      // 1~3성 이로치 절반 → 이로치 뮤츠(★4) 지급
      if (state.shinyPokedexHalfRewarded) return state;
      const shinyTarget = SHINY_TARGET_IDS;
      if ((state.shinyPokedex || []).filter(id => shinyTarget.has(id)).length < Math.ceil(shinyTarget.size / 2)) return state;
      const mewtwo = { ...createPokemonInstance(150, 4), sizeGrade: 'S', enhanceLevel: 0, isShiny: true };
      return {
        ...state,
        inventory: [...state.inventory, mewtwo],
        pokedex: state.pokedex.includes(150) ? state.pokedex : [...state.pokedex, 150],
        shinyPokedex: (state.shinyPokedex || []).includes(150) ? state.shinyPokedex : [...(state.shinyPokedex || []), 150],
        shinyPokedexHalfRewarded: true,
      };
    }

    case 'CLAIM_SHINY_FULL_REWARD': {
      // 1~3성 이로치 완성 → 이로치 아르세우스(★5) 지급
      if (state.shinyPokedexRewarded) return state;
      const shinyTargetFull = SHINY_TARGET_IDS;
      if ((state.shinyPokedex || []).filter(id => shinyTargetFull.has(id)).length < shinyTargetFull.size) return state;
      const arceus = { ...createPokemonInstance(493, 5), sizeGrade: 'S', enhanceLevel: 0, isShiny: true };
      return {
        ...state,
        inventory: [...state.inventory, arceus],
        pokedex: state.pokedex.includes(493) ? state.pokedex : [...state.pokedex, 493],
        shinyPokedexRewarded: true,
      };
    }

    case 'CLAIM_COINS': {
      const now = Date.now();
      if (now - state.lastCoinClaim < 3600000) return state;
      return { ...state, coins: state.coins + 10000, lastCoinClaim: now };
    }

    case 'RESET_GAME':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

const VALID_SCREENS = new Set(['main', 'capture', 'inventory', 'enhancement', 'gym', 'battle', 'pokedex']);

// ── 세션 저장 (accountId만 로컬에 — 게임 데이터는 Supabase) ──
function getStoredSession() {
  try { return JSON.parse(localStorage.getItem('pokemonGacha_session') || 'null'); }
  catch { return null; }
}
function setStoredSession(session) {
  localStorage.setItem('pokemonGacha_session', JSON.stringify(session));
}

// ── 로컬 게임 상태 백업 (새로고침/탭 닫기 대비) ──
function saveStateLocal(accountId, state) {
  try {
    const savedAt = Date.now();
    localStorage.setItem(
      `pokemonGacha_state_${accountId}`,
      JSON.stringify({ state: { ...state, _savedAt: savedAt }, savedAt })
    );
  } catch {}
}
function loadStateLocal(accountId) {
  try {
    const raw = localStorage.getItem(`pokemonGacha_state_${accountId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed; // { state, savedAt }
  } catch { return null; }
}
function clearStoredSession() {
  localStorage.removeItem('pokemonGacha_session');
}

function getLocalToken(accountId) {
  return localStorage.getItem(`pokemonGacha_token_${accountId}`);
}
function setLocalToken(accountId, token) {
  localStorage.setItem(`pokemonGacha_token_${accountId}`, token);
}
function genToken() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ── 루트 — 로딩 → 로그인 → 게임 ──────────────────────────
export default function App() {
  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState(null);
  const [kickedOut, setKickedOut] = useState(false);

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) { setPhase('login'); return; }

    const load = async () => {
      try {
        const gameState = await loadGameState(stored.accountId);
        const finalState = gameState ?? loadStateLocal(stored.accountId)?.state;
        // 새 토큰 발급 — 이 기기가 활성 세션 점유
        const token = genToken();
        setLocalToken(stored.accountId, token);
        await setSessionToken(stored.accountId, token);
        setSession({ ...stored, initialState: finalState });
        setPhase('game');
      } catch {
        const local = loadStateLocal(stored.accountId);
        if (local?.state) {
          setSession({ ...stored, initialState: local.state });
          setPhase('game');
        } else {
          clearStoredSession();
          setPhase('login');
        }
      }
    };
    setTimeout(load, 300);
  }, []);

  function handleLogin({ accountId, nickname }) {
    const s = { accountId, nickname };
    setStoredSession(s);
    loadGameState(accountId).then(async gameState => {
      const finalState = gameState ?? loadStateLocal(accountId)?.state;
      const token = genToken();
      setLocalToken(accountId, token);
      await setSessionToken(accountId, token);
      setSession({ ...s, initialState: finalState });
      setPhase('game');
    });
  }

  function handleLogout(kicked = false) {
    clearStoredSession();
    setSession(null);
    setKickedOut(kicked);
    setPhase('login');
  }

  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'login')   return <LoginScreen onLogin={handleLogin} kickedOut={kickedOut} />;

  return (
    <ErrorBoundary>
      <GameApp
        key={session.accountId}
        accountId={session.accountId}
        nickname={session.nickname}
        initialState={session.initialState}
        onLogout={handleLogout}
      />
    </ErrorBoundary>
  );
}

// ── 게임 본체 ──────────────────────────────────────────────
function GameApp({ accountId, nickname, initialState, onLogout }) {
  const merged = { ...INITIAL_STATE, ...(initialState || {}) };
  const safeState = {
    ...merged,
    coins:     typeof merged.coins     === 'number' ? merged.coins     : INITIAL_STATE.coins,
    fragments: typeof merged.fragments === 'number' ? merged.fragments : INITIAL_STATE.fragments,
    // 포획 화면은 세션 복원 시 항상 메인으로 리셋 (wildPokemon 무한 포획 버그 방지)
    screen: merged.screen === 'capture' ? 'main' : (VALID_SCREENS.has(merged.screen) ? merged.screen : 'main'),
    wildPokemon: null,
    captureResult: null,
    captureFailStreak: 0,
    // 구버전 pokedexRewarded → pokedex1Rewarded 마이그레이션
    pokedex1HalfRewarded: merged.pokedex1HalfRewarded || false,
    pokedex1Rewarded: merged.pokedex1Rewarded || merged.pokedexRewarded || false,
    pokedex2HalfRewarded: merged.pokedex2HalfRewarded || false,
    // 구버전 battlePokemonId → battleTeam 마이그레이션
    battleTeam: Array.isArray(merged.battleTeam) ? merged.battleTeam : [null, null, null],
    // gymTeam 마이그레이션
    gymTeam: Array.isArray(merged.gymTeam) ? merged.gymTeam : [null, null, null],
    // gymCooldowns: 구버전(instanceId 기반) → 신버전(gymMap 기반) 마이그레이션
    gymCooldowns: Object.keys(merged.gymCooldowns || {}).some(k => !GYM_CONFIG[k])
      ? {}
      : (merged.gymCooldowns || {}),
    gymPokemonCooldowns: merged.gymPokemonCooldowns || {},
  };

  const [state, dispatch] = useReducer(gameReducer, safeState);
  const isFirstRender = useRef(true);
  const stateRef      = useRef(state);
  const hasChanged    = useRef(false);
  stateRef.current = state;

  // dispatch 래핑: reducer를 직접 실행해 stateRef를 React 리렌더 전에 동기 업데이트
  // → pagehide가 dispatch와 리렌더 사이에 발생해도 최신 state로 저장 가능
  const wrappedDispatch = useCallback((action) => {
    stateRef.current = gameReducer(stateRef.current, action);
    hasChanged.current = true;
    dispatch(action);
  }, []);

  // 30초마다 세션 토큰 검증 — 다른 기기 로그인 시 강제 로그아웃
  useEffect(() => {
    const check = async () => {
      const dbToken    = await getSessionToken(accountId).catch(() => null);
      const localToken = getLocalToken(accountId);
      if (dbToken && localToken && dbToken !== localToken) {
        onLogout(true);
      }
    };
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [accountId, onLogout]);

  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'ok' | 'fail'
  const saveStatusTimer = useRef(null);

  // 상태 변경 시 localStorage + Supabase 즉시 저장 (첫 마운트 스킵)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveStateLocal(accountId, state);
    setSaveStatus('saving');
    clearTimeout(saveStatusTimer.current);
    saveGameState(accountId, { nickname, ...state, _savedAt: Date.now() })
      .then(() => {
        setSaveStatus('ok');
        saveStatusTimer.current = setTimeout(() => setSaveStatus(null), 2000);
      })
      .catch(() => {
        setSaveStatus('fail');
        saveStatusTimer.current = setTimeout(() => setSaveStatus(null), 3000);
      });
  }, [state, accountId]);

  // 탭 닫기 / 앱 전환 시 — stateRef로 항상 최신 state 저장 (useEffect 타이밍 무관)
  useEffect(() => {
    const flush = () => {
      if (!hasChanged.current) return;
      const s = stateRef.current;
      saveStateLocal(accountId, s);
      saveGameStateOnUnload(accountId, { nickname, ...s, _savedAt: Date.now() });
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    return () => window.removeEventListener('pagehide', flush);
  }, [accountId, nickname]);

  function saveNow(latestState) {
    const s = latestState ?? state;
    saveGameState(accountId, { nickname, ...s, _savedAt: Date.now() });
  }

  const screens = {
    main:        <MainScreen />,
    capture:     <CaptureScreen />,
    inventory:   <InventoryScreen />,
    enhancement: <EnhancementScreen />,
    gym:         <GymScreen />,
    battle:      <BattleScreen />,
    pokedex:     <PokedexScreen />,
  };

  return (
    <GameContext.Provider value={{ state, dispatch: wrappedDispatch, nickname, accountId, onLogout, saveNow }}>
      <div className="app">
        <HUD />
        {saveStatus && (
          <div style={{
            position: 'fixed', bottom: 8, right: 8, zIndex: 9999,
            padding: '4px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800,
            background: saveStatus === 'saving' ? 'rgba(99,102,241,0.9)'
              : saveStatus === 'ok'   ? 'rgba(76,175,80,0.9)'
              : 'rgba(239,83,80,0.9)',
            color: '#fff', letterSpacing: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {saveStatus === 'saving' ? '💾 저장 중...' : saveStatus === 'ok' ? '✅ 저장됨' : '❌ 저장 실패'}
          </div>
        )}
        <div className="screen-container">
          {screens[state.screen] || <MainScreen />}
        </div>
      </div>
    </GameContext.Provider>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 16,
    }}>
      <div style={{ fontSize: '3rem' }}>🎮</div>
      <div style={{ color: 'var(--text2)', fontSize: '0.9rem', animation: 'pulse 1s ease infinite alternate' }}>
        로딩 중...
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#ef5350', background: '#0a0010', minHeight: '100vh' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 12 }}>⚠️ 렌더링 오류</div>
          <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: '#ff8a80' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
            재시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
