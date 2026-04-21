import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonName, getRarityColor, getRarityStars,
  calculatePower, calculateSellPrice, formatCoins, getTeamSynergies, SYNERGY_CATALOG,
  getTypeAdvantage,
} from '../utils/gameUtils.js';
import { POKEMON_TYPES, TYPE_META } from '../data/pokemonData.js';
import { POKEMON_TYPE, TYPE_MOVES } from '../data/pokemonData.js';
import { updateBattlePokemon, fetchBattlePlayers, fetchRankData } from '../supabase.js';

const OPP_MOVES   = ['💢 역린', '☠️ 독침', '🌊 파도타기', '🪨 돌진', '🌀 하이퍼빔', '⭐ 찬란한바람'];
const ROUND_DUR   = 5800;
const ROUND_GAP   = 1600;

function isLegend(p) { return p && p.rarity >= 4; }

function canAssignToSlot(slot, pokemon, battleTeam, inventory) {
  const hasLegendElsewhere = battleTeam.some((id, i) => {
    if (i === slot || !id) return false;
    const p = inventory.find(x => x.instanceId === id);
    return isLegend(p);
  });
  return !(isLegend(pokemon) && hasLegendElsewhere);
}

function makeSlotData(p, multiplier = 1) {
  if (!p) return null;
  return { pokemonId: p.pokemonId, rarity: p.rarity, sizeGrade: p.sizeGrade,
    enhanceLevel: p.enhanceLevel, isGolden: p.isGolden,
    power: Math.round(calculatePower(p) * multiplier), sellPrice: calculateSellPrice(p) };
}

function computeRound(myPokemon, oppData, myMultiplier = 1) {
  const myTypes  = POKEMON_TYPES[myPokemon.pokemonId] || ['normal'];
  const oppTypes = POKEMON_TYPES[oppData.pokemonId]   || ['normal'];
  const typeAdv  = getTypeAdvantage(myTypes, oppTypes);

  const myPow  = Math.round(calculatePower(myPokemon) * myMultiplier * typeAdv.multiplier);
  const oppPow = oppData.power || 1;
  const ratio  = myPow / oppPow;
  const r2     = ratio * ratio;
  const winChance = Math.min(0.98, Math.max(0.02, r2 / (r2 + 1)));
  const won = Math.random() < winChance;

  const myType  = POKEMON_TYPE[myPokemon.pokemonId] ?? 'normal';
  const myPool  = TYPE_MOVES[myType]  ?? TYPE_MOVES.normal;
  const oppType = POKEMON_TYPE[oppData.pokemonId]   ?? 'normal';
  const oppPool = TYPE_MOVES[oppType] ?? TYPE_MOVES.normal;
  const moves = [
    myPool [Math.floor(Math.random() * myPool.length)],
    oppPool[Math.floor(Math.random() * oppPool.length)],
    myPool [Math.floor(Math.random() * myPool.length)],
  ];
  const oppHp1 = won ? Math.max(22, Math.round(72 - ratio * 45))     : Math.max(55, Math.round(88 - ratio * 28));
  const myHp1  = won ? Math.max(45, Math.round(85 - (1/ratio) * 22)) : Math.max(12, Math.round(62 - (1/ratio) * 30));
  return { won, moves, typeAdvLabel: typeAdv.label, typeAdvMult: typeAdv.multiplier, oppHp1, myHp1, oppHpFinal: won ? 0 : oppHp1, myHpFinal: won ? myHp1 : 0 };
}

const hpColor = hp => hp > 50 ? '#4caf50' : hp > 20 ? '#ffd600' : '#ef5350';

/* ── HP 바 컴포넌트 ─────────────────────────────────────────── */
function HpBox({ name, hp, right }) {
  return (
    <div className={`bov-hpbox-v2${right ? ' bov-hpbox-v2-my' : ''}`}>
      <div className="bov-hp-name">{name}</div>
      <div className="bov-hp-row">
        {right && <span className="bov-hp-val" style={{ color: hpColor(hp) }}>{hp}</span>}
        {right && <div className="bov-hp-bar-track">
          <div className="bov-hp-bar-fill" style={{ width: `${hp}%`, background: hpColor(hp), boxShadow: `0 0 8px ${hpColor(hp)}` }} />
        </div>}
        {!right && <div className="bov-hp-bar-track">
          <div className="bov-hp-bar-fill" style={{ width: `${hp}%`, background: hpColor(hp), boxShadow: `0 0 8px ${hpColor(hp)}` }} />
        </div>}
        {!right && <span className="bov-hp-val" style={{ color: hpColor(hp) }}>{hp}</span>}
        <span className="bov-hp-tag">HP</span>
      </div>
    </div>
  );
}

