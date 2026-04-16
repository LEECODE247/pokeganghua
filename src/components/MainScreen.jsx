import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import { formatCoins } from '../utils/gameUtils.js';

// ── 업데이트 공지 데이터 ──────────────────────────────────────────────────────
const UPDATES = [
  {
    id: 3,
    date: '2026.04.16',
    title: '3차 업데이트',
    badge: 'NEW',
    summary: '2세대 확장 · 진화 시스템 · 신화 등급',
    details: [
      {
        section: '🌏 2세대 포켓몬 추가',
        items: [
          '치코리타·브케인·리아코 등 금/은 버전 포켓몬 100마리 추가',
          '총 출현 풀 161마리 → 251마리 이상으로 확장',
          '2세대 포켓몬 한국어 이름 27종 정식 명칭으로 수정',
          '1세대·2세대 도감 완성 보상 신설',
          '- 1세대 완성: 💎 파편 10,000개',
          '- 2세대 완성: 랜덤 ★4 S급 +15강 포켓몬',
        ],
      },
      {
        section: '🌟 진화 시스템 추가',
        items: [
          '강화 특정 레벨 도달 시 포켓몬이 진화',
          '3단계 진화: +10 → +15 (예: 이상해씨 → 이상해풀 → 이상해꽃)',
          '2단계 진화: +13 (예: 피카츄 → 라이츄, 잉어킹 → 갸라도스)',
          '베이비 포켓몬: +10 (예: 피츄 → 피카츄)',
          '이브이: +13에 에스피·블래키 등 5종 중 랜덤 진화',
          '배루키: +13에 시라소몬·홍수몬·히토몬탑 중 랜덤',
          '진화 연출: 실루엣 → 화이트 플래시 → 등장 풀스크린 애니메이션',
        ],
      },
      {
        section: '🔶 ★5 신화 등급 — 아르세우스',
        items: [
          '출현 확률 0.5% (마스터볼로만 포획 가능, 포획률 10%)',
          '기준 전투력 40,000 — 전설의 3배 이상',
          '포획 화면에 주황색 글로우 + 🌟 신화! 배지 표시',
        ],
      },
      {
        section: '🏟️ 엔드게임 체육관 4개 추가',
        items: [
          '기존 4개 → 총 8개 체육관으로 확장',
          '체육관 탭 레이아웃 2행 × 4열 그리드로 변경',
          '🧊 빙산 체육관 — 전투력 80,000+ / 보상 🪙200,000 (엘리트)',
          '⚡ 폭풍 체육관 — 전투력 400,000+ / 보상 🪙1,000,000 (초고난이도)',
          '🌑 심연 체육관 — 전투력 2,500,000+ / 보상 🪙4,500,000 (레전드)',
          '✨ 신화 체육관 — 전투력 3,500,000+ / 보상 🪙12,000,000 (극악 난이도)',
          '- 승률: 350만 기준 5%에서 시작, 50만 오를 때마다 +5% 상승',
          '- 아르세우스 S+20강(약 1,170만) 도달 시 최대 85%',
        ],
      },
      {
        section: '⚔️ 배틀 애니메이션 개편',
        items: [
          '레이아웃 변경: 상대(위) / 나(아래) 본가 스타일',
          '8개 체육관 모두 타입별 배경·기술 개별 적용',
          '- 숲=초록/잎날가르기, 강=파랑/물대포, 동굴=갈색/지진, 하늘=빨강/불꽃방사',
          '- 빙산=하늘색/눈보라, 폭풍=노랑/번개, 심연=보라/사이코키, 신화=주황/하이퍼빔',
          '플레이어 배틀(PvP)에도 동일 7단계 애니메이션 적용',
          '차지업 글로우 → 돌진 → 타입별 에너지 탄환 → 피격 플래시',
          '7단계 배틀 시퀀스 (이전 4단계 → 7단계로 확장)',
        ],
      },
      {
        section: '⚡ 전투력 시스템 개선',
        items: [
          '포켓몬별 실제 종족값(BST) 기반 개별 전투력 적용',
          '예: 잉어킹(80) → 갸라도스 진화 시 3,500으로 급등',
          '예: 뮤츠(22,000) vs 라이코(12,500) 전설 내 차등화',
          '+15강 이상 성공 시 전투력 2배 공식 유지',
        ],
      },
      {
        section: '🎨 UI 전면 개편',
        items: [
          '어두운 보라·네이비 → 포켓몬 스타일 로얄 블루/레드/골드 테마로 전환',
          'HUD 상단 포켓몬 레드(#CC1111) 라인 + 레드 글로우 그림자',
          '활성 탭·버튼: 포켓몬 레드 그라디언트 적용',
          '타이틀 "PokéGacha" 레드→골드 시머링 애니메이션',
          '전설 포켓몬 글로우 레드+블루 이중 색상으로 변경',
          '루렛(여행) 버튼 레드/골드 그라디언트로 변경',
        ],
      },
    ],
  },
  {
    id: 2,
    date: '2026.04.10',
    title: '2차 업데이트',
    badge: null,
    summary: '도감 시스템 · 포획 연출 · 볼 이미지',
    details: [
      {
        section: '📖 포켓몬 도감',
        items: [
          '새 탭 "도감" 추가 — 포획한 포켓몬 기록',
          '도감 완성 시 💎 파편 10,000개 보상',
          '희귀도별 분류 및 전체 진행률 표시',
        ],
      },
      {
        section: '🎯 포획 연출 개선',
        items: [
          '볼 던진 후 3...2...1... GOTCHA! / 탈출! 카운트다운 오버레이',
          '포획 버튼에 실제 볼 스프라이트 이미지 적용',
        ],
      },
      {
        section: '⚔️ 배틀 애니메이션 (초기)',
        items: [
          '체육관 배틀 시 3라운드 HP바 애니메이션 추가',
          '체육관별 대표 포켓몬 등장 (이상해꽃·거북왕·딱구리·리자몽)',
          '승패 연출 후 결과 표시',
        ],
      },
      {
        section: '🔧 밸런스 조정',
        items: [
          '포획 실패 연속 보너스 5% → 1% 하향',
          '★1 출현율 수정 (52%), ★3 16%, ★4 2% 명확화',
          '매시간 코인 10,000 수령 버튼 추가',
        ],
      },
    ],
  },
  {
    id: 1,
    date: '2026.04.10',
    title: '1차 업데이트',
    badge: null,
    summary: '게임 출시 — 기본 시스템 전체',
    details: [
      {
        section: '🎮 기본 시스템',
        items: [
          '1세대 포켓몬 161마리 수록',
          '여행 → 야생 포켓몬 출현 → 볼로 포획',
          '볼 4종: 몬스터볼·슈퍼볼·하이퍼볼·마스터볼',
          '황금 포켓몬 0.5% 확률 등장 (판매가 5배)',
        ],
      },
      {
        section: '⚗️ 강화 시스템',
        items: [
          '+0 ~ +20 강화 (최대 20레벨)',
          '+15부터 성공 시 전투력 2배, 실패 시 파괴',
          '실패 스택으로 성공률 보너스 누적',
          '💎 파편 1000개로 파괴 방어 가능',
        ],
      },
      {
        section: '🏟️ 체육관 시스템',
        items: [
          '4개 체육관 (숲·강·동굴·하늘)',
          '전투력 조건 충족 시 도전 가능',
          '승리 보상 코인 획득, 1시간 쿨다운',
          '포켓몬 매각으로 코인 수급',
        ],
      },
    ],
  },
];

