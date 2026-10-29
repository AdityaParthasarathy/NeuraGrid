import React from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronRight } from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import clsx from 'clsx'

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle,   color: 'text-accent-pink',   bg: 'bg-accent-pink/10',   border: 'border-accent-pink/20',   label: 'Critical' },
  warning:  { icon: AlertTriangle, color: 'text-accent-orange', bg: 'bg-accent-orange/10', border: 'border-accent-orange/20', label: 'Warning'  },
  info:     { icon: Info,          color: 'text-accent-blue',   bg: 'bg-accent-blue/10',   border: 'border-accent-blue/20',   label: 'Info'     },
  success:  { icon: CheckCircle2,  color: 'text-accent-green',  bg: 'bg-accent-green/10',  border: 'border-accent-green/20',  label: 'Resolved' },
}

export default function AlertPanel() {
  const { insights, buildings } = useEnergy()

  // Collect building-level alerts too
  const buildingAlerts = buildings
    .flatMap(b => b.alerts.map(msg => ({
      id: `${b.id}-${msg}`,
      severity: b.status === 'critical' ? 'critical' : 'warning',
      building: b.name,
      title: msg,
      timestamp: 'Live',
    })))

  const allAlerts = [
    ...insights.filter(i => i.severity === 'critical').map(i => ({ ...i, title: i.title })),
    ...buildingAlerts.slice(0, 3),
    ...insights.filter(i => i.severity === 'warning').slice(0, 2),
  ].slice(0, 8)

  return (
    <div className="glass rounded-2xl border border-base-border p-5 flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-text-main font-semibold text-base">Active Alerts</h3>
          <p className="text-text-dim text-xs mt-0.5">{allAlerts.length} requiring attention</p>
        </div>
        <span className="chip bg-accent-pink/20 text-accent-pink border border-accent-pink/30">
          {allAlerts.filter(a => a.severity === 'critical').length} critical
        </span>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto max-h-72 pr-1">
        {allAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CheckCircle2 size={28} className="text-accent-green mb-2" />
            <p className="text-text-main text-sm font-medium">All Systems Normal</p>
            <p className="text-text-dim text-xs">No active alerts</p>
          </div>
        ) : (
          allAlerts.map((alert, i) => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info
            const Icon = cfg.icon
            return (
              <div
                key={alert.id ?? i}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 hover:scale-[1.01] cursor-pointer group',
                  cfg.bg, cfg.border
                )}
              >
                <div className={clsx('flex-shrink-0 mt-0.5', cfg.color)}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-main text-xs font-semibold leading-snug truncate">{alert.title}</p>
                  {alert.building && (
                    <p className="text-text-dim text-xxs mt-0.5">{alert.building}</p>
                  )}
                  {alert.description && (
                    <p className="text-text-dim text-xxs mt-0.5 truncate-2">{alert.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={clsx('chip text-xxs', cfg.bg, cfg.color)}>{cfg.label}</span>
                  <span className="text-text-dim text-xxs">{alert.timestamp}</span>
                  <ChevronRight size={12} className="text-text-dim group-hover:text-text-main transition-colors" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
