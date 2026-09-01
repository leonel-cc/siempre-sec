import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { OrganizationProvider } from './organizations/OrganizationProvider';
import { CamerasPage } from './pages/CamerasPage';
import { DashboardPage } from './pages/DashboardPage';
import { EnrollmentPage } from './pages/EnrollmentPage';
import { EventsPage } from './pages/EventsPage';
import { PhoneVerificationPage } from './pages/PhoneVerificationPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OrganizationProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/cameras" element={<CamerasPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/enrollment" element={<EnrollmentPage />} />
              <Route path="/phone" element={<PhoneVerificationPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </OrganizationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
