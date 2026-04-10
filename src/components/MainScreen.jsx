import React from 'react';
import { useGame } from '../App.jsx';
import { formatCoins } from '../utils/gameUtils.js';

export default function MainScreen() {
  const { state, dispatch } = useGame();

  const winRate = state.totalBattles > 0
    ? Math.round((state.totalWins / state.totalBattles) * 100)
    : 0;

  return (
    <div>
      <div className="main-title">PokéGacha</div>
      <p className="main-subtitle">포획 · 강화 · 정복</p>

      {/* 통계 */}
      <div className="card mb-12">
        <div className="stats-bar">
          <div className="stat-pill">
            <div className="stat-pill-val">{state.totalCaptured}</div>
            <div className="stat-pill-label">포획</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-val">{state.inventory.length}</div>
            <div className="stat-pill-label">보유</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-val">{state.totalEnhanced}</div>
            <div className="stat-pill-label">강화</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-val">{winRate}%</div>
            <div className="stat-pill-label">승률</div>
          </div>
        </div>
      </div>

      {/* 여행하기 버튼 */}
      <div className="roulette-section">
        <button
          className="roulette-btn"
          onClick={() => dispatch({ type: 'START_ROULETTE' })}
        >
          <span className="roulette-btn-icon">🌍</span>
          <span className="roulette-btn-text">여행하기</span>
          <span className="roulette-btn-sub">포켓몬을 찾아나선다...</span>
        </button>

        {/* 출현 확률 */}
        <div className="roulette-rates card">
          <div className="roulette-rate-row">
            <span style={{ color: '#9e9e9e' }}>★☆☆☆</span>
            <span style={{ color: 'var(--text2)' }}>일반</span>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>50%</span>
          </div>
          <div className="roulette-rate-row">
            <span style={{ color: '#42a5f5' }}>★★☆☆</span>
            <span style={{ color: 'var(--text2)' }}>희귀</span>
            <span style={{ color: '#42a5f5', fontWeight: 700 }}>30%</span>
          </div>
          <div className="roulette-rate-row">
            <span style={{ color: '#ffd600' }}>★★★☆</span>
            <span style={{ color: 'var(--text2)' }}>영웅</span>
            <span style={{ color: '#ffd600', fontWeight: 700 }}>15%</span>
          </div>
          <div className="roulette-rate-row">
            <span style={{ color: '#e040fb' }}>★★★★</span>
            <span style={{ color: 'var(--text2)' }}>전설</span>
            <span style={{ color: '#e040fb', fontWeight: 700 }}>5%</span>
          </div>
        </div>
      </div>

      {/* 팁 */}
      <div className="card">
        <div className="section-title">팁</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.8 }}>
          🌍 여행으로 161마리 중 랜덤 출현<br/>
          ⭐ 전설 포켓몬은 5% 확률 — 만나면 놓치지 마세요!<br/>
          ⚗️ 강화 +15부터 성공 시 전투력이 <span style={{ color: '#e040fb', fontWeight: 700 }}>2배</span><br/>
          🏟️ 체육관에서 대규모 코인 획득<br/>
          ✨ 황금 포켓몬은 0.5% 확률 — 판매가 5배!
        </div>
      </div>

      {/* 초기화 버튼 */}
      {/* <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          className="btn btn-gold btn-sm"
          onClick={() => {
            if (confirm('코인을 초기값(10,000)으로 초기화할까요?')) {
              dispatch({ type: 'RESET_COINS' });
            }
          }}
        >
          💰 코인 초기화
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (confirm('모든 진행 상황을 초기화할까요? 되돌릴 수 없습니다!')) {
              dispatch({ type: 'RESET_GAME' });
            }
          }}
        >
          🔄 게임 초기화
        </button>
      </div> */}
    </div>
  );
}
