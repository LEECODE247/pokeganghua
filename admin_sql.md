# PokéGacha 관리자 SQL 쿼리

> Supabase SQL Editor에서 실행. `'닉네임'` 부분을 실제 값으로 교체 후 사용.
>
> ⚠️ **주의**: 쿼리 실행 후 유저가 페이지를 **새로고침**해야 반영됩니다.  
> (앱이 브라우저 캐시보다 DB가 최신임을 감지하면 자동으로 DB 값을 불러옵니다.)

---

## 0. 보안 설정 (최초 1회 실행)

> Edge Function 배포 후 아래 RLS를 적용해야 외부 직접 API 호출이 차단됩니다.

```sql
-- game_saves: anon은 SELECT(불러오기)만 허용, 쓰기는 Edge Function(service_role)만 가능
DROP POLICY IF EXISTS "all" ON game_saves;
CREATE POLICY "read_only_anon" ON game_saves FOR SELECT USING (true);
-- INSERT / UPDATE / DELETE 는 service_role(Edge Function)이 RLS bypass로 처리
```

---

## 1. 사용자 조회

```sql
-- 닉네임으로 기본 정보 조회
SELECT
  a.id,
  a.nickname,
  a.created_at,
  (gs.game_state->>'coins')::bigint        AS coins,
  (gs.game_state->>'fragments')::int       AS fragments,
  jsonb_array_length(COALESCE(gs.game_state->'inventory', '[]'::jsonb)) AS pokemon_count,
  (gs.game_state->>'totalBattles')::int    AS total_battles,
  (gs.game_state->>'totalWins')::int       AS total_wins,
  (gs.game_state->>'dailyBattleCount')::int AS daily_battle_count,
  gs.game_state->>'battleResetDate'        AS battle_reset_date,
  gs.updated_at
FROM accounts a
LEFT JOIN game_saves gs ON gs.account_id = a.id
WHERE a.nickname = '닉네임';

-- 전체 유저 목록 (최근 접속순)
SELECT
  a.id,
  a.nickname,
  a.created_at,
  (gs.game_state->>'coins')::bigint AS coins,
  jsonb_array_length(COALESCE(gs.game_state->'inventory', '[]'::jsonb)) AS pokemon_count,
  gs.updated_at AS last_save
FROM accounts a
LEFT JOIN game_saves gs ON gs.account_id = a.id
ORDER BY gs.updated_at DESC NULLS LAST;
```

---

## 2. 돈 충전

```sql
-- 특정 유저에게 코인 추가 (기존 코인에 합산)
UPDATE game_saves
SET
  game_state = jsonb_set(
    game_state,
    '{coins}',
    to_jsonb((COALESCE((game_state->>'coins')::bigint, 0) + 100000))  -- 충전할 금액
  ) || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');

-- 코인을 특정 값으로 고정 세팅
UPDATE game_saves
SET
  game_state = jsonb_set(game_state, '{coins}', '500000')  -- 원하는 금액
    || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');
```

---

## 3. 특별 재화(파편) 지급

```sql
-- 파편 추가 (기존 파편에 합산)
UPDATE game_saves
SET
  game_state = jsonb_set(
    game_state,
    '{fragments}',
    to_jsonb((COALESCE((game_state->>'fragments')::int, 0) + 5000))  -- 지급할 파편량
  ) || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');

-- 파편을 특정 값으로 고정 세팅
UPDATE game_saves
SET
  game_state = jsonb_set(game_state, '{fragments}', '10000')  -- 원하는 파편량
    || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');
```

---

## 4. 포켓몬 지급

```sql
-- 인벤토리에 포켓몬 추가
-- pokemonId: 포켓몬 번호 (예: 150 = 뮤츠, 249 = 루기아, 493 = 아르세우스)
-- rarity: 1~5 (1=일반, 2=희귀, 3=영웅, 4=전설, 5=신화)
-- sizeGrade: 'S' | 'A' | 'B' | 'C'
UPDATE game_saves
SET
  game_state = jsonb_set(
    game_state,
    '{inventory}',
    COALESCE(game_state->'inventory', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'instanceId',   concat(extract(epoch from now())::bigint, '-admin-', gen_random_uuid()),
        'pokemonId',    150,       -- 포켓몬 번호
        'rarity',       5,         -- 희귀도 (1~5)
        'gender',       '♂',      -- '♂' 또는 '♀'
        'size',         85,        -- 1~100
        'sizeGrade',    'S',       -- 'S'|'A'|'B'|'C'
        'enhanceLevel', 0,
        'isGolden',     false,
        'capturedAt',   extract(epoch from now())::bigint * 1000
      )
    )
  ) || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');

-- 지급 후 도감 등록 (해당 pokemonId가 pokedex 배열에 없으면 추가)
UPDATE game_saves
SET
  game_state = jsonb_set(
    game_state,
    '{pokedex}',
    (COALESCE(game_state->'pokedex', '[]'::jsonb) - '150') || '[150]'  -- 포켓몬 번호
  ) || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임')
  AND NOT (game_state->'pokedex' @> '[150]');  -- 이미 있으면 스킵
```

