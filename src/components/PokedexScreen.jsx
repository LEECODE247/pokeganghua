import React from 'react';
import { useGame } from '../App.jsx';
import { ALL_POKEMON_BY_RARITY, GEN1_IDS, GEN2_IDS } from '../data/pokemonData.js';
import { getPokemonImageUrl, getPokemonName, getRarityColor } from '../utils/gameUtils.js';

const RARITY_INFO = [
  { rarity: 5, label: '★★★★★ 신화',  color: '#FF6B00' },
  { rarity: 4, label: '★★★★ 전설',   color: '#e040fb' },
  { rarity: 3, label: '★★★☆ 영웅',   color: '#ffd600' },
  { rarity: 2, label: '★★☆☆ 희귀',   color: '#42a5f5' },
  { rarity: 1, label: '★☆☆☆ 일반',   color: '#9e9e9e' },
];

function GenCompletionCard({ title, icon, ids, caughtSet, rewarded, rewardDesc, rewardColor, onClaim }) {
  const total = ids.length;
  const caught = ids.filter(id => caughtSet.has(id)).length;
  const pct = Math.round((caught / total) * 100);
  const isComplete = caught >= total;
  const canClaim = isComplete && !rewarded;

  return (
    <div style={{
      background: 'var(--surface, var(--card))',
      border: `1px solid ${isComplete ? rewardColor + '88' : 'var(--border)'}`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 12,
      boxShadow: isComplete ? `0 0 12px ${rewardColor}33` : 'none',
      transition: 'all 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isComplete ? rewardColor : 'var(--text)' }}>
          {icon} {title}
        </span>
        <span style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
          {caught} / {total} <span style={{ color: isComplete ? rewardColor : 'var(--text2)', fontWeight: 700 }}>({pct}%)</span>
        </span>
      </div>

      <div style={{ height: 7, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: isComplete
            ? `linear-gradient(90deg, ${rewardColor}, ${rewardColor}aa)`
            : 'linear-gradient(90deg, var(--primary), #42a5f5)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {canClaim && (
        <button
          className="btn btn-full"
          style={{ background: rewardColor, color: '#000', fontWeight: 800, fontSize: '0.85rem' }}
          onClick={onClaim}
        >
          🎁 완성 보상 수령 — {rewardDesc}
        </button>
      )}
      {rewarded && (
        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: rewardColor, fontWeight: 700 }}>
          ✅ 보상 수령 완료!
        </div>
      )}
      {!isComplete && !rewarded && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', textAlign: 'center' }}>
          {rewardDesc} — {total - caught}마리 남음
        </div>
      )}
    </div>
  );
}

export default function PokedexScreen() {
  const { state, dispatch } = useGame();
  const caughtSet = new Set(state.pokedex || []);

  const allIds = Object.values(ALL_POKEMON_BY_RARITY).flat();
  const totalInGame = allIds.length;
  const totalCaught = allIds.filter(id => caughtSet.has(id)).length;
  const overallPct = Math.round((totalCaught / totalInGame) * 100);

  return (
    <div>
      <div className="section-title">📖 포켓몬 도감</div>

      {/* 세대별 완성 보상 */}
      <GenCompletionCard
        title="1세대 도감"
        icon="🔴"
        ids={GEN1_IDS}
        caughtSet={caughtSet}
        rewarded={state.pokedex1Rewarded}
        rewardDesc="💎 파편 10,000개"
        rewardColor="#ffd600"
        onClaim={() => dispatch({ type: 'CLAIM_POKEDEX1_REWARD' })}
      />
      <GenCompletionCard
        title="2세대 도감"
        icon="🟡"
        ids={GEN2_IDS}
        caughtSet={caughtSet}
        rewarded={state.pokedex2Rewarded}
        rewardDesc="랜덤 +15강 S급 ★4 포켓몬"
        rewardColor="#e040fb"
        onClaim={() => dispatch({ type: 'CLAIM_POKEDEX2_REWARD' })}
      />

      {/* 전체 진행률 */}
      <div style={{
        background: 'var(--surface, var(--card))', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 16px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text2)' }}>전체 진행률</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
            {totalCaught} / {totalInGame} ({overallPct}%)
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, width: `${overallPct}%`,
            background: 'linear-gradient(90deg, var(--primary), #42a5f5)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* 희귀도별 목록 */}
      {RARITY_INFO.map(({ rarity, label, color }) => {
        const ids = ALL_POKEMON_BY_RARITY[rarity] || [];
        const caughtCount = ids.filter(id => caughtSet.has(id)).length;
        return (
          <div key={rarity} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8,
            }}>
              <span style={{ color, fontWeight: 800, fontSize: '0.9rem' }}>{label}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
                {caughtCount} / {ids.length}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 6,
            }}>
              {ids.map(id => {
                const isCaught = caughtSet.has(id);
                const isMythical = rarity === 5;
                return (
                  <div key={id} style={{
                    background: 'var(--surface, var(--card))',
                    border: `1px solid ${isCaught ? color + (isMythical ? 'cc' : '55') : 'var(--border)'}`,
                    borderRadius: 10,
                    padding: '6px 4px',
                    textAlign: 'center',
                    opacity: isCaught ? 1 : 0.45,
                    transition: 'opacity 0.2s',
                    boxShadow: isCaught && isMythical ? `0 0 10px ${color}66` : 'none',
                  }}>
                    <img
                      src={getPokemonImageUrl(id)}
                      alt={isCaught ? getPokemonName(id) : '???'}
                      style={{
                        width: 48, height: 48,
                        objectFit: 'contain',
                        imageRendering: 'pixelated',
                        filter: isCaught
                          ? (isMythical ? 'drop-shadow(0 0 4px #FF6B00)' : undefined)
                          : 'brightness(0) contrast(0.3)',
                      }}
                    />
                    <div style={{
                      fontSize: '0.6rem',
                      color: isCaught ? (isMythical ? '#FF6B00' : 'var(--text)') : 'var(--text2)',
                      marginTop: 2,
                      fontWeight: isCaught ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {isCaught ? getPokemonName(id) : '???'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
