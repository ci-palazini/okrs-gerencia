import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { BusinessUnitProvider } from './contexts/BusinessUnitContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { MainLayout } from './components/layout/MainLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { CreateUserPage } from './pages/Admin/CreateUserPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { OKRsPage } from './pages/okrs/OKRsPage'
import { ActionsPage } from './pages/actions/ActionsPage'
import { ObjectivesCorporatePage } from './pages/objectives-corporate/ObjectivesCorporatePage'
import { AuditLogPage } from './pages/audit/AuditLogPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { HelpPage } from './pages/help/HelpPage'
import { IdeasPage } from './pages/ideas/IdeasPage'
import { GenericPillarPage } from './pages/pillar/GenericPillarPage'
import { UserManagementPage } from './pages/Admin/UserManagementPage'
import { ProfilePage } from './pages/profile/ProfilePage'
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
                <Route path="/objectives-corporate" element={<ObjectivesCorporatePage />} />
                <Route path="/okrs" element={<OKRsPage />} />
                <Route path="/actions" element={<ActionsPage />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/users/create" element={<CreateUserPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                {/* Rota dinâmica para todos os pilares */}
                <Route path="/pillar/:pillarId" element={<GenericPillarPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </BusinessUnitProvider>
    </AuthProvider>
  )
}

export default App
