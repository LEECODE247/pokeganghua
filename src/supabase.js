/**
 * ── Supabase 설정 가이드 ──────────────────────────────────
 *
 * 1. https://supabase.com → 새 프로젝트 생성
 *
 * 2. SQL Editor에서 아래 실행:
 *
 *   create table accounts (
 *     id            uuid default gen_random_uuid() primary key,
 *     nickname      text unique not null,
 *     password_hash text not null,
 *     created_at    timestamptz default now()
 *   );
 *
 *   create table game_saves (
 *     account_id  uuid references accounts(id) on delete cascade primary key,
 *     game_state  jsonb not null default '{}',
 *     updated_at  timestamptz default now()
 *   );
 *
 *   -- 배틀 포켓몬 컬럼 (나중에 추가한 경우)
 *   alter table accounts add column if not exists battle_pokemon jsonb default null;
 *
 *   alter table accounts  enable row level security;
 *   alter table game_saves enable row level security;
 *
 *   create policy "select" on accounts  for select using (true);
 *   create policy "insert" on accounts  for insert with check (true);
 *   create policy "update" on accounts  for update using (true) with check (true);
 *   create policy "all"    on game_saves for all using (true) with check (true);
 *
 * 3. 프로젝트 Settings → API → 두 값을 .env.local에 추가:
 *      VITE_SUPABASE_URL=https://xxxx.supabase.co
 *      VITE_SUPABASE_ANON_KEY=eyJxxxx
 *
 * ─────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// ── 인증 ────────────────────────────────────────────────
export async function loginOrRegister(nickname, passwordHash) {
  const { data: existing, error: selectErr } = await supabase
    .from('accounts')
    .select('id, password_hash')
    .eq('nickname', nickname)
    .maybeSingle();

  if (selectErr) throw new Error('서버 오류: ' + selectErr.message);

  if (existing) {
    if (existing.password_hash !== passwordHash) throw new Error('비밀번호가 틀렸습니다.');
    return existing.id;
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({ nickname, password_hash: passwordHash })
    .select('id')
    .single();

  if (error) throw new Error('가입 실패: ' + error.message);
  return data.id;
}

// ── 게임 세이브 ──────────────────────────────────────────
export async function loadGameState(accountId) {
  const { data } = await supabase
    .from('game_saves')
    .select('game_state')
    .eq('account_id', accountId)
    .maybeSingle();
  return data?.game_state ?? null;
}

export async function saveGameState(accountId, gameState) {
  const gs = { ...gameState, _savedAt: Date.now() };
  // Edge Function 우선 (service role로 RLS 우회)
  try {
    const { error } = await supabase.functions.invoke('save-game', {
      body: { accountId, gameState: gs },
    });
    if (error) throw error;
    return;
  } catch {}
  // 폴백: 직접 upsert
  const { error } = await supabase.from('game_saves').upsert({
    account_id: accountId,
    game_state: gs,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// 페이지 닫기/백그라운드 전환 시 keepalive fetch로 저장 (브라우저가 요청 유지)
export function saveGameStateOnUnload(accountId, gameState) {
  const savedAt = Date.now();
  try {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/game_saves`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        account_id: accountId,
        game_state: { ...gameState, _savedAt: savedAt },
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {}
}

// ── 세션 토큰 (중복 로그인 제어) ────────────────────────
export async function setSessionToken(accountId, token) {
  await supabase.from('accounts').update({ session_token: token }).eq('id', accountId);
}

export async function getSessionToken(accountId) {
  const { data } = await supabase.from('accounts').select('session_token').eq('id', accountId).single();
  return data?.session_token ?? null;
}

// ── 배틀 ────────────────────────────────────────────────
export async function updateBattlePokemon(accountId, battlePokemon) {
  await supabase
    .from('accounts')
    .update({ battle_pokemon: battlePokemon })
    .eq('id', accountId);
}

export async function fetchBattlePlayers(myAccountId) {
  const { data } = await supabase
    .from('accounts')
    .select('id, nickname, battle_pokemon')
    .not('battle_pokemon', 'is', null)
    .neq('id', myAccountId);
  return data || [];
}

// ── 요일 배틀 유틸 ──────────────────────────────────────────
export function getTodayIndex() {
  return (new Date().getDay() + 6) % 7; // 0=월, 1=화, ..., 6=일
}
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}
export function getWeekStartDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  return mon.toISOString().split('T')[0];
}
function getLastWeekStartDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff - 7);
  return mon.toISOString().split('T')[0];
}

// ── 요일 배틀팀 저장/조회 ────────────────────────────────────
export async function updateDayBattleTeam(accountId, dayOfWeek, slots) {
  const { error } = await supabase.from('day_battle_teams').upsert(
    { account_id: accountId, day_of_week: dayOfWeek, slots, updated_at: new Date().toISOString() },
    { onConflict: 'account_id,day_of_week' }
  );
  if (error) throw error;
}

export async function fetchDayBattlePlayers(myAccountId, dayOfWeek) {
  const { data: teams } = await supabase
    .from('day_battle_teams')
    .select('account_id, slots')
    .eq('day_of_week', dayOfWeek)
    .neq('account_id', myAccountId);
  if (!teams || teams.length === 0) return [];
  const valid = teams.filter(t => Array.isArray(t.slots) && t.slots.length === 3 && t.slots.every(Boolean));
  if (valid.length === 0) return [];
  const ids = valid.map(t => t.account_id);
  const { data: accounts } = await supabase.from('accounts').select('id, nickname').in('id', ids);
  const nm = Object.fromEntries((accounts || []).map(a => [a.id, a.nickname]));
  return valid.map(t => ({ id: t.account_id, nickname: nm[t.account_id] || '?', slots: t.slots }));
}

// ── 배틀 기록 / 점수 ─────────────────────────────────────────
async function upsertWeeklyScore(accountId, weekStart, winsAdd, lossesAdd, scoreAdd) {
  const { data: ex } = await supabase
    .from('weekly_scores').select('score, wins, losses')
    .eq('account_id', accountId).eq('week_start', weekStart).maybeSingle();
  await supabase.from('weekly_scores').upsert({
    account_id: accountId, week_start: weekStart,
    score: Math.max(0, (ex?.score || 0) + scoreAdd),
    wins: (ex?.wins || 0) + winsAdd,
    losses: (ex?.losses || 0) + lossesAdd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id,week_start' });
}

export async function recordDayBattle(attackerId, defenderId, attackerWon, dayOfWeek) {
  const today = getTodayDate();
  await supabase.from('battle_records').insert({
    attacker_id: attackerId, defender_id: defenderId,
    attacker_won: attackerWon, day_of_week: dayOfWeek, battle_date: today,
  });
  const ws = getWeekStartDate();
  await Promise.all([
    upsertWeeklyScore(attackerId, ws, attackerWon ? 1 : 0, attackerWon ? 0 : 1, attackerWon ? 3 : -1),
    upsertWeeklyScore(defenderId, ws, attackerWon ? 0 : 1, attackerWon ? 1 : 0, attackerWon ? -1 : 3),
  ]);
}

export async function fetchTodayBattleRecords(accountId) {
  const today = getTodayDate();
  const { data } = await supabase
    .from('battle_records').select('attacker_id, defender_id, attacker_won')
    .eq('battle_date', today)
    .or(`attacker_id.eq.${accountId},defender_id.eq.${accountId}`);
  return data || [];
}

async function aggregateRanking(records) {
  if (!records || records.length === 0) return [];
  const sm = {};
  records.forEach(r => {
    if (!sm[r.attacker_id]) sm[r.attacker_id] = { wins: 0, losses: 0 };
    if (!sm[r.defender_id]) sm[r.defender_id] = { wins: 0, losses: 0 };
    if (r.attacker_won) { sm[r.attacker_id].wins++; sm[r.defender_id].losses++; }
    else { sm[r.defender_id].wins++; sm[r.attacker_id].losses++; }
  });
  const ids = Object.keys(sm);
  const { data: accs } = await supabase.from('accounts').select('id, nickname').in('id', ids);
  const nm = Object.fromEntries((accs || []).map(a => [a.id, a.nickname]));
  return ids.map(id => ({
    id, nickname: nm[id] || '?',
    wins: sm[id].wins, losses: sm[id].losses,
    score: Math.max(0, sm[id].wins * 3 - sm[id].losses),
  })).sort((a, b) => b.score - a.score || b.wins - a.wins);
}

export async function fetchDailyRanking() {
  const { data } = await supabase.from('battle_records')
    .select('attacker_id, defender_id, attacker_won').eq('battle_date', getTodayDate());
  return aggregateRanking(data);
}

async function fetchScoreRanking(weekStart) {
  const { data: scores } = await supabase
    .from('weekly_scores').select('account_id, score, wins, losses')
    .eq('week_start', weekStart).order('score', { ascending: false });
  if (!scores || scores.length === 0) return [];
  const ids = scores.map(s => s.account_id);
  const { data: accs } = await supabase.from('accounts').select('id, nickname').in('id', ids);
  const nm = Object.fromEntries((accs || []).map(a => [a.id, a.nickname]));
  return scores.map(s => ({ id: s.account_id, nickname: nm[s.account_id] || '?', score: s.score, wins: s.wins, losses: s.losses }));
}

export async function fetchWeeklyRanking() { return fetchScoreRanking(getWeekStartDate()); }
export async function fetchLastWeekRanking() { return fetchScoreRanking(getLastWeekStartDate()); }
export { getLastWeekStartDate };

// ── 보상 수령 ────────────────────────────────────────────────
export async function checkRewardClaimed(accountId, rewardKey) {
  const { data } = await supabase.from('battle_reward_claims')
    .select('reward_key').eq('account_id', accountId).eq('reward_key', rewardKey).maybeSingle();
  return !!data;
}
export async function markRewardClaimed(accountId, rewardKey, rankAchieved) {
  await supabase.from('battle_reward_claims').insert(
    { account_id: accountId, reward_key: rewardKey, rank_achieved: rankAchieved }
  ).then(() => {});
}

export async function fetchRankData() {
  // accounts와 game_saves 각각 fetch 후 클라이언트에서 합산
  const [{ data: accounts }, { data: saves }] = await Promise.all([
    supabase.from('accounts').select('id, nickname, battle_pokemon').not('battle_pokemon', 'is', null),
    supabase.from('game_saves').select('account_id, game_state'),
  ]);

  const saveMap = {};
  (saves || []).forEach(s => { saveMap[s.account_id] = s.game_state; });

  return (accounts || []).map(a => ({
    ...a,
    game_state: saveMap[a.id] || {},
  }));
}
