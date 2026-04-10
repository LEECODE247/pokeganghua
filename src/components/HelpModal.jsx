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

        <Section title="🪙 코인 수령">
          <Row>상단 코인 옆 버튼으로 <b>1시간마다 🪙10,000</b>을 무료로 수령할 수 있습니다.</Row>
          <Row>수령 후 카운트다운이 표시되며, 0이 되면 다시 수령 가능합니다.</Row>
          <Row>쿨다운은 서버에 저장되어 다른 기기에서도 공유됩니다.</Row>
        </Section>

        <Section title="🌍 여행 (포켓몬 포획)">
          <Row><b>여행하기</b> 버튼을 누르면 야생 포켓몬이 나타납니다.</Row>
          <Row>볼을 선택하면 코인이 즉시 차감되고 포획을 시도합니다.</Row>
          <Row>포획 실패가 이어질수록 다음 포획률이 <b>5%씩</b> 누적 상승합니다.</Row>
          <Row>포획 성공 시 포켓몬이 가방에 추가됩니다.</Row>
          <RarityTable />
        </Section>

        <Section title="⚽ 볼 종류">
          <BallTable />
        </Section>

        <Section title="✨ 특수 포켓몬">
          <Row><b style={{ color: '#FFD700' }}>황금 포켓몬</b> — 0.5% 확률 출현, 판매가 <b>5배!</b></Row>
          <Row><b style={{ color: '#e040fb' }}>전설 포켓몬 ★★★★</b> — 5% 확률, 뮤츠·뮤·전설 조류 등 최상위 포켓몬</Row>
          <Row>크기 등급(S·A·B·C)도 전투력과 판매가에 영향을 줍니다. <b>S가 가장 유리</b>합니다.</Row>
        </Section>

        <Section title="⚗️ 강화 시스템">
          <Row>포켓몬을 최대 <b>+20</b>까지 강화할 수 있습니다.</Row>
          <EnhanceTable />
          <Row style={{ marginTop: 4 }}>강화 실패가 쌓일수록 다음 시도 성공률이 <b>5%씩</b> 보너스됩니다.</Row>
          <Row><b style={{ color: '#e040fb' }}>+15 이상</b>부터 강화 성공 시 전투력이 <b>2배씩</b> 폭발적으로 상승!</Row>
        </Section>

        <Section title="💎 파편">
          <Row>강화 실패 시 <b>💎 파편</b>을 소량 획득합니다.</Row>
          <Row>실패(변화 없음): +3 / 레벨 감소: +8 / 포켓몬 파괴: 레벨×15</Row>
          <Row>현재 파편은 상단 HUD에 표시됩니다. (추후 활용 예정)</Row>
        </Section>

        <Section title="🎒 가방 (인벤토리)">
          <Row>보유한 포켓몬을 전체 확인할 수 있습니다.</Row>
          <Row>카드를 클릭하면 포켓몬 상세 정보와 <b>판매·강화 이동</b> 버튼이 표시됩니다.</Row>
          <Row>일괄 판매 기능으로 여러 마리를 한번에 판매할 수 있습니다.</Row>
          <Row>판매가 = 희귀도 × 크기 등급 × 강화 레벨 배율 (황금이면 ×5)</Row>
        </Section>

        <Section title="🏟️ 체육관">
          <Row>포켓몬을 선택해 체육관에 도전하면 코인을 획득합니다.</Row>
          <Row>체육관마다 <b>최소 전투력 요건</b>이 있습니다.</Row>
          <Row>전투력이 높을수록 승리 확률이 올라가며, 패배해도 소액 위로금을 받습니다.</Row>
          <Row>도전 후 해당 포켓몬은 <b>1시간 쿨다운</b>이 적용됩니다.</Row>
          <GymTable />
        </Section>

        <Section title="⚔️ 플레이어 배틀">
          <Row><b>🛡️ 내 배틀 포켓몬</b> 탭에서 대표 포켓몬을 1마리 등록하세요.</Row>
          <Row>등록하면 다른 플레이어 목록에 내 포켓몬이 노출됩니다.</Row>
          <Row><b>⚔️ 배틀하기</b> 탭에서 다른 플레이어에게 도전할 수 있습니다.</Row>
          <Row>
            🏆 <b>승리 보상</b> — 상대 포켓몬의 <b style={{ color: '#FFD700' }}>판매가만큼 🪙코인 획득!</b><br />
            강화된 희귀 포켓몬일수록 상금이 커집니다. 상대 카드에서 상금을 미리 확인하세요.
          </Row>
          <Row>💀 <b>패배</b> — 코인 손실 없음. 부담 없이 도전하세요!</Row>
          <Row>승률 공식: 내 전투력 ÷ (내 전투력 + 상대 전투력) × 100 (최소 10% ~ 최대 90%)</Row>
          <Row>배틀 목록은 <b>30초마다</b> 자동으로 갱신됩니다.</Row>
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

