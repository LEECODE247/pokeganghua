import React, { useState, useEffect } from 'react';
import { supabase, loginOrRegister } from '../supabase.js';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LoginScreen({ onLogin }) {
  const [nickname, setNickname]   = useState('');
  const [password, setPassword]   = useState('');
  const [isNew, setIsNew]         = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  // 닉네임 입력마다 신규/기존 여부 확인
  useEffect(() => {
    if (nickname.trim().length < 2) { setIsNew(false); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id')
        .eq('nickname', nickname.trim())
        .maybeSingle();
      setIsNew(!data);
    }, 400);
    return () => clearTimeout(timer);
  }, [nickname]);

  async function handleSubmit(e) {
    e.preventDefault();
    const nick = nickname.trim();
    if (nick.length < 2 || nick.length > 12) { setError('닉네임은 2~12자여야 합니다.'); return; }
    if (password.length < 4)                  { setError('비밀번호는 4자 이상이어야 합니다.'); return; }

    setLoading(true);
    setError('');
    try {
      const hash      = await sha256(password);
      const accountId = await loginOrRegister(nick, hash);
      onLogin({ accountId, nickname: nick });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: '36px 28px',
        maxWidth: 360, width: '100%', border: '1px solid var(--border)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎮</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: 4 }}>포켓가챠</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text2)', marginBottom: 28 }}>
          포획 · 진화 · 배틀
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            value={nickname}
            onChange={e => { setNickname(e.target.value); setError(''); }}
            placeholder="닉네임 (2~12자)"
            maxLength={12}
            autoFocus
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="비밀번호 (4자 이상)"
            style={inputStyle}
          />

          {nickname.trim().length >= 2 && (
            <div style={{ fontSize: '0.75rem', color: isNew ? '#4caf50' : 'var(--text2)' }}>
              {isNew ? '✨ 신규 가입' : '👤 기존 계정 로그인'}
            </div>
          )}

          {error && <div style={{ color: 'var(--fail)', fontSize: '0.8rem' }}>{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: 4, fontSize: '1rem' }}
          >
            {loading ? '확인 중...' : isNew ? '가입하고 시작하기 →' : '로그인 →'}
          </button>
        </form>

        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: 20, lineHeight: 1.7 }}>
          데이터는 서버에 저장됩니다.<br />
          어느 기기에서든 같은 계정으로 접속 가능합니다.
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '12px 14px',
  color: 'var(--text)', fontSize: '1rem', outline: 'none',
};
