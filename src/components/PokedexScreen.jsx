import React from 'react';
import { useGame } from '../App.jsx';
import { POKEMON_NAMES, ALL_POKEMON_BY_RARITY } from '../data/pokemonData.js';
import { getPokemonImageUrl, getPokemonName, getRarityColor } from '../utils/gameUtils.js';

const TOTAL = Object.keys(POKEMON_NAMES).length;

const RARITY_INFO = [
  { rarity: 4, label: '★★★★ 전설',  color: '#e040fb' },
  { rarity: 3, label: '★★★☆ 영웅',  color: '#ffd600' },
  { rarity: 2, label: '★★☆☆ 희귀',  color: '#42a5f5' },
  { rarity: 1, label: '★☆☆☆ 일반',  color: '#9e9e9e' },
];

export default function PokedexScreen() {
  const { state, dispatch } = useGame();
  const caughtSet = new Set(state.pokedex || []);
  const caught = caughtSet.size;
  const pct = Math.round((caught / TOTAL) * 100);
  const isComplete = caught >= TOTAL;
  const canClaim = isComplete && !state.pokedexRewarded;

  return (
    <div>
      <div className="section-title">📖 포켓몬 도감</div>

      {/* 진행률 */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 800, fontSize: '1rem' }}>
            {isComplete ? '✨ 도감 완성!' : `${caught} / ${TOTAL}`}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{pct}%</span>
        </div>
        <div style={{
          height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${pct}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #FFD700, #e040fb)'
              : 'linear-gradient(90deg, var(--primary), #42a5f5)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* 보상 버튼 */}
        {canClaim && (
          <button
            className="btn btn-gold btn-full"
            style={{ marginTop: 12, fontWeight: 800 }}
            onClick={() => dispatch({ type: 'CLAIM_POKEDEX_REWARD' })}
          >
            🎁 도감 완성 보상 수령 — 💎 파편 10,000개!
          </button>
        )}
        {isComplete && state.pokedexRewarded && (
          <div style={{
            marginTop: 10, textAlign: 'center', fontSize: '0.82rem',
            color: '#FFD700', fontWeight: 700,
          }}>
            ✅ 보상 수령 완료!
          </div>
        )}
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
                return (
                  <div key={id} style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isCaught ? color + '55' : 'var(--border)'}`,
                    borderRadius: 10,
                    padding: '6px 4px',
                    textAlign: 'center',
                    opacity: isCaught ? 1 : 0.45,
                    transition: 'opacity 0.2s',
                  }}>
                    <img
                      src={getPokemonImageUrl(id)}
                      alt={isCaught ? getPokemonName(id) : '???'}
                      style={{
                        width: 48, height: 48,
                        objectFit: 'contain',
                        imageRendering: 'pixelated',
                        filter: isCaught ? undefined : 'brightness(0) contrast(0.3)',
                      }}
                    />
                    <div style={{
                      fontSize: '0.6rem',
                      color: isCaught ? 'var(--text)' : 'var(--text2)',
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
