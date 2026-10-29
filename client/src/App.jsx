import React, { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { EnergyProvider }  from './context/EnergyContext'
import { AlertProvider }   from './context/AlertContext'
import { CurrencyProvider } from './context/CurrencyContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout    from './components/layout/Layout'
import AuthPage  from './pages/AuthPage'

// ── Code-split every page so the initial bundle stays small ───────────────────
const Dashboard          = lazy(() => import('./pages/Dashboard'))
const DigitalTwin        = lazy(() => import('./pages/DigitalTwin'))
const Analytics          = lazy(() => import('./pages/Analytics'))
const Optimization       = lazy(() => import('./pages/Optimization'))
const BuildingComparison = lazy(() => import('./pages/BuildingComparison'))
const SimulationLab      = lazy(() => import('./pages/SimulationLab'))

// ── Auth guard — redirects unauthenticated users to the login screen ──────────
function ProtectedRoutes() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return <AuthPage />

  return (
    <EnergyProvider>
      <AlertProvider>
        <CurrencyProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"      element={<Dashboard />}          />
              <Route path="digital-twin"   element={<DigitalTwin />}        />
              <Route path="analytics"      element={<Analytics />}          />
              <Route path="optimization"   element={<Optimization />}       />
              <Route path="comparison"     element={<BuildingComparison />}  />
              <Route path="simulation-lab" element={<SimulationLab />}       />
              {/* Any unknown route (incl. removed ai-insights / leaderboard) falls back to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </CurrencyProvider>
      </AlertProvider>
    </EnergyProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoutes />
    </AuthProvider>
  )
}
