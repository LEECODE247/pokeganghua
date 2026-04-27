import React, { useState, useMemo } from 'react';
import { useGame } from '../App.jsx';
import { ALL_POKEMON_BY_RARITY, GEN1_IDS, GEN2_IDS, POKEMON_TYPES, TYPE_META } from '../data/pokemonData.js';
import { EVOLUTIONS } from '../data/evolutionData.js';
import { getPokemonImageUrl, getPokemonShinyImageUrl, getPokemonName, getRarityColor } from '../utils/gameUtils.js';

const RARITY_INFO = [
  { rarity: 5, label: '★★★★★ 신화',  color: '#FF6B00' },
  { rarity: 4, label: '★★★★ 전설',   color: '#e040fb' },
  { rarity: 3, label: '★★★☆ 영웅',   color: '#ffd600' },
  { rarity: 2, label: '★★☆☆ 희귀',   color: '#42a5f5' },
  { rarity: 1, label: '★☆☆☆ 일반',   color: '#9e9e9e' },
];

const GEN1_SET = new Set(GEN1_IDS);
const GEN2_SET = new Set(GEN2_IDS);

const TABS = [
  { key: 'all',   label: '전체',  icon: '📖' },
  { key: 'gen1',  label: '1세대', icon: '🔴' },
  { key: 'gen2',  label: '2세대', icon: '🟡' },
  { key: 'shiny', label: '이로치', icon: '✨' },
  { key: 'evo',   label: '진화표', icon: '🔀' },
];

// EVOLUTIONS에서 전체 진화 체인 배열을 구성
function buildEvolutionChains(evolutions) {
  const allToIds = new Set(
    Object.values(evolutions).flatMap(e => Array.isArray(e.to) ? e.to : [e.to])
  );
  // 다른 포켓몬의 진화 대상이 아닌 것 = 체인의 시작점(루트)
  const roots = Object.keys(evolutions)
    .map(Number)
    .filter(id => !allToIds.has(id))
    .sort((a, b) => a - b);

  const chains = [];

  function traverse(id, chain) {
    const evo = evolutions[id];
    if (!evo) { chains.push(chain); return; }
    const targets = Array.isArray(evo.to) ? evo.to : [evo.to];
    for (const toId of targets) {
      traverse(toId, [...chain, { id: toId, at: evo.at }]);
    }
  }

  for (const root of roots) {
    traverse(root, [{ id: root, at: null }]);
  }
  return chains;
}

const ALL_CHAINS = buildEvolutionChains(EVOLUTIONS);

function RewardRow({ label, target, caught, rewarded, rewardDesc, rewardColor, onClaim }) {
  const reached = caught >= target;
  const canClaim = reached && !rewarded;
  return (
    <div style={{
      background: reached ? `${rewardColor}11` : 'var(--bg)',
      border: `1px solid ${reached ? rewardColor + '44' : 'var(--border)'}`,
      borderRadius: 8, padding: '8px 12px', marginTop: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <div style={{ fontSize: '0.75rem', color: reached ? rewardColor : 'var(--text2)', fontWeight: 700, flexShrink: 0 }}>
        {label} ({target}마리)
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', flex: 1 }}>{rewardDesc}</div>
      {canClaim && (
        <button
          className="btn"
          style={{ background: rewardColor, color: '#000', fontWeight: 800, fontSize: '0.72rem',
            padding: '4px 10px', borderRadius: 6, flexShrink: 0 }}
          onClick={onClaim}
        >🎁 수령</button>
      )}
      {rewarded && (
        <span style={{ fontSize: '0.72rem', color: rewardColor, fontWeight: 700, flexShrink: 0 }}>✅ 완료</span>
      )}
      {!reached && !rewarded && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text2)', flexShrink: 0 }}>🔒 {target - caught}마리 남음</span>
      )}
    </div>
  );
}

function GenCompletionCard({
  title, icon, ids, caughtSet, rewardColor,
  halfTarget, halfRewarded, halfRewardDesc, onClaimHalf,
  rewarded, rewardDesc, onClaim,
}) {
  const total = ids.length;
  const caught = ids.filter(id => caughtSet.has(id)).length;
  const pct = Math.round((caught / total) * 100);
  const isComplete = caught >= total;

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
      <div style={{ height: 7, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: isComplete
            ? `linear-gradient(90deg, ${rewardColor}, ${rewardColor}aa)`
            : 'linear-gradient(90deg, var(--primary), #42a5f5)',
          transition: 'width 0.4s ease',
        }} />
      </div>
      <RewardRow
        label="중간 보상" target={halfTarget} caught={caught}
        rewarded={halfRewarded} rewardDesc={halfRewardDesc}
        rewardColor={rewardColor} onClaim={onClaimHalf}
      />
      <RewardRow
        label="완성 보상" target={total} caught={caught}
        rewarded={rewarded} rewardDesc={rewardDesc}
        rewardColor={rewardColor} onClaim={onClaim}
      />
    </div>
  );
}

