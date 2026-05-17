import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Session } from './pages/Session';
import { SettingsPage } from './pages/Settings';
import { BrowsePage } from './pages/Browse';
import { WordDetailPage } from './pages/WordDetail';
import { OnboardingPage } from './pages/Onboarding';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/learn" element={<Session />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/word/:id" element={<WordDetailPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
