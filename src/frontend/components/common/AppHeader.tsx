import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || (path === '/' && location.pathname === '');

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0D1117 0%, #161B22 50%, #1A2332 100%)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid #30363D',
      minHeight: 52,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <img src="/logo.png" alt="FlexHunter" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />
        <div>
          <div style={{ color: 'white', fontSize: 14, fontWeight: 700, lineHeight: '16px' }}>FlexHunter</div>
          <div style={{ color: '#8B949E', fontSize: 10, lineHeight: '12px' }}>Product Discovery Intelligence</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
        {[
          { path: '/', label: 'Dashboard' },
          { path: '/research', label: 'Research' },
          { path: '/candidates', label: 'Candidates' },
          { path: '/imports', label: 'Imported' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 5,
            border: isActive(item.path) ? '1px solid #58A6FF' : '1px solid #30363D',
            background: isActive(item.path) ? 'rgba(56,139,253,0.15)' : '#21262D',
            color: isActive(item.path) ? '#58A6FF' : '#C9D1D9',
            cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
          }}>{item.label}</button>
        ))}
        <button onClick={() => navigate('/seo')} style={{
          padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 5,
          border: '1px solid #5C6AC4',
          background: isActive('/seo') ? '#5C6AC4' : 'linear-gradient(135deg, #007ACE, #5C6AC4)',
          color: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
          boxShadow: '0 0 8px rgba(92,106,196,0.4)',
          animation: 'seoGlow 2s ease-in-out infinite',
        }}>SEO Optimizer</button>
      </div>
    </div>
  );
}
