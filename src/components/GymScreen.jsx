import React, { useState, useEffect } from 'react';
import { useGame } from '../App.jsx';
import { GYM_CONFIG, MAP_CONFIG } from '../data/pokemonData.js';
import {
  getPokemonImageUrl, getPokemonName, getRarityColor,
  calculatePower, formatCoins, formatCooldown,
} from '../utils/gameUtils.js';

export default function GymScreen() {
  const { state, dispatch } = useGame();
  const { gymMap, gymSelectedPokemonId, gymBattleResult, gymCooldowns, inventory } = state;

  const [now, setNow] = useState(Date.now());
  const [battling, setBattling] = useState(false);

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

  const winChance = canEnter
    ? Math.min(95, Math.max(25, Math.round((playerPower / gym.gymPower) * 55)))
    : 0;

  function startBattle() {
    if (!canEnter || onCooldown || battling || !selectedPokemon) return;
    setBattling(true);
    setTimeout(() => {
      dispatch({
        type: 'GYM_BATTLE_RESOLVE',
        playerPower,
        gymPower: gym.gymPower,
        gymReward: gym.reward,
      });
      setBattling(false);
    }, 1500);
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
