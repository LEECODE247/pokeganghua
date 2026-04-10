import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import { formatCoins } from '../utils/gameUtils.js';
import HelpModal from './HelpModal.jsx';

const NAV = [
  { id: 'main',        label: '🌍 여행'    },
  { id: 'inventory',   label: '🎒 가방'   },
  { id: 'enhancement', label: '⚗️ 강화'  },
  { id: 'gym',         label: '🏟️ 체육관' },
];

export default function HUD() {
  const { state, dispatch, nickname, onLogout } = useGame();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div className="hud">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
              color: 'var(--text)', fontWeight: 900, fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onClick={() => setShowHelp(true)}
            title="게임 설명서"
          >
            ❗
          </button>
          <div className="hud-coins">
            <span className="hud-coin-icon">🪙</span>
            {formatCoins(state.coins)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text2)', fontWeight: 600 }}>
            👤 {nickname}
          </div>
          <div className="hud-frags">💎 {state.fragments}</div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
            onClick={() => {
              if (confirm('로그아웃 하시겠습니까?')) onLogout();
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <nav className="nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`nav-btn${state.screen === n.id ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'NAVIGATE', screen: n.id })}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
