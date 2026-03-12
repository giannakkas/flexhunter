// ==============================================
// FlexHunter - Frontend App
// ==============================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <ErrorBoundary>
        <BrowserRouter>
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
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  );
}
