import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import { formatCoins } from '../utils/gameUtils.js';

// ── 업데이트 공지 데이터 ──────────────────────────────────────────────────────
const UPDATES = [
  {
    id: 3,
    date: '2026.04.22',
    title: '🙇 서버 오류 사과 및 보상 지급',
    badge: 'HOT',
    summary: '데이터 저장 오류 사과 · 전 유저 보상 지급',
    details: [
      {
        section: '🙇 불편을 드려 진심으로 사과드립니다',
        items: [
          '안녕하세요, 포켓가챠 운영팀입니다.',
          '정식 출시 이후 일부 기간 동안 게임 데이터가 정상적으로 저장되지 않는 심각한 오류가 발생하였습니다.',
          '포획한 포켓몬, 강화 결과, 코인 등 소중한 진행 데이터가 유실되신 분들께 진심으로 사과드립니다.',
          '오류의 원인은 보안 업데이트 과정에서 저장 API가 올바르게 연결되지 않은 문제였으며, 현재는 완전히 수정 완료되었습니다.',
          '다시는 이런 일이 발생하지 않도록 더욱 철저히 관리하겠습니다. 🙏',
        ],
      },
      {
        section: '🎁 전 유저 보상 지급',
        items: [
          '오류로 인한 불편에 대한 보상으로 전 유저에게 아래 보상을 지급합니다.',
          '💰 코인 100,000개',
          '💎 특별 재화(파편) 3,000개',
          '보상은 자동으로 계정에 지급되며, 게임에 접속하시면 바로 확인하실 수 있습니다.',
          '앞으로도 포켓가챠를 사랑해 주셔서 감사합니다.',
        ],
      },
    ],
  },
  {
    id: 2,
    date: '2026.04.21',
    title: '⚖️ 밸런스 조정',
    badge: 'HOT',
    summary: '전설의 새 시너지 배율 하향',
    details: [
      {
        section: '⚖️ 밸런스 조정',
        items: [
          '전설의 새 (썬더 + 파이어 + 프리저) 시너지 배율이 하향 조정되었습니다.',
          '기존 ×2.5 → 변경 ×1.5',
          '전설 포켓몬 조합의 전투력이 지나치게 높아 전체적인 밸런스를 해친다고 판단하여 조정하였습니다.',
          '더 다양한 조합이 경쟁력을 가질 수 있도록 앞으로도 지속적으로 조율해 나가겠습니다.',
        ],
      },
    ],
  },
  {
    id: 1,
    date: '2026.04.20',
    title: '🎉 정식 버전 출시',
    badge: 'NEW',
    summary: '클로즈베타 종료 · 정식 서비스 시작',
    details: [
      {
        section: '💌 클로즈베타에 참여해주신 분들께',
        items: [
          '긴 시간 동안 함께해주셔서 진심으로 감사합니다.',
          '여러분의 피드백과 관심 덕분에 더 좋은 게임으로 성장할 수 있었습니다.',
          '버그를 발견하고, 불편함을 알려주시고, 묵묵히 함께해주신 모든 분들께 깊이 감사드립니다.',
          '클로즈베타가 있었기에 오늘의 정식 출시가 있을 수 있었습니다. 정말 감사했습니다. 🙏',
        ],
      },
      {
        section: '🚀 이제, 정식으로 시작합니다',
        items: [
          '오늘부터 포켓가챠가 정식 서비스를 시작합니다.',
          '1·2세대 포켓몬 251마리, 8개 체육관, 진화 시스템, PvP 배틀까지 —',
          '모든 콘텐츠가 준비되어 있습니다.',
          '자, 이제 다 같이 여행을 떠나봅시다! 🌍',
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

  return (
    <div>
      <div className="main-title">PokéGacha</div>
      <p className="main-subtitle">포획 · 진화 · 배틀</p>

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
      <div className="card" style={{ marginBottom: 0 }}>
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

      {/* 개발자 크레딧 */}
      <div style={{
        textAlign: 'center', marginTop: 20, paddingBottom: 8,
        fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)',
        letterSpacing: 1,
      }}>
        developed by <span style={{ color: 'rgba(255,255,255,0.32)', fontWeight: 700 }}>jito's husband</span>
      </div>
    </div>
  );
}
