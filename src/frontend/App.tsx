// ==============================================
// FlexHunter - Frontend App
// ==============================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

import { AppFrame } from './components/common/AppFrame';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { SelectionsPage } from './pages/SelectionsPage';
import { ImportsPage } from './pages/ImportsPage';
import { ReplacementsPage } from './pages/ReplacementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { ResearchPage } from './pages/ResearchPage';

import { SeoPage } from './pages/SeoPage';
import { PlansPage } from './pages/PlansPage';
import { TrendsPage } from './pages/TrendsPage';
import { AdminPage } from './pages/AdminPage';

// Check if we're in a valid Shopify context
function isShopifyContext(): boolean {
  const params = new URLSearchParams(window.location.search);
  // Shopify embedded apps always get ?shop= and ?host= params
  if (params.get('shop') || params.get('host') || params.get('hmac') || params.get('id_token')) return true;
  // Check if we're in an iframe (Shopify admin embeds apps in iframes)
  if (window.top !== window.self) return true;
  // Check if Shopify App Bridge is available
  if ((window as any).shopify) return true;
  return false;
}

// Store Shopify context once detected (survives SPA navigation)
let _shopifyVerified = isShopifyContext();

function ShopifyGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  // Re-check on location change in case params were added
  if (!_shopifyVerified) {
    _shopifyVerified = isShopifyContext();
  }
  
  if (!_shopifyVerified) {
    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#F6F6F7', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24,
      }}>
        <div style={{ 
          background: 'white', borderRadius: 16, padding: '48px 40px', maxWidth: 440,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E1E3E5',
        }}>
          <img src="/logo.png" alt="FlexHunter" style={{ height: 64, marginBottom: 20 }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>Access Through Shopify</h1>
          <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            FlexHunter is a Shopify embedded app. Please access it through your Shopify admin panel.
          </p>
          <a href="https://apps.shopify.com/flexhunter" style={{
            display: 'inline-block', padding: '12px 28px', background: '#008060', color: 'white',
            borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none',
          }}>Install on Shopify</a>
          <div style={{ marginTop: 16 }}>
            <a href="/" style={{ color: '#3B82F6', fontSize: 13, textDecoration: 'none' }}>← Back to flexhunter.app</a>
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

export default function App() {
  const isAdmin = window.location.pathname === '/admin';

  return (
    <AppProvider i18n={enTranslations}>
      <ErrorBoundary>
        <BrowserRouter>
          {isAdmin ? (
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          ) : (
            <ShopifyGuard>
              <AppFrame>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/research" element={<ResearchPage />} />
                    <Route path="/candidates" element={<CandidatesPage />} />
                    <Route path="/selections" element={<SelectionsPage />} />
                    <Route path="/imports" element={<ImportsPage />} />
                    <Route path="/seo" element={<SeoPage />} />
                    <Route path="/plans" element={<PlansPage />} />
                    <Route path="/trends" element={<TrendsPage />} />
                    <Route path="/replacements" element={<ReplacementsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </ErrorBoundary>
              </AppFrame>
            </ShopifyGuard>
          )}
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  );
}
