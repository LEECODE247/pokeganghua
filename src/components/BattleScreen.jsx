import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonShinyImageUrl, getPokemonName, getRarityColor, getRarityStars,
  calculatePower, calculateSellPrice, formatCoins, getTeamSynergies, SYNERGY_CATALOG,
  getTypeAdvantage, createPokemonInstance,
} from '../utils/gameUtils.js';

const DAY_SYNERGY_CATALOG = SYNERGY_CATALOG.filter(s => s.dayIdx !== undefined);
import { POKEMON_TYPES, TYPE_META, POKEMON_TYPE, TYPE_MOVES, DAY_TYPES, ALL_POKEMON_BY_RARITY } from '../data/pokemonData.js';
import {
  updateDayBattleTeam, fetchDayBattlePlayers, recordDayBattle, fetchTodayBattleRecords,
  fetchDailyRanking, fetchWeeklyRanking, fetchLastWeekRanking,
  checkRewardClaimed, markRewardClaimed, getTodayIndex, getTodayDate, getWeekStartDate, getLastWeekStartDate,
} from '../supabase.js';

const ROUND_DUR = 5800;
const ROUND_GAP = 1600;

function is5Star(p) { return p && p.rarity >= 5; }
function is4Star(p) { return p && p.rarity === 4; }

