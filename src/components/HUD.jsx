import React, { useState, useEffect } from 'react';
import { useGame } from '../App.jsx';
import { formatCoins } from '../utils/gameUtils.js';
import HelpModal from './HelpModal.jsx';

function useCountdown(lastCoinClaim) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function calc() {
      const diff = 3600000 - (Date.now() - lastCoinClaim);
      setRemaining(diff > 0 ? diff : 0);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [lastCoinClaim]);

  return remaining;
}

function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const NAV = [
  { id: 'main',        label: '🌍 여행'    },
  { id: 'inventory',   label: '🎒 가방'   },
  { id: 'enhancement', label: '⚗️ 강화'  },
  { id: 'gym',         label: '🏟️ 체육관' },
  { id: 'battle',      label: '⚔️ 배틀'  },
  { id: 'pokedex',     label: '📖 도감'   },
];

export default function HUD() {
  const { state, dispatch, nickname, onLogout } = useGame();
  const [showHelp, setShowHelp] = useState(false);
  const remaining = useCountdown(state.lastCoinClaim || 0);
  const canClaim = remaining === 0;

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
          <button
            onClick={() => canClaim && dispatch({ type: 'CLAIM_COINS' })}
            disabled={!canClaim}
            title="1시간마다 🪙10,000 수령"
            style={{
              background: canClaim ? 'rgba(255,200,0,0.18)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${canClaim ? 'rgba(255,200,0,0.6)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 8,
              padding: '2px 8px',
              cursor: canClaim ? 'pointer' : 'default',
              color: canClaim ? '#FFD700' : 'var(--text2)',
              fontSize: '0.68rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {canClaim ? '🪙 수령하기' : `⏱ ${formatCountdown(remaining)}`}
          </button>
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