---

## 5. 배틀 횟수 초기화

```sql
-- 일일 배틀 횟수 초기화 (dailyBattleCount → 0)
UPDATE game_saves
SET
  game_state = game_state
    || '{"dailyBattleCount": 0}'::jsonb
    || jsonb_build_object('battleResetDate', to_char(now(), 'YYYY-MM-DD'))
    || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');

-- 체육관 쿨다운 전체 초기화
UPDATE game_saves
SET
  game_state = game_state
    || '{"gymCooldowns": {}}'::jsonb
    || '{"gymPokemonCooldowns": {}}'::jsonb
    || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now()
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임');

-- 전체 유저 일일 배틀 횟수 일괄 초기화
UPDATE game_saves
SET
  game_state = game_state
    || '{"dailyBattleCount": 0}'::jsonb
    || jsonb_build_object('battleResetDate', to_char(now(), 'YYYY-MM-DD'))
    || jsonb_build_object('_savedAt', extract(epoch from now())::bigint * 1000 + 60000),
  updated_at = now();
```

---

## 6. 요일 배틀 테이블 생성 (최초 1회)

```sql
-- 요일별 배틀팀 등록 (account_id + day_of_week 복합 PK)
create table if not exists day_battle_teams (
  account_id  uuid references accounts(id) on delete cascade,
  day_of_week int  not null,  -- 0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일
  slots       jsonb not null default '[]',
  updated_at  timestamptz default now(),
  primary key (account_id, day_of_week)
);
alter table day_battle_teams enable row level security;
create policy "all" on day_battle_teams for all using (true) with check (true);

-- 배틀 결과 기록
create table if not exists battle_records (
  id           uuid default gen_random_uuid() primary key,
  attacker_id  uuid references accounts(id),
  defender_id  uuid references accounts(id),
  attacker_won bool not null,
  day_of_week  int  not null,
  battle_date  date not null default current_date,
  created_at   timestamptz default now()
);
alter table battle_records enable row level security;
create policy "all" on battle_records for all using (true) with check (true);
create index on battle_records(battle_date);
create index on battle_records(attacker_id);
create index on battle_records(defender_id);

-- 주간 누적 점수 (이기면 +3, 지면 -1, 최소 0)
create table if not exists weekly_scores (
  account_id  uuid references accounts(id) on delete cascade,
  week_start  date not null,  -- 해당 주 월요일 날짜
  score       int  not null default 0,
  wins        int  not null default 0,
  losses      int  not null default 0,
  updated_at  timestamptz default now(),
  primary key (account_id, week_start)
);
alter table weekly_scores enable row level security;
create policy "all" on weekly_scores for all using (true) with check (true);

-- 보상 수령 기록 (중복 수령 방지)
create table if not exists battle_reward_claims (
  account_id    uuid references accounts(id) on delete cascade,
  reward_key    text not null,  -- 'daily_YYYY-MM-DD' or 'weekly_YYYY-MM-DD'
  rank_achieved int,
  claimed_at    timestamptz default now(),
  primary key (account_id, reward_key)
);
alter table battle_reward_claims enable row level security;
create policy "all" on battle_reward_claims for all using (true) with check (true);
```

---

## 7. 요일 배틀 관리

```sql
-- 특정 유저의 요일별 팀 조회
SELECT day_of_week, slots, updated_at
FROM day_battle_teams
WHERE account_id = (SELECT id FROM accounts WHERE nickname = '닉네임')
ORDER BY day_of_week;

-- 오늘 배틀 기록 조회
SELECT
  a1.nickname AS attacker,
  a2.nickname AS defender,
  br.attacker_won,
  br.day_of_week,
  br.created_at
FROM battle_records br
JOIN accounts a1 ON a1.id = br.attacker_id
JOIN accounts a2 ON a2.id = br.defender_id
WHERE br.battle_date = current_date
ORDER BY br.created_at DESC;

-- 이번 주 랭킹 조회
SELECT
  a.nickname,
  ws.score,
  ws.wins,
  ws.losses
FROM weekly_scores ws
JOIN accounts a ON a.id = ws.account_id
WHERE ws.week_start = date_trunc('week', current_date)::date
ORDER BY ws.score DESC;

-- 특정 유저 배틀 기록 초기화 (오늘)
DELETE FROM battle_records
WHERE battle_date = current_date
  AND (attacker_id = (SELECT id FROM accounts WHERE nickname = '닉네임')
    OR defender_id = (SELECT id FROM accounts WHERE nickname = '닉네임'));
```

