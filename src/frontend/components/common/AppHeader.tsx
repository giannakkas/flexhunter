import React from 'react';
import { InlineStack, Text, Button } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0D1117 0%, #161B22 40%, #1A2332 100%)',
      borderRadius: 10, padding: '14px 20px', marginBottom: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/logo.png" alt="FlexHunter" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'contain' }} />
        <div>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>FlexHunter</div>
          <div style={{ color: '#8B949E', fontSize: 11 }}>Product Discovery Intelligence</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="slim" onClick={() => navigate('/')}>Dashboard</Button>
        <Button size="slim" onClick={() => navigate('/research')}>Research</Button>
        <Button size="slim" onClick={() => navigate('/candidates')}>Candidates</Button>
        <Button size="slim" onClick={() => navigate('/imports')}>Imported</Button>
        <Button size="slim" variant="primary" onClick={() => navigate('/seo')}>SEO</Button>
      </div>
    </div>
  );
}