function canAssignToSlot(slot, pokemon, team, inventory) {
  const others = team.filter((id, i) => i !== slot && id).map(id => inventory.find(x => x.instanceId === id));
  const other5 = others.some(is5Star);
  const other4 = others.filter(is4Star).length;
  if (is5Star(pokemon)) return !other5 && other4 === 0;
  if (is4Star(pokemon)) return !other5 && other4 < 2;
  return true;
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
  const myType   = POKEMON_TYPE[myPokemon.pokemonId] ?? 'normal';
  const myPool   = TYPE_MOVES[myType]  ?? TYPE_MOVES.normal;
  const oppType  = POKEMON_TYPE[oppData.pokemonId] ?? 'normal';
  const oppPool  = TYPE_MOVES[oppType] ?? TYPE_MOVES.normal;
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

/* ── HP 바 ─────────────────────────────────────────────────── */
function HpBox({ name, hp, right }) {
  return (
    <div className={`bov-hpbox-v2${right ? ' bov-hpbox-v2-my' : ''}`}>
      <div className="bov-hp-name">{name}</div>
      <div className="bov-hp-row">
        {right && <span className="bov-hp-val" style={{ color: hpColor(hp) }}>{hp}</span>}
        {right && <div className="bov-hp-bar-track"><div className="bov-hp-bar-fill" style={{ width: `${hp}%`, background: hpColor(hp), boxShadow: `0 0 8px ${hpColor(hp)}` }} /></div>}
        {!right && <div className="bov-hp-bar-track"><div className="bov-hp-bar-fill" style={{ width: `${hp}%`, background: hpColor(hp), boxShadow: `0 0 8px ${hpColor(hp)}` }} /></div>}
        {!right && <span className="bov-hp-val" style={{ color: hpColor(hp) }}>{hp}</span>}
        <span className="bov-hp-tag">HP</span>
      </div>
    </div>
  );
}

/* ── 슬롯 카드 ──────────────────────────────────────────────── */
function SlotCard({ idx, pokemon, onSelect, onClear, dayAllowedTypes }) {
  const label  = `슬롯 ${idx + 1}`;
  const color  = pokemon ? getRarityColor(pokemon.rarity) : 'rgba(255,255,255,0.15)';
  const filled = !!pokemon;
  const pow    = pokemon ? calculatePower(pokemon) : 0;
  const pTypes = pokemon ? (POKEMON_TYPES[pokemon.pokemonId] || ['normal']) : [];
  const typeOk = !dayAllowedTypes || pTypes.some(t => dayAllowedTypes.has(t));

  return (
    <div className={`battle-slot-card ${filled ? 'filled' : 'empty'}`} style={filled ? {
      border: `2px solid ${typeOk ? color + '55' : '#ef535055'}`,
      boxShadow: `0 0 16px ${typeOk ? color + '22' : '#ef535022'}`,
    } : {}}>
      {filled ? (
        <>
          <div style={{ position:'absolute', top:6, left:8, fontSize:'0.58rem', fontWeight:800, color, letterSpacing:1 }}>{label}</div>
          <img src={pokemon.isShiny ? getPokemonShinyImageUrl(pokemon.pokemonId) : getPokemonImageUrl(pokemon.pokemonId)}
            style={{ width:60, height:60, imageRendering:'pixelated', objectFit:'contain',
              filter: pokemon.isShiny ? 'drop-shadow(0 0 8px rgba(0,229,255,0.9))' : `drop-shadow(0 0 8px ${color}88)` }} alt="" />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3, marginTop:3 }}>
            <span style={{ fontSize:'0.65rem', fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
              {pokemon.isShiny && <span style={{ color:'#00e5ff', marginRight:2 }}>✦</span>}{getPokemonName(pokemon.pokemonId)}
            </span>
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:3, marginTop:3 }}>
            {pTypes.map(t => {
              const meta = TYPE_META[t] || TYPE_META.normal;
              return <span key={t} style={{ background:meta.color, color:'#fff', fontSize:'0.44rem', fontWeight:800, padding:'1px 4px', borderRadius:8 }}>{meta.label}</span>;
            })}
          </div>
          <div style={{ fontSize:'0.6rem', color, marginTop:2 }}>{getRarityStars(pokemon.rarity)}{pokemon.enhanceLevel > 0 ? ` +${pokemon.enhanceLevel}` : ''}</div>
          <div style={{ fontSize:'0.6rem', fontWeight:800, color:'rgba(255,255,255,0.75)', marginTop:2 }}>⚡{pow.toLocaleString()}</div>
          {!typeOk && <div style={{ fontSize:'0.5rem', color:'#ef5350', marginTop:2 }}>타입 불일치</div>}
          <div style={{ display:'flex', gap:4, marginTop:6, justifyContent:'center' }}>
            <button onClick={onSelect} style={{ fontSize:'0.58rem', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>변경</button>
            <button onClick={onClear} style={{ fontSize:'0.58rem', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(239,83,80,0.5)', background:'rgba(239,83,80,0.08)', color:'#ef5350', cursor:'pointer' }}>해제</button>
          </div>
        </>
      ) : (
        <div onClick={onSelect} style={{ paddingTop:6, cursor:'pointer' }}>
          <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', marginBottom:8, letterSpacing:1 }}>{label}</div>
          <div style={{ fontSize:'2rem', color:'rgba(255,255,255,0.12)', lineHeight:1 }}>＋</div>
          <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.25)', marginTop:8 }}>선택</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════ 메인 컴포넌트 ════════════════════════════ */
export default function BattleScreen() {
  const { state, dispatch, accountId, nickname } = useGame();
  const { inventory, dayBattleTeams } = state;

  const todayIdx    = getTodayIndex();
  const todayConfig = DAY_TYPES[todayIdx];
  const todayTypes  = new Set(todayConfig.types);

  // ── 탭 ──────────────────────────────────────────────────────
  const [tab, setTab]           = useState('battle');
  const [rankSubTab, setRankSubTab] = useState('daily');
  const [registerDay, setRegisterDay] = useState(todayIdx);
  const [selectingSlot, setSelectingSlot] = useState(null); // { day, slotIdx }

  // ── 배틀 ──────────────────────────────────────────────────
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBattling, setIsBattling]   = useState(false);
  const [matchAnim, setMatchAnim]     = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [todayRecords, setTodayRecords] = useState([]);
  const timers = useRef([]);

  // ── 랭킹 ──────────────────────────────────────────────────
  const [dailyRank, setDailyRank]     = useState([]);
  const [weeklyRank, setWeeklyRank]   = useState([]);
  const [lastWeekRank, setLastWeekRank] = useState([]);
  const [rankLoading, setRankLoading] = useState(false);

  // ── 보상 ──────────────────────────────────────────────────
  const [rewardRank, setRewardRank]       = useState([]);    // 오늘 랭킹 for reward tab
  const [lastWkRank, setLastWkRank]       = useState([]);    // 지난주 랭킹 for reward tab
  const [claimedKeys, setClaimedKeys]     = useState(new Set());
  const [rewardLoading, setRewardLoading] = useState(false);
  const [registerSaving, setRegisterSaving] = useState(false);

  // ── 내 오늘 팀 ──────────────────────────────────────────────
  const todayTeamIds   = dayBattleTeams[todayIdx] || [null, null, null];
  const myTodayTeam    = todayTeamIds.map(id => id ? (inventory.find(p => p.instanceId === id) || null) : null);
  const todayTeamReady = myTodayTeam.every(p =>
    p && (POKEMON_TYPES[p.pokemonId] || ['normal']).some(t => todayTypes.has(t)));
  const todayFull      = myTodayTeam.every(Boolean);

  const today       = new Date().toDateString();
  const dailyCount  = state.battleResetDate === today ? (state.dailyBattleCount || 0) : 0;
  const limitReached = dailyCount >= 10;

  const winsAgainst = useCallback((oppId) =>
    todayRecords.filter(r => r.attacker_id === accountId && r.defender_id === oppId && r.attacker_won).length,
  [todayRecords, accountId]);

  /* ── 데이터 로드 ──────────────────────────────────────────── */
  const loadPlayers = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const data = await fetchDayBattlePlayers(accountId, todayIdx);
    setPlayers(data);
    setLoading(false);
  }, [accountId, todayIdx]);

  const loadTodayRecords = useCallback(async () => {
    if (!accountId) return;
    const data = await fetchTodayBattleRecords(accountId);
    setTodayRecords(data);
  }, [accountId]);

  useEffect(() => {
    loadPlayers();
    loadTodayRecords();
    const iv = setInterval(() => { loadPlayers(); loadTodayRecords(); }, 30000);
    return () => clearInterval(iv);
  }, [loadPlayers, loadTodayRecords]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const loadRankings = useCallback(async () => {
    setRankLoading(true);
    const [d, w] = await Promise.all([fetchDailyRanking(), fetchWeeklyRanking()]);
    setDailyRank(d);
    setWeeklyRank(w);
    setRankLoading(false);
  }, []);

  useEffect(() => { if (tab === 'rank') loadRankings(); }, [tab, loadRankings]);

  const loadRewardInfo = useCallback(async () => {
    if (!accountId) return;
    setRewardLoading(true);
    const [d, lw] = await Promise.all([fetchDailyRanking(), fetchLastWeekRanking()]);
    setRewardRank(d);
    setLastWkRank(lw);
    const dailyKey  = `daily_${getTodayDate()}`;
    const weeklyKey = `weekly_${getWeekStartDate()}`;
    const lastWkKey = `weekly_${getLastWeekStartDate()}`;
    const [dc, wc] = await Promise.all([
      checkRewardClaimed(accountId, dailyKey),
      checkRewardClaimed(accountId, lastWkKey),
    ]);
    const claimed = new Set();
    if (dc) claimed.add(dailyKey);
    if (wc) claimed.add(lastWkKey);
    setClaimedKeys(claimed);
    setRewardLoading(false);
  }, [accountId]);

  useEffect(() => { if (tab === 'reward') loadRewardInfo(); }, [tab, loadRewardInfo]);

  /* ── 팀 등록 저장 ─────────────────────────────────────────── */
  async function registerDayTeam(dayIdx) {
    const ids      = dayBattleTeams[dayIdx] || [null, null, null];
    const pokemon  = ids.map(id => id ? inventory.find(p => p.instanceId === id) : null);
    if (!pokemon.every(Boolean)) return;
    const synergies = getTeamSynergies(pokemon);
    const slots     = pokemon.map((p, i) => makeSlotData(p, synergies.multipliers[i]));
    setRegisterSaving(true);
    try {
      await updateDayBattleTeam(accountId, dayIdx, slots);
      alert(`${DAY_TYPES[dayIdx].label} 팀 등록 완료!`);
    } catch { alert('등록 실패. 다시 시도해주세요.'); }
    setRegisterSaving(false);
  }

  /* ── 인벤토리 필터 ────────────────────────────────────────── */
  function getAvailableForDay(dayIdx, slotIdx) {
    const allowed  = new Set(DAY_TYPES[dayIdx].types);
    const teamIds  = dayBattleTeams[dayIdx] || [null, null, null];
    return [...inventory]
      .filter(p => {
        const pTypes = POKEMON_TYPES[p.pokemonId] || ['normal'];
        if (!pTypes.some(t => allowed.has(t))) return false;
        if (teamIds.some((id, i) => i !== slotIdx && id === p.instanceId)) return false;
        return canAssignToSlot(slotIdx, p, teamIds, inventory);
      })
      .sort((a, b) => calculatePower(b) - calculatePower(a));
  }

  /* ── 배틀 시작 ────────────────────────────────────────────── */
  function startBattle(opponent) {
    if (!todayFull || !todayTeamReady || isBattling || limitReached) return;
    if (winsAgainst(opponent.id) >= 3) return;
    setIsBattling(true);
    setMatchResult(null);

    const oppSlots  = opponent.slots;
    const synergies = getTeamSynergies(myTodayTeam);
    let myW = 0, oppW = 0;
    const rounds = [];
    for (let i = 0; i < 3; i++) {
      const r = computeRound(myTodayTeam[i], oppSlots[i], synergies.multipliers[i]);
      rounds.push(r);
      if (r.won) myW++; else oppW++;
      if (myW === 2 || oppW === 2) break;
    }
    const matchWon = myW > oppW;

    setMatchAnim({ opponent, rounds, roundIdx:0, step:0, myHp:100, oppHp:100, moveName:null, myWins:0, oppWins:0 });

    const add = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

    for (let ri = 0; ri < rounds.length; ri++) {
      const base = ri * (ROUND_DUR + ROUND_GAP);
      const r    = rounds[ri];
      add(() => setMatchAnim(f => ({ ...f, roundIdx:ri, step:0, myHp:100, oppHp:100, moveName:null })), base);
      add(() => setMatchAnim(f => ({ ...f, step:1, moveName:r.moves[0] })), base + 700);
      add(() => setMatchAnim(f => ({ ...f, step:2, oppHp:r.oppHp1 })),      base + 1250);
      add(() => setMatchAnim(f => ({ ...f, step:3, moveName:r.moves[1] })), base + 2150);
      add(() => setMatchAnim(f => ({ ...f, step:4, myHp:r.myHp1 })),        base + 2700);
      add(() => setMatchAnim(f => ({ ...f, step:5, moveName:r.moves[2] })), base + 3550);
      add(() => setMatchAnim(f => ({ ...f, step:6, oppHp:r.oppHpFinal, myHp:r.myHpFinal })), base + 4100);
      add(() => setMatchAnim(f => ({ ...f, step:7, myWins:f.myWins+(r.won?1:0), oppWins:f.oppWins+(r.won?0:1) })), base + 4900);
    }

    const total = rounds.length * (ROUND_DUR + ROUND_GAP);
    add(() => {
      setMatchAnim(null);
      dispatch({ type: matchWon ? 'BATTLE_WIN' : 'BATTLE_LOSE', coins: 0 });
      setMatchResult({ won:matchWon, myWins:myW, oppWins:oppW, rounds, opponent });
      setIsBattling(false);
      timers.current = [];
      recordDayBattle(accountId, opponent.id, matchWon, todayIdx).then(() => loadTodayRecords());
    }, total);
  }

  /* ── 보상 수령 ────────────────────────────────────────────── */
  async function claimDailyReward(rank, fragments) {
    const key = `daily_${getTodayDate()}`;
    await markRewardClaimed(accountId, key, rank);
    dispatch({ type: 'CLAIM_DAY_BATTLE_REWARD', fragments });
    setClaimedKeys(prev => new Set([...prev, key]));
  }

  async function claimWeeklyReward(rank, fragments, pokemon) {
    const key = `weekly_${getLastWeekStartDate()}`;
    await markRewardClaimed(accountId, key, rank);
    dispatch({ type: 'CLAIM_WEEKLY_BATTLE_REWARD', fragments, pokemon });
    setClaimedKeys(prev => new Set([...prev, key]));
  }

  function generateRank4Pokemon(shiny = false) {
    const pool = ALL_POKEMON_BY_RARITY[4];
    const id   = pool[Math.floor(Math.random() * pool.length)];
    return { ...createPokemonInstance(id, 4), sizeGrade: 'S', enhanceLevel: 0, isShiny: shiny };
  }

  /* ══════════════════ RENDER ══════════════════════════════════ */
  return (
    <div>

      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(20,8,50,0.9) 0%, rgba(8,4,20,0.9) 100%)`,
        border: `1px solid ${todayConfig.color}33`, borderRadius:14, padding:'14px 16px', marginBottom:14,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        boxShadow: `0 4px 20px ${todayConfig.color}15`,
      }}>
        <div>
          <div style={{ fontSize:'1.05rem', fontWeight:900, letterSpacing:2, color:'#fff' }}>
            {todayConfig.emoji} 요일 배틀
          </div>
          <div style={{ display:'flex', gap:4, marginTop:5, flexWrap:'wrap' }}>
            {todayConfig.types.map(t => {
              const meta = TYPE_META[t];
              return <span key={t} style={{ background:meta.color, color:'#fff', fontSize:'0.55rem', fontWeight:800, padding:'2px 7px', borderRadius:8 }}>{meta.label}</span>;
            })}
          </div>
          <div style={{ fontSize:'0.65rem', color:todayConfig.color, marginTop:4, fontWeight:700 }}>{todayConfig.label} · 오늘의 배틀</div>
        </div>
        <div style={{
          background: limitReached ? 'rgba(239,83,80,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${limitReached ? '#ef5350' : 'rgba(99,102,241,0.4)'}`,
          borderRadius:10, padding:'6px 12px', textAlign:'center',
        }}>
          <div style={{ fontSize:'1.2rem', fontWeight:900, color: limitReached ? '#ef5350' : '#fff' }}>
            {dailyCount}<span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.4)' }}>/10</span>
          </div>
          <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.35)', letterSpacing:1 }}>TODAY</div>
        </div>
      </div>

      {/* ── 탭 ────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:5, marginBottom:16 }}>
        {[['battle','⚔️ 배틀'],['register','🛡️ 팀 등록'],['rank','🏆 랭킹'],['reward','🎁 보상']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelectingSlot(null); setMatchResult(null); }} style={{
            flex:1, padding:'9px 0', borderRadius:10, cursor:'pointer',
            border: tab===id ? '2px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.08)',
            background: tab===id
              ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(66,133,244,0.2) 100%)'
              : 'rgba(255,255,255,0.03)',
            color: tab===id ? '#fff' : 'rgba(255,255,255,0.4)',
            fontWeight: tab===id ? 800 : 500, fontSize:'0.78rem',
            boxShadow: tab===id ? '0 0 16px rgba(99,102,241,0.25)' : 'none',
            transition:'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ═════ 배틀하기 탭 ════════════════════════════════════ */}
      {tab === 'battle' && (
        <>
          {/* 내 오늘 팀 미리보기 */}
          <div style={{
            background:'linear-gradient(135deg, rgba(20,10,50,0.9) 0%, rgba(8,4,20,0.9) 100%)',
            border:`1px solid ${todayTeamReady && todayFull ? 'rgba(76,175,80,0.3)' : 'rgba(239,83,80,0.3)'}`,
            borderRadius:14, padding:'12px 14px', marginBottom:14,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:'0.7rem', fontWeight:800, letterSpacing:2, color:'rgba(255,255,255,0.4)' }}>MY TEAM · {todayConfig.short}요일</span>
              {todayFull && todayTeamReady
                ? <span style={{ fontSize:'0.65rem', color:'#4caf50', fontWeight:800 }}>✅ READY</span>
                : <span style={{ fontSize:'0.65rem', color:'#ef5350', fontWeight:800 }}>⚠️ 미등록</span>
              }
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ flex:1, textAlign:'center' }}>
                  {myTodayTeam[i] ? (
                    <>
                      <img src={myTodayTeam[i].isShiny ? getPokemonShinyImageUrl(myTodayTeam[i].pokemonId) : getPokemonImageUrl(myTodayTeam[i].pokemonId)}
                        style={{ width:46, height:46, imageRendering:'pixelated', objectFit:'contain',
                          filter: myTodayTeam[i].isShiny
                            ? 'drop-shadow(0 0 6px rgba(0,229,255,0.9))'
                            : `drop-shadow(0 0 6px ${getRarityColor(myTodayTeam[i].rarity)}88)` }} alt="" />
                      <div style={{ fontSize:'0.56rem', color:getRarityColor(myTodayTeam[i].rarity), marginTop:2, fontWeight:700 }}>
                        {myTodayTeam[i].isShiny && <span style={{ color:'#00e5ff', marginRight:2 }}>✦</span>}
                        {'★'.repeat(myTodayTeam[i].rarity)}
                      </div>
                    </>
                  ) : (
                    <div style={{ width:46, height:46, margin:'0 auto', border:'1.5px dashed rgba(255,255,255,0.1)',
                      borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                      color:'rgba(255,255,255,0.12)', fontSize:'1.1rem' }}>?</div>
                  )}
                  <div style={{ fontSize:'0.5rem', color:'rgba(255,255,255,0.2)', letterSpacing:1, marginTop:2 }}>S{i+1}</div>
                </div>
              ))}
            </div>
            {(!todayFull || !todayTeamReady) && (
              <div style={{ textAlign:'center', fontSize:'0.7rem', color:'#ef5350', marginTop:8 }}>
                팀 등록 탭에서 오늘의 타입({todayConfig.types.map(t=>TYPE_META[t]?.label).join('·')}) 포켓몬을 등록하세요
              </div>
            )}
          </div>

          {/* 검색 + 새로고침 */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input type="text" placeholder="🔍 닉네임 검색..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex:1, padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
                background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'0.8rem', outline:'none' }} />
            <button onClick={loadPlayers} disabled={loading} style={{
              padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', cursor:'pointer',
            }}>{loading ? '...' : '🔄'}</button>
          </div>

          {/* 상대 목록 */}
          {(() => {
            const filtered = players.filter(p => p.nickname.toLowerCase().includes(searchQuery.toLowerCase()));
            if (loading) return <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'50px 0' }}>불러오는 중...</div>;
            if (filtered.length === 0) return <div style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', padding:'50px 0' }}>
              오늘 {todayConfig.short}요일 팀을 등록한 상대가 없습니다
            </div>;
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filtered.map(player => {
                  const oppSlots  = player.slots;
                  const oppPow    = oppSlots.reduce((s, p) => s + (p?.power || 0), 0);
                  const myPow     = myTodayTeam.reduce((s, p) => s + (p ? calculatePower(p) : 0), 0);
                  const ratio     = myPow / (oppPow || 1);
                  const r2        = ratio * ratio;
                  const p1        = Math.min(0.98, Math.max(0.02, r2 / (r2 + 1)));
                  const winPct    = (todayFull && todayTeamReady) ? Math.round(p1 * p1 * (3 - 2 * p1) * 100) : 0;
                  const winColor  = winPct >= 60 ? '#4caf50' : winPct >= 40 ? '#ffd600' : '#ef5350';
                  const winsVsOpp = winsAgainst(player.id);
                  const capReached = winsVsOpp >= 3;

                  return (
                    <div key={player.id} className="opp-card">
                      <div className="opp-card-header">
                        <div>
                          <div style={{ fontWeight:800, fontSize:'0.9rem', color:'#fff' }}>{player.nickname}</div>
                          <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', marginTop:1 }}>
                            ⚡{oppPow.toLocaleString()}
                            {capReached && <span style={{ marginLeft:6, color:'#ffd600' }}>· 오늘 3승 달성</span>}
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'1.4rem', fontWeight:900, color:winColor, lineHeight:1 }}>{winPct}%</div>
                          <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>WIN RATE</div>
                        </div>
                      </div>

                      <div className="opp-win-bar" style={{ margin:'8px 14px 10px' }}>
                        <div style={{ display:'flex', height:'100%' }}>
                          <div className="opp-win-bar-my" style={{ width:`${winPct}%` }} />
                          <div className="opp-win-bar-opp" style={{ width:`${100-winPct}%` }} />
                        </div>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', padding:'4px 14px 12px', gap:10 }}>
                        <div style={{ display:'flex', gap:8, flex:1 }}>
                          {oppSlots.map((p, i) => p && (
                            <div key={i} style={{ textAlign:'center' }}>
                              <div style={{ width:44, height:44, borderRadius:10, background:'rgba(255,255,255,0.04)',
                                border:`1px solid ${getRarityColor(p.rarity)}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <img src={getPokemonImageUrl(p.pokemonId)}
                                  style={{ width:36, height:36, imageRendering:'pixelated', objectFit:'contain' }} alt="" />
                              </div>
                              <div style={{ fontSize:'0.52rem', color:getRarityColor(p.rarity), marginTop:2 }}>{'★'.repeat(p.rarity)}</div>
                            </div>
                          ))}
                        </div>
                        <button
                          disabled={!todayFull || !todayTeamReady || isBattling || limitReached || capReached}
                          onClick={() => startBattle(player)}
                          style={{
                            padding:'10px 16px', borderRadius:10, cursor:'pointer', border:'none',
                            background: (!todayFull || !todayTeamReady || limitReached || capReached || isBattling)
                              ? 'rgba(255,255,255,0.08)'
                              : 'linear-gradient(135deg, #6366f1 0%, #42a5f5 100%)',
                            color: (!todayFull || !todayTeamReady || limitReached || capReached || isBattling) ? 'rgba(255,255,255,0.3)' : '#fff',
                            fontWeight:900, fontSize:'0.85rem', letterSpacing:1, flexShrink:0,
                            boxShadow: (!todayFull || !todayTeamReady || limitReached || capReached || isBattling) ? 'none' : '0 4px 16px rgba(99,102,241,0.5)',
                          }}
                        >
                          {isBattling ? '⚔️' : limitReached ? '한도\n초과' : capReached ? '3승\n달성' : !todayFull || !todayTeamReady ? '미등록' : '⚔️\n도전'}
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

      {/* ═════ 팀 등록 탭 ═════════════════════════════════════ */}
      {tab === 'register' && (
        <>
          {/* 요일 선택 버튼 */}
          <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
            {Object.entries(DAY_TYPES).map(([d, cfg]) => {
              const di      = Number(d);
              const isToday = di === todayIdx;
              const teamIds = dayBattleTeams[di] || [null,null,null];
              const full    = teamIds.every(Boolean);
              return (
                <button key={d} onClick={() => { setRegisterDay(di); setSelectingSlot(null); }} style={{
                  flex:'0 0 calc(14% - 3px)', padding:'7px 0', borderRadius:9, cursor:'pointer',
                  border: registerDay === di ? `2px solid ${cfg.color}` : isToday ? `1px solid ${cfg.color}55` : '1px solid rgba(255,255,255,0.08)',
                  background: registerDay === di ? `${cfg.color}22` : 'rgba(255,255,255,0.03)',
                  color: registerDay === di ? cfg.color : 'rgba(255,255,255,0.5)',
                  fontWeight: registerDay === di ? 900 : 500, fontSize:'0.72rem', position:'relative',
                }}>
                  <div>{cfg.emoji}</div>
                  <div>{cfg.short}</div>
                  {full && <div style={{ fontSize:'0.45rem', color:'#4caf50' }}>✓</div>}
                  {isToday && <div style={{ fontSize:'0.45rem', color:cfg.color }}>오늘</div>}
                </button>
              );
            })}
          </div>

          {selectingSlot === null ? (
            <>
              {/* 선택된 요일 정보 */}
              <div style={{
                background:'rgba(255,255,255,0.03)', border:`1px solid ${DAY_TYPES[registerDay].color}33`,
                borderRadius:10, padding:'10px 12px', marginBottom:12,
              }}>
                <div style={{ fontSize:'0.8rem', fontWeight:800, color:DAY_TYPES[registerDay].color, marginBottom:6 }}>
                  {DAY_TYPES[registerDay].emoji} {DAY_TYPES[registerDay].label} — 허용 타입
                </div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {DAY_TYPES[registerDay].types.map(t => {
                    const meta = TYPE_META[t];
                    return <span key={t} style={{ background:meta.color, color:'#fff', fontSize:'0.62rem', fontWeight:800, padding:'2px 10px', borderRadius:10 }}>{meta.label}</span>;
                  })}
                </div>
              </div>

              {/* 요일 전용 시너지 조합표 */}
              {(() => {
                const daySyns = DAY_SYNERGY_CATALOG.filter(s => s.dayIdx === registerDay);
                if (daySyns.length === 0) return null;
                return (
                  <div style={{
                    background:'rgba(255,255,255,0.02)', border:`1px solid ${DAY_TYPES[registerDay].color}22`,
                    borderRadius:10, padding:'8px 12px', marginBottom:12,
                  }}>
                    <div style={{ fontSize:'0.62rem', fontWeight:800, color:'rgba(255,255,255,0.35)', letterSpacing:1, marginBottom:6 }}>
                      ✨ {DAY_TYPES[registerDay].short}요일 특별 시너지
                    </div>
                    {daySyns.map(s => (
                      <div key={s.fixedId} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                        <span style={{ fontSize:'0.8rem', width:20, textAlign:'center' }}>{s.icon}</span>
                        <span style={{ fontSize:'0.63rem', fontWeight:800, color: s.color || '#ffd600', flex:1 }}>{s.name}</span>
                        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', flex:2 }}>{s.desc}</span>
                        <span style={{ fontSize:'0.62rem', fontWeight:800, color:'#ffd600', flexShrink:0 }}>{s.bonus}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 슬롯 3개 */}
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                {[0,1,2].map(i => {
                  const id = (dayBattleTeams[registerDay] || [null,null,null])[i];
                  const p  = id ? inventory.find(x => x.instanceId === id) : null;
                  return (
                    <SlotCard key={i} idx={i} pokemon={p}
                      dayAllowedTypes={new Set(DAY_TYPES[registerDay].types)}
                      onSelect={() => setSelectingSlot({ day: registerDay, slotIdx: i })}
                      onClear={() => dispatch({ type:'SET_DAY_BATTLE_SLOT', day:registerDay, slot:i, pokemonId:null })}
                    />
                  );
                })}
              </div>

              {/* 팀 구성 제한 안내 */}
              <div style={{
                background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:10, padding:'8px 12px', marginBottom:10, fontSize:'0.65rem', color:'rgba(255,255,255,0.5)',
              }}>
                <span style={{ color:'rgba(255,255,255,0.7)', fontWeight:800 }}>팀 구성 제한 </span>
                <span style={{ color:'#e040fb' }}>★5</span> 단독 1마리 (★4 불가)&nbsp;·&nbsp;또는&nbsp;
                <span style={{ color:'#42a5f5' }}>★4</span> 최대 2마리 (★5 불가)
              </div>

              {/* 시너지 미리보기 */}
              {(() => {
                const regIds = dayBattleTeams[registerDay] || [null,null,null];
                const regPokemon = regIds.map(id => id ? inventory.find(p => p.instanceId === id) : null);
                const filledCount = regPokemon.filter(Boolean).length;
                if (filledCount === 0) return null;
                const syn = getTeamSynergies(regPokemon);
                if (syn.active.length === 0 && syn.partial.length === 0) return null;
                return (
                  <div style={{
                    background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:10, padding:'10px 12px', marginBottom:10,
                  }}>
                    <div style={{ fontSize:'0.65rem', fontWeight:800, color:'rgba(255,255,255,0.45)', letterSpacing:1, marginBottom:6 }}>🔗 시너지</div>
                    {syn.active.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:'0.85rem' }}>{s.icon}</span>
                        <span style={{ fontSize:'0.68rem', fontWeight:800, color: s.color || '#ffd600' }}>{s.name}</span>
                        <span style={{ fontSize:'0.62rem', color:'#4caf50', marginLeft:'auto', fontWeight:700 }}>×{s.multiplier} ✅</span>
                      </div>
                    ))}
                    {syn.partial.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, opacity:0.55 }}>
                        <span style={{ fontSize:'0.85rem' }}>{s.icon}</span>
                        <span style={{ fontSize:'0.68rem', fontWeight:700, color:'rgba(255,255,255,0.5)' }}>{s.name}</span>
                        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', marginLeft:'auto' }}>
                          {s.missing.slice(0,2).join('·')} 필요
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 등록 완료 버튼 */}
              <button
                disabled={!(dayBattleTeams[registerDay] || [null,null,null]).every(Boolean) || registerSaving}
                onClick={() => registerDayTeam(registerDay)}
                style={{
                  width:'100%', padding:'13px 0', borderRadius:12, cursor:'pointer', border:'none', fontWeight:900, fontSize:'0.9rem', letterSpacing:1,
                  background: (dayBattleTeams[registerDay] || [null,null,null]).every(Boolean)
                    ? `linear-gradient(135deg, ${DAY_TYPES[registerDay].color} 0%, #6366f1 100%)`
                    : 'rgba(255,255,255,0.06)',
                  color: (dayBattleTeams[registerDay] || [null,null,null]).every(Boolean) ? '#fff' : 'rgba(255,255,255,0.25)',
                  boxShadow: (dayBattleTeams[registerDay] || [null,null,null]).every(Boolean)
                    ? `0 4px 20px ${DAY_TYPES[registerDay].color}44` : 'none',
                  transition:'all 0.2s', marginBottom:8,
                }}
              >
                {registerSaving ? '등록 중...' : `✅ ${DAY_TYPES[registerDay].label} 팀 등록 완료`}
              </button>
              <div style={{ textAlign:'center', fontSize:'0.62rem', color:'rgba(255,255,255,0.25)' }}>
                3마리 모두 선택 후 등록 → 다른 플레이어에게 공개됩니다
              </div>
            </>
          ) : (
            /* 인벤토리 피커 */
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <button onClick={() => setSelectingSlot(null)} style={{
                  padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)',
                  background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.6)', fontSize:'0.8rem', cursor:'pointer',
                }}>← 뒤로</button>
                <span style={{ fontWeight:800, fontSize:'0.85rem' }}>
                  {DAY_TYPES[selectingSlot.day].label} · 슬롯 {selectingSlot.slotIdx + 1} — 포켓몬 선택
                </span>
              </div>
              <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)', marginBottom:10 }}>
                허용: {DAY_TYPES[selectingSlot.day].types.map(t => TYPE_META[t]?.label).join(' · ')} 타입만 등록 가능
              </div>
              {getAvailableForDay(selectingSlot.day, selectingSlot.slotIdx).length === 0
                ? <div style={{ color:'rgba(255,255,255,0.3)', textAlign:'center', padding:24 }}>
                    해당 타입의 포켓몬이 없습니다.
                  </div>
                : (
                  <div className="inv-grid">
                    {getAvailableForDay(selectingSlot.day, selectingSlot.slotIdx).map(p => (
                      <div key={p.instanceId} className={`inv-card${p.isGolden?' golden':''}${p.isShiny?' shiny':''}`}
                        style={{ cursor:'pointer' }}
                        onClick={() => {
                          dispatch({ type:'SET_DAY_BATTLE_SLOT', day:selectingSlot.day, slot:selectingSlot.slotIdx, pokemonId:p.instanceId });
                          setSelectingSlot(null);
                        }}>
                        {p.enhanceLevel > 0 && <div className="enhance-level-badge">+{p.enhanceLevel}</div>}
                        {p.isShiny && <div style={{ position:'absolute', top:4, left:4, fontSize:'0.5rem', fontWeight:900, color:'#00e5ff', textShadow:'0 0 6px #00e5ff', lineHeight:1 }}>✦이로치</div>}
                        <img src={p.isShiny ? getPokemonShinyImageUrl(p.pokemonId) : getPokemonImageUrl(p.pokemonId)} alt="" className="inv-img"
                          style={p.isShiny ? { filter:'drop-shadow(0 0 8px rgba(0,229,255,0.8))' } : {}} />
                        <div className="inv-name">{getPokemonName(p.pokemonId)}</div>
                        <div style={{ display:'flex', justifyContent:'center', gap:2, marginBottom:2 }}>
                          {(POKEMON_TYPES[p.pokemonId] || ['normal']).map(t => {
                            const meta = TYPE_META[t] || TYPE_META.normal;
                            return <span key={t} style={{ background:meta.color, color:'#fff', fontSize:'0.48rem', fontWeight:800, padding:'1px 5px', borderRadius:10 }}>{meta.label}</span>;
                          })}
                        </div>
                        <div style={{ color:getRarityColor(p.rarity), fontSize:'0.65rem' }}>{'★'.repeat(p.rarity)}</div>
                        <div className="inv-power">⚡{calculatePower(p).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </>
      )}

      {/* ═════ 랭킹 탭 ═══════════════════════════════════════ */}
      {tab === 'rank' && (
        <>
          <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center' }}>
            {[['daily','📅 오늘'],['weekly','📊 이번주']].map(([key, label]) => (
              <button key={key} onClick={() => setRankSubTab(key)} style={{
                flex:1, padding:'7px 0', borderRadius:8, cursor:'pointer',
                border: rankSubTab===key ? '2px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.08)',
                background: rankSubTab===key ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(66,133,244,0.2) 100%)' : 'rgba(255,255,255,0.03)',
                color: rankSubTab===key ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: rankSubTab===key ? 800 : 500, fontSize:'0.8rem',
              }}>{label}</button>
            ))}
            <button onClick={loadRankings} disabled={rankLoading} style={{
              padding:'7px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.4)', fontSize:'0.75rem', cursor:'pointer', flexShrink:0,
            }}>{rankLoading ? '...' : '🔄'}</button>
          </div>
          {rankLoading ? (
            <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'40px 0' }}>불러오는 중...</div>
          ) : (() => {
            const data = rankSubTab === 'daily' ? dailyRank : weeklyRank;
            if (data.length === 0) return <div style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', padding:'40px 0' }}>아직 배틀 기록이 없습니다</div>;
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {data.map((p, idx) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;
                  const crown = rank===1?'👑':rank===2?'🥈':rank===3?'🥉':null;
                  const rankColor = rank===1?'#FFD700':rank===2?'#C0C0C0':rank===3?'#CD7F32':'rgba(255,255,255,0.15)';
                  const isMe = p.id === accountId;
                  return (
                    <div key={p.id} style={{
                      borderRadius:12, padding:'10px 14px',
                      background: isTop3 ? 'linear-gradient(135deg, rgba(20,10,50,0.95) 0%, rgba(8,4,20,0.95) 100%)' : 'rgba(255,255,255,0.03)',
                      border: isTop3 ? `1.5px solid ${rankColor}` : isMe ? '1px solid rgba(66,165,245,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: isTop3 ? `0 0 16px ${rankColor}44` : 'none',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0,
                          background: isTop3 ? `${rankColor}22` : 'rgba(255,255,255,0.05)',
                          border:`2px solid ${rankColor}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize: isTop3 ? '1.1rem' : '0.8rem', fontWeight:900, color:rankColor,
                        }}>{crown || rank}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:800, fontSize:'0.85rem', color: isMe ? '#42a5f5' : '#fff', display:'flex', alignItems:'center', gap:5 }}>
                            {p.nickname}
                            {isMe && <span style={{ fontSize:'0.58rem', color:'#42a5f5', background:'rgba(66,165,245,0.15)', padding:'1px 5px', borderRadius:4 }}>나</span>}
                          </div>
                          <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', marginTop:1 }}>
                            {p.wins}승 {p.losses}패
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'0.9rem', fontWeight:900, color:rankColor }}>{p.score}점</div>
                          <div style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>
                            (+{p.wins*3} -{p.losses})
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {/* ═════ 보상 탭 ════════════════════════════════════════ */}
      {tab === 'reward' && (
        <>
          {rewardLoading ? (
            <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'50px 0' }}>불러오는 중...</div>
          ) : (
            <>
              {/* 일일 보상 */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:'0.85rem', fontWeight:900, color:'rgba(255,255,255,0.8)', marginBottom:10, letterSpacing:1 }}>
                  📅 오늘 {todayConfig.label} 배틀 보상
                </div>
                {(() => {
                  const dailyKey  = `daily_${getTodayDate()}`;
                  const myRank    = rewardRank.findIndex(p => p.id === accountId) + 1;
                  const inTop3    = myRank >= 1 && myRank <= 3;
                  const claimed   = claimedKeys.has(dailyKey);
                  const dailyPrizes = { 1: 500, 2: 300, 3: 150 };

                  return (
                    <>
                      {[
                        { rank:1, label:'👑 1등', fragments:500, color:'#FFD700' },
                        { rank:2, label:'🥈 2등', fragments:300, color:'#C0C0C0' },
                        { rank:3, label:'🥉 3등', fragments:150, color:'#CD7F32' },
                      ].map(({ rank, label, fragments, color }) => {
                        const isMyRank = myRank === rank;
                        const canClaim = isMyRank && !claimed && rewardRank.length > 0;
                        return (
                          <div key={rank} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            background: isMyRank ? `${color}15` : 'rgba(255,255,255,0.03)',
                            border: isMyRank ? `1px solid ${color}44` : '1px solid rgba(255,255,255,0.07)',
                            borderRadius:10, padding:'10px 14px', marginBottom:6,
                          }}>
                            <div>
                              <div style={{ fontWeight:800, fontSize:'0.82rem', color: isMyRank ? color : 'rgba(255,255,255,0.5)' }}>{label}</div>
                              <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', marginTop:2 }}>💎 파편 {fragments}개</div>
                            </div>
                            {canClaim ? (
                              <button onClick={() => claimDailyReward(rank, fragments)} style={{
                                padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:900, fontSize:'0.78rem',
                                background:`linear-gradient(135deg, ${color} 0%, #6366f1 100%)`, color:'#fff',
                                boxShadow:`0 4px 14px ${color}55`,
                              }}>수령하기</button>
                            ) : claimed && isMyRank ? (
                              <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', fontWeight:700 }}>수령 완료</span>
                            ) : isMyRank ? (
                              <span style={{ fontSize:'0.7rem', color:color, fontWeight:700 }}>내 순위</span>
                            ) : (
                              <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.2)' }}>
                                {rewardRank[rank-1]?.nickname || '-'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {myRank === 0 && rewardRank.length > 0 && (
                        <div style={{ textAlign:'center', fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:8 }}>
                          현재 순위 밖 — 배틀에서 승리하여 순위를 올리세요
                        </div>
                      )}
                      {rewardRank.length === 0 && (
                        <div style={{ textAlign:'center', fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:8 }}>
                          아직 오늘 배틀 기록이 없습니다
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 주간 보상 (지난주) */}
              <div>
                <div style={{ fontSize:'0.85rem', fontWeight:900, color:'rgba(255,255,255,0.8)', marginBottom:6, letterSpacing:1 }}>
                  🏆 지난주 주간 랭킹 보상
                </div>
                <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', marginBottom:10 }}>
                  매주 월요일 기준 지난주 결산 · 이번주 기록은 다음주에 반영
                </div>
                {(() => {
                  const weeklyKey = `weekly_${getLastWeekStartDate()}`;
                  const myRank    = lastWkRank.findIndex(p => p.id === accountId) + 1;
                  const claimed   = claimedKeys.has(weeklyKey);

                  const weeklyRewards = [
                    { rank:1, label:'👑 1등', fragments:3000, extra:'★4 이로치', color:'#FFD700', shiny:true },
                    { rank:2, label:'🥈 2등', fragments:1500, extra:'★4 보장', color:'#C0C0C0', shiny:false },
                    { rank:3, label:'🥉 3등', fragments:1500, extra:'★4 보장', color:'#CD7F32', shiny:false },
                  ];

                  return (
                    <>
                      {weeklyRewards.map(({ rank, label, fragments, extra, color, shiny }) => {
                        const isMyRank = myRank === rank;
                        const canClaim = isMyRank && !claimed && lastWkRank.length > 0;
                        return (
                          <div key={rank} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            background: isMyRank ? `${color}15` : 'rgba(255,255,255,0.03)',
                            border: isMyRank ? `1px solid ${color}44` : '1px solid rgba(255,255,255,0.07)',
                            borderRadius:10, padding:'10px 14px', marginBottom:6,
                          }}>
                            <div>
                              <div style={{ fontWeight:800, fontSize:'0.82rem', color: isMyRank ? color : 'rgba(255,255,255,0.5)' }}>{label}</div>
                              <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.4)', marginTop:2 }}>
                                💎 파편 {fragments}개 + {shiny ? '✦ ' : ''}{extra}
                              </div>
                            </div>
                            {canClaim ? (
                              <button onClick={() => claimWeeklyReward(rank, fragments, generateRank4Pokemon(shiny))} style={{
                                padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:900, fontSize:'0.78rem',
                                background:`linear-gradient(135deg, ${color} 0%, #6366f1 100%)`, color:'#fff',
                                boxShadow:`0 4px 14px ${color}55`,
                              }}>수령하기</button>
                            ) : claimed && isMyRank ? (
                              <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', fontWeight:700 }}>수령 완료</span>
                            ) : isMyRank ? (
                              <span style={{ fontSize:'0.7rem', color, fontWeight:700 }}>내 순위</span>
                            ) : (
                              <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.2)' }}>
                                {lastWkRank[rank-1]?.nickname || '-'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {/* 4~10등 */}
                      {myRank >= 4 && myRank <= 10 && (() => {
                        const claimed4 = claimedKeys.has(`weekly_${getWeekStartDate()}`);
                        return (
                          <div style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)',
                            borderRadius:10, padding:'10px 14px', marginBottom:6,
                          }}>
                            <div>
                              <div style={{ fontWeight:800, fontSize:'0.82rem', color:'#a78bfa' }}>{myRank}등 (나)</div>
                              <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.4)', marginTop:2 }}>💎 파편 500개</div>
                            </div>
                            {!claimed ? (
                              <button onClick={() => claimWeeklyReward(myRank, 500, null)} style={{
                                padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:900, fontSize:'0.78rem',
                                background:'linear-gradient(135deg, #6366f1 0%, #42a5f5 100%)', color:'#fff',
                              }}>수령하기</button>
                            ) : (
                              <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', fontWeight:700 }}>수령 완료</span>
                            )}
                          </div>
                        );
                      })()}
                      {lastWkRank.length === 0 && (
                        <div style={{ textAlign:'center', fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:8 }}>
                          지난주 배틀 기록이 없습니다
                        </div>
                      )}
                      {myRank > 10 && lastWkRank.length > 0 && (
                        <div style={{ textAlign:'center', fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:8 }}>
                          지난주 순위 {myRank}위 — 다음주에는 더 열심히!
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <button onClick={loadRewardInfo} disabled={rewardLoading} style={{
                width:'100%', marginTop:14, padding:'10px 0', borderRadius:10, cursor:'pointer',
                border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)',
                color:'rgba(255,255,255,0.4)', fontSize:'0.78rem',
              }}>{rewardLoading ? '...' : '🔄 새로고침'}</button>
            </>
          )}
        </>
      )}

      {/* ═════ 배틀 애니메이션 오버레이 ════════════════════════ */}
      {matchAnim && (() => {
        const { opponent, rounds, roundIdx, step, myHp, oppHp, moveName, myWins, oppWins } = matchAnim;
        const myPokemon = myTodayTeam[roundIdx];
        const oppSlot   = opponent.slots[roundIdx];
        if (!myPokemon || !oppSlot) return null;
        const roundWon = rounds[roundIdx]?.won;
        const totalR   = rounds.length;
        const myAnim  = step===1||step===5?'bmon-charge':step===2||step===6?'bmon-lunge-r':step===4?'bmon-hit':step===7?(roundWon?'bmon-winner':'bmon-loser'):'';
        const oppAnim = step===3?'bmon-charge':step===4?'bmon-lunge-l':step===2||step===6?'bmon-hit':step===7?(roundWon?'bmon-loser':'bmon-winner'):'';
        const showProj = step===2||step===4||step===6;
        const projDir  = (step===2||step===6)?'right':'left';
        const myType   = POKEMON_TYPE[myPokemon.pokemonId] ?? 'normal';
        const projClass = `proj-${myType==='myth'?'myth':myType==='normal'?'pvp':myType}`;
        const isHitStep = step===2||step===4||step===6;
        const bgColor = step<2?'linear-gradient(170deg,#0a0420 0%,#040210 100%)'
          :roundWon?'linear-gradient(170deg,#0a1f0a 0%,#030d03 100%)'
          :'linear-gradient(170deg,#1f0a0a 0%,#0d0303 100%)';
        const impactColor = (step===2||step===6)?'#ce93d8':'#ef5350';
        const impactTop  = (step===2||step===6)?'28%':'62%';
        const impactLeft = (step===2||step===6)?'72%':'28%';

        return (
          <div className="bov" style={{ background:bgColor }}>
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
              background:'radial-gradient(ellipse at 50% 40%, rgba(100,60,200,0.12) 0%, transparent 70%)' }} />
            <div className={isHitStep?'bov-shaking':''} key={`shake-${roundIdx}-${step}`}
              style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', padding:'20px 16px 16px', gap:0, pointerEvents:'none' }}>
              {(step===2||step===6) && <div className="bov-flash bov-flash-white" key={`fl-${roundIdx}-${step}`} />}
              {step===4 && <div className="bov-flash bov-flash-red" key={`flr-${roundIdx}-${step}`} />}
              {isHitStep && (
                <div className="bov-impact" key={`imp-${roundIdx}-${step}`} style={{ top:impactTop, left:impactLeft, color:impactColor }}>
                  <div className="bov-impact-ring" />
                  <div className="bov-impact-ring2" />
                  <div className="bov-impact-core" style={{ background:impactColor, boxShadow:`0 0 30px ${impactColor}` }} />
                  <div className="bov-impact-star" style={{ color:impactColor }} />
                </div>
              )}
            </div>
            {step===0 && (
              <div className="bov-announce" key={`ann-${roundIdx}`}>
                <div className="bov-announce-text">ROUND {roundIdx+1}</div>
                <div className="bov-announce-sub">{roundIdx===totalR-1&&totalR===3?'FINAL ROUND':`${totalR}판 2선승제`}</div>
              </div>
            )}
            <div className="bov-scorebar">
              <div style={{ display:'flex', gap:5 }}>{[0,1].map(i=><div key={i} className={`bov-score-dot ${i<myWins?'win':''}`}/>)}</div>
              <div className="bov-round-badge">ROUND {roundIdx+1} · {totalR}전</div>
              <div style={{ display:'flex', gap:5 }}>{[0,1].map(i=><div key={i} className={`bov-score-dot ${i<oppWins?'lose':''}`}/>)}</div>
            </div>
            <div className="bov-opp-row" style={{ paddingTop:52 }}>
              <HpBox name={`${opponent.nickname} · ${getPokemonName(oppSlot.pokemonId)}`} hp={oppHp} right={false} />
              <img src={getPokemonImageUrl(oppSlot.pokemonId)} className={`bov-mon bov-mon-opp ${oppAnim}`} style={{ '--glow':'rgba(239,83,80,0.9)' }} key={`opp-${roundIdx}-${step}`} alt="" />
            </div>
            <div className="bov-field">
              {moveName && step>=1 && step<=6 && <div className="bov-move-v2" key={`mv-${roundIdx}-${step}`}>{moveName}</div>}
              {step===2 && rounds[roundIdx]?.typeAdvLabel && (() => {
                const r = rounds[roundIdx];
                const good = r.typeAdvMult > 1;
                return (
                  <div key={`tadv-${roundIdx}`} style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:3, animation:'bov-announce-in 0.25s ease', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:'0.8rem', fontWeight:900, letterSpacing:1, color:good?'#ffd600':'rgba(200,200,255,0.5)', textShadow:good?'0 0 14px #ffd600':'none' }}>{r.typeAdvLabel}</span>
                    <span style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:0.5, background:good?'rgba(255,214,0,0.18)':'rgba(255,255,255,0.07)', border:`1px solid ${good?'#ffd60055':'rgba(255,255,255,0.12)'}`, color:good?'#ffd600':'rgba(200,200,255,0.45)', padding:'1px 8px', borderRadius:8 }}>{good?'+25% 전투력':'-20% 전투력'}</span>
                  </div>
                );
              })()}
              {showProj && <div className={`bov-proj bov-proj-${projDir} ${projClass}`} key={`pj-${roundIdx}-${step}`} />}
            </div>
            <div className="bov-my-row">
              <img src={getPokemonImageUrl(myPokemon.pokemonId)} className={`bov-mon bov-mon-my ${myAnim}`} style={{ '--glow':'rgba(99,102,241,0.9)' }} key={`my-${roundIdx}-${step}`} alt="" />
              <HpBox name={`나의 ${getPokemonName(myPokemon.pokemonId)}`} hp={myHp} right={true} />
            </div>
            {step===7 && (
              <div className="bov-round-result" key={`res-${roundIdx}`}>
                <div className="bov-round-result-text" style={{ color:roundWon?'#4caf50':'#ef5350' }}>{roundWon?'🏆 WIN':'💀 LOSE'}</div>
                <div className="bov-round-result-sub">{`ROUND ${roundIdx+1} · ${myWins+(roundWon?1:0)} : ${oppWins+(roundWon?0:1)}`}{roundIdx+1<totalR?' · 다음 라운드 준비...':''}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═════ 최종 결과 오버레이 ══════════════════════════════ */}
      {matchResult && (
        <div className="match-result-overlay" onClick={() => setMatchResult(null)}>
          <div className="match-result-bg" />
          <div style={{ position:'absolute', inset:0, pointerEvents:'none',
            background: matchResult.won
              ? 'radial-gradient(ellipse at center, rgba(76,175,80,0.15) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(239,83,80,0.15) 0%, transparent 70%)' }} />
          <div className="match-result-title" style={{ color:matchResult.won?'#4caf50':'#ef5350' }}>
            {matchResult.won ? '🏆 WIN' : '💀 LOSE'}
          </div>
          <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', marginBottom:8, position:'relative', zIndex:1 }}>
            {matchResult.won ? '+3점' : '-1점'} &nbsp;|&nbsp; vs {matchResult.opponent.nickname}
          </div>
          <div className="match-result-score">
            <span style={{ color:'#4caf50' }}>{matchResult.myWins}</span>
            <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'1.8rem' }}> — </span>
            <span style={{ color:'#ef5350' }}>{matchResult.oppWins}</span>
          </div>
          <div className="match-result-rounds">
            {matchResult.rounds.map((r, i) => (
              <div key={i} className="match-round-pill"
                style={{ background:r.won?'rgba(76,175,80,0.15)':'rgba(239,83,80,0.12)',
                  border:`1px solid ${r.won?'#4caf50':'#ef5350'}`, color:r.won?'#4caf50':'#ef5350' }}>
                R{i+1} {r.won?'승':'패'}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16, position:'relative', zIndex:1, marginBottom:20 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ display:'flex', gap:4 }}>
                {myTodayTeam.filter(Boolean).map((p, i) => (
                  <img key={i} src={p.isShiny ? getPokemonShinyImageUrl(p.pokemonId) : getPokemonImageUrl(p.pokemonId)}
                    style={{ width:40, height:40, imageRendering:'pixelated', objectFit:'contain',
                      filter: p.isShiny ? 'drop-shadow(0 0 6px rgba(0,229,255,0.8))' : undefined }} alt="" />
                ))}
              </div>
              <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', marginTop:4, letterSpacing:1 }}>MY TEAM</div>
            </div>
            <div style={{ color:'rgba(255,255,255,0.15)', fontSize:'1.2rem' }}>VS</div>
            <div style={{ textAlign:'center' }}>
              <div style={{ display:'flex', gap:4 }}>
                {matchResult.opponent.slots.map((p, i) => p && (
                  <img key={i} src={getPokemonImageUrl(p.pokemonId)} style={{ width:40, height:40, imageRendering:'pixelated', objectFit:'contain' }} alt="" />
                ))}
              </div>
              <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', marginTop:4, letterSpacing:1 }}>
                {matchResult.opponent.nickname}
              </div>
            </div>
          </div>
          <div className="match-result-hint">TAP TO CONTINUE</div>
        </div>
      )}
    </div>
  );
}
