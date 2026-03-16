import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function AppHeader({ candidateCount = 0 }: { candidateCount?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [researchRunning, setResearchRunning] = useState(false);

  // Poll for research status every 5 seconds
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch('/api/research/status', { headers: { 'x-shop-domain': sessionStorage.getItem('shopDomain') || 'unknown' } });
        const d = await r.json();
        if (!cancelled) setResearchRunning(d?.data?.status === 'RUNNING');
      } catch {}
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/research', label: 'Store DNA' },
    { path: '/candidates', label: 'Research', isResearch: true },
    { path: '/selections', label: 'Candidates', count: candidateCount },
    { path: '/imports', label: 'Imported' },
  ];

  return (
    <>
    <style>{`@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }`}</style>
    <div style={{
      background: 'linear-gradient(135deg, #0D1117 0%, #161B22 50%, #1A2332 100%)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid #30363D', minHeight: 52,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <img src="/logo.png" alt="FlexHunter" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />
        <div>
          <div style={{ color: 'white', fontSize: 14, fontWeight: 700, lineHeight: '16px' }}>FlexHunter</div>
          <div style={{ color: '#8B949E', fontSize: 10, lineHeight: '12px' }}>Product Discovery Intelligence</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
        {navItems.map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 5,
            border: isActive(item.path) ? '1px solid #58A6FF' : '1px solid #30363D',
            background: isActive(item.path) ? 'rgba(56,139,253,0.15)' : '#21262D',
            color: isActive(item.path) ? '#58A6FF' : '#C9D1D9',
            cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {(item as any).isResearch && researchRunning && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#3FB950',
                animation: 'pulse 1.5s ease-in-out infinite',
                boxShadow: '0 0 6px #3FB950',
              }} />
            )}
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span style={{
                background: '#F97316', color: 'white', borderRadius: 10,
                padding: '1px 6px', fontSize: 10, fontWeight: 700,
                minWidth: 18, textAlign: 'center',
              }}>{item.count}</span>
            )}
          </button>
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
    </>
  );
}
