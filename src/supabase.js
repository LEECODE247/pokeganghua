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
 *   alter table accounts  enable row level security;
 *   alter table game_saves enable row level security;
 *
 *   create policy "select" on accounts  for select using (true);
 *   create policy "insert" on accounts  for insert with check (true);
 *   create policy "all"    on game_saves for all using (true) with check (true);
 *
 * 3. 프로젝트 Settings → API → 아래 두 값을 복사
 *    .env.local 파일에 추가:
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

// 로그인 또는 신규 가입
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

  // 신규 계정 생성
  const { data, error: insertErr } = await supabase
    .from('accounts')
    .insert({ nickname, password_hash: passwordHash })
    .select('id')
    .single();

  if (insertErr) throw new Error('가입 실패: ' + insertErr.message);
  return data.id;
}

// 게임 상태 불러오기
export async function loadGameState(accountId) {
  const { data } = await supabase
    .from('game_saves')
    .select('game_state')
    .eq('account_id', accountId)
    .maybeSingle();
  return data?.game_state ?? null;
}

// 게임 상태 저장 (upsert)
export async function saveGameState(accountId, gameState) {
  await supabase
    .from('game_saves')
    .upsert({
      account_id: accountId,
      game_state: gameState,
      updated_at: new Date().toISOString(),
    });
}
