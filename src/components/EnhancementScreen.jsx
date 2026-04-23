import React, { useState, useEffect, useMemo } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonShinyImageUrl, getPokemonName, getRarityStars, getRarityColor,
  calculatePower, calculateSellPrice, getEnhanceRate, getEnhanceCost,
  getEnhanceFailEffect, formatCoins,
} from '../utils/gameUtils.js';
import { EVOLUTIONS } from '../data/evolutionData.js';

// ── 진화 연출 오버레이 ────────────────────────────────────────────────────────
function EvolutionOverlay({ from, to, isShiny, onClose }) {
  const [phase, setPhase] = useState(0);
  // 0: 기존 포켓몬 실루엣 → 1: 화이트 플래시 → 2: 새 포켓몬 등장 → 3: 텍스트

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2300);
    const t4 = setTimeout(() => onClose(), 5000);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const particles = useMemo(() => {
    const colors = ['#fff', '#ffd600', '#42a5f5', '#ce93d8', '#66bb6a', '#ef5350'];
    return [...Array(14)].map((_, i) => {
      const angle = (i / 14) * 360 + Math.random() * 15;
      const dist  = 80 + Math.random() * 80;
      const size  = 4 + Math.random() * 7;
      return {
        color: colors[i % colors.length],
        dx: Math.cos(angle * Math.PI / 180) * dist,
        dy: Math.sin(angle * Math.PI / 180) * dist,
        size,
        delay: Math.random() * 0.25,
      };
    });
  }, []);

  return (
    <div
      className={`evo-overlay evo-phase-${phase}`}
      onClick={phase >= 2 ? onClose : undefined}
    >
      {/* Phase 0: 기존 포켓몬 실루엣 */}
      {phase === 0 && (
        <img src={isShiny ? getPokemonShinyImageUrl(from) : getPokemonImageUrl(from)} className="evo-old-img" alt=""
          style={isShiny ? { filter: 'drop-shadow(0 0 14px rgba(0,229,255,0.9)) brightness(1.1)' } : {}} />
      )}

      {/* Phase 2+: 파티클 + 새 포켓몬 */}
      {phase >= 2 && (
        <>
          {particles.map((p, i) => (
            <div
              key={i}
              className="evo-particle"
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
          <img src={isShiny ? getPokemonShinyImageUrl(to) : getPokemonImageUrl(to)} className="evo-new-img" alt=""
            style={isShiny ? { filter: 'drop-shadow(0 0 14px rgba(0,229,255,0.9)) brightness(1.1)' } : {}} />
        </>
      )}

      {/* Phase 3: 텍스트 */}
      {phase >= 3 && (
        <div className="evo-text-group">
          <div className="evo-label">{isShiny ? '✦ 이로치 진화!' : '✨ 진화!'}</div>
          <div className="evo-names" style={isShiny ? { color: '#00e5ff' } : {}}>
            {getPokemonName(from)}&nbsp;&rarr;&nbsp;{getPokemonName(to)}
          </div>
          <div className="evo-tap-hint">탭하여 닫기</div>
        </div>
      )}
    </div>
  );
}

export default function EnhancementScreen() {
  const { state, dispatch, saveNow } = useGame();
  const { enhancingPokemonId, enhanceResult, enhanceFailStack, inventory } = state;

  const [cardAnim, setCardAnim] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [useShield, setUseShield] = useState(false);

  const pokemon = inventory.find(p => p.instanceId === enhancingPokemonId);

  useEffect(() => {
    if (!enhanceResult) return;

    const animMap = {
      success:  'anim-success',
      evolved:  'anim-success',
      fail:     'anim-fail',
      shielded: 'anim-fail',
      decreased:'anim-fail',
      destroyed:'anim-destroyed',
    };

    setCardAnim(animMap[enhanceResult] || '');
    setIsEnhancing(false);

    // 파괴 시 Supabase에 즉시 저장 (beforeunload async 버그 방지)
    if (enhanceResult === 'destroyed') {
      saveNow();
    }

    const t = setTimeout(() => {
      setCardAnim('');
    }, 1000);

    return () => clearTimeout(t);
  }, [enhanceResult]);

  function handleEnhance() {
    if (!pokemon || isEnhancing) return;
    const cost = getEnhanceCost(pokemon.enhanceLevel);
    if (state.coins < cost) return;

    setIsEnhancing(true);
    setCardAnim('');
    dispatch({ type: 'CLEAR_ENHANCE_RESULT' });

    setTimeout(() => {
      dispatch({ type: 'ATTEMPT_ENHANCE', useShield });
    }, 300);
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.code !== 'Space') return;
      e.preventDefault();
      handleEnhance();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pokemon, isEnhancing, useShield, state.coins]);

  function getSuccessRateClass(rate) {
    if (rate >= 1) return 'rate-100';
    if (rate >= 0.7) return 'rate-high';
    if (rate >= 0.5) return 'rate-med';
    return 'rate-low';
  }

  if (!pokemon) {
    return (
      <div>
        <div className="section-title">⚗️ 포켓몬 강화</div>

        {inventory.length === 0 ? (
          <div className="no-pokemon-selected">
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎒</div>
            <div>가방에 포켓몬이 없습니다!</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginTop: 8 }}>
              먼저 포켓몬을 잡으세요.
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: 'var(--text2)', marginBottom: 16, fontSize: '0.9rem' }}>
              강화할 포켓몬을 선택하세요:
            </div>
            <div className="select-pokemon-grid pokemon-select-scroll">
              {[...inventory]
                .sort((a, b) => b.rarity - a.rarity || b.enhanceLevel - a.enhanceLevel)
                .map(p => {
                  const lvl = p.enhanceLevel;
                  const atMax = lvl >= 20;
                  return (
                    <div
                      key={p.instanceId}
                      className={`inv-card${p.isGolden ? ' golden' : ''}`}
                      onClick={() => !atMax && dispatch({ type: 'SELECT_FOR_ENHANCE', pokemonId: p.instanceId })}
                      style={{ cursor: atMax ? 'default' : 'pointer', opacity: atMax ? 0.5 : 1 }}
                    >
                      {lvl > 0 && <div className="enhance-level-badge">+{lvl}</div>}
                      <img src={p.isShiny ? getPokemonShinyImageUrl(p.pokemonId) : getPokemonImageUrl(p.pokemonId)} alt="" className="inv-img"
                        style={p.isShiny ? { filter: 'drop-shadow(0 0 6px rgba(0,229,255,0.8))' } : {}} />
                      <div className="inv-name">{getPokemonName(p.pokemonId)}</div>
                      <div style={{ color: getRarityColor(p.rarity), fontSize: '0.65rem' }}>{'★'.repeat(p.rarity)}</div>
                      {atMax && <div style={{ fontSize: '0.6rem', color: 'var(--gold)' }}>최대</div>}
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    );
  }

  const level = pokemon.enhanceLevel;
  const atMax = level >= 20;
  const cost = getEnhanceCost(level);
  const baseRate = getEnhanceRate(level);
  const stackBonus = enhanceFailStack * 0.05;
  const actualRate = Math.min(0.95, baseRate + stackBonus);
  const failEffect = getEnhanceFailEffect(level);
  const canAfford = state.coins >= cost;
  const power = calculatePower(pokemon);

  // 진화 예고: 다음 강화 성공 시 진화하는지 확인
  const evoPreview = EVOLUTIONS[pokemon.pokemonId];
  const willEvolveNext = !atMax && evoPreview && evoPreview.at === level + 1;

  const failEffectLabel = {
    none: '',
    nothing: '실패: 변화 없음',
    minus1: '⚠️ 실패: -1 레벨',
    destroy: '💀 실패: 파괴됨',
  }[failEffect] || '';

  const rateClass = getSuccessRateClass(actualRate);

  const showEvoOverlay = enhanceResult === 'evolved' && state.lastEvolution;

  return (
    <div>
      {/* 진화 오버레이 */}
      {showEvoOverlay && (
        <EvolutionOverlay
          from={state.lastEvolution.from}
          to={state.lastEvolution.to}
          isShiny={state.lastEvolution.isShiny}
          onClose={() => dispatch({ type: 'CLEAR_ENHANCE_RESULT' })}
        />
      )}

      <div className="flex items-center justify-between mb-12">
        <div className="section-title" style={{ margin: 0 }}>⚗️ 포켓몬 강화</div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'SELECT_FOR_ENHANCE', pokemonId: null })}
        >
          변경
        </button>
      </div>

      <div className="enhance-main">
        {/* 포켓몬 카드 */}
        <div className={`enhance-pokemon-card ${cardAnim}`}
          style={pokemon.isGolden ? { borderColor: 'var(--gold)' } : pokemon.isShiny ? { borderColor: '#00e5ff' } : {}}>
          <div style={{ position: 'relative' }}>
            <img
              src={pokemon.isShiny ? getPokemonShinyImageUrl(pokemon.pokemonId) : getPokemonImageUrl(pokemon.pokemonId)}
              alt={getPokemonName(pokemon.pokemonId)}
              style={{
                width: 160, height: 160, objectFit: 'contain', imageRendering: 'pixelated',
                animation: isEnhancing ? 'pulse 0.3s ease infinite alternate' : 'float 3s ease infinite',
                filter: pokemon.isGolden
                  ? 'sepia(0.3) brightness(1.3) drop-shadow(0 0 10px rgba(255,214,0,0.8))'
                  : pokemon.isShiny
                  ? 'drop-shadow(0 0 14px rgba(0,229,255,0.9)) brightness(1.1)'
                  : 'drop-shadow(0 0 10px rgba(255,255,255,0.1))',
              }}
            />
          </div>

          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{getPokemonName(pokemon.pokemonId)}</div>
          <div style={{ color: getRarityColor(pokemon.rarity), fontSize: '0.9rem' }}>
            {getRarityStars(pokemon.rarity)}
          </div>

          <div className="enhance-level-display">
            {atMax ? '✨ 최대' : `+${level} → +${level + 1}`}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>
            ⚡ 전투력: {power.toLocaleString()}
          </div>
        </div>

        {/* 성공률 표시 */}
        {!atMax && (
          <>
            <div className={`enhance-rate-display ${rateClass}`}>
              성공률: {Math.round(actualRate * 100)}%
              {enhanceFailStack > 0 && (
                <span style={{ fontSize: '0.75rem', marginLeft: 8, color: 'var(--purple)' }}>
                  (기본 {Math.round(baseRate * 100)}% +{Math.round(stackBonus * 100)}% 스택)
                </span>
              )}
            </div>

            {enhanceFailStack > 0 && (
              <div className="fail-stack-bar">
                💜 실패 스택: {enhanceFailStack} (+{Math.round(stackBonus * 100)}% 보너스)
              </div>
            )}

            {failEffectLabel && (
              <div className="enhance-fail-effect">{failEffectLabel}</div>
            )}

            {/* +15 이상 — 성공 시 전투력 2배 강조 */}
            {level >= 15 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(224,64,251,0.15), rgba(170,0,255,0.1))',
                border: '1px solid #e040fb', borderRadius: 8,
                padding: '8px 14px', textAlign: 'center', fontSize: '0.85rem',
              }}>
                <span style={{ color: '#e040fb', fontWeight: 900, fontSize: '1rem' }}>
                  ⚡ 성공 시 전투력 {Math.pow(2, level - 14)}배!
                </span>
                <br/>
                <span style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>
                  현재 {power.toLocaleString()} → 성공 {Math.floor(power * 2).toLocaleString()}
                </span>
              </div>
            )}

            <div className="enhance-cost">
              비용: 🪙{formatCoins(cost)}
              {!canAfford && <span style={{ color: 'var(--fail)', marginLeft: 8 }}>코인이 부족합니다!</span>}
            </div>

            {/* 진화 예고 배너 */}
            {willEvolveNext && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,199,99,0.15), rgba(50,150,250,0.1))',
                border: '1px solid #66bb6a', borderRadius: 8,
                padding: '8px 14px', textAlign: 'center', fontSize: '0.82rem',
              }}>
                <span style={{ color: '#66bb6a', fontWeight: 900 }}>
                  🌟 이번 강화 성공 시 진화!
                </span>
                {' '}
                <span style={{ color: 'var(--text2)' }}>
                  +{level + 1} 달성 →{' '}
                  {Array.isArray(evoPreview.to)
                    ? evoPreview.to.map(id => getPokemonName(id)).join(' / ')
                    : getPokemonName(evoPreview.to)
                  }
                </span>
              </div>
            )}

            {/* 강화 결과 플래시 (진화는 오버레이로 처리) */}
            {enhanceResult && enhanceResult !== 'evolved' && (
              <div className={`enhance-result-flash ${enhanceResult}`}>
                {enhanceResult === 'success'   && `🎉 성공! +${level} 달성!`}
                {enhanceResult === 'fail'      && `💨 실패... (+${level} 유지)`}
                {enhanceResult === 'shielded'  && `🛡️ 파편 ${((level - 14) * 1000).toLocaleString()}개로 파괴를 막았습니다!`}
                {enhanceResult === 'decreased' && `📉 실패! +${level}로 하락`}
                {enhanceResult === 'destroyed' && `💥 파괴됨! 포켓몬을 잃었습니다!`}
              </div>
            )}

            <button
              className="btn btn-gold btn-lg btn-full"
              disabled={!canAfford || isEnhancing || atMax}
              onClick={handleEnhance}
              style={{ fontSize: '1rem', position: 'relative', overflow: 'hidden' }}
            >
              {isEnhancing ? '⚡ 강화 중...' : `⚗️ 강화 (+${level} → +${level + 1})`}
            </button>

            {/* 파괴 위험 경고 + 파편 방어 */}
            {failEffect === 'destroy' && (() => {
              const shieldCost = (level - 14) * 1000;
              const canShield = state.fragments >= shieldCost;
              return (
                <div style={{
                  background: 'rgba(183,28,28,0.15)', border: '1px solid var(--fail)',
                  borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem',
                  color: 'var(--fail)', textAlign: 'center',
                }}>
                  ⚠️ 위험 구간! 실패하면 이 포켓몬이 영구히 파괴됩니다!
                  <br/>
                  <span style={{ color: 'var(--text2)' }}>
                    파괴 보상: 💎 {level * 15} 파편
                  </span>
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => setUseShield(v => !v)}
                      style={{
                        background: useShield ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${useShield ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: 8, padding: '5px 14px', cursor: 'pointer',
                        color: useShield ? 'var(--primary)' : 'var(--text2)',
                        fontWeight: 700, fontSize: '0.8rem',
                        opacity: canShield ? 1 : 0.4,
                      }}
                      disabled={!canShield}
                      title={!canShield ? '파편이 부족합니다' : ''}
                    >
                      🛡️ 파편 {shieldCost.toLocaleString()}개로 파괴 방지 {useShield ? '✅' : '⬜'}
                    </button>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: 3 }}>
                      보유 파편: 💎 {state.fragments.toLocaleString()}
                      {!canShield && <span style={{ color: 'var(--fail)' }}> (부족)</span>}
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {atMax && (
          <div style={{ color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}>
            ✨ 이 포켓몬은 최대 강화되었습니다!<br/>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: 400 }}>
              전투력: ⚡{power.toLocaleString()}
            </span>
          </div>
        )}

        {/* 판매 버튼 */}
        <div style={{ width: '100%', maxWidth: 320 }}>
          <button
            className="btn btn-ghost btn-sm btn-full"
            style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }}
            onClick={() => {
              const price = calculateSellPrice(pokemon);
              if (confirm(`${getPokemonName(pokemon.pokemonId)}을(를) 🪙${formatCoins(price)}에 판매할까요?`)) {
                dispatch({ type: 'SELL_POKEMON', pokemonId: pokemon.instanceId });
              }
            }}
          >
            💸 판매 🪙{formatCoins(calculateSellPrice(pokemon))}
          </button>
        </div>
      </div>
    </div>
  );
}