function Row({ children, style }) {
  return (
    <div style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.6, paddingLeft: 8, borderLeft: '2px solid var(--border)', ...style }}>
      {children}
    </div>
  );
}

function RarityTable() {
  const rows = [
    { stars: '★☆☆☆', label: '일반',  rate: '50%', color: '#9e9e9e' },
    { stars: '★★☆☆', label: '희귀',  rate: '30%', color: '#42a5f5' },
    { stars: '★★★☆', label: '영웅',  rate: '15%', color: '#ffd600' },
    { stars: '★★★★', label: '전설',  rate: '5%',  color: '#e040fb' },
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

function BallTable() {
  const balls = [
    { name: '몬스터볼', icon: '⚽', cost: '🪙100',     desc: '★1: 50% · ★2: 20% · ★3: 5% · ★4: 2%' },
    { name: '슈퍼볼',   icon: '🔵', cost: '🪙3,000',   desc: '★1: 80% · ★2: 50% · ★3: 20% · ★4: 7%' },
    { name: '하이퍼볼', icon: '🟡', cost: '🪙20,000',  desc: '★1·2 확정 · ★3: 80% · ★4: 20%' },
    { name: '마스터볼', icon: '🟣', cost: '🪙100,000', desc: '★1·2·3 확정 · ★4: 50%' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {balls.map(b => (
        <div key={b.name} style={{
          background: 'var(--bg)', borderRadius: 6, padding: '6px 10px',
          borderLeft: '2px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
            {b.icon} {b.name} <span style={{ color: 'var(--primary)', fontWeight: 400 }}>{b.cost}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: 1 }}>{b.desc}</div>
        </div>
      ))}
    </div>
  );
}

function EnhanceTable() {
  const rows = [
    { range: '+0 ~ +4',   rate: '100%', fail: '없음',       cost: '🪙300~1,500' },
    { range: '+5 ~ +9',   rate: '70%',  fail: '변화 없음',  cost: '🪙5,000~25,000' },
    { range: '+10 ~ +14', rate: '50%',  fail: '레벨 -1',    cost: '🪙50,000~250,000' },
    { range: '+15 ~ +19', rate: '10~30%', fail: '포켓몬 파괴', cost: '🪙500,000+' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '4px 0' }}>
      {rows.map(r => (
        <div key={r.range} style={{
          background: 'var(--bg)', borderRadius: 6, padding: '5px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderLeft: '2px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{r.range}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>성공 {r.rate}</span>
          <span style={{ fontSize: '0.72rem', color: r.fail === '포켓몬 파괴' ? 'var(--fail)' : 'var(--text2)' }}>실패: {r.fail}</span>
        </div>
      ))}
    </div>
  );
}

function GymTable() {
  const gyms = [
    { name: '숲',   icon: '🌲', power: '500',    reward: '🪙1,000' },
    { name: '강',   icon: '🌊', power: '2,000',  reward: '🪙4,000' },
    { name: '동굴', icon: '⛰️', power: '8,000',  reward: '🪙16,000' },
    { name: '하늘', icon: '🌤️', power: '35,000', reward: '🪙70,000' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
      {gyms.map(g => (
        <div key={g.name} style={{
          background: 'var(--bg)', borderRadius: 6, padding: '5px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderLeft: '2px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.82rem' }}>{g.icon} {g.name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>필요 ⚡{g.power}</span>
          <span style={{ fontSize: '0.78rem', color: '#FFD700', fontWeight: 700 }}>{g.reward}</span>
        </div>
      ))}
    </div>
  );
}
