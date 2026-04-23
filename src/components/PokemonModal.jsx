import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonShinyImageUrl, getPokemonName, getRarityStars, getRarityColor,
  calculatePower, calculateSellPrice, formatCoins, getSellFragmentBonus,
} from '../utils/gameUtils.js';
import { POKEMON_TYPES, TYPE_META } from '../data/pokemonData.js';

export default function PokemonModal({ pokemon, onClose }) {
  const { dispatch } = useGame();
  const [soldInfo, setSoldInfo] = useState(null);

  if (!pokemon) return null;

  const power = calculatePower(pokemon);
  const sellPrice = calculateSellPrice(pokemon);
  const fragBonus = getSellFragmentBonus(pokemon);
  const name = getPokemonName(pokemon.pokemonId);

  function handleSell() {
    if (confirm(`${name}을(를) 🪙${formatCoins(sellPrice)}${fragBonus > 0 ? ` + 💎${fragBonus}` : ''}에 판매할까요?`)) {
      dispatch({ type: 'SELL_POKEMON', pokemonId: pokemon.instanceId });
      setSoldInfo({ coins: sellPrice, frags: fragBonus, name });
    }
  }

  function handleEnhance() {
    dispatch({ type: 'SELECT_FOR_ENHANCE', pokemonId: pokemon.instanceId });
    onClose();
  }

  const rarityColor = getRarityColor(pokemon.rarity);

  if (soldInfo) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💸</div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 16 }}>{soldInfo.name} 판매 완료!</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,214,0,0.1)', border: '1px solid var(--gold)', borderRadius: 10, padding: '10px 16px', fontSize: '1rem', fontWeight: 800, color: 'var(--gold)' }}>
              🪙 {formatCoins(soldInfo.coins)}
            </div>
            {soldInfo.frags > 0 && (
              <div style={{ background: 'rgba(100,181,246,0.1)', border: '1px solid #42a5f5', borderRadius: 10, padding: '10px 16px', fontSize: '1rem', fontWeight: 800, color: '#42a5f5' }}>
                💎 {soldInfo.frags} 파편
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-full" onClick={onClose}>확인</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: rarityColor }}>
            {name}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ position: 'relative', textAlign: 'center' }}>
          <img
            src={pokemon.isShiny
              ? getPokemonShinyImageUrl(pokemon.pokemonId)
              : getPokemonImageUrl(pokemon.pokemonId)}
            alt={name}
            className="modal-img"
            style={pokemon.isGolden
              ? { animation: 'golden-shimmer 1.5s ease infinite', filter: 'sepia(0.3) brightness(1.3)' }
              : pokemon.isShiny
              ? { animation: 'float 3s ease infinite', filter: 'drop-shadow(0 0 14px rgba(0,229,255,0.9)) brightness(1.1)' }
              : { animation: 'float 3s ease infinite' }}
          />
          {pokemon.isShiny && (
            <div className="golden-badge" style={{ position: 'absolute', top: 0, right: '50%', transform: 'translateX(80px)', background: 'linear-gradient(135deg,#00e5ff,#b388ff)', color: '#000' }}>
              ✦ 이로치
            </div>
          )}
          {pokemon.isGolden && (
            <div className="golden-badge" style={{ position: 'absolute', top: pokemon.isShiny ? 30 : 0, right: '50%', transform: 'translateX(80px)' }}>
              ✨ 황금
            </div>
          )}
        </div>

        {/* 타입 뱃지 */}
        {(() => {
          const types = POKEMON_TYPES[pokemon.pokemonId] || ['normal'];
          return (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
              {types.map(t => {
                const meta = TYPE_META[t] || TYPE_META.normal;
                return (
                  <span key={t} style={{
                    background: meta.color, color: '#fff',
                    fontSize: '0.7rem', fontWeight: 800,
                    padding: '3px 10px', borderRadius: 20,
                    letterSpacing: 0.5, textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}>{meta.label}</span>
                );
              })}
            </div>
          );
        })()}

        {/* 메타 정보 */}
        <div className="flex gap-8 items-center" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: rarityColor, fontSize: '1rem' }}>{getRarityStars(pokemon.rarity)}</span>
          <span className={`size-badge size-${pokemon.sizeGrade}`}>{pokemon.sizeGrade} (크기:{pokemon.size})</span>
          <span style={{ color: 'var(--text2)' }}>{pokemon.gender}</span>
          {pokemon.enhanceLevel > 0 && (
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+{pokemon.enhanceLevel}</span>
          )}
        </div>

        {/* 전투력 */}
        <div style={{ textAlign: 'center' }}>
          <div className="modal-power">⚡ {power.toLocaleString()}</div>
          <div className="modal-power-label">전투력</div>
        </div>

        {/* 판매가 */}
        <div className="modal-sell-price">
          🪙 판매가: {formatCoins(sellPrice)}
          {fragBonus > 0 && <span style={{ marginLeft: 6, color: '#42a5f5', fontSize: '0.8rem' }}>+💎{fragBonus} 파편</span>}
          {pokemon.isShiny  && <span style={{ marginLeft: 6, color: '#00e5ff', fontSize: '0.8rem' }}>×1.5 이로치!</span>}
          {pokemon.isGolden && <span style={{ marginLeft: 6, color: 'var(--gold)', fontSize: '0.8rem' }}>×5 황금!</span>}
        </div>

        {/* 액션 */}
        <div className="modal-actions">
          <button className="btn btn-gold btn-full" onClick={handleEnhance}>
            ⚗️ 강화 (+{pokemon.enhanceLevel} → +{pokemon.enhanceLevel + 1})
          </button>
          <button className="btn btn-ghost btn-full" onClick={handleSell} style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }}>
            💸 판매 🪙{formatCoins(sellPrice)}{fragBonus > 0 ? ` +💎${fragBonus}` : ''}
          </button>
          <button className="btn btn-ghost btn-full" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
