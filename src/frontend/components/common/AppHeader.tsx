import React from 'react';
import { useNavigate } from 'react-router-dom';

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0D1117 0%, #161B22 40%, #1A2332 100%)',
      borderRadius: 0, padding: '14px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/logo.png" alt="FlexHunter" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'contain' }} />
        <div>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>FlexHunter</div>
          <div style={{ color: '#8B949E', fontSize: 11 }}>Product Discovery Intelligence</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => navigate('/')} style={btnStyle}>Dashboard</button>
        <button onClick={() => navigate('/research')} style={btnStyle}>Research</button>
        <button onClick={() => navigate('/candidates')} style={btnStyle}>Candidates</button>
        <button onClick={() => navigate('/imports')} style={btnStyle}>Imported</button>
        <button onClick={() => navigate('/seo')} style={{
          ...btnStyle,
          background: 'linear-gradient(135deg, #007ACE, #5C6AC4)',
          color: 'white',
          border: '1px solid #5C6AC4',
          boxShadow: '0 0 12px rgba(92, 106, 196, 0.5)',
          animation: 'seoGlow 2s ease-in-out infinite',
        }}>SEO Optimizer</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: '1px solid #30363D',
  background: '#21262D',
  color: '#C9D1D9',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  whiteSpace: 'nowrap',
};