/* ── 슬롯 카드 ──────────────────────────────────────────────── */
function SlotCard({ idx, pokemon, effectivePow, multiplier, synIcon, synColor, activeSyns, onSelect, onClear }) {
  const label  = `슬롯 ${idx + 1}`;
  const color  = pokemon ? getRarityColor(pokemon.rarity) : 'rgba(255,255,255,0.15)';
  const filled = !!pokemon;
  const rawPow = pokemon ? calculatePower(pokemon) : 0;
  const dispPow = effectivePow ?? rawPow;
  const hasSynergy = multiplier && multiplier > 1;
  const bonusPow = hasSynergy ? dispPow - rawPow : 0;
  const synHighlight = synColor || '#ffd600';

  return (
    <div
      className={`battle-slot-card ${filled ? 'filled' : 'empty'}`}
      style={filled ? {
        border: `2px solid ${hasSynergy ? synHighlight : color}55`,
        boxShadow: `0 0 16px ${hasSynergy ? synHighlight + '33' : color + '22'}`,
      } : {}}
    >
      {filled ? (
        <>
          <div style={{
            position: 'absolute', top: 6, left: 8, fontSize: '0.58rem',
            fontWeight: 800, color: hasSynergy ? synHighlight : color, letterSpacing: 1,
          }}>{label}</div>
          <img src={getPokemonImageUrl(pokemon.pokemonId)}
            style={{ width: 60, height: 60, imageRendering: 'pixelated', objectFit: 'contain',
              filter: `drop-shadow(0 0 8px ${color}88)` }} alt="" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 3, width: '100%' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {getPokemonName(pokemon.pokemonId)}
            </span>
            {activeSyns?.map(syn => (
              <span key={syn.id} title={syn.name} style={{ fontSize: '0.72rem', flexShrink: 0 }}>{syn.icon}</span>
            ))}
          </div>
          {/* 타입 뱃지 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 3 }}>
            {(POKEMON_TYPES[pokemon.pokemonId] || ['normal']).map(t => {
              const meta = TYPE_META[t] || TYPE_META.normal;
              return (
                <span key={t} style={{
                  background: meta.color, color: '#fff',
                  fontSize: '0.44rem', fontWeight: 800,
                  padding: '1px 4px', borderRadius: 8,
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}>{meta.label}</span>
              );
            })}
          </div>
          <div style={{ fontSize: '0.6rem', color, marginTop: 2 }}>
            {getRarityStars(pokemon.rarity)}{pokemon.enhanceLevel > 0 ? ` +${pokemon.enhanceLevel}` : ''}
          </div>
          {/* 전투력 */}
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>
              ⚡{rawPow.toLocaleString()}
            </div>
            {hasSynergy && (
              <div style={{ fontSize: '0.52rem', fontWeight: 800, color: synHighlight, letterSpacing: 0 }}>
                (+{bonusPow.toLocaleString()} {synIcon || '🔗'})
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
            <button onClick={onSelect} style={{
              fontSize: '0.58rem', padding: '2px 8px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            }}>변경</button>
            <button onClick={onClear} style={{
              fontSize: '0.58rem', padding: '2px 8px', borderRadius: 6,
              border: '1px solid rgba(239,83,80,0.5)', background: 'rgba(239,83,80,0.08)',
              color: '#ef5350', cursor: 'pointer',
            }}>해제</button>
          </div>
        </>
      ) : (
        <div onClick={onSelect} style={{ paddingTop: 6 }}>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: 1 }}>{label}</div>
          <div style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.12)', lineHeight: 1 }}>＋</div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>선택</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ 메인 컴포넌트 ═══════════════════════════ */
export default function BattleScreen() {
  const { state, dispatch, accountId, nickname } = useGame();
  const { inventory, battleTeam } = state;

  const [tab, setTab]             = useState('battle');
  const [players, setPlayers]     = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [rankData, setRankData]   = useState([]);
  const [rankSort, setRankSort]   = useState('power'); // 'power' | 'winrate'
  const [rankLoading, setRankLoading] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [selectingSlot, setSelectingSlot] = useState(null);
  const [matchAnim, setMatchAnim] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [isBattling, setIsBattling] = useState(false);
  const timers      = useRef([]);

  const myTeam   = battleTeam.map(id => id ? (inventory.find(p => p.instanceId === id) || null) : null);
  const teamReady = myTeam.every(Boolean);
  const legendCount = myTeam.filter(p => isLegend(p)).length;

  // 시너지 계산
  const synergies = getTeamSynergies(myTeam);
  const myEffPows = myTeam.map((p, i) => p ? Math.round(calculatePower(p) * synergies.multipliers[i]) : 0);
  const myTotalPow = myEffPows.reduce((s, v) => s + v, 0);
  const myRawPow   = myTeam.reduce((s, p) => s + (p ? calculatePower(p) : 0), 0);

  // 슬롯별 시너지 메타 (아이콘, 컬러, 승수, 전체 목록)
  const slotSynData = myTeam.map((p, i) => {
    const mult          = synergies.multipliers[i];
    const rawP          = p ? calculatePower(p) : 0;
    const effP          = p ? Math.round(rawP * mult) : 0;
    const activeForSlot = synergies.active.filter(s => s.appliedSlots?.includes(i));
    const primarySyn    = activeForSlot[0] || null;
    return {
      effectivePow: effP, multiplier: mult,
      synIcon: primarySyn?.icon ?? null, synColor: primarySyn?.color ?? null,
      activeSyns: activeForSlot,
    };
  });

  const today = new Date().toDateString();
  const dailyCount = state.battleResetDate === today ? (state.dailyBattleCount || 0) : 0;
  const battleLimitReached = dailyCount >= 10;

  /* ── Supabase 동기화 ─────────────────────────────────────── */
  const syncKey = battleTeam.join('-');
  useEffect(() => {
    if (!accountId) return;
    updateBattlePokemon(accountId,
      teamReady ? myTeam.map((p, i) => makeSlotData(p, synergies.multipliers[i])) : null
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, accountId]);

  /* ── 상대 목록 ───────────────────────────────────────────── */
  const loadPlayers = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const data = await fetchBattlePlayers(accountId);
    setPlayers(data.filter(p => Array.isArray(p.battle_pokemon) && p.battle_pokemon.length === 3));
    setLoading(false);
  }, [accountId]);

  /* ── 랭크 목록 ───────────────────────────────────────────── */
  const loadRank = useCallback(async () => {
    setRankLoading(true);
    const data = await fetchRankData();
    const processed = data
      .filter(p => Array.isArray(p.battle_pokemon) && p.battle_pokemon.length === 3)
      .map(p => {
        const gs = p.game_state || {};
        const totalBattles = gs.totalBattles || 0;
        const totalWins    = gs.totalWins    || 0;
        const winRate      = totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;
        const totalPower   = p.battle_pokemon.reduce((s, m) => s + (m?.power || 0), 0);
        return { ...p, totalBattles, totalWins, winRate, totalPower };
      })
      .sort((a, b) => b.totalPower - a.totalPower); // 기본 전투력순, 실제 정렬은 렌더링 시 rankSort로
    setRankData(processed);
    setRankLoading(false);
  }, []);

  useEffect(() => {
    loadPlayers();
    const iv = setInterval(loadPlayers, 30000);
    return () => clearInterval(iv);
  }, [loadPlayers]);

  useEffect(() => {
    if (tab === 'rank') loadRank();
  }, [tab, loadRank]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* ── 배틀 시작 ───────────────────────────────────────────── */
  function startBattle(opponent) {
    if (!teamReady || isBattling || battleLimitReached) return;
    setIsBattling(true);
    setMatchResult(null);

    const oppTeam = opponent.battle_pokemon;
    const { multipliers: myMults } = getTeamSynergies(myTeam);
    let myW = 0, oppW = 0;
    const rounds = [];
    for (let i = 0; i < 3; i++) {
      const r = computeRound(myTeam[i], oppTeam[i], myMults[i]);
      rounds.push(r);
      if (r.won) myW++; else oppW++;
      if (myW === 2 || oppW === 2) break;
    }

    const matchWon = myW > oppW;
    const prize = matchWon ? oppTeam.reduce((s, p) => s + (p?.sellPrice || 0), 0) : 0;

    setMatchAnim({ opponent, rounds, roundIdx: 0, step: 0, myHp: 100, oppHp: 100,
      moveName: null, myWins: 0, oppWins: 0 });

    const add = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

    for (let ri = 0; ri < rounds.length; ri++) {
      const base = ri * (ROUND_DUR + ROUND_GAP);
      const r    = rounds[ri];

      add(() => setMatchAnim(f => ({ ...f, roundIdx: ri, step: 0, myHp: 100, oppHp: 100, moveName: null })), base);
      add(() => setMatchAnim(f => ({ ...f, step: 1, moveName: r.moves[0] })), base + 700);
      add(() => setMatchAnim(f => ({ ...f, step: 2, oppHp: r.oppHp1 })),      base + 1250);
      add(() => setMatchAnim(f => ({ ...f, step: 3, moveName: r.moves[1] })), base + 2150);
      add(() => setMatchAnim(f => ({ ...f, step: 4, myHp: r.myHp1 })),        base + 2700);
      add(() => setMatchAnim(f => ({ ...f, step: 5, moveName: r.moves[2] })), base + 3550);
      add(() => setMatchAnim(f => ({ ...f, step: 6, oppHp: r.oppHpFinal, myHp: r.myHpFinal })), base + 4100);
      add(() => setMatchAnim(f => ({
        ...f, step: 7,
        myWins:  f.myWins  + (r.won ? 1 : 0),
        oppWins: f.oppWins + (r.won ? 0 : 1),
      })), base + 4900);
    }

    const total = rounds.length * (ROUND_DUR + ROUND_GAP);
    add(() => {
      setMatchAnim(null);
      dispatch({ type: matchWon ? 'BATTLE_WIN' : 'BATTLE_LOSE', coins: prize });
      setMatchResult({ won: matchWon, myWins: myW, oppWins: oppW, prize, rounds, opponent });
      setIsBattling(false);
      timers.current = [];
    }, total);
  }

  /* ── 슬롯용 인벤토리 필터 ────────────────────────────────── */
  function getAvailableForSlot(slotIdx) {
    return [...inventory]
      .filter(p => {
        if (battleTeam.some((id, i) => i !== slotIdx && id === p.instanceId)) return false;
        return canAssignToSlot(slotIdx, p, battleTeam, inventory);
      })
      .sort((a, b) => calculatePower(b) - calculatePower(a));
  }

  /* ════════════════════ RENDER ══════════════════════════════ */
  return (
    <div>

      {/* ── 헤더 ──────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30,10,60,0.8) 0%, rgba(10,5,25,0.8) 100%)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
        padding: '14px 16px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: 2, color: '#fff' }}>⚔️ PLAYER BATTLE</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 2, letterSpacing: 1 }}>
            3판 2선승제 · 팀 3마리
          </div>
        </div>
        <div style={{
          background: battleLimitReached ? 'rgba(239,83,80,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${battleLimitReached ? '#ef5350' : 'rgba(99,102,241,0.4)'}`,
          borderRadius: 10, padding: '6px 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: battleLimitReached ? '#ef5350' : '#fff' }}>
            {dailyCount}<span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>/10</span>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>TODAY</div>
        </div>
      </div>

      {/* ── 탭 ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['battle', '⚔️ 배틀하기'], ['rank', '🏆 랭크'], ['register', '🛡️ 팀 편성']].map(([id, label]) => (
          <button key={id}
            onClick={() => { setTab(id); setSelectingSlot(null); setMatchResult(null); }}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
              border: tab === id ? '2px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.08)',
              background: tab === id
                ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(66,133,244,0.2) 100%)'
                : 'rgba(255,255,255,0.03)',
              color: tab === id ? '#fff' : 'rgba(255,255,255,0.4)',
              fontWeight: tab === id ? 800 : 500, fontSize: '0.85rem',
              boxShadow: tab === id ? '0 0 16px rgba(99,102,241,0.25)' : 'none',
              transition: 'all 0.2s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ════════ 랭크 탭 ════════ */}
      {tab === 'rank' && (
        <div>
          {/* 정렬 + 새로고침 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            {[['power', '⚡ 전투력순'], ['winrate', '🏆 승률순']].map(([key, label]) => (
              <button key={key} onClick={() => setRankSort(key)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                border: rankSort === key ? '2px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.08)',
                background: rankSort === key
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(66,133,244,0.2) 100%)'
                  : 'rgba(255,255,255,0.03)',
                color: rankSort === key ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: rankSort === key ? 800 : 500,
                fontSize: '0.8rem', transition: 'all 0.2s',
              }}>{label}</button>
            ))}
            <button onClick={loadRank} disabled={rankLoading} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0,
            }}>{rankLoading ? '...' : '🔄'}</button>
          </div>
          {rankLoading ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0' }}>불러오는 중...</div>
          ) : rankData.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '40px 0' }}>등록된 플레이어가 없습니다</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...rankData]
                .sort((a, b) => rankSort === 'winrate'
                  ? b.winRate - a.winRate || b.totalBattles - a.totalBattles
                  : b.totalPower - a.totalPower)
                .map((player, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                const crown = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.15)';
                const isMe = player.id === accountId;

                return (
                  <div key={player.id} style={{
                    borderRadius: 14, padding: '12px 14px',
                    background: isTop3
                      ? `linear-gradient(135deg, rgba(20,10,50,0.95) 0%, rgba(8,4,20,0.95) 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: isTop3
                      ? `1.5px solid ${rankColor}`
                      : `1px solid rgba(255,255,255,0.07)`,
                    boxShadow: isTop3 ? `0 0 16px ${rankColor}44, inset 0 0 20px ${rankColor}08` : 'none',
                    animation: isTop3 ? 'rankShimmer 2s ease-in-out infinite alternate' : 'none',
                    '--rank-color': rankColor,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* 배경 글로우 */}
                    {isTop3 && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: `radial-gradient(ellipse at 0% 50%, ${rankColor}0a 0%, transparent 60%)`,
                      }} />
                    )}

                    {/* 상단: 순위 + 닉네임 + 전투력 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: isTop3 ? `${rankColor}22` : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${rankColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isTop3 ? '1.2rem' : '0.8rem',
                        fontWeight: 900, color: rankColor,
                      }}>
                        {crown || rank}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isMe ? '#42a5f5' : '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {player.nickname}
                          {isMe && <span style={{ fontSize: '0.6rem', color: '#42a5f5', background: 'rgba(66,165,245,0.15)', padding: '1px 6px', borderRadius: 4 }}>나</span>}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                          ⚡{player.totalPower.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 900, color: rankColor }}>{player.winRate}%</div>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>승률</div>
                      </div>
                    </div>

                    {/* 팀 포켓몬 + 배틀수 */}
                    {(() => {
                      const pSyns = getTeamSynergies(player.battle_pokemon).active;
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                              {player.battle_pokemon.map((p, i) => p && (
                                <div key={i} style={{ textAlign: 'center' }}>
                                  <div style={{
                                    width: 42, height: 42, borderRadius: 9,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${getRarityColor(p.rarity)}33`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <img src={getPokemonImageUrl(p.pokemonId)}
                                      style={{ width: 34, height: 34, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
                                  </div>
                                  <div style={{ fontSize: '0.5rem', color: getRarityColor(p.rarity), marginTop: 2 }}>
                                    {'★'.repeat(p.rarity)}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div style={{
                              textAlign: 'right', flexShrink: 0,
                              fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
                            }}>
                              <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{player.totalBattles}전</div>
                              <div>{player.totalWins}승 {player.totalBattles - player.totalWins}패</div>
                            </div>
                          </div>
                          {pSyns.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                              {pSyns.map(syn => (
                                <span key={syn.id} style={{
                                  background: `${syn.color}22`,
                                  border: `1px solid ${syn.color}55`,
                                  color: syn.color,
                                  fontSize: '0.57rem', fontWeight: 800,
                                  padding: '2px 7px', borderRadius: 10,
                                }}>{syn.icon} {syn.name} ×{syn.multiplier}</span>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════ 팀 편성 탭 ════════ */}
      {tab === 'register' && (
        <>
          {/* 제약 안내 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '8px 12px', marginBottom: 12,
            fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)',
          }}>
            <span style={{ fontSize: '1.1rem' }}>📋</span>
            <span>
              ★4·★5 <b style={{ color: '#ffd600' }}>1마리</b>만 · 나머지는 ★3 이하
              {legendCount > 0 && <span style={{ color: '#e040fb', marginLeft: 6 }}>● 전설 등록됨</span>}
            </span>
          </div>

          {selectingSlot === null ? (
            <>
              {/* 슬롯 3개 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[0, 1, 2].map(i => (
                  <SlotCard key={i} idx={i} pokemon={myTeam[i]}
                    effectivePow={slotSynData[i].effectivePow}
                    multiplier={slotSynData[i].multiplier}
                    synIcon={slotSynData[i].synIcon}
                    synColor={slotSynData[i].synColor}
                    activeSyns={slotSynData[i].activeSyns}
                    onSelect={() => setSelectingSlot(i)}
                    onClear={() => dispatch({ type: 'SET_BATTLE_SLOT', slot: i, pokemonId: null })}
                  />
                ))}
              </div>

              {/* 팀 파워 바 */}
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>TEAM POWER</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>⚡{myTotalPow.toLocaleString()}</span>
                    {myTotalPow !== myRawPow && (
                      <span style={{ fontSize: '0.65rem', color: '#ffd600', marginLeft: 6 }}>
                        (원본 {myRawPow.toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min(100, (myTotalPow / 150000) * 100)}%`,
                    background: 'linear-gradient(90deg, #6366f1, #42a5f5)',
                    boxShadow: '0 0 10px rgba(99,102,241,0.6)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {teamReady ? (
                  <div style={{ marginTop: 10, textAlign: 'center', color: '#4caf50', fontSize: '0.8rem', fontWeight: 800, letterSpacing: 2 }}>✅ READY TO BATTLE</div>
                ) : (
                  <div style={{ marginTop: 8, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>
                    {3 - myTeam.filter(Boolean).length}마리 더 등록하세요
                  </div>
                )}
              </div>

              {/* ── 시너지 조합표 (통합) ── */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 10 }}>
                  🔗 시너지 조합표
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SYNERGY_CATALOG.map(item => {
                    const isType = item.fixedId === 'type3' || item.fixedId === 'type2';
                    const prefix = item.fixedId === 'type3' ? 'type3_' : 'type2_';

                    // 혜택 태그 (이름 옆 인라인)
                    const BonusTag = ({ bonus, color, active }) => (
                      <span style={{
                        display: 'inline-block',
                        background: active ? `${color}33` : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${active ? color + '55' : 'rgba(255,255,255,0.12)'}`,
                        color: active ? color : 'rgba(255,255,255,0.45)',
                        fontSize: '0.55rem', fontWeight: 900,
                        padding: '1px 6px', borderRadius: 6,
                        marginLeft: 5, verticalAlign: 'middle',
                        letterSpacing: '0.02em',
                      }}>{bonus}</span>
                    );

                    if (isType) {
                      // 타입 시너지: 활성인 것들 나열, 없으면 카탈로그 항목 1개 표시
                      const actives = synergies.active.filter(s => s.id.startsWith(prefix));
                      if (actives.length > 0) {
                        return actives.map(syn => (
                          <div key={syn.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: `linear-gradient(90deg, ${syn.color}20, transparent)`,
                            border: `1px solid ${syn.color}66`,
                            borderRadius: 8, padding: '7px 10px',
                          }}>
                            <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: syn.color }}>
                                {syn.name}
                                <BonusTag bonus={item.bonus} color={syn.color} active />
                              </div>
                              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{syn.desc}</div>
                            </div>
                            <div style={{
                              background: `${syn.color}33`, border: `1px solid ${syn.color}66`,
                              borderRadius: 6, padding: '2px 8px',
                              fontSize: '0.72rem', fontWeight: 900, color: syn.color, flexShrink: 0,
                            }}>✓</div>
                          </div>
                        ));
                      }
                      return (
                        <div key={item.fixedId} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: 8, padding: '7px 10px', opacity: 0.45,
                        }}>
                          <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: item.color }}>
                              {item.name}
                              <BonusTag bonus={item.bonus} color={item.color} active={false} />
                            </div>
                            <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{item.desc}</div>
                          </div>
                        </div>
                      );
                    }

                    // 고정 시너지
                    const activeSyn  = synergies.active.find(s => s.id === item.fixedId);
                    const partialSyn = synergies.partial.find(s => s.id === item.fixedId);
                    const isActive   = !!activeSyn;
                    const isPartial  = !isActive && !!partialSyn;

                    return (
                      <div key={item.fixedId} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: isActive
                          ? `linear-gradient(90deg, ${item.color}20, transparent)`
                          : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${isActive ? item.color + '66' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: 8, padding: '7px 10px',
                        opacity: (!isActive && !isPartial) ? 0.45 : 1,
                        transition: 'all 0.25s',
                      }}>
                        <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: isActive ? item.color : 'rgba(255,255,255,0.55)' }}>
                            {item.name}
                            <BonusTag bonus={item.bonus} color={item.color} active={isActive} />
                          </div>
                          <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{item.desc}</div>
                          {isPartial && (
                            <div style={{ fontSize: '0.55rem', color: 'rgba(255,200,100,0.55)', marginTop: 2 }}>
                              필요: {partialSyn.missing?.join(' · ')}
                            </div>
                          )}
                        </div>
                        {isActive ? (
                          <div style={{
                            background: `${item.color}33`, border: `1px solid ${item.color}66`,
                            borderRadius: 6, padding: '2px 8px',
                            fontSize: '0.72rem', fontWeight: 900, color: item.color, flexShrink: 0,
                          }}>✓</div>
                        ) : isPartial ? (
                          <div style={{ fontSize: '0.65rem', color: 'rgba(255,200,100,0.5)', flexShrink: 0 }}>
                            {partialSyn.foundCount}/3
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* 인벤토리 피커 */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <button onClick={() => setSelectingSlot(null)} style={{
                  padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.8rem', cursor: 'pointer',
                }}>← 뒤로</button>
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>슬롯 {selectingSlot + 1} — 포켓몬 선택</span>
              </div>
              {getAvailableForSlot(selectingSlot).length === 0
                ? <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 24 }}>등록 가능한 포켓몬이 없습니다.</div>
                : (
                  <div className="inv-grid">
                    {getAvailableForSlot(selectingSlot).map(p => (
                      <div key={p.instanceId} className={`inv-card${p.isGolden ? ' golden' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => { dispatch({ type: 'SET_BATTLE_SLOT', slot: selectingSlot, pokemonId: p.instanceId }); setSelectingSlot(null); }}
                      >
                        {p.enhanceLevel > 0 && <div className="enhance-level-badge">+{p.enhanceLevel}</div>}
                        <img src={getPokemonImageUrl(p.pokemonId)} alt="" className="inv-img" />
                        <div className="inv-name">{getPokemonName(p.pokemonId)}</div>
                        <div style={{ color: getRarityColor(p.rarity), fontSize: '0.65rem' }}>{'★'.repeat(p.rarity)}</div>
                        <div className="inv-power">⚡{calculatePower(p).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </>
      )}

      {/* ════════ 배틀하기 탭 ════════ */}
      {tab === 'battle' && (
        <>
          {/* 내 팀 미니 카드 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(20,10,50,0.9) 0%, rgba(8,4,20,0.9) 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 14, padding: '12px 14px', marginBottom: 14,
            boxShadow: '0 4px 20px rgba(99,102,241,0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.4)' }}>MY TEAM</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'rgba(99,102,241,0.8)', fontWeight: 700 }}>⚡{myTotalPow.toLocaleString()}</span>
                {myTotalPow !== myRawPow && (
                  <span style={{ fontSize: '0.6rem', color: '#ffd600', marginLeft: 5 }}>시너지↑</span>
                )}
              </div>
            </div>
            {/* 활성 시너지 뱃지 */}
            {synergies.active.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {synergies.active.map(syn => (
                  <span key={syn.id} style={{
                    background: `${syn.color || '#6366f1'}33`,
                    border: `1px solid ${syn.color || '#6366f1'}66`,
                    color: syn.color || '#fff',
                    fontSize: '0.58rem', fontWeight: 800,
                    padding: '2px 7px', borderRadius: 10,
                  }}>{syn.icon} {syn.name} ×{syn.multiplier}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  {myTeam[i] ? (
                    <>
                      <img src={getPokemonImageUrl(myTeam[i].pokemonId)}
                        style={{ width: 46, height: 46, imageRendering: 'pixelated', objectFit: 'contain',
                          filter: `drop-shadow(0 0 6px ${getRarityColor(myTeam[i].rarity)}88)` }} alt="" />
                      <div style={{ fontSize: '0.56rem', color: getRarityColor(myTeam[i].rarity), marginTop: 2, fontWeight: 700 }}>
                        {'★'.repeat(myTeam[i].rarity)}
                      </div>
                    </>
                  ) : (
                    <div style={{
                      width: 46, height: 46, margin: '0 auto',
                      border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255,255,255,0.12)', fontSize: '1.1rem',
                    }}>?</div>
                  )}
                  <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 1, marginTop: 2 }}>S{i+1}</div>
                </div>
              ))}
            </div>
            {!teamReady && (
              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#ef5350', marginTop: 8 }}>
                ⚠️ 팀 편성 탭에서 3마리를 먼저 등록하세요
              </div>
            )}
          </div>

          {/* 검색 + 새로고침 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="🔍 닉네임 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, padding: '6px 12px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#fff',
                fontSize: '0.8rem', outline: 'none',
              }}
            />
            <button onClick={loadPlayers} disabled={loading} style={{
              padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem', cursor: 'pointer',
            }}>{loading ? '...' : '🔄 새로고침'}</button>
          </div>

          {/* 상대 목록 */}
          {(() => {
            const filteredPlayers = players.filter(p =>
              p.nickname.toLowerCase().includes(searchQuery.toLowerCase())
            );
            return filteredPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '50px 0', fontSize: '0.9rem', letterSpacing: 1 }}>
              {loading ? '불러오는 중...' : '등록된 상대가 없습니다'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredPlayers.map(player => {
                const oppTeam   = player.battle_pokemon;
                const oppPow    = oppTeam.reduce((s, p) => s + (p?.power || 0), 0);
                const ratio     = myTotalPow / (oppPow || 1);
                const r2        = ratio * ratio;
                const p1        = Math.min(0.98, Math.max(0.02, r2 / (r2 + 1)));
                const winPct    = teamReady ? Math.round(p1 * p1 * (3 - 2 * p1) * 100) : 0;
                const oppPrize  = oppTeam.reduce((s, p) => s + (p?.sellPrice || 0), 0);
                const sortedOpp = [...oppTeam].sort((a, b) => (b?.power || 0) - (a?.power || 0));
                const winColor  = winPct >= 60 ? '#4caf50' : winPct >= 40 ? '#ffd600' : '#ef5350';

                const oppSyns = getTeamSynergies(oppTeam).active;

                return (
                  <div key={player.id} className="opp-card">
                    {/* 카드 헤더 */}
                    <div className="opp-card-header">
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>{player.nickname}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                          ⚡{oppPow.toLocaleString()} · 🏆 상금 🪙{formatCoins(oppPrize)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: winColor, lineHeight: 1 }}>{winPct}%</div>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>WIN RATE</div>
                      </div>
                    </div>

                    {/* 상대방 시너지 뱃지 */}
                    {oppSyns.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 14px 8px' }}>
                        {oppSyns.map(syn => (
                          <span key={syn.id} style={{
                            background: `${syn.color}22`,
                            border: `1px solid ${syn.color}55`,
                            color: syn.color,
                            fontSize: '0.58rem', fontWeight: 800,
                            padding: '2px 7px', borderRadius: 10,
                          }}>{syn.icon} {syn.name} ×{syn.multiplier}</span>
                        ))}
                      </div>
                    )}

                    {/* 승률 바 */}
                    <div className="opp-win-bar" style={{ margin: '8px 14px 10px' }}>
                      <div style={{ display: 'flex', height: '100%' }}>
                        <div className="opp-win-bar-my" style={{ width: `${winPct}%` }} />
                        <div className="opp-win-bar-opp" style={{ width: `${100 - winPct}%` }} />
                      </div>
                    </div>

                    {/* 포켓몬 + 버튼 */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 14px 12px', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        {sortedOpp.map((p, i) => p && (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 10,
                              background: 'rgba(255,255,255,0.04)',
                              border: `1px solid ${getRarityColor(p.rarity)}33`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <img src={getPokemonImageUrl(p.pokemonId)}
                                style={{ width: 36, height: 36, imageRendering: 'pixelated', objectFit: 'contain',
                                  filter: p.isGolden ? 'sepia(0.3) brightness(1.4) drop-shadow(0 0 4px rgba(255,214,0,0.8))' : undefined }} alt="" />
                            </div>
                            <div style={{ fontSize: '0.52rem', color: getRarityColor(p.rarity), marginTop: 2 }}>
                              {'★'.repeat(p.rarity)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        disabled={!teamReady || isBattling || battleLimitReached}
                        onClick={() => startBattle(player)}
                        style={{
                          padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                          border: 'none',
                          background: !teamReady || battleLimitReached || isBattling
                            ? 'rgba(255,255,255,0.08)'
                            : 'linear-gradient(135deg, #6366f1 0%, #42a5f5 100%)',
                          color: !teamReady || battleLimitReached || isBattling ? 'rgba(255,255,255,0.3)' : '#fff',
                          fontWeight: 900, fontSize: '0.85rem', letterSpacing: 1,
                          boxShadow: (!teamReady || battleLimitReached || isBattling) ? 'none' : '0 4px 16px rgba(99,102,241,0.5)',
                          flexShrink: 0,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isBattling ? '⚔️' : battleLimitReached ? '한도\n초과' : !teamReady ? '미등록' : '⚔️\n도전'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
          })()}
        </>
      )}

      {/* ════════ 배틀 애니메이션 오버레이 ════════ */}
      {matchAnim && (() => {
        const { opponent, rounds, roundIdx, step, myHp, oppHp, moveName, myWins, oppWins } = matchAnim;
        const myPokemon  = myTeam[roundIdx];
        const oppSlot    = opponent.battle_pokemon[roundIdx];
        if (!myPokemon || !oppSlot) return null;
        const roundWon   = rounds[roundIdx]?.won;
        const totalR     = rounds.length;

        const myAnim  = step === 1 || step === 5 ? 'bmon-charge' : step === 2 || step === 6 ? 'bmon-lunge-r' : step === 4 ? 'bmon-hit' : step === 7 ? (roundWon ? 'bmon-winner' : 'bmon-loser') : '';
        const oppAnim = step === 3 ? 'bmon-charge' : step === 4 ? 'bmon-lunge-l' : step === 2 || step === 6 ? 'bmon-hit' : step === 7 ? (roundWon ? 'bmon-loser' : 'bmon-winner') : '';
        const showProj = step === 2 || step === 4 || step === 6;
        const projDir  = (step === 2 || step === 6) ? 'right' : 'left';
        const myType   = POKEMON_TYPE[myPokemon.pokemonId] ?? 'normal';
        const projClass = `proj-${myType === 'myth' ? 'myth' : myType === 'normal' ? 'pvp' : myType}`;

        const isHitStep = step === 2 || step === 4 || step === 6;
        const bgColor = step < 2 ? 'linear-gradient(170deg,#0a0420 0%,#040210 100%)'
          : roundWon ? 'linear-gradient(170deg,#0a1f0a 0%,#030d03 100%)'
          : 'linear-gradient(170deg,#1f0a0a 0%,#0d0303 100%)';

        // 임팩트 색상: 내 공격=보라, 상대 공격=빨강
        const impactColor = (step === 2 || step === 6) ? '#ce93d8' : '#ef5350';
        // 임팩트 위치: 내 공격→상대(우측상단), 상대 공격→나(좌측하단)
        const impactTop  = (step === 2 || step === 6) ? '28%' : '62%';
        const impactLeft = (step === 2 || step === 6) ? '72%' : '28%';

        return (
          <div className="bov" style={{ background: bgColor }}>

            {/* 배경 글로우 */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
              background: 'radial-gradient(ellipse at 50% 40%, rgba(100,60,200,0.12) 0%, transparent 70%)',
            }} />

            {/* 화면 흔들림 래퍼 */}
            <div className={isHitStep ? 'bov-shaking' : ''}
              key={`shake-${roundIdx}-${step}`}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '20px 16px 16px', gap: 0, pointerEvents: 'none' }}>

              {/* 피격 플래시 */}
              {(step === 2 || step === 6) && <div className="bov-flash bov-flash-white" key={`fl-${roundIdx}-${step}`} />}
              {step === 4 && <div className="bov-flash bov-flash-red" key={`flr-${roundIdx}-${step}`} />}

              {/* 충격 폭발 */}
              {isHitStep && (
                <div className="bov-impact" key={`imp-${roundIdx}-${step}`}
                  style={{ top: impactTop, left: impactLeft, color: impactColor }}>
                  <div className="bov-impact-ring" />
                  <div className="bov-impact-ring2" />
                  <div className="bov-impact-core" style={{ background: impactColor, boxShadow: `0 0 30px ${impactColor}` }} />
                  <div className="bov-impact-star" style={{ color: impactColor }} />
                </div>
              )}
            </div>

            {/* 라운드 어나운스 (step 0) */}
            {step === 0 && (
              <div className="bov-announce" key={`ann-${roundIdx}`}>
                <div className="bov-announce-text">ROUND {roundIdx + 1}</div>
                <div className="bov-announce-sub">
                  {roundIdx === totalR - 1 && totalR === 3 ? 'FINAL ROUND' : `${totalR}판 2선승제`}
                </div>
              </div>
            )}

            {/* 스코어바 */}
            <div className="bov-scorebar">
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1].map(i => (
                  <div key={i} className={`bov-score-dot ${i < myWins ? 'win' : ''}`} />
                ))}
              </div>
              <div className="bov-round-badge">ROUND {roundIdx + 1} · {totalR}전</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1].map(i => (
                  <div key={i} className={`bov-score-dot ${i < oppWins ? 'lose' : ''}`} />
                ))}
              </div>
            </div>

            {/* 상대 */}
            <div className="bov-opp-row" style={{ paddingTop: 52 }}>
              <HpBox name={`${opponent.nickname} · ${getPokemonName(oppSlot.pokemonId)}`} hp={oppHp} right={false} />
              <img src={getPokemonImageUrl(oppSlot.pokemonId)}
                className={`bov-mon bov-mon-opp ${oppAnim}`} style={{ '--glow': 'rgba(239,83,80,0.9)' }}
                key={`opp-${roundIdx}-${step}`} alt="" />
            </div>

            {/* 필드 */}
            <div className="bov-field">
              {moveName && step >= 1 && step <= 6 && (
                <div className="bov-move-v2" key={`mv-${roundIdx}-${step}`}>{moveName}</div>
              )}
              {step === 2 && rounds[roundIdx]?.typeAdvLabel && (() => {
                const r = rounds[roundIdx];
                const good = r.typeAdvMult > 1;
                const pctText = good ? '+25% 전투력' : '-20% 전투력';
                return (
                  <div key={`tadv-${roundIdx}`} style={{
                    position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    animation: 'bov-announce-in 0.25s ease', whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: 900, letterSpacing: 1,
                      color: good ? '#ffd600' : 'rgba(200,200,255,0.5)',
                      textShadow: good ? '0 0 14px #ffd600' : 'none',
                    }}>{r.typeAdvLabel}</span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.5,
                      background: good ? 'rgba(255,214,0,0.18)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${good ? '#ffd60055' : 'rgba(255,255,255,0.12)'}`,
                      color: good ? '#ffd600' : 'rgba(200,200,255,0.45)',
                      padding: '1px 8px', borderRadius: 8,
                    }}>{pctText}</span>
                  </div>
                );
              })()}
              {showProj && (
                <div className={`bov-proj bov-proj-${projDir} ${projClass}`} key={`pj-${roundIdx}-${step}`} />
              )}
            </div>

            {/* 내 포켓몬 */}
            <div className="bov-my-row">
              <img src={getPokemonImageUrl(myPokemon.pokemonId)}
                className={`bov-mon bov-mon-my ${myAnim}`} style={{ '--glow': 'rgba(99,102,241,0.9)' }}
                key={`my-${roundIdx}-${step}`} alt="" />
              <HpBox name={`나의 ${getPokemonName(myPokemon.pokemonId)}`} hp={myHp} right={true} />
            </div>

            {/* 라운드 결과 */}
            {step === 7 && (
              <div className="bov-round-result" key={`res-${roundIdx}`}>
                <div className="bov-round-result-text" style={{ color: roundWon ? '#4caf50' : '#ef5350' }}>
                  {roundWon ? '🏆 WIN' : '💀 LOSE'}
                </div>
                <div className="bov-round-result-sub">
                  {`ROUND ${roundIdx + 1} · ${myWins + (roundWon ? 1 : 0)} : ${oppWins + (roundWon ? 0 : 1)}`}
                  {roundIdx + 1 < totalR ? ' · 다음 라운드 준비...' : ''}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════ 최종 결과 오버레이 ════════ */}
      {matchResult && (
        <div className="match-result-overlay" onClick={() => setMatchResult(null)}>
          <div className="match-result-bg" />
          {/* 글로우 */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: matchResult.won
              ? 'radial-gradient(ellipse at center, rgba(76,175,80,0.15) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(239,83,80,0.15) 0%, transparent 70%)',
          }} />

          <div className="match-result-title" style={{ color: matchResult.won ? '#4caf50' : '#ef5350' }}>
            {matchResult.won ? '🏆 WIN' : '💀 LOSE'}
          </div>

          <div className="match-result-score">
            <span style={{ color: '#4caf50' }}>{matchResult.myWins}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.8rem' }}> — </span>
            <span style={{ color: '#ef5350' }}>{matchResult.oppWins}</span>
          </div>

          {/* 라운드별 결과 */}
          <div className="match-result-rounds">
            {matchResult.rounds.map((r, i) => (
              <div key={i} className="match-round-pill"
                style={{
                  background: r.won ? 'rgba(76,175,80,0.15)' : 'rgba(239,83,80,0.12)',
                  border: `1px solid ${r.won ? '#4caf50' : '#ef5350'}`,
                  color: r.won ? '#4caf50' : '#ef5350',
                }}>
                R{i+1} {r.won ? '승' : '패'}
              </div>
            ))}
          </div>

          {/* 팀 비교 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1,
            marginBottom: 20,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {myTeam.filter(Boolean).map((p, i) => (
                  <img key={i} src={getPokemonImageUrl(p.pokemonId)}
                    style={{ width: 40, height: 40, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
                ))}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: 1 }}>MY TEAM</div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '1.2rem' }}>VS</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {matchResult.opponent.battle_pokemon.map((p, i) => p && (
                  <img key={i} src={getPokemonImageUrl(p.pokemonId)}
                    style={{ width: 40, height: 40, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
                ))}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: 1 }}>
                {matchResult.opponent.nickname}
              </div>
            </div>
          </div>

          {matchResult.won && (
            <div className="match-result-prize">🪙 +{formatCoins(matchResult.prize)} 획득!</div>
          )}
          <div className="match-result-hint">TAP TO CONTINUE</div>
        </div>
      )}
    </div>
  );
}
