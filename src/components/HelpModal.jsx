import React from 'react';

export default function HelpModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 16,
          padding: '20px', maxWidth: 420, width: '100%',
          border: '1px solid var(--border)', marginTop: 8,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>📖 게임 설명서</div>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
            onClick={onClose}
          >✕</button>
        </div>

        <Section title="🌍 여행하기 (포켓몬 포획)">
          <Row>메인 화면의 <b>여행하기</b> 버튼으로 야생 포켓몬을 만납니다.</Row>
          <Row>볼을 선택하면 코인이 즉시 차감되며 포획을 시도합니다.</Row>
          <Row>포획 실패가 이어질수록 다음 포획률이 <b>5%씩</b> 상승합니다.</Row>
          <RarityTable />
        </Section>

        <Section title="⚽ 볼 종류">
          <Row><b>몬스터볼</b> 🪙100 — ★4 포획률 2%</Row>
          <Row><b>슈퍼볼</b> 🪙3,000 — ★4 포획률 7%</Row>
          <Row><b>하이퍼볼</b> 🪙20,000 — ★★ 확정, ★4 포획률 20%</Row>
          <Row><b>마스터볼</b> 🪙100,000 — ★★★ 확정, ★4 포획률 100%</Row>
        </Section>

        <Section title="✨ 특수 포켓몬">
          <Row><b style={{ color: 'var(--gold)' }}>황금 포켓몬</b> 0.5% 확률 — 판매가 5배!</Row>
          <Row><b style={{ color: '#e040fb' }}>전설 포켓몬 ★★★★</b> 5% 확률 — 뮤츠·뮤·전설 조류 등 10마리</Row>
        </Section>

        <Section title="⚗️ 강화 시스템">
          <Row>포켓몬을 최대 <b>+20</b>까지 강화할 수 있습니다.</Row>
          <Row><b>+0~+4</b> 성공률 100%, 실패 없음</Row>
          <Row><b>+5~+9</b> 성공률 70%, 실패 시 변화 없음</Row>
          <Row><b>+10~+14</b> 성공률 50%, 실패 시 -1 레벨</Row>
          <Row><b style={{ color: '#e040fb' }}>+15부터</b> 성공 시 전투력 <b>2배!</b> 실패 시 포켓몬 파괴</Row>
          <Row>+15→16: 30% / +16→17: 27% / +17→18: 24% / +18→19: 20% / +19→20: 10%</Row>
          <Row>강화 실패가 쌓이면 다음 강화 성공률이 <b>5%씩</b> 보너스됩니다.</Row>
        </Section>

        <Section title="🏟️ 체육관">
          <Row>포켓몬을 선택해 체육관에 도전하면 코인을 획득합니다.</Row>
          <Row>필요 전투력 이상이어야 도전 가능 (승리 확률은 전투력 비례).</Row>
          <Row>도전 후 포켓몬은 <b>1시간 휴식</b>이 필요합니다.</Row>
          <Row>패배해도 소액의 위로금을 받습니다.</Row>
          <Row><b>숲</b> 🪙1,000 / <b>강</b> 🪙4,000 / <b>동굴</b> 🪙16,000 / <b>하늘</b> 🪙70,000</Row>
        </Section>

        <Section title="💎 파편 & 💸 판매">
          <Row>강화 실패 시 <b>💎 파편</b>을 소량 획득합니다. (파괴 시 더 많이)</Row>
          <Row>판매가는 희귀도·크기·강화 레벨에 비례하며, +15 이후 2배씩 상승합니다.</Row>
          <Row>판매가 = 배틀 승리 시 획득할 수 있는 상금이 되므로, 강한 포켓몬을 등록해두세요!</Row>
        </Section>

        <button
          className="btn btn-primary btn-full"
          style={{ marginTop: 12 }}
          onClick={onClose}
        >
          확인
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.6, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
      {children}
    </div>
  );
}

function RarityTable() {
  const rows = [
    { stars: '★☆☆☆', label: '일반', rate: '50%', color: '#9e9e9e' },
    { stars: '★★☆☆', label: '희귀', rate: '30%', color: '#42a5f5' },
    { stars: '★★★☆', label: '영웅', rate: '15%', color: '#ffd600' },
    { stars: '★★★★', label: '전설', rate: '5%',  color: '#e040fb' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
      {rows.map(r => (
        <div key={r.label} style={{
          background: 'var(--bg)', borderRadius: 6, padding: '4px 8px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: r.color, fontSize: '0.75rem' }}>{r.stars}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>{r.label}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: r.color }}>{r.rate}</span>
        </div>
      ))}
    </div>
  );
}
