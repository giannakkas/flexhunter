import React, { useEffect, useState } from 'react';
import { Frame, Navigation } from '@shopify/polaris';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon, SearchIcon, ProductIcon, ImportIcon,
  RefreshIcon, SettingsIcon, ListBulletedIcon,
} from '@shopify/polaris-icons';
import { apiFetch } from '../../hooks/useApi';
import { AppHeader } from './AppHeader';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [candidateCount, setCandidateCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      apiFetch<any>('/candidates/selected-count').then(r => setCandidateCount(r.data?.count || 0)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        title=""
        items={[
          { label: 'Dashboard', icon: HomeIcon, onClick: () => navigate('/'), selected: location.pathname === '/' },
          { label: 'Store DNA', icon: SearchIcon, onClick: () => navigate('/research'), selected: location.pathname === '/research' },
          { label: 'Research', icon: ProductIcon, onClick: () => navigate('/candidates'), selected: location.pathname === '/candidates' },
          {
            label: 'Candidates',
            icon: RefreshIcon,
            onClick: () => navigate('/selections'),
            selected: location.pathname === '/selections',
            badge: candidateCount > 0 ? String(candidateCount) : undefined,
          },
          { label: 'Imported', icon: ImportIcon, onClick: () => navigate('/imports'), selected: location.pathname === '/imports' },
        ]}
      />
      <Navigation.Section
        title="Optimize"
        items={[
          { label: 'SEO Optimizer', icon: SearchIcon, onClick: () => navigate('/seo'), selected: location.pathname.startsWith('/seo') },
        ]}
      />
      <Navigation.Section
        title="System"
        items={[
          { label: 'Settings', icon: SettingsIcon, onClick: () => navigate('/settings'), selected: location.pathname === '/settings' },
          { label: 'Audit Log', icon: ListBulletedIcon, onClick: () => navigate('/audit'), selected: location.pathname === '/audit' },
        ]}
      />
    </Navigation>
  );

  return (
    <Frame
      navigation={navigationMarkup}
      logo={{ topBarSource: '/logo.png', width: 140, url: '/', accessibilityLabel: 'FlexHunter' }}
    >
      <div>
        <AppHeader candidateCount={candidateCount} />
        {children}
      </div>
    </Frame>
  );
}
