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
  await supabase.functions.invoke('save-game', {
    body: { accountId, gameState },
  });
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
