import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonName, getRarityStars, getRarityColor,
  calculatePower, calculateSellPrice, formatCoins,
} from '../utils/gameUtils.js';
import PokemonModal from './PokemonModal.jsx';

const SORTS = [
  { id: 'capturedAt',   label: '최신순' },
  { id: 'power',        label: '전투력' },
  { id: 'rarity',       label: '희귀도' },
  { id: 'enhanceLevel', label: '레벨'   },
];

const RARITY_LABEL = { 0: '전체', 1: '일반', 2: '희귀', 3: '영웅', 4: '전설' };

export default function InventoryScreen() {
  const { state, dispatch } = useGame();
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [sort, setSort] = useState('capturedAt');
  const [filterRarity, setFilterRarity] = useState(0);

  const sorted = [...state.inventory]
    .filter(p => filterRarity === 0 || p.rarity === filterRarity)
    .sort((a, b) => {
      if (sort === 'power')        return calculatePower(b) - calculatePower(a);
      if (sort === 'rarity')       return b.rarity - a.rarity || b.enhanceLevel - a.enhanceLevel;
      if (sort === 'enhanceLevel') return b.enhanceLevel - a.enhanceLevel;
      return b.capturedAt - a.capturedAt;
    });

  const totalSellPrice = sorted.reduce((sum, p) => sum + calculateSellPrice(p), 0);

  function bulkSell() {
    if (sorted.length === 0) return;
    const label = filterRarity === 0 ? '전체' : `★${filterRarity} ${RARITY_LABEL[filterRarity]}`;
    const confirmed = confirm(
      `정말 판매하시겠습니까?\n\n${label} ${sorted.length}마리\n합계: 🪙${totalSellPrice.toLocaleString()}`
    );
    if (confirmed) {
      dispatch({ type: 'SELL_BULK', pokemonIds: sorted.map(p => p.instanceId) });
    }
  }

  return (
    <div>
      <div className="inventory-header">
        <div>
          <div className="section-title" style={{ margin: 0 }}>포켓몬 가방</div>
          <div className="inventory-count">{state.inventory.length}마리 보유</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-8 mb-8" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4].map(r => (
            <button
              key={r}
              className={`btn btn-sm btn-ghost${filterRarity === r ? ' active' : ''}`}
              style={filterRarity === r
                ? { borderColor: r === 0 ? 'var(--text)' : getRarityColor(r), color: r === 0 ? 'var(--text)' : getRarityColor(r) }
                : {}}
              onClick={() => setFilterRarity(r)}
            >
              {r === 0 ? '전체' : `${'★'.repeat(r)} ${RARITY_LABEL[r]}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {SORTS.map(s => (
            <button
              key={s.id}
              className={`btn btn-sm btn-ghost${sort === s.id ? ' active' : ''}`}
              style={sort === s.id ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 일괄 판매 버튼 */}
      {sorted.length > 0 && (
        <button
          className="btn btn-sm btn-full mb-12"
          style={{ borderColor: 'var(--fail)', color: 'var(--fail)', border: '1px solid', background: 'rgba(239,83,80,0.08)' }}
          onClick={bulkSell}
        >
          💸 일괄 판매 ({sorted.length}마리 · 🪙{formatCoins(totalSellPrice)})
        </button>
      )}

      {sorted.length === 0 ? (
        <div className="empty-inv">
          <div className="empty-icon">🎒</div>
          <div>
            {state.inventory.length === 0
              ? '가방이 비었습니다! 여행을 떠나 포켓몬을 잡으세요.'
              : '해당 조건의 포켓몬이 없습니다.'}
          </div>
        </div>
      ) : (
        <div className="inv-grid">
          {sorted.map(pokemon => {
            const power = calculatePower(pokemon);
            const name = getPokemonName(pokemon.pokemonId);
            const isLegendary = pokemon.rarity === 4;
            return (
              <div
                key={pokemon.instanceId}
                className={`inv-card${pokemon.isGolden ? ' golden' : ''}`}
                style={isLegendary && !pokemon.isGolden
                  ? { borderColor: '#e040fb', boxShadow: '0 0 8px rgba(224,64,251,0.3)' }
                  : {}}
                onClick={() => setSelectedPokemon(pokemon)}
              >
                {pokemon.enhanceLevel > 0 && (
                  <div className="enhance-level-badge">+{pokemon.enhanceLevel}</div>
                )}
                <img
                  src={getPokemonImageUrl(pokemon.pokemonId)}
                  alt={name}
                  className="inv-img"
                  style={pokemon.isGolden
                    ? { filter: 'sepia(0.3) brightness(1.4) drop-shadow(0 0 6px rgba(255,214,0,0.8))' }
                    : isLegendary
                    ? { filter: 'drop-shadow(0 0 6px rgba(224,64,251,0.6))' }
                    : {}}
                />
                <div className="inv-name" title={name}>{name}</div>
                <div className="inv-rarity" style={{ color: getRarityColor(pokemon.rarity) }}>
                  {'★'.repeat(pokemon.rarity)}
                </div>
                <div className={`inv-size-grade size-${pokemon.sizeGrade}`}>
                  {pokemon.sizeGrade}
                </div>
                <div className="inv-power">⚡{power.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPokemon && (
        <PokemonModal
          pokemon={selectedPokemon}
          onClose={() => setSelectedPokemon(null)}
        />
      )}
    </div>
  );
}
