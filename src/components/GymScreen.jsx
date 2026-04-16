import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../App.jsx';
import { GYM_CONFIG, MAP_CONFIG } from '../data/pokemonData.js';
import {
  getPokemonImageUrl, getPokemonName, getRarityColor,
  calculatePower, formatCoins, formatCooldown,
} from '../utils/gameUtils.js';

// 체육관별 대표 포켓몬 (관장)
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

// 체육관 타입 테마
const GYM_THEME = {
  forest:  { bg: 'linear-gradient(170deg,#071a07 0%,#03100a 100%)', color: '#66bb6a', glow: 'rgba(102,187,106,0.85)', projClass: 'proj-grass'   },
  river:   { bg: 'linear-gradient(170deg,#04152a 0%,#020a18 100%)', color: '#42a5f5', glow: 'rgba(66,165,245,0.85)',  projClass: 'proj-water'   },
  cave:    { bg: 'linear-gradient(170deg,#130e06 0%,#0a0803 100%)', color: '#bcaaa4', glow: 'rgba(188,170,164,0.85)', projClass: 'proj-rock'    },
  sky:     { bg: 'linear-gradient(170deg,#1f0606 0%,#0f0303 100%)', color: '#ef5350', glow: 'rgba(239,83,80,0.85)',   projClass: 'proj-fire'    },
  glacier: { bg: 'linear-gradient(170deg,#031520 0%,#010a12 100%)', color: '#00e5ff', glow: 'rgba(0,229,255,0.85)',   projClass: 'proj-ice'     },
  storm:   { bg: 'linear-gradient(170deg,#1a1500 0%,#0d0a00 100%)', color: '#ffd600', glow: 'rgba(255,214,0,0.85)',   projClass: 'proj-electric'},
  abyss:   { bg: 'linear-gradient(170deg,#0f0018 0%,#06000d 100%)', color: '#e040fb', glow: 'rgba(224,64,251,0.85)', projClass: 'proj-psychic' },
  myth:    { bg: 'linear-gradient(170deg,#1a0a00 0%,#0d0500 100%)', color: '#FF8C00', glow: 'rgba(255,140,0,0.95)',   projClass: 'proj-myth'    },
};

// 기술 목록
const MY_MOVES = {
  forest:  ['🍃 잎날가르기', '🌿 에너지볼', '☀️ 솔라빔'],
  river:   ['💧 물대포', '🌊 파도타기', '❄️ 냉동빔'],
  cave:    ['⛰️ 지진', '🪨 바위깨기', '💥 폭발'],
  sky:     ['🔥 불꽃방사', '💨 에어슬래시', '🐲 드래곤클로'],
  glacier: ['❄️ 냉동빔', '🧊 눈보라', '💎 다이아몬드스톰'],
  storm:   ['⚡ 10만볼트', '🌩️ 번개', '🌀 하이퍼빔'],
  abyss:   ['🌊 물의파동', '🌑 섀도볼', '💜 사이코키네시스'],
  myth:    ['✨ 심판의날', '🌟 신의분노', '⚡ 창조의섬광'],
};
const OPP_MOVES = {
  forest:  ['🌱 씨뿌리기', '☠️ 독가루', '🌿 체력흡수'],
  river:   ['🌊 파도타기', '💦 거품광선', '🌀 하이드로펌프'],
  cave:    ['⛰️ 대지의힘', '💪 구르기', '🪨 스텔스록'],
  sky:     ['🔥 화염방사', '💨 폭풍', '🌪️ 열풍'],
  glacier: ['❄️ 빙산', '🌨️ 눈의세례', '🧊 냉동펀치'],
  storm:   ['⚡ 전자포', '🌩️ 역할교대', '💥 폭발'],
  abyss:   ['🌑 달의빛', '🌊 조수', '💜 사이코노이즈'],
  myth:    ['🔱 창세의빛', '✨ 신판', '⚡ 아르세우스의분노'],
};

