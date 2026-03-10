// ==============================================
// FlexHunter - Frontend App
// ==============================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

import { AppFrame } from './components/common/AppFrame';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { ImportsPage } from './pages/ImportsPage';
import { ReplacementsPage } from './pages/ReplacementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { ResearchPage } from './pages/ResearchPage';

export default function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <BrowserRouter>
        <AppFrame>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/replacements" element={<ReplacementsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AppFrame>
      </BrowserRouter>
    </AppProvider>
  );
}
