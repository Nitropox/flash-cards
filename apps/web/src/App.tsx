import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Session } from './pages/Session';
import { SettingsPage } from './pages/Settings';
import { BrowsePage } from './pages/Browse';
import { WordDetailPage } from './pages/WordDetail';
import { OnboardingPage } from './pages/Onboarding';
import { StatsPage } from './pages/Stats';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/learn" element={<Session />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/word/:id" element={<WordDetailPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
