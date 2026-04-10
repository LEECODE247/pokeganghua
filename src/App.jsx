import React, { useReducer, useEffect, useState, useRef, createContext, useContext } from 'react';
import { generateWildPokemon, calculateSellPrice, getEnhanceRate, getEnhanceFailEffect, getEnhanceCost } from './utils/gameUtils.js';
import { BALL_CONFIG } from './data/pokemonData.js';
import { loadGameState, saveGameState } from './supabase.js';
import HUD from './components/HUD.jsx';
import MainScreen from './components/MainScreen.jsx';
import CaptureScreen from './components/CaptureScreen.jsx';
import InventoryScreen from './components/InventoryScreen.jsx';
import EnhancementScreen from './components/EnhancementScreen.jsx';
import GymScreen from './components/GymScreen.jsx';
import BattleScreen from './components/BattleScreen.jsx';
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
  battlePokemonId: null,
  gymMap: 'forest',
  gymSelectedPokemonId: null,
  gymBattleResult: null,
  gymCooldowns: {},
  totalCaptured: 0,
  totalEnhanced: 0,
  totalBattles: 0,
  totalWins: 0,
  lastCoinClaim: 0,
  dailyBattleCount: 0,
  battleResetDate: '',
};

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
      const { ballType } = action;
      const ballCfg = BALL_CONFIG[ballType];
      if (!ballCfg || state.coins < ballCfg.cost || !state.wildPokemon) return state;

      const baseRate  = ballCfg.rates[state.wildPokemon.rarity] || 0;
      const catchRate = Math.min(1, baseRate + state.captureFailStreak * 0.01);
      const roll      = Math.random();
      const result    = roll < catchRate ? 'success' : roll < catchRate + 0.18 ? 'near-miss' : 'fail';
      const captured  = result === 'success';

      return {
        ...state,
        coins: state.coins - ballCfg.cost,
        captureResult: result,
        captureFailStreak: captured ? 0 : state.captureFailStreak + 1,
        inventory: captured ? [...state.inventory, state.wildPokemon] : state.inventory,
        totalCaptured: captured ? state.totalCaptured + 1 : state.totalCaptured,
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

      if (success) {
        result = 'success';
        newInventory = newInventory.map(p =>
          p.instanceId === pokemon.instanceId ? { ...p, enhanceLevel: p.enhanceLevel + 1 } : p
        );
        newFailStack = 0;
      } else {
        newFailStack++;
        const failEffect = getEnhanceFailEffect(pokemon.enhanceLevel);
        if (failEffect === 'destroy') {
          if (action.useShield && state.fragments >= 1000) {
            result = 'shielded';
            newFragments -= 1000;
          } else {
            result = 'destroyed';
            newInventory = newInventory.filter(p => p.instanceId !== pokemon.instanceId);
            newFragments += pokemon.enhanceLevel * 15;
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

      return {
        ...state,
        coins: state.coins - cost,
        inventory: newInventory,
        fragments: newFragments,
        enhanceResult: result,
        enhanceFailStack: newFailStack,
        enhancingPokemonId: result === 'destroyed' ? null : state.enhancingPokemonId,
        totalEnhanced: state.totalEnhanced + 1,
      };
    }

    case 'CLEAR_ENHANCE_RESULT':
      return { ...state, enhanceResult: null };

    case 'REGISTER_BATTLE_POKEMON':
      return { ...state, battlePokemonId: action.pokemonId };

    case 'BATTLE_WIN': {
      const today = new Date().toDateString();
      const prevCount = state.battleResetDate === today ? state.dailyBattleCount : 0;
      return {
        ...state,
        coins: state.coins + action.coins,
        totalBattles: state.totalBattles + 1,
        totalWins: state.totalWins + 1,
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
        dailyBattleCount: prevCount + 1,
        battleResetDate: today,
      };
    }

    case 'SELL_POKEMON': {
      const pokemon = state.inventory.find(p => p.instanceId === action.pokemonId);
      if (!pokemon) return state;
      return {
        ...state,
        coins: state.coins + calculateSellPrice(pokemon),
        inventory: state.inventory.filter(p => p.instanceId !== action.pokemonId),
        enhancingPokemonId:   state.enhancingPokemonId   === action.pokemonId ? null : state.enhancingPokemonId,
        gymSelectedPokemonId: state.gymSelectedPokemonId === action.pokemonId ? null : state.gymSelectedPokemonId,
        battlePokemonId:      state.battlePokemonId      === action.pokemonId ? null : state.battlePokemonId,
      };
    }

    case 'SELL_BULK': {
      const idSet      = new Set(action.pokemonIds);
      const totalCoins = state.inventory
        .filter(p => idSet.has(p.instanceId))
        .reduce((sum, p) => sum + calculateSellPrice(p), 0);
      return {
        ...state,
        coins: state.coins + totalCoins,
        inventory: state.inventory.filter(p => !idSet.has(p.instanceId)),
        enhancingPokemonId:   idSet.has(state.enhancingPokemonId)   ? null : state.enhancingPokemonId,
        gymSelectedPokemonId: idSet.has(state.gymSelectedPokemonId) ? null : state.gymSelectedPokemonId,
        battlePokemonId:      idSet.has(state.battlePokemonId)      ? null : state.battlePokemonId,
      };
    }

    case 'SET_GYM_MAP':
      return { ...state, gymMap: action.mapId, gymBattleResult: null };

    case 'SELECT_GYM_POKEMON':
      return { ...state, gymSelectedPokemonId: action.pokemonId, gymBattleResult: null };

    case 'GYM_BATTLE_RESOLVE': {
      const { playerPower, gymPower, gymReward } = action;
      const winChance = Math.min(0.95, Math.max(0.25, (playerPower / gymPower) * 0.55));
      const won       = Math.random() < winChance;
      const reward    = won ? gymReward : Math.floor(gymReward * 0.05);
      return {
        ...state,
        coins: state.coins + reward,
        gymBattleResult: { won, reward, winChance: Math.round(winChance * 100) },
        gymCooldowns: { ...state.gymCooldowns, [state.gymSelectedPokemonId]: Date.now() + 3600000 },
        totalBattles: state.totalBattles + 1,
        totalWins: won ? state.totalWins + 1 : state.totalWins,
      };
    }

    case 'CLEAR_GYM_RESULT':
      return { ...state, gymBattleResult: null };

    case 'RESET_COINS':
      return { ...state, coins: INITIAL_STATE.coins };

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

const VALID_SCREENS = new Set(['main', 'capture', 'inventory', 'enhancement', 'gym', 'battle']);

// ── 세션 저장 (accountId만 로컬에 — 게임 데이터는 Supabase) ──
function getStoredSession() {
  try { return JSON.parse(localStorage.getItem('pokemonGacha_session') || 'null'); }
  catch { return null; }
}
function setStoredSession(session) {
  localStorage.setItem('pokemonGacha_session', JSON.stringify(session));
}
function clearStoredSession() {
  localStorage.removeItem('pokemonGacha_session');
}

// ── 루트 — 로딩 → 로그인 → 게임 ──────────────────────────
export default function App() {
  // phase: 'loading' | 'login' | 'game'
  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState(null); // { accountId, nickname, initialState }

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) { setPhase('login'); return; }

    // 저장된 세션으로 게임 상태 복원
    loadGameState(stored.accountId)
      .then(gameState => {
        setSession({ ...stored, initialState: gameState });
        setPhase('game');
      })
      .catch(() => {
        clearStoredSession();
        setPhase('login');
      });
  }, []);

  function handleLogin({ accountId, nickname }) {
    const s = { accountId, nickname };
    setStoredSession(s);
    // 로그인 시 게임 상태를 Supabase에서 불러옴
    loadGameState(accountId).then(gameState => {
      setSession({ ...s, initialState: gameState });
      setPhase('game');
    });
  }

  function handleLogout() {
    clearStoredSession();
    setSession(null);
    setPhase('login');
  }

  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'login')   return <LoginScreen onLogin={handleLogin} />;

  return (
    <GameApp
      key={session.accountId}
      accountId={session.accountId}
      nickname={session.nickname}
      initialState={session.initialState}
      onLogout={handleLogout}
    />
  );
}

