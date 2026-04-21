import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../App.jsx';
import { GYM_CONFIG, POKEMON_TYPE, POKEMON_TYPES, TYPE_MOVES } from '../data/pokemonData.js';
import {
  getPokemonImageUrl, getPokemonName, getRarityColor,
  calculatePower, formatCoins, formatCooldown, getTypeAdvantage,
} from '../utils/gameUtils.js';

/* ── 체육관 관장 대표 포켓몬 ──────────────────────────────── */
const GYM_LEADER_POKEMON = {
  forest:  3,   // 이상해꽃
  river:   9,   // 거북왕
  cave:    76,  // 딱구리
  sky:     6,   // 리자몽
  glacier: 131, // 라프라스
  storm:   150, // 뮤츠
  abyss:   249, // 루기아
  myth:    493, // 아르세우스
};

/* ── 체육관 테마 ──────────────────────────────────────────── */
const GYM_THEME = {
  forest:  { bg: 'linear-gradient(170deg,#071a07 0%,#03100a 100%)', color: '#66bb6a', glow: 'rgba(102,187,106,0.9)',  projClass: 'proj-grass'    },
  river:   { bg: 'linear-gradient(170deg,#04152a 0%,#020a18 100%)', color: '#42a5f5', glow: 'rgba(66,165,245,0.9)',  projClass: 'proj-water'    },
  cave:    { bg: 'linear-gradient(170deg,#130e06 0%,#0a0803 100%)', color: '#bcaaa4', glow: 'rgba(188,170,164,0.9)', projClass: 'proj-rock'     },
  sky:     { bg: 'linear-gradient(170deg,#1f0606 0%,#0f0303 100%)', color: '#ef5350', glow: 'rgba(239,83,80,0.9)',   projClass: 'proj-fire'     },
  glacier: { bg: 'linear-gradient(170deg,#031520 0%,#010a12 100%)', color: '#00e5ff', glow: 'rgba(0,229,255,0.9)',   projClass: 'proj-ice'      },
  storm:   { bg: 'linear-gradient(170deg,#1a1500 0%,#0d0a00 100%)', color: '#ffd600', glow: 'rgba(255,214,0,0.9)',   projClass: 'proj-electric' },
  abyss:   { bg: 'linear-gradient(170deg,#0f0018 0%,#06000d 100%)', color: '#e040fb', glow: 'rgba(224,64,251,0.9)', projClass: 'proj-psychic'  },
  myth:    { bg: 'linear-gradient(170deg,#1a0a00 0%,#0d0500 100%)', color: '#FF8C00', glow: 'rgba(255,140,0,0.95)',  projClass: 'proj-myth'     },
};

/* ── 관장 기술 풀 ──────────────────────────────────────────── */
const OPP_MOVES = {
  forest:  ['🌱 씨뿌리기', '☠️ 독가루', '🌿 체력흡수', '🍃 잎날가르기'],
  river:   ['🌊 파도타기', '💦 거품광선', '🌀 하이드로펌프', '💧 물대포'],
  cave:    ['⛰️ 대지의힘', '💪 구르기', '🪨 스텔스록', '💥 폭발'],
  sky:     ['🔥 화염방사', '💨 폭풍', '🌪️ 열풍', '🐲 드래곤클로'],
  glacier: ['❄️ 빙산', '🌨️ 눈의세례', '🧊 냉동펀치', '💎 다이아몬드스톰'],
  storm:   ['⚡ 전자포', '🌩️ 번개', '💥 폭발', '🌩️ 역할교대'],
  abyss:   ['🌑 달의빛', '🌊 조수', '💜 사이코노이즈', '🌑 섀도볼'],
  myth:    ['🔱 창세의빛', '✨ 신판', '⚡ 아르세우스의분노', '🌟 신의분노'],
};

const hpColor = hp => hp > 50 ? '#4caf50' : hp > 20 ? '#ffd600' : '#ef5350';