export default function GymScreen() {
  const { state, dispatch } = useGame();
  const { gymMap, gymSelectedPokemonId, gymBattleResult, gymCooldowns, inventory } = state;

  const [now, setNow] = useState(Date.now());
  const [battling, setBattling] = useState(false);
  const [gymAnim, setGymAnim] = useState(null); // { step, myHp, oppHp, won }
  const gymTimers = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const gym = GYM_CONFIG[gymMap];
  const selectedPokemon = inventory.find(p => p.instanceId === gymSelectedPokemonId);
  const playerPower = selectedPokemon ? calculatePower(selectedPokemon) : 0;
  const canEnter = playerPower >= gym.requiredPower;

  const cooldownEnd = gymSelectedPokemonId ? (gymCooldowns[gymSelectedPokemonId] || 0) : 0;
  const cooldownRemaining = Math.max(0, cooldownEnd - now);
  const onCooldown = cooldownRemaining > 0;

  const minWin = gym.minWinChance ?? 25;
  const maxWin = gym.maxWinChance ?? 95;

  let winChance;
  if (!canEnter) {
    winChance = 0;
  } else if (gymMap === 'myth') {
    // 350만 기준 5%, 50만 오를 때마다 +5%
    const steps = Math.floor((playerPower - 3_500_000) / 500_000);
    winChance = Math.max(5, 5 + steps * 5);
  } else {
    winChance = Math.min(maxWin, Math.max(minWin, Math.round((playerPower / gym.gymPower) * 55)));
  }

  function startBattle() {
    if (!canEnter || onCooldown || battling || !selectedPokemon) return;
    setBattling(true);

    const won = Math.random() * 100 < winChance;
    const add = (fn, ms) => { const t = setTimeout(fn, ms); gymTimers.current.push(t); };

    const myPool  = MY_MOVES[gymMap];
    const oppPool = OPP_MOVES[gymMap];
    const move1 = myPool[Math.floor(Math.random() * myPool.length)];
    const move2 = oppPool[Math.floor(Math.random() * oppPool.length)];
    const move3 = myPool[Math.floor(Math.random() * myPool.length)];

    // HP 계산
    const ratio = playerPower / gym.gymPower;
    const oppHp1 = won
      ? Math.max(22, Math.round(72 - ratio * 45))
      : Math.max(55, Math.round(88 - ratio * 28));
    const myHp1 = won
      ? Math.max(45, Math.round(85 - (1 / ratio) * 22))
      : Math.max(12, Math.round(62 - (1 / ratio) * 30));
    const oppHpFinal = won ? 0 : oppHp1;
    const myHpFinal  = won ? myHp1 : 0;

    // step: 0=입장, 1=내차지, 2=내공격+피격, 3=상대차지, 4=상대공격+피격, 5=결정타차지, 6=결정타피격, 7=결과
    setGymAnim({ step: 0, myHp: 100, oppHp: 100, won, moveName: null });
    add(() => setGymAnim(f => ({ ...f, step: 1, moveName: move1 })),           600);
    add(() => setGymAnim(f => ({ ...f, step: 2, oppHp: oppHp1 })),             1150);
    add(() => setGymAnim(f => ({ ...f, step: 3, moveName: move2 })),           2000);
    add(() => setGymAnim(f => ({ ...f, step: 4, myHp: myHp1 })),               2550);
    add(() => setGymAnim(f => ({ ...f, step: 5, moveName: move3 })),           3400);
    add(() => setGymAnim(f => ({ ...f, step: 6, oppHp: oppHpFinal, myHp: myHpFinal })), 3950);
    add(() => setGymAnim(f => ({ ...f, step: 7 })),                            4700);
    add(() => {
      dispatch({ type: 'GYM_BATTLE_RESOLVE', playerPower, gymPower: gym.gymPower, gymReward: gym.reward });
      setGymAnim(null);
      setBattling(false);
      gymTimers.current = [];
    }, 6300);
  }

  return (
    <div>
      <div className="section-title">🏟️ 체육관 도전</div>

      {/* 체육관 탭 */}
      <div className="gym-tabs">
        {Object.entries(GYM_CONFIG).map(([mapId, g]) => (
          <button
            key={mapId}
            className={`gym-tab${gymMap === mapId ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_GYM_MAP', mapId })}
          >
            {g.icon} {g.name}
          </button>
        ))}
      </div>

      {/* 체육관 정보 */}
      <div className="gym-info-card">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{gym.name}</div>
            <div className="gym-difficulty" style={{ color: gym.difficultyColor }}>
              {gym.difficulty}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem' }}>
              🪙 {formatCoins(gym.reward)}
            </div>
            <div style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>승리 보상</div>
          </div>
        </div>

        <hr className="divider" />

        <div className="gym-power-compare">
          <div className="power-block player">
            <div
              className="power-block-val"
              style={{ color: canEnter ? 'var(--blue)' : 'var(--fail)' }}
            >
              ⚡{playerPower.toLocaleString()}
            </div>
            <div className="power-block-label">내 전투력</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text2)', fontSize: '1.5rem' }}>
            vs
          </div>
          <div className="power-block gym">
            <div className="power-block-val" style={{ color: 'var(--fail)' }}>
              ⚡{gym.requiredPower.toLocaleString()}
            </div>
            <div className="power-block-label">필요 전투력</div>
          </div>
        </div>

        {canEnter && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 4 }}>
              승률: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{winChance}%</span>
              <span style={{ color: 'var(--text2)', fontSize: '0.7rem' }}> (랜덤 결과)</span>
            </div>
            <div className="win-chance-bar-wrap">
              <div className="win-chance-bar" style={{ width: `${winChance}%` }} />
            </div>
          </>
        )}

        {!canEnter && selectedPokemon && (
          <div style={{ color: 'var(--fail)', fontSize: '0.85rem', textAlign: 'center', padding: '8px 0' }}>
            ⚠️ ⚡{(gym.requiredPower - playerPower).toLocaleString()} 전투력이 더 필요합니다!
            <br/>
            <span style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>
              포켓몬을 강화하거나 더 강한 포켓몬을 사용하세요.
            </span>
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
          disabled={!canEnter || !selectedPokemon || onCooldown || battling}
          onClick={startBattle}
          style={{ fontSize: '1rem' }}
        >
          {battling ? '⚔️ 배틀 중...'
            : onCooldown ? `⏳ 휴식 중 (${formatCooldown(cooldownRemaining)})`
            : !canEnter ? '🔒 전투력 부족'
            : !selectedPokemon ? '포켓몬을 선택하세요'
            : '⚔️ 체육관 도전!'}
        </button>

        {onCooldown && (
          <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '0.75rem', marginTop: 6 }}>
            포켓몬이 전투 후 휴식 중
          </div>
        )}
      </div>

      {/* 포켓몬 선택 */}
      <div className="gym-pokemon-select">
        <div className="section-title">포켓몬 선택</div>
        {inventory.length === 0 ? (
          <div style={{ color: 'var(--text2)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
            가방에 포켓몬이 없습니다! 먼저 잡으러 가세요.
          </div>
        ) : (
          <div className="gym-pokemon-list pokemon-select-scroll">
            {[...inventory]
              .sort((a, b) => calculatePower(b) - calculatePower(a))
              .map(p => {
                const pwr = calculatePower(p);
                const cd = gymCooldowns[p.instanceId] || 0;
                const cdRemain = Math.max(0, cd - now);
                const hasCd = cdRemain > 0;
                const isSelected = p.instanceId === gymSelectedPokemonId;
                const meetsPower = pwr >= gym.requiredPower;

                return (
                  <div
                    key={p.instanceId}
                    className={`gym-pokemon-item${isSelected ? ' selected' : ''}${hasCd ? ' on-cooldown' : ''}`}
                    onClick={() => !hasCd && dispatch({ type: 'SELECT_GYM_POKEMON', pokemonId: p.instanceId })}
                    title={hasCd ? `휴식 중: ${formatCooldown(cdRemain)}` : getPokemonName(p.pokemonId)}
                  >
                    <img
                      src={getPokemonImageUrl(p.pokemonId)}
                      alt={getPokemonName(p.pokemonId)}
                      className="gym-pokemon-img"
                      style={p.isGolden ? { filter: 'sepia(0.3) brightness(1.4)' } : {}}
                    />
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                      {getPokemonName(p.pokemonId)}
                    </div>
                    <div style={{ color: getRarityColor(p.rarity), fontSize: '0.6rem' }}>
                      {'★'.repeat(p.rarity)}
                    </div>
                    {p.enhanceLevel > 0 && (
                      <div style={{ color: 'var(--gold)', fontSize: '0.6rem' }}>+{p.enhanceLevel}</div>
                    )}
                    <div style={{ color: meetsPower ? 'var(--blue)' : 'var(--text2)', fontSize: '0.6rem', fontWeight: 700 }}>
                      ⚡{pwr.toLocaleString()}
                    </div>
                    {hasCd && (
                      <div className="cooldown-timer">⏳{formatCooldown(cdRemain)}</div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 체육관 전투 애니메이션 오버레이 */}
      {gymAnim && selectedPokemon && (() => {
        const theme = GYM_THEME[gymMap];
        const { step, myHp, oppHp, won, moveName } = gymAnim;
        const oppId = GYM_LEADER_POKEMON[gymMap];

        // 포켓몬 클래스
        const myAnim =
          step === 1 || step === 5 ? 'bmon-charge' :
          step === 2 || step === 6 ? 'bmon-lunge-r' :
          step === 4               ? 'bmon-hit' :
          step === 7               ? (won ? 'bmon-winner' : 'bmon-loser') : '';

        const oppAnim =
          step === 3               ? 'bmon-charge' :
          step === 4               ? 'bmon-lunge-l' :
          step === 2 || step === 6 ? 'bmon-hit' :
          step === 7               ? (won ? 'bmon-loser' : 'bmon-winner') : '';

        // 발사체 방향
        const showProj = step === 2 || step === 4 || step === 6;
        const projDir  = (step === 2 || step === 6) ? 'right' : 'left';

        const hpColor = (hp) => hp > 50 ? '#4caf50' : hp > 20 ? '#FFD700' : '#ef5350';

        return (
          <div className="bov" style={{ background: theme.bg }}>

            {/* 상대 포켓몬 영역 (상단 오른쪽) */}
            <div className="bov-opp-row">
              <div className="bov-hpbox">
                <div className="bov-hpbox-name">{gym.name} 관장</div>
                <div className="bov-hpbox-bar-row">
                  <span className="bov-hp-label">HP</span>
                  <div className="bov-hp-track">
                    <div className="bov-hp-fill" style={{ width: `${oppHp}%`, background: hpColor(oppHp) }} />
                  </div>
                  <span className="bov-hp-num" style={{ color: hpColor(oppHp) }}>{oppHp}</span>
                </div>
              </div>
              <img
                src={getPokemonImageUrl(oppId)}
                className={`bov-mon bov-mon-opp ${oppAnim}`}
                style={{ '--glow': theme.glow }}
                key={`opp-${step}`}
                alt=""
              />
            </div>

            {/* 필드 중앙 (기술 이름 + 발사체) */}
            <div className="bov-field">
              {moveName && step >= 1 && step <= 6 && (
                <div
                  className="bov-move-name"
                  key={`move-${step}`}
                  style={{ color: theme.color, textShadow: `0 0 16px ${theme.glow}` }}
                >
                  {moveName}
                </div>
              )}
              {showProj && (
                <div
                  className={`bov-proj bov-proj-${projDir} ${theme.projClass}`}
                  key={`proj-${step}`}
                />
              )}
            </div>

            {/* 내 포켓몬 영역 (하단 왼쪽) */}
            <div className="bov-my-row">
              <img
                src={getPokemonImageUrl(selectedPokemon.pokemonId)}
                className={`bov-mon bov-mon-my ${myAnim}`}
                style={{ '--glow': theme.glow }}
                key={`my-${step}`}
                alt=""
              />
              <div className="bov-hpbox bov-hpbox-my">
                <div className="bov-hpbox-name">나의 {getPokemonName(selectedPokemon.pokemonId)}</div>
                <div className="bov-hpbox-bar-row">
                  <span className="bov-hp-label">HP</span>
                  <div className="bov-hp-track">
                    <div className="bov-hp-fill" style={{ width: `${myHp}%`, background: hpColor(myHp) }} />
                  </div>
                  <span className="bov-hp-num" style={{ color: hpColor(myHp) }}>{myHp}</span>
                </div>
              </div>
            </div>

            {/* 결과 */}
            {step === 7 && (
              <div className="bov-result" style={{ color: won ? '#4caf50' : '#ef5350' }}>
                <div className="bov-result-text">{won ? '🏆 승리!' : '💀 패배...'}</div>
                {won && <div className="bov-reward">+🪙{formatCoins(gym.reward)}</div>}
              </div>
            )}
          </div>
        );
      })()}

      {/* 배틀 결과 오버레이 */}
      {gymBattleResult && (
        <div className="battle-result-overlay" onClick={() => dispatch({ type: 'CLEAR_GYM_RESULT' })}>
          <div className="battle-result-text" style={{ color: gymBattleResult.won ? 'var(--success)' : 'var(--fail)' }}>
            {gymBattleResult.won ? '🏆 승리!' : '💀 패배'}
          </div>

          <div className="battle-result-reward">
            {gymBattleResult.won ? '🎉' : '😢'} +🪙{formatCoins(gymBattleResult.reward)}
          </div>

          {gymBattleResult.won && (
            <div style={{ color: 'var(--gold)', fontSize: '0.9rem', textAlign: 'center' }}>
              {gym.name} 정복!<br/>
              <span style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>
                승률은 {gymBattleResult.winChance}%였습니다
              </span>
            </div>
          )}

          {!gymBattleResult.won && (
            <div style={{ color: 'var(--text2)', fontSize: '0.85rem', textAlign: 'center' }}>
              위로금: 🪙{formatCoins(gymBattleResult.reward)}<br/>
              <span style={{ fontSize: '0.75rem' }}>
                승률은 {gymBattleResult.winChance}% — 포켓몬을 강화해보세요!
              </span>
            </div>
          )}

          <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginTop: 8 }}>
            화면을 터치하면 계속합니다
          </div>
        </div>
      )}
    </div>
  );
}
