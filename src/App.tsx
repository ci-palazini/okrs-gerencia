import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { BusinessUnitProvider } from './contexts/BusinessUnitContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { MainLayout } from './components/layout/MainLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { CreateUserPage } from './pages/Admin/CreateUserPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { OKRsPage } from './pages/okrs/OKRsPage'
import { PillarOKRsPage } from './pages/okrs/PillarOKRsPage'
import { OKRFocusPage } from './pages/okrs/OKRFocusPage'
import { OKRConfidenceMapPage } from './pages/okrs/OKRConfidenceMapPage'
import { ActionsPage } from './pages/actions/ActionsPage'
import { AuditLogPage } from './pages/audit/AuditLogPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { UserManagementPage } from './pages/Admin/UserManagementPage'
import { TeamsPage } from './pages/teams/TeamsPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { PillarsPage } from './pages/pillars/PillarsPage'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <BusinessUnitProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected routes */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/okrs" element={<OKRsPage />} />
                <Route path="/mapa" element={<OKRConfidenceMapPage />} />
                <Route path="/okrs/pillar/:pillarId" element={<PillarOKRsPage />} />
                <Route path="/okrs/pillar/:pillarId/kr/:krId" element={<OKRFocusPage />} />
                <Route path="/actions" element={<ActionsPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/pillars" element={<PillarsPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/users/create" element={<CreateUserPage />} />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </BusinessUnitProvider>
    </AuthProvider>
  )
}

export default App
