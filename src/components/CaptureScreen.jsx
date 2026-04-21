import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../App.jsx';
import { BALL_CONFIG, POKEMON_TYPES, TYPE_META } from '../data/pokemonData.js';
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
  const [countdown, setCountdown] = useState(null); // 3 | 2 | 1 | 'gotcha' | 'escaped' | null
  const captureResultRef = useRef(null);

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

  // captureResult를 ref에 동기화 (setTimeout 클로저에서 최신값 접근용)
  useEffect(() => {
    captureResultRef.current = captureResult;
  }, [captureResult]);

  // 볼이 던져지면 카운트다운 시작
  useEffect(() => {
    if (phase !== PHASE.SHAKING) { setCountdown(null); return; }

    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 800);
    const t2 = setTimeout(() => setCountdown(1), 1600);
    const t3 = setTimeout(() => {
      const r = captureResultRef.current;
      setCountdown(r === 'success' ? 'gotcha' : 'escaped');
    }, 2400);
    const t4 = setTimeout(() => {
      setPhase(PHASE.RESULT);
      setShowResult(true);
      setCountdown(null);
    }, 3300);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [phase]);

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
  const isMythical  = wildPokemon?.rarity === 5;
  const sellPrice = wildPokemon ? calculateSellPrice(wildPokemon) : 0;
  const isInPokedex = wildPokemon ? state.pokedex.includes(wildPokemon.pokemonId) : false;

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
            🔥 {captureFailStreak}연속 실패! +{Math.min(captureFailStreak, 10)}% 포획률 상승
          </span>
        </div>
      )}

      <div className="capture-arena">
        {/* 야생 포켓몬 카드 */}
        {wildPokemon && (
          <div
            className={`wild-pokemon-card${wildPokemon.isGolden ? ' golden' : ''}${isLegendary ? ' legendary' : ''}${isMythical ? ' mythical' : ''}`}
            style={
              isMythical  ? { borderColor: '#FF6B00', boxShadow: '0 0 40px rgba(255,107,0,0.75)' } :
              isLegendary ? { borderColor: '#e040fb', boxShadow: '0 0 30px rgba(224,64,251,0.5)' } : {}
            }
          >
            {/* 도감 등록 여부 뱃지 (왼쪽 상단) */}
            <div style={{
              position: 'absolute', top: 6, left: 8,
              background: isInPokedex ? 'rgba(76,175,80,0.18)' : 'rgba(255,214,0,0.15)',
              border: `1px solid ${isInPokedex ? '#4caf50' : '#ffd700'}`,
              color: isInPokedex ? '#4caf50' : '#ffd700',
              fontSize: '0.6rem', fontWeight: 900,
              padding: '2px 7px', borderRadius: 10,
              letterSpacing: '0.02em',
            }}>
              {isInPokedex ? '✓ 도감등록' : '★ 미등록'}
            </div>

            {wildPokemon.isGolden && <div className="golden-badge">✨ 황금!</div>}
            {isMythical && !wildPokemon.isGolden && (
              <div className="golden-badge" style={{ background: 'linear-gradient(135deg,#FF6B00,#FFD700)', color: '#000' }}>🌟 신화!</div>
            )}
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
                    : isMythical
                    ? 'drop-shadow(0 0 20px rgba(255,107,0,1)) brightness(1.1)'
                    : isLegendary
                    ? 'drop-shadow(0 0 16px rgba(224,64,251,0.8))'
                    : undefined,
                }}
              />
            </div>

            <div className="pokemon-name" style={{ color: rarityColor }}>
              {getPokemonName(wildPokemon.pokemonId)}
            </div>

            {/* 타입 뱃지 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
              {(POKEMON_TYPES[wildPokemon.pokemonId] || ['normal']).map(t => {
                const meta = TYPE_META[t] || TYPE_META.normal;
                return (
                  <span key={t} style={{
                    background: meta.color, color: '#fff',
                    fontSize: '0.62rem', fontWeight: 800,
                    padding: '2px 8px', borderRadius: 10,
                    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    letterSpacing: '0.03em',
                  }}>{meta.label}</span>
                );
              })}
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
              {BALL_CONFIG[thrownBall]?.img
                ? <img src={BALL_CONFIG[thrownBall].img} alt="" style={{ width: 48, height: 48, imageRendering: 'pixelated' }} />
                : BALL_CONFIG[thrownBall]?.icon || '⚫'}
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
            {/* ★5 신화 경고 배너 */}
            {isMythical && (
              <div style={{
                width: '100%', textAlign: 'center', padding: '6px 10px',
                background: 'rgba(255,107,0,0.15)', border: '1px solid #FF6B00',
                borderRadius: 8, marginBottom: 6,
                color: '#FF6B00', fontWeight: 800, fontSize: '0.8rem',
              }}>
                ⚠️ 아르세우스는 마스터볼로만 포획 가능! (10%)
              </div>
            )}
            {Object.entries(BALL_CONFIG).map(([type, cfg]) => {
              const canAfford = state.coins >= cfg.cost;
              const rarity = wildPokemon?.rarity || 1;
              const baseRate = cfg.rates[rarity] ?? 0;
              const streakBonus = Math.min(captureFailStreak, 10) * 0.01;
              // ★5는 마스터볼 외 0%, 실패 연속 보너스 없음
              const displayRate = (isMythical && type !== 'master')
                ? 0
                : Math.min(100, Math.round((baseRate + streakBonus) * 100));

              return (
                <button
                  key={type}
                  className="ball-btn"
                  disabled={!canAfford}
                  onClick={() => throwBall(type)}
                  style={{ borderColor: canAfford ? cfg.color : 'transparent' }}
                >
                  {cfg.img
                    ? <img src={cfg.img} alt={cfg.name} style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
                    : <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>}
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

      {/* 카운트다운 오버레이 */}
      {countdown !== null && (
        <div className="capture-countdown-overlay">
          <div className="countdown-ball-wrap">
            <div className="countdown-pokeball">
              {thrownBall && BALL_CONFIG[thrownBall]?.img
                ? <img src={BALL_CONFIG[thrownBall].img} alt="" style={{ width: 56, height: 56, imageRendering: 'pixelated' }} />
                : thrownBall ? BALL_CONFIG[thrownBall]?.icon : '⚫'}
            </div>
            {countdown === 'gotcha' ? (
              <div className="countdown-gotcha">GOTCHA! 🎉</div>
            ) : countdown === 'escaped' ? (
              <div className="countdown-escaped">탈출했다! 💨</div>
            ) : (
              <div
                key={countdown}
                className="countdown-number"
                style={{
                  color: countdown === 3 ? '#fff' : countdown === 2 ? '#FFD700' : '#FF5722',
                }}
              >
                {countdown}
              </div>
            )}
          </div>
          {countdown !== 'gotcha' && countdown !== 'escaped' && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
              포켓볼이 흔들리고 있다...
            </div>
          )}
        </div>
      )}

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
                {isMythical && <span style={{ color: '#FF6B00', marginLeft: 6 }}>🌟 신화!</span>}
                {isLegendary && !isMythical && <span style={{ color: '#e040fb', marginLeft: 6 }}>⭐ 전설!</span>}
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
              실패 연속: {captureFailStreak}회 → 다음 시도 +{Math.min(captureFailStreak, 10)}% 상승{captureFailStreak >= 10 ? ' (최대)' : ''}
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
