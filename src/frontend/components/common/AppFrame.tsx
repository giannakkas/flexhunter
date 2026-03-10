import React from 'react';
import { Frame, Navigation } from '@shopify/polaris';
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

function FlexHunterLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#grad)" />
      <path d="M10 22L16 8L22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 18H20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M16 8L16 5" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 6L16 5L19 6" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#1A1A2E"/>
          <stop offset="1" stopColor="#0F3460"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        title="FlexHunter"
        items={[
          {
            label: 'Dashboard',
            icon: HomeIcon,
            onClick: () => navigate('/'),
            selected: location.pathname === '/',
          },
          {
            label: 'Research',
            icon: SearchIcon,
            onClick: () => navigate('/research'),
            selected: location.pathname === '/research',
          },
          {
            label: 'Candidates',
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
        topBarSource: 'data:image/svg+xml,' + encodeURIComponent('<svg width="120" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#1A1A2E"/><path d="M10 22L16 8L22 22" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18H20" stroke="white" stroke-width="2.5" stroke-linecap="round"/><path d="M16 8L16 5" stroke="#00D4AA" stroke-width="2.5" stroke-linecap="round"/><text x="36" y="22" fill="#1A1A2E" font-family="Arial" font-weight="bold" font-size="16">FlexHunter</text></svg>'),
        width: 120,
        url: '/',
        accessibilityLabel: 'FlexHunter',
      }}
    >
      {children}
    </Frame>
  );
}
