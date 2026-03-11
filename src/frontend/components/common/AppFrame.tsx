import React from 'react';
import { Frame, Navigation, TopBar } from '@shopify/polaris';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  SearchIcon,
  ProductIcon,
  ImportIcon,
  RefreshIcon,
  SettingsIcon,
  ListBulletedIcon,
} from '@shopify/polaris-icons';

import { AppHeader } from './AppHeader';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        title=""
        items={[
          {
            label: 'Dashboard',
            icon: HomeIcon,
            onClick: () => navigate('/'),
            selected: location.pathname === '/',
          },
          {
            label: 'Store DNA',
            icon: SearchIcon,
            onClick: () => navigate('/research'),
            selected: location.pathname === '/research',
          },
          {
            label: 'Research',
            icon: ProductIcon,
            onClick: () => navigate('/candidates'),
            selected: location.pathname === '/candidates',
          },
          {
            label: 'Imported',
            icon: ImportIcon,
            onClick: () => navigate('/imports'),
            selected: location.pathname === '/imports',
          },
          {
            label: 'Replacements',
            icon: RefreshIcon,
            onClick: () => navigate('/replacements'),
            selected: location.pathname === '/replacements',
          },
        ]}
      />
      <Navigation.Section
        title="Optimize"
        items={[
          {
            label: 'SEO Optimizer',
            icon: SearchIcon,
            onClick: () => navigate('/seo'),
            selected: location.pathname.startsWith('/seo'),
          },
        ]}
      />
      <Navigation.Section
        title="System"
        items={[
          {
            label: 'Settings',
            icon: SettingsIcon,
            onClick: () => navigate('/settings'),
            selected: location.pathname === '/settings',
          },
          {
            label: 'Audit Log',
            icon: ListBulletedIcon,
            onClick: () => navigate('/audit'),
            selected: location.pathname === '/audit',
          },
        ]}
      />
    </Navigation>
  );

  return (
    <Frame
      navigation={navigationMarkup}
      logo={{
        topBarSource: '/logo.png',
        width: 140,
        url: '/',
        accessibilityLabel: 'FlexHunter',
      }}
    >
      <div style={{ padding: '0 0 0 0' }}>
        <AppHeader />
        {children}
      </div>
    </Frame>
  );
}
