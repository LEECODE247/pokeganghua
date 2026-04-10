import React, { useState, useEffect } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonName, getRarityStars, getRarityColor,
  calculatePower, calculateSellPrice, getEnhanceRate, getEnhanceCost,
  getEnhanceFailEffect, formatCoins,
} from '../utils/gameUtils.js';

export default function EnhancementScreen() {
  const { state, dispatch } = useGame();
  const { enhancingPokemonId, enhanceResult, enhanceFailStack, inventory } = state;

  const [cardAnim, setCardAnim] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const pokemon = inventory.find(p => p.instanceId === enhancingPokemonId);

  useEffect(() => {
    if (!enhanceResult) return;

    const animMap = {
      success: 'anim-success',
      fail: 'anim-fail',
      decreased: 'anim-fail',
      destroyed: 'anim-destroyed',
    };

    setCardAnim(animMap[enhanceResult] || '');
    setIsEnhancing(false);

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
      dispatch({ type: 'ATTEMPT_ENHANCE' });
    }, 300);
  }

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
                      <img src={getPokemonImageUrl(p.pokemonId)} alt="" className="inv-img" />
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

  const failEffectLabel = {
    none: '',
    nothing: '실패: 변화 없음',
    minus1: '⚠️ 실패: -1 레벨',
    destroy: '💀 실패: 파괴됨',
  }[failEffect] || '';

  const rateClass = getSuccessRateClass(actualRate);

  return (
    <div>
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
          style={pokemon.isGolden ? { borderColor: 'var(--gold)' } : {}}>
          <div style={{ position: 'relative' }}>
            <img
              src={getPokemonImageUrl(pokemon.pokemonId)}
              alt={getPokemonName(pokemon.pokemonId)}
              style={{
                width: 160, height: 160, objectFit: 'contain', imageRendering: 'pixelated',
                animation: isEnhancing ? 'pulse 0.3s ease infinite alternate' : 'float 3s ease infinite',
                filter: pokemon.isGolden ? 'sepia(0.3) brightness(1.3) drop-shadow(0 0 10px rgba(255,214,0,0.8))' : 'drop-shadow(0 0 10px rgba(255,255,255,0.1))',
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

            {/* 강화 결과 플래시 */}
            {enhanceResult && (
              <div className={`enhance-result-flash ${enhanceResult}`}>
                {enhanceResult === 'success' && `🎉 성공! +${level} 달성!`}
                {enhanceResult === 'fail' && `💨 실패... (+${level} 유지)`}
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

            {/* 파괴 위험 경고 */}
            {failEffect === 'destroy' && (
              <div style={{
                background: 'rgba(183,28,28,0.15)', border: '1px solid var(--fail)',
                borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem',
                color: 'var(--fail)', textAlign: 'center',
              }}>
                ⚠️ 위험 구간! 실패하면 이 포켓몬이 영구히 파괴됩니다!
                <br/>
                <span style={{ color: 'var(--text2)' }}>
                  파괴 보상: 💎 {level * 15} 파편
                </span>
              </div>
            )}
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