function HpBox({ name, hp, right }) {
  return (
    <div className={`bov-hpbox-v2${right ? ' bov-hpbox-v2-my' : ''}`}>
      <div className="bov-hp-name">{name}</div>
      <div className="bov-hp-row">
        {right && <span className="bov-hp-val" style={{ color: hpColor(hp) }}>{hp}</span>}
        {right && <div className="bov-hp-bar-track">
          <div className="bov-hp-bar-fill" style={{ width: `${hp}%`, background: hpColor(hp), boxShadow: `0 0 8px ${hpColor(hp)}` }} />
        </div>}
        {!right && <div className="bov-hp-bar-track">
          <div className="bov-hp-bar-fill" style={{ width: `${hp}%`, background: hpColor(hp), boxShadow: `0 0 8px ${hpColor(hp)}` }} />
        </div>}
        {!right && <span className="bov-hp-val" style={{ color: hpColor(hp) }}>{hp}</span>}
        <span className="bov-hp-tag">HP</span>
      </div>
    </div>
  );
}

/* ══════════════════ 메인 컴포넌트 ══════════════════════════ */
export default function GymScreen() {
  const { state, dispatch, saveNow } = useGame();
  const { gymMap, gymCooldowns, gymPokemonCooldowns, gymSelectedPokemonId, inventory } = state;

  const [gymAnim, setGymAnim]     = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [battling, setBattling]   = useState(false);
  const [now, setNow]             = useState(Date.now());
  const timers   = useRef([]);
  const pendingRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 배틀 완료 즉시 저장 — 새로고침으로 쿨다운 우회 방지
  const prevPokemonCooldowns = useRef(state.gymPokemonCooldowns);
  useEffect(() => {
    if (state.gymPokemonCooldowns !== prevPokemonCooldowns.current) {
      prevPokemonCooldowns.current = state.gymPokemonCooldowns;
      saveNow();
    }
  }, [state.gymPokemonCooldowns]);

  const gym             = GYM_CONFIG[gymMap];
  const theme           = GYM_THEME[gymMap];
  const oppId           = GYM_LEADER_POKEMON[gymMap];
  const selectedPokemon = inventory.find(p => p.instanceId === gymSelectedPokemonId);
  const playerPower     = selectedPokemon ? calculatePower(selectedPokemon) : 0;
  const canEnter        = playerPower >= gym.requiredPower;

  const cooldownEnd       = gymCooldowns[gymMap] || 0;
  const cooldownRemaining = Math.max(0, cooldownEnd - now);
  const onCooldown        = cooldownRemaining > 0;

  // 포켓몬별 일일 쿨다운
  const pokemonCooldownEnd       = selectedPokemon ? (gymPokemonCooldowns[selectedPokemon.instanceId] || 0) : 0;
  const pokemonCooldownRemaining = Math.max(0, pokemonCooldownEnd - now);
  const pokemonOnCooldown        = pokemonCooldownRemaining > 0;

  // 타입 상성
  const myTypes  = selectedPokemon ? (POKEMON_TYPES[selectedPokemon.pokemonId] || ['normal']) : ['normal'];
  const oppTypes = POKEMON_TYPES[oppId] || ['normal'];
  const typeAdv  = selectedPokemon ? getTypeAdvantage(myTypes, oppTypes) : { multiplier: 1, label: null };
  const effectivePower = playerPower * typeAdv.multiplier;

  // 승률 (기본 + 상성 적용)
  const minWin = gym.minWinChance ?? 25;
  const maxWin = gym.maxWinChance ?? 95;
  let baseWinChance, winChance;
  if (!canEnter) {
    baseWinChance = winChance = 0;
  } else if (gymMap === 'myth') {
    baseWinChance = Math.max(5, 5 + Math.floor((playerPower    - 3_500_000) / 500_000) * 5);
    winChance     = Math.max(5, 5 + Math.floor((effectivePower - 3_500_000) / 500_000) * 5);
  } else {
    baseWinChance = Math.min(maxWin, Math.max(minWin, Math.round((playerPower    / gym.gymPower) * 55)));
    winChance     = Math.min(maxWin, Math.max(minWin, Math.round((effectivePower / gym.gymPower) * 55)));
  }
  const winDelta = winChance - baseWinChance;

  /* ── 스킵 ──────────────────────────────────────────────── */
  function skipBattle() {
    if (!battling || !pendingRef.current) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const { won, coinReward } = pendingRef.current;
    setGymAnim(null);
    dispatch({ type: 'GYM_BATTLE_RESOLVE', won, coinReward });
    setMatchResult({ won, coinReward });
    setBattling(false);
    pendingRef.current = null;
  }

  /* ── 배틀 시작 ──────────────────────────────────────────── */
  function startBattle() {
    if (!canEnter || onCooldown || pokemonOnCooldown || battling || !selectedPokemon) return;
    setBattling(true);
    setMatchResult(null);

    const won        = Math.random() * 100 < winChance;
    const coinReward = won ? gym.reward : Math.floor(gym.reward * 0.05);
    pendingRef.current = { won, coinReward };

    const myType  = POKEMON_TYPE[selectedPokemon.pokemonId] ?? 'normal';
    const myPool  = TYPE_MOVES[myType]  ?? TYPE_MOVES.normal;
    const oppType = POKEMON_TYPE[oppId] ?? 'normal';
    const oppPool = TYPE_MOVES[oppType] ?? TYPE_MOVES.normal;
    const moves   = [
      myPool[Math.floor(Math.random() * myPool.length)],
      oppPool[Math.floor(Math.random() * oppPool.length)],
      myPool[Math.floor(Math.random() * myPool.length)],
    ];

    const ratio    = playerPower / gym.gymPower;
    const oppHp1   = won ? Math.max(22, Math.round(72 - ratio * 45))     : Math.max(55, Math.round(88 - ratio * 28));
    const myHp1    = won ? Math.max(45, Math.round(85 - (1/ratio) * 22)) : Math.max(12, Math.round(62 - (1/ratio) * 30));
    const oppHpFin = won ? 0 : oppHp1;
    const myHpFin  = won ? myHp1 : 0;

    const add = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

    setGymAnim({ step: 0, myHp: 100, oppHp: 100, moveName: null, won, typeAdvLabel: typeAdv.label });
    add(() => setGymAnim(f => ({ ...f, step: 1, moveName: moves[0] })),                     600);
    add(() => setGymAnim(f => ({ ...f, step: 2, oppHp: oppHp1 })),                         1150);
    add(() => setGymAnim(f => ({ ...f, step: 3, moveName: moves[1] })),                    2000);
    add(() => setGymAnim(f => ({ ...f, step: 4, myHp: myHp1 })),                           2550);
    add(() => setGymAnim(f => ({ ...f, step: 5, moveName: moves[2] })),                    3400);
    add(() => setGymAnim(f => ({ ...f, step: 6, oppHp: oppHpFin, myHp: myHpFin })),       3950);
    add(() => setGymAnim(f => ({ ...f, step: 7 })),                                        4700);
    add(() => {
      setGymAnim(null);
      dispatch({ type: 'GYM_BATTLE_RESOLVE', won, coinReward });
      setMatchResult({ won, coinReward });
      setBattling(false);
      timers.current = [];
      pendingRef.current = null;
    }, 6300);
  }

  /* ════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div>
      {/* 체육관 탭 */}
      <div className="gym-tabs">
        {Object.entries(GYM_CONFIG).map(([mapId, g]) => (
          <button
            key={mapId}
            className={`gym-tab${gymMap === mapId ? ' active' : ''}`}
            onClick={() => { dispatch({ type: 'SET_GYM_MAP', mapId }); setMatchResult(null); }}
          >
            {g.icon} {g.name.replace(' 체육관', '')}
          </button>
        ))}
      </div>

      {/* 체육관 정보 카드 */}
      <div className="gym-info-card">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{gym.name}</div>
            <div className="gym-difficulty" style={{ color: gym.difficultyColor }}>{gym.difficulty}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem' }}>🪙 {formatCoins(gym.reward)}</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>승리 보상 · 패배 {formatCoins(Math.floor(gym.reward * 0.05))}</div>
          </div>
        </div>

        {/* 관장 포켓몬 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
          background: `linear-gradient(135deg, ${theme.color}11 0%, transparent 100%)`,
          border: `1px solid ${theme.color}22`, borderRadius: 10, padding: '8px 12px' }}>
          <img src={getPokemonImageUrl(oppId)}
            style={{ width: 52, height: 52, imageRendering: 'pixelated', objectFit: 'contain',
              filter: `drop-shadow(0 0 8px ${theme.glow})` }} alt="" />
          <div>
            <div style={{ fontSize: '0.72rem', color: theme.color, fontWeight: 800, letterSpacing: 1 }}>관장 포켓몬</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>{getPokemonName(oppId)}</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              ⚡{gym.gymPower.toLocaleString()} 전투력
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* 전투력 비교 */}
        <div className="gym-power-compare">
          <div className="power-block player">
            <div className="power-block-val" style={{ color: canEnter ? (typeAdv.multiplier > 1 ? '#ffd600' : typeAdv.multiplier < 1 ? 'var(--fail)' : 'var(--blue)') : 'var(--fail)' }}>
              ⚡{effectivePower.toLocaleString()}
            </div>
            {typeAdv.multiplier !== 1 && (
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', textAlign: 'center' }}>
                {playerPower.toLocaleString()}
              </div>
            )}
            <div className="power-block-label">내 전투력</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text2)', fontSize: '1.5rem' }}>vs</div>
          <div className="power-block gym">
            <div className="power-block-val" style={{ color: 'var(--fail)' }}>⚡{gym.requiredPower.toLocaleString()}</div>
            <div className="power-block-label">필요 전투력</div>
          </div>
        </div>

        {canEnter && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: typeAdv.label ? 5 : 0 }}>
                <span>승률:</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{winChance}%</span>
                {winDelta !== 0 && (
                  <span style={{ fontSize: '0.65rem', color: winDelta > 0 ? '#4caf50' : '#ef5350', fontWeight: 700 }}>
                    ({winDelta > 0 ? '+' : ''}{winDelta}%)
                  </span>
                )}
              </div>
              {typeAdv.label && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 8,
                  background: typeAdv.multiplier > 1 ? 'rgba(255,214,0,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${typeAdv.multiplier > 1 ? '#ffd60044' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800,
                    color: typeAdv.multiplier > 1 ? '#ffd600' : 'rgba(200,200,255,0.5)',
                  }}>{typeAdv.label}</span>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700,
                    color: typeAdv.multiplier > 1 ? 'rgba(255,214,0,0.7)' : 'rgba(255,255,255,0.3)',
                  }}>
                    전투력 ×{typeAdv.multiplier}
                    {winDelta !== 0 && ` · 승률 ${winDelta > 0 ? '+' : ''}${winDelta}%`}
                  </span>
                </div>
              )}
            </div>
            <div className="win-chance-bar-wrap">
              <div className="win-chance-bar" style={{ width: `${winChance}%` }} />
            </div>
          </>
        )}

        {!canEnter && selectedPokemon && (
          <div style={{ color: 'var(--fail)', fontSize: '0.85rem', textAlign: 'center', padding: '8px 0' }}>
            ⚠️ ⚡{(gym.requiredPower - playerPower).toLocaleString()} 전투력이 더 필요합니다!
          </div>
        )}
        {!selectedPokemon && (
          <div style={{ color: 'var(--text2)', fontSize: '0.85rem', textAlign: 'center', padding: '8px 0' }}>
            아래에서 포켓몬을 선택하세요.
          </div>
        )}

        {/* 배틀 버튼 */}
        <button
          className="btn btn-primary btn-full btn-lg mt-12"
          disabled={!canEnter || !selectedPokemon || onCooldown || pokemonOnCooldown || battling}
          onClick={startBattle}
          style={{ fontSize: '1rem' }}
        >
          {battling ? '⚔️ 배틀 중...'
            : onCooldown ? `⏳ 체육관 재도전까지 (${formatCooldown(cooldownRemaining)})`
            : pokemonOnCooldown ? `😴 포켓몬 오늘 출전 완료 (내일 자정 초기화)`
            : !canEnter ? '🔒 전투력 부족'
            : !selectedPokemon ? '포켓몬을 선택하세요'
            : '⚔️ 체육관 도전!'}
        </button>
        {onCooldown && (
          <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '0.75rem', marginTop: 6 }}>
            체육관 쿨다운: 1시간
          </div>
        )}
        {!onCooldown && pokemonOnCooldown && (
          <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '0.75rem', marginTop: 6 }}>
            이 포켓몬은 오늘 이미 출전했습니다. 다른 포켓몬을 선택하거나 내일 다시 도전하세요.
          </div>
        )}
      </div>

      {/* 포켓몬 선택 */}
      <div className="gym-pokemon-select">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>포켓몬 선택</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>
            😴 포켓몬 1마리당 하루 1회만 출전 가능 · 매일 자정 초기화
          </div>
        </div>
        {inventory.length === 0 ? (
          <div style={{ color: 'var(--text2)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
            가방에 포켓몬이 없습니다!
          </div>
        ) : (
          <div className="gym-pokemon-list pokemon-select-scroll">
            {[...inventory]
              .sort((a, b) => calculatePower(b) - calculatePower(a))
              .map(p => {
                const pwr        = calculatePower(p);
                const isSelected = p.instanceId === gymSelectedPokemonId;
                const meetsPower = pwr >= gym.requiredPower;
                const pCoolEnd   = gymPokemonCooldowns[p.instanceId] || 0;
                const pOnCool    = pCoolEnd > now;
                return (
                  <div
                    key={p.instanceId}
                    className={`gym-pokemon-item${isSelected ? ' selected' : ''}`}
                    onClick={() => dispatch({ type: 'SELECT_GYM_POKEMON', pokemonId: p.instanceId })}
                    title={getPokemonName(p.pokemonId)}
                    style={pOnCool ? { opacity: 0.45, position: 'relative' } : {}}
                  >
                    <img src={getPokemonImageUrl(p.pokemonId)} alt={getPokemonName(p.pokemonId)}
                      className="gym-pokemon-img"
                      style={p.isGolden ? { filter: 'sepia(0.3) brightness(1.4)' } : {}} />
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                      {getPokemonName(p.pokemonId)}
                    </div>
                    <div style={{ color: getRarityColor(p.rarity), fontSize: '0.6rem' }}>{'★'.repeat(p.rarity)}</div>
                    {p.enhanceLevel > 0 && <div style={{ color: 'var(--gold)', fontSize: '0.6rem' }}>+{p.enhanceLevel}</div>}
                    {pOnCool
                      ? <div style={{ color: '#ef5350', fontSize: '0.58rem', fontWeight: 700 }}>😴 출전완료</div>
                      : <div style={{ color: meetsPower ? 'var(--blue)' : 'var(--text2)', fontSize: '0.6rem', fontWeight: 700 }}>
                          ⚡{pwr.toLocaleString()}
                        </div>
                    }
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ════════ 배틀 애니메이션 오버레이 ════════ */}
      {gymAnim && selectedPokemon && (() => {
        const { step, myHp, oppHp, moveName, won, typeAdvLabel } = gymAnim;

        const myAnim  = step === 1 || step === 5 ? 'bmon-charge'
          : step === 2 || step === 6 ? 'bmon-lunge-r'
          : step === 4 ? 'bmon-hit'
          : step === 7 ? (won ? 'bmon-winner' : 'bmon-loser') : '';
        const oppAnim = step === 3 ? 'bmon-charge'
          : step === 4 ? 'bmon-lunge-l'
          : step === 2 || step === 6 ? 'bmon-hit'
          : step === 7 ? (won ? 'bmon-loser' : 'bmon-winner') : '';

        const showProj = step === 2 || step === 4 || step === 6;
        const projDir  = (step === 2 || step === 6) ? 'right' : 'left';
        const myType   = POKEMON_TYPE[selectedPokemon.pokemonId] ?? 'normal';
        const projClass = `proj-${myType === 'myth' ? 'myth' : myType === 'normal' ? 'pvp' : myType}`;

        const isHitStep   = step === 2 || step === 4 || step === 6;
        const impactColor = (step === 2 || step === 6) ? theme.color : '#ef5350';
        const impactTop   = (step === 2 || step === 6) ? '28%' : '62%';
        const impactLeft  = (step === 2 || step === 6) ? '72%' : '28%';

        const bgColor = step < 2 ? theme.bg
          : won ? 'linear-gradient(170deg,#0a1f0a 0%,#030d03 100%)'
          : 'linear-gradient(170deg,#1f0a0a 0%,#0d0303 100%)';

        return (
          <div className="bov" style={{ background: bgColor, cursor: 'pointer' }}
            onClick={skipBattle}>

            {/* 배경 글로우 */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
              background: `radial-gradient(ellipse at 50% 40%, ${theme.glow.replace('0.9','0.08')} 0%, transparent 70%)` }} />

            {/* 흔들림 + 플래시 + 임팩트 */}
            <div className={isHitStep ? 'bov-shaking' : ''}
              key={`shake-${step}`}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {(step === 2 || step === 6) && <div className="bov-flash bov-flash-white" key={`fl-${step}`} />}
              {step === 4 && <div className="bov-flash bov-flash-red" key={`flr-${step}`} />}
              {isHitStep && (
                <div className="bov-impact" key={`imp-${step}`}
                  style={{ top: impactTop, left: impactLeft, color: impactColor }}>
                  <div className="bov-impact-ring" />
                  <div className="bov-impact-ring2" />
                  <div className="bov-impact-core" style={{ background: impactColor, boxShadow: `0 0 30px ${impactColor}` }} />
                  <div className="bov-impact-star" style={{ color: impactColor }} />
                </div>
              )}
            </div>

            {/* 상대 */}
            <div className="bov-opp-row">
              <HpBox name={`${gym.name} 관장`} hp={oppHp} right={false} />
              <img src={getPokemonImageUrl(oppId)}
                className={`bov-mon bov-mon-opp ${oppAnim}`}
                style={{ '--glow': theme.glow }}
                key={`opp-${step}`} alt="" />
            </div>

            {/* 필드 */}
            <div className="bov-field">
              {moveName && step >= 1 && step <= 6 && (
                <div className="bov-move-v2" key={`mv-${step}`}
                  style={{ color: theme.color, textShadow: `0 0 24px ${theme.glow}` }}>
                  {moveName}
                </div>
              )}
              {step === 2 && typeAdvLabel && (
                <div key="gym-tadv" style={{
                  position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
                  fontSize: '0.75rem', fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap',
                  color: typeAdvLabel.includes('좋음') ? '#ffd600' : 'rgba(255,255,255,0.4)',
                  textShadow: typeAdvLabel.includes('좋음') ? '0 0 12px #ffd600' : 'none',
                  animation: 'bov-announce-in 0.25s ease',
                }}>
                  {typeAdvLabel}
                </div>
              )}
              {showProj && (
                <div className={`bov-proj bov-proj-${projDir} ${projClass}`} key={`pj-${step}`} />
              )}
            </div>

            {/* 내 포켓몬 */}
            <div className="bov-my-row">
              <img src={getPokemonImageUrl(selectedPokemon.pokemonId)}
                className={`bov-mon bov-mon-my ${myAnim}`}
                style={{ '--glow': 'rgba(99,102,241,0.9)' }}
                key={`my-${step}`} alt="" />
              <HpBox name={`나의 ${getPokemonName(selectedPokemon.pokemonId)}`} hp={myHp} right={true} />
            </div>

            {/* 결과 (step 7) */}
            {step === 7 && (
              <div className="bov-result" style={{ color: won ? '#4caf50' : '#ef5350' }}>
                <div className="bov-result-text">{won ? '🏆 승리!' : '💀 패배...'}</div>
                {won && <div className="bov-reward">+🪙{formatCoins(gym.reward)}</div>}
              </div>
            )}

            {/* 스킵 힌트 */}
            <div className="bov-skip-hint">탭하여 스킵</div>
          </div>
        );
      })()}

      {/* ════════ 최종 결과 오버레이 ════════ */}
      {matchResult && (
        <div className="match-result-overlay" onClick={() => setMatchResult(null)}>
          <div className="match-result-bg" />
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: matchResult.won
              ? 'radial-gradient(ellipse at center, rgba(76,175,80,0.15) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(239,83,80,0.15) 0%, transparent 70%)',
          }} />

          <div className="match-result-title" style={{ color: matchResult.won ? '#4caf50' : '#ef5350' }}>
            {matchResult.won ? '🏆 WIN' : '💀 LOSE'}
          </div>
          <div style={{ fontSize: '0.9rem', color: theme.color, fontWeight: 700, letterSpacing: 2,
            position: 'relative', zIndex: 1, marginTop: 4, marginBottom: 16 }}>
            {gym.name}
          </div>

          <div className="match-result-prize">
            {matchResult.won ? '' : '위로금 '}🪙{formatCoins(matchResult.coinReward)}
          </div>

          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginTop: 8,
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
            {matchResult.won ? `🏆 ${gym.name} 정복!` : `💪 다음엔 이길 수 있어요!`}<br />
            이 포켓몬은 내일 자정에 다시 출전 가능합니다.
          </div>

          <div className="match-result-hint">화면을 터치하면 계속</div>
        </div>
      )}
    </div>
  );
}