// ── 게임 본체 ──────────────────────────────────────────────
function GameApp({ accountId, nickname, initialState, onLogout }) {
  const merged = { ...INITIAL_STATE, ...(initialState || {}) };
  const safeState = VALID_SCREENS.has(merged.screen) ? merged : { ...merged, screen: 'main' };

  const [state, dispatch] = useReducer(gameReducer, safeState);
  const saveTimer = useRef(null);

  // 상태 변경 시 3초 디바운스로 Supabase 저장
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveGameState(accountId, state);
    }, 3000);
    return () => clearTimeout(saveTimer.current);
  }, [state, accountId]);

  // 탭/창 닫기 전 즉시 저장
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      saveGameState(accountId, state);
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [state, accountId]);

  function saveNow(latestState) {
    clearTimeout(saveTimer.current);
    saveGameState(accountId, latestState ?? state);
  }

  const screens = {
    main:        <MainScreen />,
    capture:     <CaptureScreen />,
    inventory:   <InventoryScreen />,
    enhancement: <EnhancementScreen />,
    gym:         <GymScreen />,
    battle:      <BattleScreen />,
  };

  return (
    <GameContext.Provider value={{ state, dispatch, nickname, accountId, onLogout, saveNow }}>
      <div className="app">
        <HUD />
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
