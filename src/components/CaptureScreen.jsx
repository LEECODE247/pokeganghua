import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../App.jsx';
import { BALL_CONFIG } from '../data/pokemonData.js';
import {
  getPokemonImageUrl, getPokemonName,
  getRarityStars, getRarityColor, formatCoins, calculateSellPrice,
} from '../utils/gameUtils.js';

const PHASE = {
  IDLE: 'idle',
  APPEARING: 'appearing',
  READY: 'ready',
  THROWING: 'throwing',
  SHAKING: 'shaking',
  RESULT: 'result',
};

const CHEAPEST_BALL = Math.min(...Object.values(BALL_CONFIG).map(c => c.cost));

export default function CaptureScreen() {
  const { state, dispatch } = useGame();
  const { wildPokemon, captureResult, captureFailStreak } = state;

  const [phase, setPhase] = useState(PHASE.IDLE);
  const [thrownBall, setThrownBall] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [justSold, setJustSold] = useState(false);

  useEffect(() => {
    if (wildPokemon) {
      setPhase(PHASE.READY);
    } else {
      setPhase(PHASE.APPEARING);
      dispatch({ type: 'GENERATE_WILD_POKEMON' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wildPokemon && phase === PHASE.APPEARING) {
      const t = setTimeout(() => setPhase(PHASE.READY), 600);
      return () => clearTimeout(t);
    }
  }, [wildPokemon, phase]);

  useEffect(() => {
    if (captureResult && phase === PHASE.SHAKING) {
      const t = setTimeout(() => {
        setPhase(PHASE.RESULT);
        setShowResult(true);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [captureResult, phase]);

  const throwBall = useCallback((ballType) => {
    if (phase !== PHASE.READY) return;
    const cost = BALL_CONFIG[ballType]?.cost ?? Infinity;
    if (state.coins < cost) return;

    setThrownBall(ballType);
    setPhase(PHASE.THROWING);
    setShowResult(false);
    setJustSold(false);

    setTimeout(() => {
      dispatch({ type: 'ATTEMPT_CAPTURE', ballType });
      setPhase(PHASE.SHAKING);
    }, 400);
  }, [phase, state.coins, dispatch]);

  function nextJourney() {
    dispatch({ type: 'DISMISS_CAPTURE' });
    setPhase(PHASE.APPEARING);
    setShowResult(false);
    setThrownBall(null);
    setJustSold(false);
    dispatch({ type: 'GENERATE_WILD_POKEMON' });
  }

  function sellCaptured() {
    if (!wildPokemon || justSold) return;
    dispatch({ type: 'SELL_POKEMON', pokemonId: wildPokemon.instanceId });
    setJustSold(true);
  }

  function goBack() {
    dispatch({ type: 'DISMISS_CAPTURE' });
    dispatch({ type: 'NAVIGATE', screen: 'main' });
  }

  const rarityColor = wildPokemon ? getRarityColor(wildPokemon.rarity) : 'var(--text)';
  const isLegendary = wildPokemon?.rarity === 4;
  const sellPrice = wildPokemon ? calculateSellPrice(wildPokemon) : 0;

  const imgAnimClass = phase === PHASE.APPEARING ? 'anim-bounce'
    : phase === PHASE.SHAKING && captureResult === 'near-miss' ? 'anim-nearmiss'
    : phase === PHASE.RESULT && captureResult === 'success' ? 'anim-caught'
    : phase === PHASE.RESULT && captureResult !== 'success' ? 'anim-escape'
    : '';

  const ballShakeClass = phase === PHASE.THROWING ? 'throwing'
    : phase === PHASE.SHAKING ? 'shaking' : '';

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-12">
        <button className="btn btn-ghost btn-sm" onClick={goBack}>← 뒤로</button>
        <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '1rem' }}>
          🌍 여행하기
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 700 }}>
          🪙 {formatCoins(state.coins)}
        </div>
      </div>

      {/* 실패 연속 뱃지 */}
      {captureFailStreak >= 2 && phase !== PHASE.RESULT && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span className="streak-badge">
            🔥 {captureFailStreak}연속 실패! +{captureFailStreak}% 포획률 상승
          </span>
        </div>
      )}

      <div className="capture-arena">
        {/* 야생 포켓몬 카드 */}
        {wildPokemon && (
          <div
            className={`wild-pokemon-card${wildPokemon.isGolden ? ' golden' : ''}${isLegendary ? ' legendary' : ''}`}
            style={isLegendary ? { borderColor: '#e040fb', boxShadow: '0 0 30px rgba(224,64,251,0.5)' } : {}}
          >
            {wildPokemon.isGolden && <div className="golden-badge">✨ 황금!</div>}
            {isLegendary && !wildPokemon.isGolden && (
              <div className="golden-badge" style={{ background: '#e040fb' }}>⭐ 전설!</div>
            )}

            <div className="pokemon-img-wrap">
              <img
                src={getPokemonImageUrl(wildPokemon.pokemonId)}
                alt={getPokemonName(wildPokemon.pokemonId)}
                className={`pokemon-img ${imgAnimClass}`}
                style={{
                  filter: wildPokemon.isGolden
                    ? 'drop-shadow(0 0 12px rgba(255,214,0,0.9)) sepia(0.3) brightness(1.3)'
                    : isLegendary
                    ? 'drop-shadow(0 0 16px rgba(224,64,251,0.8))'
                    : undefined,
                }}
              />
            </div>

            <div className="pokemon-name" style={{ color: rarityColor }}>
              {getPokemonName(wildPokemon.pokemonId)}
            </div>

            <div className="pokemon-meta">
              <span className="rarity-stars" style={{ color: rarityColor }}>
                {getRarityStars(wildPokemon.rarity)}
              </span>
              <span className={`size-badge size-${wildPokemon.sizeGrade}`}>
                {wildPokemon.sizeGrade}
              </span>
              <span style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
                {wildPokemon.gender}
              </span>
            </div>

          </div>
        )}

        {/* 볼 던지기 애니메이션 */}
        {(phase === PHASE.THROWING || phase === PHASE.SHAKING) && thrownBall && (
          <div className="pokeball-throw-wrap">
            <span className={`pokeball-anim ${ballShakeClass}`}>
              {BALL_CONFIG[thrownBall]?.icon || '⚫'}
            </span>
            {phase === PHASE.SHAKING && (
              <div style={{ position: 'absolute', fontSize: '0.8rem', color: 'var(--text2)', bottom: -20 }}>
                {captureResult === 'near-miss' ? '아슬아슬...' : '...'}
              </div>
            )}
          </div>
        )}

        {/* 볼 선택 — 코인 직접 차감 */}
        {phase === PHASE.READY && (
          <div className="ball-buttons">
            {Object.entries(BALL_CONFIG).map(([type, cfg]) => {
              const canAfford = state.coins >= cfg.cost;
              const rarity = wildPokemon?.rarity || 1;
              const baseRate = cfg.rates[rarity] || 0;
              const streakBonus = captureFailStreak * 0.01;
              const displayRate = Math.min(100, Math.round((baseRate + streakBonus) * 100));

              return (
                <button
                  key={type}
                  className="ball-btn"
                  disabled={!canAfford}
                  onClick={() => throwBall(type)}
                  style={{ borderColor: canAfford ? cfg.color : 'transparent' }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
                  <span className="ball-btn-name" style={{ color: cfg.color }}>{cfg.name}</span>
                  <span className="ball-btn-count" style={{ color: 'var(--gold)' }}>
                    🪙{formatCoins(cfg.cost)}
                  </span>
                  <span className="ball-btn-rate">포획: {displayRate}%</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 로딩 */}
        {(phase === PHASE.IDLE || (phase === PHASE.APPEARING && !wildPokemon)) && (
          <div style={{ color: 'var(--text2)', fontSize: '0.9rem', animation: 'pulse 1s ease infinite alternate' }}>
            포켓몬을 찾고 있습니다...
          </div>
        )}
      </div>

      {/* 결과 오버레이 */}
      {showResult && captureResult && (
        <div className="capture-result-overlay">
          <div className={`result-text ${captureResult}`}>
            {captureResult === 'success' && '✅ 포획 성공!'}
            {captureResult === 'fail' && '❌ 도망쳤다!'}
            {captureResult === 'near-miss' && '💨 아깝다!'}
          </div>

          {captureResult === 'success' && wildPokemon && (
            <div style={{ textAlign: 'center' }}>
              <img
                src={getPokemonImageUrl(wildPokemon.pokemonId)}
                style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated', animation: 'float 2s ease infinite' }}
                alt=""
              />
              <div style={{ color: rarityColor, fontWeight: 700, fontSize: '1rem', marginTop: 6 }}>
                {getPokemonName(wildPokemon.pokemonId)} 포획!
                {wildPokemon.isGolden && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>✨ 황금!</span>}
                {isLegendary && <span style={{ color: '#e040fb', marginLeft: 6 }}>⭐ 전설!</span>}
              </div>
              {/* 판매가 미리보기 */}
              {!justSold && (
                <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginTop: 4 }}>
                  판매가: 🪙{formatCoins(sellPrice)}
                </div>
              )}
              {justSold && (
                <div style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 700, marginTop: 4 }}>
                  ✅ 🪙{formatCoins(sellPrice)} 판매 완료!
                </div>
              )}
            </div>
          )}

          {captureResult !== 'success' && captureFailStreak > 0 && (
            <div className="result-sub">
              실패 연속: {captureFailStreak}회 → 다음 시도 +{captureFailStreak}% 상승
            </div>
          )}

          {/* 버튼 영역 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={nextJourney}>
              🌍 다음 여행
            </button>
            {/* 포획 성공 시 즉시 판매 버튼 */}
            {captureResult === 'success' && !justSold && (
              <button
                className="btn btn-sm"
                style={{ background: 'var(--fail)', color: '#fff', border: 'none' }}
                onClick={sellCaptured}
              >
                💸 바로 판매
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={goBack}>
              ← 뒤로
            </button>
          </div>

          {/* 코인 부족 경고 */}
          {state.coins < CHEAPEST_BALL && (
            <div style={{ color: 'var(--fail)', fontSize: '0.8rem', textAlign: 'center', marginTop: 8 }}>
              코인이 부족합니다! (몬스터볼 최소 🪙{formatCoins(CHEAPEST_BALL)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
