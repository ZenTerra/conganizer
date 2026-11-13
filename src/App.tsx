import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OverviewPage } from './features/overview/OverviewPage';
import { ConFormPage } from './features/convention/ConFormPage';
import { ConLayout } from './features/convention/ConLayout';
import { OverviewTab } from './features/convention/tabs/OverviewTab';
import { HotelTab } from './features/convention/tabs/HotelTab';
import { PlaceholderTab } from './features/convention/tabs/PlaceholderTab';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/neu" element={<ConFormPage />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
          <Route path="/con/:id/bearbeiten" element={<ConFormPage />} />
          <Route path="/con/:id" element={<ConLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="hotel" element={<HotelTab />} />
            <Route path="fahrten" element={<PlaceholderTab title="Fahrtenbuch" milestone={2} />} />
            <Route path="packliste" element={<PlaceholderTab title="Packliste" milestone={2} />} />
            <Route path="kasse" element={<PlaceholderTab title="Kasse" milestone={2} />} />
            <Route path="checkliste" element={<PlaceholderTab title="Checkliste" milestone={2} />} />
            <Route path="bilder" element={<PlaceholderTab title="Referenzbilder" milestone={3} />} />
            <Route path="abrechnung" element={<PlaceholderTab title="Abrechnung" milestone={3} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