function PokemonNode({ id, caughtSet }) {
  const isCaught = caughtSet.has(id);
  return (
    <div style={{ textAlign: 'center', minWidth: 58 }}>
      <img
        src={getPokemonImageUrl(id)}
        alt={getPokemonName(id)}
        style={{
          width: 48, height: 48,
          objectFit: 'contain',
          imageRendering: 'pixelated',
          filter: isCaught ? undefined : 'brightness(0) contrast(0.25)',
          opacity: isCaught ? 1 : 0.5,
        }}
      />
      <div style={{
        fontSize: '0.58rem',
        color: isCaught ? 'var(--text)' : 'var(--text2)',
        fontWeight: isCaught ? 700 : 400,
        marginTop: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 58,
      }}>
        {isCaught ? getPokemonName(id) : '???'}
      </div>
    </div>
  );
}

function EvoArrow({ at }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 2, padding: '0 4px',
    }}>
      <div style={{ fontSize: '0.58rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>+{at}강</div>
      <div style={{ color: 'var(--primary)', fontSize: '1rem', lineHeight: 1 }}>→</div>
    </div>
  );
}

function EvolutionChainRow({ chain, caughtSet }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'nowrap',
      background: 'var(--surface, var(--card))',
      border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 10px', marginBottom: 6,
      overflowX: 'auto',
    }}>
      {chain.map((step, i) => (
        <React.Fragment key={`${step.id}-${i}`}>
          {step.at !== null && <EvoArrow at={step.at} />}
          <PokemonNode id={step.id} caughtSet={caughtSet} />
        </React.Fragment>
      ))}
    </div>
  );
}

