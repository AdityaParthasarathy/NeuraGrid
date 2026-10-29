import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Globe2, BarChart3,
  Zap, Sparkles, Activity, Leaf, LogOut, Scale,
  FlaskConical,
} from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import { useAuth }   from '../../context/AuthContext'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/digital-twin',   icon: Globe2,          label: 'Digital Twin' },
  { to: '/analytics',      icon: BarChart3,        label: 'Analytics'    },
  { to: '/optimization',   icon: Sparkles,         label: 'Optimization' },
  { to: '/comparison',     icon: Scale,            label: 'Compare'      },
  { to: '/simulation-lab', icon: FlaskConical,     label: 'Sim Lab'      },
]

export default function Sidebar() {
  const { metrics, liveMode, buildings } = useEnergy()
  const { user, logout } = useAuth()

  const criticals = buildings.filter(b => b.status === 'critical').length
  const warnings  = buildings.filter(b => b.status === 'warning').length

  // Derive initials for avatar
  const initials = (user?.name ?? 'U')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-base-card border-r border-base-border relative z-10">

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-base-border">
        <div className="relative w-9 h-9 flex-shrink-0">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple opacity-10" />
          <div className="w-9 h-9 rounded-lg border border-accent-blue/40 flex items-center justify-center">
            <Zap size={18} className="text-accent-blue" />
          </div>
        </div>
        <div>
          <span className="text-text-main font-bold text-base tracking-tight">NeuraGrid</span>
          <p className="text-text-dim text-xxs uppercase tracking-widest">Energy Twin v2.1</p>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-text-dim text-xxs uppercase tracking-widest px-3 mb-3">Navigation</p>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                  : 'text-text-dim hover:text-text-main hover:bg-base-elevated'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-blue rounded-r-full" />
                )}
                <Icon
                  size={16}
                  className={clsx(
                    'flex-shrink-0 transition-colors',
                    isActive ? 'text-accent-blue' : 'text-text-dim group-hover:text-text-main'
                  )}
                />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom section ────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 space-y-3">

        {/* Campus Status */}
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-text-dim text-xs">Campus Status</span>
            <Activity size={12} className="text-accent-green" />
          </div>

          <div>
            <div className="flex justify-between text-xxs mb-1">
              <span className="text-text-dim">Load</span>
              <span className="text-text-main font-mono">
                {metrics.totalConsumption.toLocaleString()} kW
              </span>
            </div>
            <div className="metric-bar">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-purple transition-all duration-700"
                style={{ width: `${Math.min(100, (metrics.totalConsumption / metrics.totalCapacity) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2 text-xxs">
            {criticals > 0 && (
              <span className="flex items-center gap-1 text-accent-pink">
                <span className="status-dot status-critical" />
                {criticals} Critical
              </span>
            )}
            {warnings > 0 && (
              <span className="flex items-center gap-1 text-accent-orange">
                <span className="status-dot status-warning" />
                {warnings} Warning
              </span>
            )}
            {criticals === 0 && warnings === 0 && (
              <span className="flex items-center gap-1 text-accent-green">
                <span className="status-dot status-normal" />
                All Normal
              </span>
            )}
          </div>
        </div>

        {/* Solar */}
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center flex-shrink-0">
            <Leaf size={14} className="text-accent-green" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-dim text-xxs">Solar Active</p>
            <p className="text-text-main text-sm font-bold font-mono">{metrics.solarGeneration} kW</p>
          </div>
          <div className={clsx(
            'w-2 h-2 rounded-full flex-shrink-0',
            liveMode ? 'bg-accent-green' : 'bg-base-muted'
          )} />
        </div>

        {/* User + Logout */}
        <div
          className="flex items-center gap-3 p-3 rounded-xl border bg-base-elevated/50 border-base-border shadow-sm"
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 bg-base-elevated border border-base-border text-accent-blue shadow-sm"
          >
            {initials}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-text-main text-xs font-semibold truncate">{user?.name ?? 'Operator'}</p>
            <p className="text-text-dim text-xxs capitalize">{user?.role ?? 'operator'}</p>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-accent-pink hover:bg-accent-pink/10 transition-all flex-shrink-0"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