// ── 업데이트 모달 ─────────────────────────────────────────────────────────────
function UpdateModal({ update, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ maxHeight: '80vh', overflowY: 'auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 2 }}>{update.date}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{update.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginTop: 3 }}>{update.summary}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text2)',
            fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
          }}>✕</button>
        </div>

        <hr className="divider" style={{ marginBottom: 14 }} />

        {/* 섹션별 내용 */}
        {update.details.map((sec, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 7, color: 'var(--text)' }}>
              {sec.section}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {sec.items.map((item, j) => (
                <li key={j} style={{
                  fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.7,
                  listStyleType: item.startsWith('-') ? 'none' : 'disc',
                  paddingLeft: item.startsWith('-') ? 4 : 0,
                }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MainScreen() {
  const { state, dispatch } = useGame();
  const [selectedUpdate, setSelectedUpdate] = useState(null);

  const winRate = state.totalBattles > 0
    ? Math.round((state.totalWins / state.totalBattles) * 100)
    : 0;

  return (
    <div>
      <div className="main-title">PokéGacha</div>
      <p className="main-subtitle">포획 · 강화 · 정복</p>

      {/* 통계 */}
      <div className="card mb-12">
        <div className="stats-bar">
          <div className="stat-pill">
            <div className="stat-pill-val">{state.totalCaptured}</div>
            <div className="stat-pill-label">포획</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-val">{state.inventory.length}</div>
            <div className="stat-pill-label">보유</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-val">{state.totalEnhanced}</div>
            <div className="stat-pill-label">강화</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-val">{winRate}%</div>
            <div className="stat-pill-label">승률</div>
          </div>
        </div>
      </div>

      {/* 여행하기 버튼 */}
      <div className="roulette-section">
        <button
          className="roulette-btn"
          onClick={() => dispatch({ type: 'START_ROULETTE' })}
        >
          <span className="roulette-btn-icon">🌍</span>
          <span className="roulette-btn-text">여행하기</span>
          <span className="roulette-btn-sub">포켓몬을 찾아나선다...</span>
        </button>

        {/* 업데이트 공지 게시판 */}
        <div className="card" style={{ padding: '10px 0 4px' }}>
          <div className="section-title" style={{ paddingLeft: 14, marginBottom: 6 }}>
            📢 업데이트 공지
          </div>
          {UPDATES.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUpdate(u)}
              style={{
                width: '100%', background: 'none', border: 'none',
                borderTop: '1px solid var(--border)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {u.badge && (
                <span style={{
                  background: 'var(--primary)', color: '#fff',
                  fontSize: '0.6rem', fontWeight: 900,
                  padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                }}>
                  {u.badge}
                </span>
              )}
              {!u.badge && (
                <span style={{
                  background: 'var(--border)', color: 'var(--text2)',
                  fontSize: '0.6rem', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                }}>
                  {u.id}차
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: u.badge ? 'var(--text)' : 'var(--text2)' }}>
                  {u.date} {u.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.summary}
                </div>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: '0.8rem', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {/* 업데이트 모달 */}
      {selectedUpdate && (
        <UpdateModal update={selectedUpdate} onClose={() => setSelectedUpdate(null)} />
      )}

      {/* 팁 */}
      <div className="card">
        <div className="section-title">팁</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.8 }}>
          🌍 여행으로 1·2세대 포켓몬 랜덤 출현<br/>
          ⭐ 전설 포켓몬은 2% 확률 — 만나면 놓치지 마세요!<br/>
          🌟 신화 <span style={{ color: '#FF6B00', fontWeight: 700 }}>아르세우스</span>는 0.5% — 마스터볼로만 포획 가능!<br/>
          ⚗️ 강화 +15부터 성공 시 전투력이 <span style={{ color: '#e040fb', fontWeight: 700 }}>2배</span><br/>
          🏟️ 체육관에서 대규모 코인 획득<br/>
          ✨ 황금 포켓몬은 0.5% 확률 — 판매가 5배!
        </div>
      </div>
    </div>
  );
}