function EvolutionTab({ caughtSet }) {
  const [genFilter, setGenFilter] = useState('all');

  const filteredChains = useMemo(() => {
    if (genFilter === 'all') return ALL_CHAINS;
    const genSet = genFilter === 'gen1' ? GEN1_SET : GEN2_SET;
    // 체인의 루트(첫 번째)가 해당 세대에 속한 경우만 표시
    return ALL_CHAINS.filter(chain => genSet.has(chain[0].id));
  }, [genFilter]);

  return (
    <div>
      {/* 세대 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ key: 'all', label: '전체' }, { key: 'gen1', label: '🔴 1세대' }, { key: 'gen2', label: '🟡 2세대' }].map(f => {
          const isActive = genFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setGenFilter(f.key)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8,
                border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: isActive ? 'var(--primary)' : 'var(--surface, var(--card))',
                color: isActive ? '#fff' : 'var(--text2)',
                fontWeight: isActive ? 800 : 500,
                fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.18s',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 10 }}>
        총 {filteredChains.length}개 진화 라인 · 어두운 포켓몬은 미획득
      </div>

      {filteredChains.map((chain, i) => (
        <EvolutionChainRow key={i} chain={chain} caughtSet={caughtSet} />
      ))}
    </div>
  );
}

export default function PokedexScreen() {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState('all');
  const caughtSet = new Set(state.pokedex || []);

  const allIds = Object.values(ALL_POKEMON_BY_RARITY).flat();
  const totalInGame = allIds.length;
  const totalCaught = allIds.filter(id => caughtSet.has(id)).length;
  const overallPct = Math.round((totalCaught / totalInGame) * 100);

  const filterSet = activeTab === 'gen1' ? GEN1_SET : activeTab === 'gen2' ? GEN2_SET : null;

  return (
    <div>
      <div className="section-title">📖 포켓몬 도감</div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10,
                border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: isActive ? 'var(--primary)' : 'var(--surface, var(--card))',
                color: isActive ? '#fff' : 'var(--text2)',
                fontWeight: isActive ? 800 : 500,
                fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.18s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* 진화표 탭 */}
      {activeTab === 'evo' && <EvolutionTab caughtSet={caughtSet} />}

      {/* 이로치 탭 */}
      {activeTab === 'shiny' && (() => {
        const shinySet = new Set(state.shinyPokedex || []);
        const genAllSet = new Set([...GEN1_IDS, ...GEN2_IDS]);
        // 이로치 도감 대상: 1~3성 1·2세대만
        const shinyTargetIds = [
          ...(ALL_POKEMON_BY_RARITY[1] || []),
          ...(ALL_POKEMON_BY_RARITY[2] || []),
          ...(ALL_POKEMON_BY_RARITY[3] || []),
        ].filter(id => genAllSet.has(id));
        const totalShiny = shinyTargetIds.length;
        const halfTarget = Math.ceil(totalShiny / 2);
        const caughtShiny = shinyTargetIds.filter(id => shinySet.has(id)).length;
        const pct = Math.round((caughtShiny / totalShiny) * 100);
        return (
          <div>
            {/* 진행률 */}
            <div style={{
              background: 'var(--surface, var(--card))',
              border: '1px solid #00e5ff44', borderRadius: 12,
              padding: '14px 16px', marginBottom: 14,
              boxShadow: caughtShiny > 0 ? '0 0 12px rgba(0,229,255,0.2)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#00e5ff' }}>✨ 이로치 도감 (1~3성)</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>{caughtShiny} / {totalShiny} ({pct}%)</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', borderRadius: 99, width: `${pct}%`,
                  background: 'linear-gradient(90deg, #00e5ff, #b388ff)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              {/* 절반 보상 */}
              <div style={{
                background: state.shinyPokedexHalfRewarded ? 'rgba(0,229,255,0.08)' : 'var(--bg)',
                border: `1px solid ${caughtShiny >= halfTarget ? '#00e5ff44' : 'var(--border)'}`,
                borderRadius: 8, padding: '8px 12px', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ fontSize: '0.75rem', color: caughtShiny >= halfTarget ? '#00e5ff' : 'var(--text2)', fontWeight: 700, flexShrink: 0 }}>
                  절반 달성 ({halfTarget}마리)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <img src={getPokemonShinyImageUrl(150)} alt="이로치 뮤츠" style={{ width: 32, height: 32, imageRendering: 'pixelated', filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.8))' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>이로치 뮤츠 S급 지급</span>
                </div>
                {caughtShiny >= halfTarget && !state.shinyPokedexHalfRewarded && (
                  <button className="btn" style={{ background: '#00e5ff', color: '#000', fontWeight: 800, fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6, flexShrink: 0 }}
                    onClick={() => dispatch({ type: 'CLAIM_SHINY_HALF_REWARD' })}>🎁 수령</button>
                )}
                {state.shinyPokedexHalfRewarded && <span style={{ fontSize: '0.72rem', color: '#00e5ff', fontWeight: 700, flexShrink: 0 }}>✅ 완료</span>}
                {caughtShiny < halfTarget && !state.shinyPokedexHalfRewarded && <span style={{ fontSize: '0.72rem', color: 'var(--text2)', flexShrink: 0 }}>🔒 {halfTarget - caughtShiny}마리 남음</span>}
              </div>
              {/* 완성 보상 */}
              <div style={{
                background: state.shinyPokedexRewarded ? 'rgba(179,136,255,0.08)' : 'var(--bg)',
                border: `1px solid ${caughtShiny >= totalShiny ? '#b388ff44' : 'var(--border)'}`,
                borderRadius: 8, padding: '8px 12px', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ fontSize: '0.75rem', color: caughtShiny >= totalShiny ? '#b388ff' : 'var(--text2)', fontWeight: 700, flexShrink: 0 }}>
                  완성 보상 ({totalShiny}마리)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <img src={getPokemonShinyImageUrl(493)} alt="이로치 아르세우스" style={{ width: 32, height: 32, imageRendering: 'pixelated', filter: 'drop-shadow(0 0 4px rgba(179,136,255,0.8))' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>이로치 아르세우스 S급 지급</span>
                </div>
                {caughtShiny >= totalShiny && !state.shinyPokedexRewarded && (
                  <button className="btn" style={{ background: '#b388ff', color: '#000', fontWeight: 800, fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6, flexShrink: 0 }}
                    onClick={() => dispatch({ type: 'CLAIM_SHINY_FULL_REWARD' })}>🎁 수령</button>
                )}
                {state.shinyPokedexRewarded && <span style={{ fontSize: '0.72rem', color: '#b388ff', fontWeight: 700, flexShrink: 0 }}>✅ 완료</span>}
                {caughtShiny < totalShiny && !state.shinyPokedexRewarded && <span style={{ fontSize: '0.72rem', color: 'var(--text2)', flexShrink: 0 }}>🔒 {totalShiny - caughtShiny}마리 남음</span>}
              </div>
            </div>

            {/* 이로치 도감 그리드 (1~3성만) */}
            {[3,2,1].map(rarity => {
              const ids = (ALL_POKEMON_BY_RARITY[rarity] || []).filter(id => genAllSet.has(id));
              if (ids.length === 0) return null;
              const caughtCount = ids.filter(id => shinySet.has(id)).length;
              const color = getRarityColor(rarity);
              return (
                <div key={rarity} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color, fontWeight: 800, fontSize: '0.9rem' }}>{'★'.repeat(rarity)} {['','일반','희귀','영웅','전설','신화'][rarity]}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{caughtCount} / {ids.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
                    {ids.map(id => {
                      const isCaught = shinySet.has(id);
                      return (
                        <div key={id} style={{
                          background: isCaught ? 'rgba(0,229,255,0.08)' : 'var(--surface, var(--card))',
                          border: `1px solid ${isCaught ? '#00e5ff55' : 'var(--border)'}`,
                          borderRadius: 10, padding: '6px 4px', textAlign: 'center',
                          opacity: isCaught ? 1 : 0.4,
                          boxShadow: isCaught ? '0 0 8px rgba(0,229,255,0.3)' : 'none',
                        }}>
                          <img
                            src={isCaught ? getPokemonShinyImageUrl(id) : getPokemonImageUrl(id)}
                            alt={isCaught ? getPokemonName(id) : '???'}
                            style={{
                              width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated',
                              filter: isCaught
                                ? 'drop-shadow(0 0 4px rgba(0,229,255,0.8))'
                                : 'brightness(0) contrast(0.3)',
                            }}
                          />
                          <div style={{
                            fontSize: '0.6rem',
                            color: isCaught ? '#00e5ff' : 'var(--text2)',
                            marginTop: 2, fontWeight: isCaught ? 700 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {isCaught ? getPokemonName(id) : '???'}
                          </div>
                          {isCaught && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3, flexWrap: 'wrap' }}>
                              {(POKEMON_TYPES[id] || ['normal']).map(t => {
                                const meta = TYPE_META[t] || { label: t, color: '#888' };
                                return <span key={t} style={{ background: meta.color, color: '#fff', fontSize: '0.42rem', fontWeight: 800, padding: '1px 4px', borderRadius: 6 }}>{meta.label}</span>;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 도감 탭들 (전체/1세대/2세대) */}
      {activeTab !== 'evo' && activeTab !== 'shiny' && (
        <>
          {(activeTab === 'all' || activeTab === 'gen1') && (
            <GenCompletionCard
              title="1세대 도감"
              icon="🔴"
              ids={GEN1_IDS}
              caughtSet={caughtSet}
              rewardColor="#ffd600"
              halfTarget={80}
              halfRewarded={state.pokedex1HalfRewarded}
              halfRewardDesc="💎 파편 5,000개"
              onClaimHalf={() => dispatch({ type: 'CLAIM_POKEDEX1_HALF_REWARD' })}
              rewarded={state.pokedex1Rewarded}
              rewardDesc="💎 파편 10,000개"
              onClaim={() => dispatch({ type: 'CLAIM_POKEDEX1_REWARD' })}
            />
          )}
          {(activeTab === 'all' || activeTab === 'gen2') && (
            <GenCompletionCard
              title="2세대 도감"
              icon="🟡"
              ids={GEN2_IDS}
              caughtSet={caughtSet}
              rewardColor="#e040fb"
              halfTarget={50}
              halfRewarded={state.pokedex2HalfRewarded}
              halfRewardDesc="랜덤 +18강 S급 ★3 포켓몬"
              onClaimHalf={() => dispatch({ type: 'CLAIM_POKEDEX2_HALF_REWARD' })}
              rewarded={state.pokedex2Rewarded}
              rewardDesc="랜덤 +15강 S급 ★4 포켓몬"
              onClaim={() => dispatch({ type: 'CLAIM_POKEDEX2_REWARD' })}
            />
          )}

          {activeTab === 'all' && (
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
          )}

          {RARITY_INFO.map(({ rarity, label, color }) => {
            const ids = (ALL_POKEMON_BY_RARITY[rarity] || []).filter(id =>
              filterSet ? filterSet.has(id) : true
            );
            if (ids.length === 0) return null;
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
                        borderRadius: 10, padding: '6px 4px', textAlign: 'center',
                        opacity: isCaught ? 1 : 0.45, transition: 'opacity 0.2s',
                        boxShadow: isCaught && isMythical ? `0 0 10px ${color}66` : 'none',
                      }}>
                        <img
                          src={getPokemonImageUrl(id)}
                          alt={isCaught ? getPokemonName(id) : '???'}
                          style={{
                            width: 48, height: 48, objectFit: 'contain',
                            imageRendering: 'pixelated',
                            filter: isCaught
                              ? (isMythical ? 'drop-shadow(0 0 4px #FF6B00)' : undefined)
                              : 'brightness(0) contrast(0.3)',
                          }}
                        />
                        <div style={{
                          fontSize: '0.6rem',
                          color: isCaught ? (isMythical ? '#FF6B00' : 'var(--text)') : 'var(--text2)',
                          marginTop: 2, fontWeight: isCaught ? 600 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {isCaught ? getPokemonName(id) : '???'}
                        </div>
                        {isCaught && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3, flexWrap: 'wrap' }}>
                            {(POKEMON_TYPES[id] || ['normal']).map(t => {
                              const meta = TYPE_META[t] || { label: t, color: '#888' };
                              return <span key={t} style={{ background: meta.color, color: '#fff', fontSize: '0.42rem', fontWeight: 800, padding: '1px 4px', borderRadius: 6 }}>{meta.label}</span>;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
