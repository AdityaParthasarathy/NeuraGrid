import React from 'react'
import { Building2, Thermometer, Wind, Users } from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import { calcEnergyScore } from '../../utils/aiEngine'
import clsx from 'clsx'

const TYPE_LABEL = {
  academic:   'Academic',
  lab:        'Lab Block',
  auditorium: 'Auditorium',
  // legacy types kept for safety
  research:   'Research',
  library:    'Library',
  social:     'Social',
  sports:     'Athletics',
  admin:      'Admin',
  medical:    'Medical',
}

const STATUS_CONFIG = {
  normal:   { dot: 'status-normal',   label: 'Normal',   text: 'text-accent-green'  },
  warning:  { dot: 'status-warning',  label: 'Warning',  text: 'text-accent-orange' },
  critical: { dot: 'status-critical', label: 'Critical', text: 'text-accent-pink'   },
}

export default function BuildingGrid({ onSelect }) {
  const { buildings, setSelectedBuilding } = useEnergy()

  function handleClick(b) {
    setSelectedBuilding(b)
    onSelect?.(b)
  }

  return (
    <div className="bg-base-card rounded-2xl border border-base-border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-900 font-semibold text-base">Building Status</h3>
        <span className="text-text-dim text-xs">{buildings.length} buildings monitored</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {buildings.map(b => {
          const pct    = Math.round((b.currentLoad / b.capacity) * 100)
          const score  = calcEnergyScore(b)
          const status = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.normal

          return (
            <button
              key={b.id}
              onClick={() => handleClick(b)}
              className="bg-base-elevated rounded-xl p-3.5 border border-base-border hover:border-accent-blue/40 transition-all duration-200 text-left group hover:-translate-y-0.5 shadow-sm"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `${b.color}18`, border: `1px solid ${b.color}30`, color: b.color }}
                >
                  {b.shortName}
                </div>
                <span className={clsx('flex items-center gap-1 text-xxs font-medium', status.text)}>
                  <span className={clsx('status-dot', status.dot)} />
                  {status.label}
                </span>
              </div>

              {/* Name */}
              <p className="text-gray-900 text-xs font-semibold leading-tight mb-1 group-hover:text-accent-blue transition-colors">
                {b.name}
              </p>
              <p className="text-text-dim text-xxs mb-3">{TYPE_LABEL[b.type]} · {b.floors}F</p>

              {/* Load bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xxs mb-1">
                  <span className="text-text-dim">Load</span>
                  <span className="text-gray-900 font-mono font-bold">{b.currentLoad} kW</span>
                </div>
                <div className="metric-bar">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct > 90 ? '#DB2777'
                        : pct > 75 ? '#EA580C'
                        : `linear-gradient(90deg, ${b.color}aa, ${b.color})`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xxs mt-0.5">
                  <span className="text-text-dim">{pct}% capacity</span>
                  <span className="text-text-dim">{b.capacity} kW max</span>
                </div>
              </div>

              {/* Sensors row */}
              <div className="flex items-center gap-3 text-xxs text-text-dim border-t border-base-border pt-2 mt-2">
                <span className="flex items-center gap-1">
                  <Thermometer size={9} className="text-accent-orange" />
                  {b.temperature}°F
                </span>
                <span className="flex items-center gap-1">
                  <Wind size={9} className="text-accent-blue" />
                  {b.co2} ppm
                </span>
                <span className="flex items-center gap-1">
                  <Users size={9} className="text-accent-purple" />
                  {b.occupancy}%
                </span>
              </div>

              {/* Energy score */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-border">
                <span className="text-text-dim text-xxs">Energy Score</span>
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: score > 70 ? '#059669' : score > 50 ? '#EA580C' : '#DB2777' }}
                >
                  {score}/100
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
