import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell, Wifi, WifiOff,
  Zap, LayoutDashboard, Globe2, BarChart3,
  Menu, X, Sparkles, LogOut, Scale, SlidersHorizontal,
  FlaskConical,
} from 'lucide-react'
import { useEnergy }   from '../../context/EnergyContext'
import { useAlerts }   from '../../context/AlertContext'
import { useCurrency } from '../../context/CurrencyContext'
import { useAuth }     from '../../context/AuthContext'
import AlertPanel   from '../alerts/AlertPanel'
import ControlPanel from '../controls/ControlPanel'
import { format } from 'date-fns'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/digital-twin',   icon: Globe2,          label: 'Digital Twin' },
  { to: '/analytics',      icon: BarChart3,        label: 'Analytics'    },
  { to: '/optimization',   icon: Sparkles,         label: 'Optimization' },
  { to: '/comparison',     icon: Scale,            label: 'Compare'      },
  { to: '/simulation-lab', icon: FlaskConical,     label: 'Sim Lab'      },
]

export default function Navbar() {
  const { metrics, liveMode, setLiveMode, lastUpdated, simulationMode } = useEnergy()
  const { unseenCount, alerts } = useAlerts()
  const { currency, toggle: toggleCurrency } = useCurrency()
  const { user, logout } = useAuth()

  const [alertOpen,    setAlertOpen]    = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)

  // Bell colour driven by most-severe unseen alert
  const hasCritical = alerts.some(a => !a.seen && a.severity === 'critical')
  const hasWarning  = alerts.some(a => !a.seen && a.severity === 'warning')
  const bellColor   = hasCritical ? '#DB2777' : hasWarning ? '#EA580C' : unseenCount > 0 ? '#0284C7' : undefined

  // User initials for mobile avatar
  const initials = (user?.name ?? 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <header className="sticky top-0 z-50 bg-base-card/90 backdrop-blur-xl border-b border-base-border">
        <div className="flex items-center h-16 px-4 lg:px-6 gap-4">

          {/* Logo (mobile only) */}
          <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg border border-accent-blue/40 flex items-center justify-center bg-accent-blue/10">
              <Zap size={15} className="text-accent-blue" />
            </div>
            <span className="text-text-main font-bold text-sm">NeuraGrid</span>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden ml-auto text-text-dim hover:text-text-main p-1"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Desktop breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-text-dim flex-1">
            <Zap size={13} className="text-accent-blue" />
            <span className="text-accent-blue/60">/</span>
            <span className="text-text-main font-medium">Smart Campus Energy Twin</span>
          </div>

          {/* Desktop right controls */}
          <div className="hidden lg:flex items-center gap-3 ml-auto">

            {/* Live toggle */}
            <button
              onClick={() => setLiveMode(m => !m)}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                liveMode
                  ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                  : 'border-base-border bg-base-elevated text-text-dim hover:text-text-main'
              )}
            >
              {liveMode
                ? <><Wifi size={12} /> LIVE</>
                : <><WifiOff size={12} /> PAUSED</>}
            </button>

            {/* Timestamp */}
            <span className="text-text-dim text-xs font-mono hidden xl:block">
              {format(lastUpdated, 'HH:mm:ss')}
            </span>

            {/* Currency toggle */}
            <button
              onClick={toggleCurrency}
              title={`Switch to ${currency === 'INR' ? 'USD' : 'INR'}`}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 font-mono',
                currency === 'INR'
                  ? 'border-accent-orange/30 bg-accent-orange/10 text-accent-orange'
                  : 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue'
              )}
            >
              {currency === 'INR' ? '₹ INR' : '$ USD'}
            </button>

            {/* Controls / sliders */}
            <button
              onClick={() => setControlsOpen(o => !o)}
              title={simulationMode ? 'Simulation Mode Active' : 'Environment Controls'}
              className={clsx(
                'relative w-9 h-9 rounded-lg border flex items-center justify-center transition-all',
                simulationMode
                  ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-400'
                  : controlsOpen
                  ? 'border-accent-purple/40 bg-accent-purple/15 text-accent-purple'
                  : 'border-base-border bg-base-elevated text-text-dim hover:text-text-main hover:border-accent-purple/30'
              )}
            >
              <SlidersHorizontal size={15} />
              {simulationMode && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[8px] font-bold text-white flex items-center justify-center bg-accent-purple shadow-sm">
                  SIM
                </span>
              )}
            </button>

            {/* Alert bell */}
            <button
              onClick={() => setAlertOpen(true)}
              className={clsx(
                'relative w-9 h-9 rounded-lg border flex items-center justify-center transition-all',
                hasCritical
                  ? 'border-accent-pink/40 bg-accent-pink/10 text-accent-pink animate-pulse-slow'
                  : hasWarning
                  ? 'border-accent-orange/30 bg-accent-orange/10 text-accent-orange'
                  : 'border-base-border bg-base-elevated text-text-dim hover:text-text-main hover:border-accent-blue/30'
              )}
            >
              <Bell size={15} />
              {unseenCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] text-white flex items-center justify-center font-bold"
                  style={{ background: bellColor ?? '#0284C7' }}
                >
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
            </button>



            {/* Campus total */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-base-border bg-base-elevated">
              <span className="text-text-dim text-xs">Current Load</span>
              <span className="text-accent-blue text-sm font-bold font-mono">
                {metrics.totalConsumption.toLocaleString()} kW
              </span>
            </div>

            {/* Logout (desktop) */}
            <button
              onClick={logout}
              title={`Sign out (${user?.name ?? ''})`}
              className="w-9 h-9 rounded-lg border border-base-border bg-base-elevated flex items-center justify-center text-text-dim hover:text-accent-pink hover:border-accent-pink/30 hover:bg-accent-pink/08 transition-all"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-base-border bg-base-card px-4 py-3 space-y-1 animate-slide-up">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-dim'
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}

            {/* Controls */}
            <button
              onClick={() => { setMobileOpen(false); setControlsOpen(true) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-dim"
            >
              <SlidersHorizontal size={16} />
              Controls
            </button>

            {/* Alerts */}
            <button
              onClick={() => { setMobileOpen(false); setAlertOpen(true) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-dim"
            >
              <Bell size={16} />
              Alerts
              {unseenCount > 0 && (
                <span className="ml-auto chip text-[10px]"
                  style={{ background: `${bellColor}20`, color: bellColor }}>
                  {unseenCount}
                </span>
              )}
            </button>

            {/* User row + logout */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-t border-base-border mt-2 pt-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border shadow-sm bg-base-elevated border-base-border text-accent-blue"
              >
                {initials}
              </div>
              <span className="text-text-main text-sm font-medium flex-1 truncate">
                {user?.name ?? 'Operator'}
              </span>
              <button
                onClick={() => { setMobileOpen(false); logout() }}
                className="flex items-center gap-1.5 text-xs text-accent-pink font-medium"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Alert slide-over panel */}
      <AlertPanel open={alertOpen} onClose={() => setAlertOpen(false)} />

      {/* Environment controls slide-over panel */}
      <ControlPanel open={controlsOpen} onClose={() => setControlsOpen(false)} />
    </>
  )
}