---

## 8. 특정 유저 삭제

```sql
-- 특정 유저 완전 삭제 (game_saves는 CASCADE로 자동 삭제)
DELETE FROM accounts WHERE nickname = '닉네임';
```

---

## 9. 서버 전체 초기화 (전 유저 삭제)

> ⚠️ **되돌릴 수 없습니다.** 실행 전 반드시 백업할 것.

### 백업 (선택사항)
```sql
-- 초기화 전 전체 데이터 스냅샷 (Supabase > Table Editor > Export CSV 로도 가능)
SELECT a.nickname, gs.game_state, gs.updated_at
FROM accounts a
JOIN game_saves gs ON gs.account_id = a.id
ORDER BY gs.updated_at DESC;
```

### 전체 삭제
```sql
TRUNCATE TABLE accounts, game_saves CASCADE;
```

> 두 테이블을 동시에 나열하면 FK 제약 오류 없이 한 번에 삭제됨.

---

## 참고 — 주요 포켓몬 번호

### ★5 (신화)
| 번호 | 이름       | 타입           |
|------|------------|----------------|
| 150  | 뮤츠       | 에스퍼         |
| 151  | 뮤         | 에스퍼         |
| 249  | 루기아     | 에스퍼·비행    |
| 250  | 칠색조     | 불꽃·비행      |
| 493  | 아르세우스 | 노말           |

### ★4 (전설)
| 번호 | 이름       | 타입           | 요일 시너지 |
|------|------------|----------------|-------------|
| 144  | 프리저     | 얼음·비행      | 월 냉열충돌 |
| 145  | 썬더       | 전기·비행      |             |
| 146  | 파이어     | 불꽃·비행      | 월 냉열충돌 |
| 243  | 라이코     | 전기           |             |
| 244  | 앤테이     | 불꽃           |             |
| 245  | 스이쿤     | 물             |             |
| 377  | 레지록     | 바위           | 수 레지듀오 |
| 378  | 레지아이스 | 얼음           |             |
| 379  | 레지스틸   | 강철           | 수 레지듀오 |
| 380  | 라티아스   | 드래곤·에스퍼  | 토 라티남매 |
| 381  | 라티오스   | 드래곤·에스퍼  | 토 라티남매 |
| 382  | 가이오가   | 물             |             |
| 383  | 그란돈     | 땅             |             |
| 384  | 레쿠쟈     | 드래곤·비행    |             |
| 480  | 유크시     | 에스퍼         | 금 호수수호신 |
| 481  | 엠리트     | 에스퍼         | 금 호수수호신 |
| 482  | 아그놈     | 에스퍼         | 금 호수수호신 |
| 483  | 디아루가   | 강철·드래곤    | 시공의 신   |
| 484  | 펄기아     | 물·드래곤      | 시공의 신   |
| 485  | 히드런     | 불꽃·강철      |             |
| 486  | 레지기가스 | 노말           | 일 거인단   |
| 487  | 기라티나   | 고스트·드래곤  |             |
| 638  | 코바르온   | 강철·격투      | 목 검객     |
| 639  | 테라키온   | 바위·격투      | 목 검객     |
| 640  | 비리디온   | 풀·격투        | 화 맥박 / 목 검객 |
| 641  | 토네로스   | 비행           |             |
| 642  | 볼트로스   | 전기·비행      |             |
| 644  | 레시라무   | 드래곤·불꽃    |             |
| 645  | 란드로스   | 땅·비행        |             |

### ★3 (영웅)
| 번호 | 이름       | 타입           | 요일 시너지 |
|------|------------|----------------|-------------|
| 3    | 이상해풀   | 풀·독          | 화 자연맥박 |
| 6    | 리자몽     | 불꽃·비행      | 1세대 삼인방 |
| 9    | 거북왕     | 물             | 1세대 삼인방 |
| 143  | 잠만보     | 노말           | 일 거인단   |
| 154  | 메가니움   | 풀             | 2세대 삼인방 |
| 157  | 블레이범   | 불꽃           | 2세대 삼인방 |
| 160  | 장크로다일 | 물             | 2세대 삼인방 |
