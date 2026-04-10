import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../App.jsx';
import {
  getPokemonImageUrl, getPokemonName, getRarityColor, getRarityStars,
  calculatePower, calculateSellPrice, formatCoins,
} from '../utils/gameUtils.js';
import { updateBattlePokemon, fetchBattlePlayers } from '../supabase.js';

export default function BattleScreen() {
  const { state, dispatch, accountId, nickname } = useGame();
  const { inventory, battlePokemonId } = state;

  const [tab, setTab]               = useState('battle');
  const [players, setPlayers]       = useState([]);
  const [battleResult, setBattleResult] = useState(null);
  const [isBattling, setIsBattling] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [fightAnim, setFightAnim]   = useState(null); // { opponent, step, myHp, oppHp, won }
  const fightTimers = React.useRef([]);

  const myBattlePokemon = inventory.find(p => p.instanceId === battlePokemonId) || null;

  const today = new Date().toDateString();
  const dailyCount = state.battleResetDate === today ? (state.dailyBattleCount || 0) : 0;
  const battleLimitReached = dailyCount >= 10;

  // 다른 플레이어 목록 불러오기
  const loadPlayers = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const data = await fetchBattlePlayers(accountId);
    setPlayers(data);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    loadPlayers();
    const interval = setInterval(loadPlayers, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [loadPlayers]);

  // 배틀 포켓몬 변경 시 Supabase 동기화
  const syncKey = myBattlePokemon
    ? `${myBattlePokemon.instanceId}-${myBattlePokemon.enhanceLevel}`
    : 'none';

  useEffect(() => {
    if (!accountId) return;
    const data = myBattlePokemon ? makeBattleData(myBattlePokemon) : null;
    updateBattlePokemon(accountId, data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, accountId]);

  function makeBattleData(pokemon) {
    return {
      pokemonId:    pokemon.pokemonId,
      rarity:       pokemon.rarity,
      sizeGrade:    pokemon.sizeGrade,
      enhanceLevel: pokemon.enhanceLevel,
      isGolden:     pokemon.isGolden,
      power:        calculatePower(pokemon),
      sellPrice:    calculateSellPrice(pokemon),
    };
  }

  function doBattle(opponent) {
    if (!myBattlePokemon || isBattling || battleLimitReached) return;
    setIsBattling(true);
    setBattleResult(null);

    const myPow  = calculatePower(myBattlePokemon);
    const oppPow = opponent.battle_pokemon.power || 1;
    const ratio  = myPow / oppPow;
    const winChance = Math.min(0.90, Math.max(0.10, ratio / (ratio + 1)));
    const won    = Math.random() < winChance;
    const prize  = won ? opponent.battle_pokemon.sellPrice : 0;

    // 전투 애니메이션 시작 (결과는 미리 계산, 나중에 공개)
    setFightAnim({ opponent, step: 0, myHp: 100, oppHp: 100, won });

    const addTimer = (fn, ms) => {
      const t = setTimeout(fn, ms);
      fightTimers.current.push(t);
      return t;
    };

    // step 시퀀스: 0=입장, 1=내공격, 2=상대공격, 3=내공격2, 4=결과
    addTimer(() => setFightAnim(f => ({ ...f, step: 1 })), 700);
    addTimer(() => setFightAnim(f => ({ ...f, step: 2, oppHp: won ? Math.max(10, 60 - Math.round(ratio * 20)) : 75 })), 1400);
    addTimer(() => setFightAnim(f => ({ ...f, step: 3, myHp: won ? 70 : Math.max(10, 40 - Math.round((1/ratio) * 20)) })), 2100);
    addTimer(() => setFightAnim(f => ({ ...f, step: 4, oppHp: won ? Math.max(0, f?.oppHp - 30) : f?.oppHp, myHp: won ? f?.myHp : Math.max(0, f?.myHp - 30) })), 2800);
    addTimer(() => {
      dispatch({ type: won ? 'BATTLE_WIN' : 'BATTLE_LOSE', coins: prize });
      setBattleResult({ won, prize, opponentNickname: opponent.nickname, opponentPokemon: opponent.battle_pokemon, myPower: myPow, oppPower: oppPow, winChance: Math.round(winChance * 100) });
      setFightAnim(null);
      setIsBattling(false);
      fightTimers.current = [];
    }, 3800);
  }

  return (
    <div>
      <div className="section-title">⚔️ 플레이어 배틀</div>

      {/* 일일 배틀 횟수 */}
      <div style={{
        background: battleLimitReached ? 'rgba(183,28,28,0.12)' : 'rgba(99,102,241,0.1)',
        border: `1px solid ${battleLimitReached ? 'var(--fail)' : 'var(--border)'}`,
        borderRadius: 8, padding: '6px 12px', marginBottom: 12,
        fontSize: '0.8rem', color: battleLimitReached ? 'var(--fail)' : 'var(--text2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>⚔️ 오늘 배틀 횟수</span>
        <span style={{ fontWeight: 700, color: battleLimitReached ? 'var(--fail)' : 'var(--text)' }}>
          {dailyCount} / 10 {battleLimitReached && '— 내일 초기화됩니다'}
        </span>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['battle', '⚔️ 배틀하기'], ['register', '🛡️ 내 배틀 포켓몬']].map(([id, label]) => (
          <button
            key={id}
            className={`btn btn-sm btn-ghost${tab === id ? ' active' : ''}`}
            style={tab === id ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
            onClick={() => { setTab(id); setBattleResult(null); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 배틀하기 탭 ── */}
      {tab === 'battle' && (
        <>
          {/* 내 대표 요약 */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            {myBattlePokemon ? (
              <>
                <img src={getPokemonImageUrl(myBattlePokemon.pokemonId)}
                  style={{ width: 48, height: 48, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {nickname} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>의 대표</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: getRarityColor(myBattlePokemon.rarity) }}>
                    {getPokemonName(myBattlePokemon.pokemonId)} {getRarityStars(myBattlePokemon.rarity)}
                    {myBattlePokemon.enhanceLevel > 0 && ` +${myBattlePokemon.enhanceLevel}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>
                    ⚡{calculatePower(myBattlePokemon).toLocaleString()}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
                🛡️ 탭에서 배틀 포켓몬을 먼저 등록하세요.
              </div>
            )}
          </div>

          {/* 새로고침 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={loadPlayers} disabled={loading}>
              {loading ? '...' : '🔄 새로고침'}
            </button>
          </div>

          {/* 상대 목록 */}
          {players.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '40px 0', fontSize: '0.9rem' }}>
              {loading ? '불러오는 중...' : '아직 배틀 포켓몬을 등록한 플레이어가 없습니다.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {players.map(player => {
                const bp     = player.battle_pokemon;
                const myPow  = myBattlePokemon ? calculatePower(myBattlePokemon) : 0;
                const oppPow = bp.power || 1;
                const ratio  = myPow / oppPow;
                const winPct = myPow > 0
                  ? Math.round(Math.min(90, Math.max(10, ratio / (ratio + 1) * 100)))
                  : 0;

                return (
                  <div key={player.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <img
                      src={getPokemonImageUrl(bp.pokemonId)}
                      style={{
                        width: 56, height: 56, imageRendering: 'pixelated', objectFit: 'contain',
                        filter: bp.isGolden ? 'sepia(0.3) brightness(1.4) drop-shadow(0 0 4px rgba(255,214,0,0.8))' : undefined,
                      }}
                      alt=""
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{player.nickname}</div>
                      <div style={{ fontSize: '0.78rem', color: getRarityColor(bp.rarity) }}>
                        {getPokemonName(bp.pokemonId)} {getRarityStars(bp.rarity)}
                        {bp.enhanceLevel > 0 && ` +${bp.enhanceLevel}`}
                        {bp.isGolden && ' ✨'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>
                        ⚡{oppPow.toLocaleString()} · 상금 🪙{formatCoins(bp.sellPrice)}
                      </div>
                      <div style={{ fontSize: '0.7rem', marginTop: 2 }}>
                        예상 승률:{' '}
                        <span style={{ color: winPct >= 50 ? 'var(--success)' : 'var(--fail)', fontWeight: 700 }}>
                          {winPct}%
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!myBattlePokemon || isBattling || battleLimitReached}
                      onClick={() => doBattle(player)}
                      style={{ flexShrink: 0 }}
                    >
                      {isBattling ? '⚔️...' : battleLimitReached ? '한도 초과' : '도전!'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── 등록 탭 ── */}
      {tab === 'register' && (
        <>
          {myBattlePokemon && (
            <div style={{
              background: 'rgba(99,102,241,0.12)', border: '1px solid var(--primary)',
              borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center',
            }}>
              <img src={getPokemonImageUrl(myBattlePokemon.pokemonId)}
                style={{ width: 80, height: 80, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
              <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: 4 }}>
                {getPokemonName(myBattlePokemon.pokemonId)}
              </div>
              <div style={{ color: getRarityColor(myBattlePokemon.rarity), fontSize: '0.85rem' }}>
                {getRarityStars(myBattlePokemon.rarity)}
                {myBattlePokemon.enhanceLevel > 0 && ` +${myBattlePokemon.enhanceLevel}`}
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>
                ⚡{calculatePower(myBattlePokemon).toLocaleString()} · 상금 🪙{formatCoins(calculateSellPrice(myBattlePokemon))}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10, borderColor: 'var(--fail)', color: 'var(--fail)' }}
                onClick={() => dispatch({ type: 'REGISTER_BATTLE_POKEMON', pokemonId: null })}
              >
                등록 해제
              </button>
            </div>
          )}

          {!myBattlePokemon && (
            <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 12 }}>
              대표 포켓몬을 선택하세요. 다른 플레이어가 도전할 수 있습니다.
            </div>
          )}

          {inventory.length === 0 ? (
            <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 24 }}>
              가방에 포켓몬이 없습니다!
            </div>
          ) : (
            <div className="inv-grid">
              {[...inventory]
                .sort((a, b) => calculatePower(b) - calculatePower(a))
                .map(p => {
                  const isSelected = p.instanceId === battlePokemonId;
                  return (
                    <div
                      key={p.instanceId}
                      className={`inv-card${p.isGolden ? ' golden' : ''}`}
                      style={isSelected
                        ? { borderColor: 'var(--primary)', boxShadow: '0 0 8px rgba(99,102,241,0.5)', cursor: 'pointer' }
                        : { cursor: 'pointer' }}
                      onClick={() => dispatch({ type: 'REGISTER_BATTLE_POKEMON', pokemonId: isSelected ? null : p.instanceId })}
                    >
                      {p.enhanceLevel > 0 && <div className="enhance-level-badge">+{p.enhanceLevel}</div>}
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'var(--primary)', color: '#fff',
                          fontSize: '0.5rem', borderRadius: 4, padding: '1px 4px', fontWeight: 700,
                        }}>대표</div>
                      )}
                      <img src={getPokemonImageUrl(p.pokemonId)} alt="" className="inv-img" />
                      <div className="inv-name">{getPokemonName(p.pokemonId)}</div>
                      <div style={{ color: getRarityColor(p.rarity), fontSize: '0.65rem' }}>{'★'.repeat(p.rarity)}</div>
                      <div className="inv-power">⚡{calculatePower(p).toLocaleString()}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* ── 전투 애니메이션 오버레이 ── */}
      {fightAnim && (
        <div className="battle-anim-overlay">
          {fightAnim.step < 4 && (
            <>
              <div className="battle-round-text" key={fightAnim.step}>
                {fightAnim.step === 0 && '⚔️ 배틀 시작!'}
                {fightAnim.step === 1 && '💥 공격!'}
                {fightAnim.step === 2 && '💢 반격!'}
                {fightAnim.step === 3 && '⚡ 결정타!'}
              </div>
              <div className="battle-stage">
                {/* 내 포켓몬 */}
                <div className="battle-pokemon-wrap">
                  <img
                    src={getPokemonImageUrl(myBattlePokemon.pokemonId)}
                    className={`battle-pokemon-img ${fightAnim.step === 1 || fightAnim.step === 3 ? 'attack-right' : fightAnim.step === 2 ? 'hit' : ''}`}
                    alt=""
                    key={`my-${fightAnim.step}`}
                  />
                  <div className="battle-hp-bar-wrap">
                    <div className="battle-hp-bar" style={{ width: `${fightAnim.myHp}%`, background: fightAnim.myHp > 50 ? '#4caf50' : fightAnim.myHp > 20 ? '#FFD700' : '#ef5350' }} />
                  </div>
                  <div className="battle-label">나</div>
                </div>

                <div className="battle-vs-text">VS</div>

                {/* 상대 포켓몬 */}
                <div className="battle-pokemon-wrap">
                  <img
                    src={getPokemonImageUrl(fightAnim.opponent.battle_pokemon.pokemonId)}
                    className={`battle-pokemon-img ${fightAnim.step === 2 ? 'attack-left' : fightAnim.step === 1 || fightAnim.step === 3 ? 'hit' : ''}`}
                    alt=""
                    key={`opp-${fightAnim.step}`}
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <div className="battle-hp-bar-wrap">
                    <div className="battle-hp-bar" style={{ width: `${fightAnim.oppHp}%`, background: fightAnim.oppHp > 50 ? '#4caf50' : fightAnim.oppHp > 20 ? '#FFD700' : '#ef5350' }} />
                  </div>
                  <div className="battle-label">{fightAnim.opponent.nickname}</div>
                </div>
              </div>
            </>
          )}

          {fightAnim.step === 4 && (
            <>
              <div className="battle-result-reveal" style={{ color: fightAnim.won ? '#4caf50' : '#ef5350' }}>
                {fightAnim.won ? '🏆 승리!' : '💀 패배'}
              </div>
              <div className="battle-stage">
                <div className="battle-pokemon-wrap">
                  <img
                    src={getPokemonImageUrl(myBattlePokemon.pokemonId)}
                    className={`battle-pokemon-img ${fightAnim.won ? 'winner' : 'loser'}`}
                    alt=""
                  />
                </div>
                <div className="battle-vs-text" style={{ color: 'var(--text2)' }}>VS</div>
                <div className="battle-pokemon-wrap">
                  <img
                    src={getPokemonImageUrl(fightAnim.opponent.battle_pokemon.pokemonId)}
                    className={`battle-pokemon-img ${fightAnim.won ? 'loser' : 'winner'}`}
                    alt=""
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
              </div>
              {fightAnim.won && (
                <div style={{ color: '#FFD700', fontWeight: 800, fontSize: '1.3rem' }}>
                  +🪙{formatCoins(fightAnim.opponent.battle_pokemon.sellPrice)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 배틀 결과 오버레이 ── */}
      {battleResult && (
        <div className="battle-result-overlay" onClick={() => setBattleResult(null)}>
          <div className="battle-result-text" style={{ color: battleResult.won ? 'var(--success)' : 'var(--fail)' }}>
            {battleResult.won ? '🏆 승리!' : '💀 패배'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <img src={getPokemonImageUrl(myBattlePokemon.pokemonId)}
                style={{ width: 60, height: 60, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
              <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>내 포켓몬</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--blue)', fontWeight: 700 }}>
                ⚡{battleResult.myPower.toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: 'var(--text2)' }}>vs</div>
            <div style={{ textAlign: 'center' }}>
              <img src={getPokemonImageUrl(battleResult.opponentPokemon.pokemonId)}
                style={{ width: 60, height: 60, imageRendering: 'pixelated', objectFit: 'contain' }} alt="" />
              <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>{battleResult.opponentNickname}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fail)', fontWeight: 700 }}>
                ⚡{battleResult.oppPower.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="battle-result-reward" style={{ marginTop: 12 }}>
            {battleResult.won
              ? `🎉 +🪙${formatCoins(battleResult.prize)} 획득!`
              : '😢 다음엔 더 강해져서 도전하세요!'}
          </div>
          <div style={{ color: 'var(--text2)', fontSize: '0.75rem', marginTop: 4 }}>
            예상 승률: {battleResult.winChance}%
          </div>
          <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginTop: 12 }}>
            화면을 터치하면 계속합니다
          </div>
        </div>
      )}
    </div>
  );
}
