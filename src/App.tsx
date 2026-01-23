import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { SettingsProvider } from './contexts/SettingsContext'
import { MainLayout } from './components/layout/MainLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { OKRsPage } from './pages/okrs/OKRsPage'
import { RentabilidadePage } from './pages/rentabilidade/RentabilidadePage'
import { ActionsPage } from './pages/actions/ActionsPage'

import { LeadTimePage } from './pages/leadtime/LeadTimePage'
import { SegurancaPage } from './pages/seguranca/SegurancaPage'
import { AuditLogPage } from './pages/audit/AuditLogPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { HelpPage } from './pages/help/HelpPage'
import { IdeasPage } from './pages/ideas/IdeasPage'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/okrs" element={<OKRsPage />} />
              <Route path="/rentabilidade" element={<RentabilidadePage />} />
              <Route path="/lead-time" element={<LeadTimePage />} />
              <Route path="/seguranca" element={<SegurancaPage />} />
              <Route path="/actions" element={<ActionsPage />} />
              <Route path="/ideas" element={<IdeasPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
