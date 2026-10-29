/**
 * NeuraGrid — One-Click Smart Actions
 *
 * Three preset actions that adjust all three environment sliders at once and
 * automatically resolve related active alerts. Works transparently in both
 * live mode (applies to real state) and simulation mode (applies to preview
 * state only). The routing is handled by EnergyContext's setControl → ref
 * system, so this component never needs to know which mode is active.
 *
 * Actions:
 *   Optimize Energy    — shed non-essential load, raise AC setpoint
 *   Improve Air Quality — boost ventilation, clear CO₂
 *   Balance Comfort    — moderate temp + CO₂ + load
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Zap, Wind, Thermometer, CheckCircle2, Loader2 } from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import { useAlerts } from '../../context/AlertContext'
import clsx from 'clsx'

// ─── Action definitions ───────────────────────────────────────────────────────
// Each entry is self-contained — new actions can be added here without touching
// any other code. `controls` keys match EnergyContext's control state keys.
export const SMART_ACTIONS = [
  {
    id: 'optimize_energy',
    label: 'Optimize Energy',
    icon: Zap,
    color: '#EA580C',
    description: 'Shed non-essential load · raise AC setpoint',
    // Target slider values (realism: lower load + warmer temp = less energy;
    // ventilation drops slightly as fans aren't needed at reduced occupancy)
    controls: { energyLoad: 52, temperature: 27, ventilation: 55 },
    // Alert types to auto-resolve when action fires
    resolves: ['overloaded', 'energy_spike', 'night_usage'],
    toastEmoji: '⚡',
    toastTitle: 'Energy Optimized',
    toastMsg: 'Load reduced ~31%, AC setpoint raised to 27°C, non-essential systems shed.',
    toastIcon: 'zap',
  },
  {
    id: 'improve_air',
    label: 'Improve Air Quality',
    icon: Wind,
    color: '#0284C7',
    description: 'Boost ventilation · clear CO₂ buildup',
    // Realism: high ventilation costs slightly more fan power → energyLoad rises
    controls: { ventilation: 92, temperature: 24, energyLoad: 80 },
    resolves: ['co2_critical'],
    toastEmoji: '🌬️',
    toastTitle: 'Air Quality Improved',
    toastMsg: 'Ventilation at 92%, full fresh-air cycle active. CO₂ will normalise in 2–3 ticks.',
    toastIcon: 'wind',
  },
  {
    id: 'balance_comfort',
    label: 'Balance Comfort',
    icon: Thermometer,
    color: '#059669',
    description: 'Moderate temp · safe CO₂ · stable load',
    // Realism: comfort setpoint trade-off — not as energy-efficient as optimize,
    // not as air-focused as improve_air; sits in the middle on all axes.
    controls: { temperature: 23, ventilation: 65, energyLoad: 70 },
    resolves: ['temp_spike'],
    toastEmoji: '🌡️',
    toastTitle: 'Comfort Balanced',
    toastMsg: 'Setpoint 23°C, ventilation 65%, load capped at 70%. Comfort zone maintained.',
    toastIcon: 'thermometer',
  },
]

// Keyframes injected into <head> once when this component first mounts.
// Using a global constant avoids re-injecting on every render.
const SWEEP_STYLE = `
  @keyframes smartActionSweep {
    0%   { transform: translateX(-100%); opacity: 0;   }
    30%  { opacity: 1; }
    70%  { opacity: 1; }
    100% { transform: translateX(400%);  opacity: 0;   }
  }
`

// ─── Component ────────────────────────────────────────────────────────────────
export default function SmartActions() {
  const { setControl, simulationMode } = useEnergy()
  const { resolveAlertsByType, pushToast } = useAlerts()

  // Per-action UI phase: 'idle' | 'running' | 'done'
  const [phases, setPhases] = useState({})

  // Track all pending timer IDs so they can be cleared on unmount
  const timersRef = useRef([])
  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  const fire = useCallback((action) => {
    // Prevent double-fire while already running
    if ((phases[action.id] ?? 'idle') === 'running') return

    setPhases(prev => ({ ...prev, [action.id]: 'running' }))

    // Stagger each setControl call by 140 ms so slider thumbs visually
    // animate one by one in the panel (setControl is already routed to
    // simulated or real state by EnergyContext's simulationModeRef).
    const track = (fn, ms) => {
      const id = setTimeout(fn, ms)
      timersRef.current.push(id)
      return id
    }

    const entries = Object.entries(action.controls)
    entries.forEach(([key, val], i) => {
      track(() => setControl(key, val), i * 140)
    })

    // Resolve all active alerts of the relevant types immediately
    resolveAlertsByType(action.resolves)

    // Toast fires after the last slider has settled
    const settleMs = entries.length * 140 + 120
    track(() => {
      const prefix = simulationMode ? '[SIM] ' : ''
      pushToast(
        `${action.toastEmoji} ${action.toastTitle}`,
        `${prefix}${action.toastMsg}`,
        'info',
        action.toastIcon,
      )
    }, settleMs)

    // Transition to 'done', then back to 'idle'
    track(() => {
      setPhases(prev => ({ ...prev, [action.id]: 'done' }))
      track(() => setPhases(prev => ({ ...prev, [action.id]: 'idle' })), 2800)
    }, settleMs + 80)
  }, [phases, simulationMode, setControl, resolveAlertsByType, pushToast])

  return (
    <div>
      {/* Inject sweep keyframes once */}
      <style>{SWEEP_STYLE}</style>

      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold tracking-widest uppercase text-text-dim">
          Quick Actions
        </p>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={simulationMode
            ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.30)' }
            : { background: 'rgba(0,0,0,0.03)', color: '#6b7280',  border: '1px solid rgba(0,0,0,0.10)' }
          }
        >
          {simulationMode ? 'Applies to Simulation' : 'Live System'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        {SMART_ACTIONS.map(action => {
          const phase     = phases[action.id] ?? 'idle'
          const isRunning = phase === 'running'
          const isDone    = phase === 'done'
          const Icon      = action.icon

          return (
            <button
              key={action.id}
              onClick={() => fire(action)}
              disabled={isRunning}
              className={clsx(
                'relative w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left overflow-hidden',
                'transition-all duration-200 select-none',
                !isRunning && !isDone && 'hover:scale-[1.01]',
                'active:scale-[0.99]',
                isRunning && 'cursor-not-allowed',
              )}
              style={{
                background: isDone
                  ? `${action.color}12`
                  : isRunning
                  ? `${action.color}07`
                  : 'rgba(0,0,0,0.03)',
                borderColor: isDone
                  ? `${action.color}80`
                  : isRunning
                  ? `${action.color}50`
                  : 'rgba(0,0,0,0.10)',
                boxShadow: isDone
                  ? `0 0 18px ${action.color}22, inset 0 0 12px ${action.color}08`
                  : 'none',
              }}
            >
              {/* Shimmer sweep while running */}
              {isRunning && (
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-2/5 pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${action.color}20, transparent)`,
                    animation: 'smartActionSweep 0.9s ease-in-out infinite',
                  }}
                />
              )}

              {/* Icon pill */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  background: isDone ? `${action.color}22` : `${action.color}12`,
                  border: `1px solid ${isDone ? action.color + '60' : action.color + '28'}`,
                }}
              >
                {isDone    && <CheckCircle2 size={14} style={{ color: action.color }} />}
                {isRunning && <Loader2 size={14} style={{ color: action.color }} className="animate-spin" />}
                {!isDone && !isRunning && <Icon size={14} style={{ color: action.color }} />}
              </div>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 leading-tight">
                  {isDone ? `✓  ${action.label}` : action.label}
                </p>
                <p className="text-[10px] text-text-dim mt-0.5 truncate">
                  {action.description}
                </p>
              </div>

              {/* State chip */}
              <span
                className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all duration-300"
                style={isDone
                  ? { background: `${action.color}20`, color: action.color,  border: `1px solid ${action.color}50` }
                  : simulationMode
                  ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.30)' }
                  : { background: `${action.color}10`,    color: action.color, border: `1px solid ${action.color}25` }
                }
              >
                {isDone ? 'Done ✓' : simulationMode ? 'SIM' : '1-click'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
