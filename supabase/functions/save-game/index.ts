import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')!

const MAX_COINS      = 50_000_000
const MAX_FRAGMENTS  = 5_000_000
const MAX_INVENTORY  = 500
const MAX_ENHANCE    = 25
const VALID_GRADES   = new Set(['S', 'A', 'B', 'C'])
const VALID_RARITIES = new Set([1, 2, 3, 4, 5])

function validate(gs: unknown): string | null {
  if (!gs || typeof gs !== 'object' || Array.isArray(gs)) return '잘못된 형식'
  const g = gs as Record<string, unknown>

  const coins = Number(g.coins)
  if (!Number.isFinite(coins) || coins < 0 || coins > MAX_COINS)
    return `코인 범위 초과 (0 ~ ${MAX_COINS.toLocaleString()})`

  const frags = Number(g.fragments ?? 0)
  if (!Number.isFinite(frags) || frags < 0 || frags > MAX_FRAGMENTS)
    return `파편 범위 초과 (0 ~ ${MAX_FRAGMENTS.toLocaleString()})`

  if (!Array.isArray(g.inventory)) return '인벤토리 형식 오류'
  if ((g.inventory as unknown[]).length > MAX_INVENTORY)
    return `인벤토리 초과 (최대 ${MAX_INVENTORY})`

  for (const raw of g.inventory as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '포켓몬 데이터 오류'
    const p = raw as Record<string, unknown>

    const id = Number(p.pokemonId)
    if (!Number.isInteger(id) || id < 1 || id > 1010)
      return `잘못된 포켓몬 ID: ${p.pokemonId}`

    if (!VALID_RARITIES.has(Number(p.rarity)))
      return `잘못된 희귀도: ${p.rarity}`

    const size = Number(p.size)
    if (!Number.isInteger(size) || size < 1 || size > 100)
      return `잘못된 크기: ${p.size}`

    if (!VALID_GRADES.has(String(p.sizeGrade)))
      return `잘못된 등급: ${p.sizeGrade}`

    const lv = Number(p.enhanceLevel)
    if (!Number.isInteger(lv) || lv < 0 || lv > MAX_ENHANCE)
      return `강화 레벨 범위 초과: ${p.enhanceLevel} (최대 ${MAX_ENHANCE})`
  }

  return null
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: CORS })

  try {
    const { accountId, gameState } = await req.json()

    if (!accountId || typeof accountId !== 'string')
      return new Response(JSON.stringify({ error: '계정 ID 누락' }), { status: 400, headers: CORS })

    const err = validate(gameState)
    if (err)
      return new Response(JSON.stringify({ error: err }), { status: 400, headers: CORS })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 계정 존재 확인
    const { data: account } = await supabase
      .from('accounts').select('id').eq('id', accountId).maybeSingle()
    if (!account)
      return new Response(JSON.stringify({ error: '계정 없음' }), { status: 404, headers: CORS })

    // _savedAt은 서버 시간으로 덮어씀 (클라이언트 조작 방지)
    const safeState = { ...gameState, _savedAt: Date.now() }
    delete safeState.screen  // 화면 상태는 저장하되 민감한 필드 추가 제거 가능

    await supabase.from('game_saves').upsert({
      account_id:  accountId,
      game_state:  safeState,
      updated_at:  new Date().toISOString(),
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: '서버 오류' }), { status: 500, headers: CORS })
  }
})
