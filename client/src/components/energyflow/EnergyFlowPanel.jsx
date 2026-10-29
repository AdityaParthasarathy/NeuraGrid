/**
 * NeuraGrid — Energy Flow Panel
 *
 * Collapsible dashboard panel wrapping EnergyFlowCanvas.
 *
 * Shows an animated topology of the campus electrical grid:
 *   Grid source → 6 building nodes → 2 room nodes each
 *
 * Particle count, line width, and colour all respond in real time to:
 *   • energyLoad slider (real or simulated)
 *   • Building currentLoad changes from EnergyContext ticks
 *   • Smart action presets
 *
 * Simulation mode
 * ───────────────
 * When active, building loads are scaled by the ratio of simulated vs real
 * energyLoad so the canvas previews what the flow will look like after applying.
 *
 * Controls
 * ────────
 *   "Show Flow" toggle — pauses / resumes the canvas animation
 *   Collapse arrow     — hides the panel body without unmounting
 */

import React, { useState, useMemo } from 'react'
import {
  Zap, ChevronDown, ChevronUp,
  Eye, EyeOff, FlaskConical,
} from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import EnergyFlowCanvas from './EnergyFlowCanvas'
import clsx from 'clsx'

// ─── Load-level colour (mirrors canvas logic — kept in sync) ──────────────────
function loadColor(pct) {
  if (pct >= 85) return '#DB2777'
  if (pct >= 65) return '#EA580C'
  return '#0284C7'
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EnergyFlowPanel() {
  const {
    buildings,
    metrics,
    controls,
    simulationMode,
    simulatedControls,
  } = useEnergy()

  // Active controls (sim or real)
  const activeControls  = simulationMode && simulatedControls ? simulatedControls : controls
  const realLoad        = controls.energyLoad
  const simLoad         = simulatedControls?.energyLoad ?? realLoad
  const simScale        = simulationMode && simulatedControls ? simLoad / Math.max(realLoad, 1) : 1

  // Scale building loads in sim mode to preview the effect of the simulated energyLoad slider
  const displayBuildings = useMemo(() => {
    if (simScale === 1) return buildings
    return buildings.map(b => ({
      ...b,
      currentLoad: +(b.currentLoad * simScale).toFixed(1),
    }))
  }, [buildings, simScale])

  const [panelOpen, setPanelOpen] = useState(true)
  const [showFlow,  setShowFlow]  = useState(true)

  // Campus summary stats
  const totalLoad = metrics.totalConsumption
  const totalCap  = displayBuildings.reduce((s, b) => s + b.capacity, 0)
  const utilPct   = Math.min(100, Math.round((totalLoad / totalCap) * 100))
  const flowCol   = loadColor(utilPct)

  // How many buildings are overloaded?
  const overloadCount = displayBuildings.filter(
    b => (b.currentLoad / b.capacity) >= 0.85
  ).length

  return (
    <div
      className="rounded-2xl overflow-hidden border border-base-border shadow-sm"
      style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-border">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `${flowCol}12`,
              border:     `1px solid ${flowCol}30`,
            }}
          >
            <Zap
              size={14}
              style={{
                color:     flowCol,
                animation: showFlow ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* Title */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              Energy Flow
              {simulationMode && (
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(99,102,241,0.15)',
                    color:      '#818cf8',
                    border:     '1px solid rgba(99,102,241,0.28)',
                  }}
                >
                  <FlaskConical size={8} className="inline mr-0.5" />
                  SIMULATION
                </span>
              )}
            </h3>
            <p className="text-text-dim text-xs mt-0.5">
              Grid → buildings → rooms ·&nbsp;
              <span className="font-mono font-bold" style={{ color: flowCol }}>
                {utilPct}%
              </span>
              &nbsp;utilization
              {overloadCount > 0 && (
                <span className="ml-2 font-semibold" style={{ color: '#DB2777' }}>
                  · {overloadCount} overloaded
                </span>
              )}
              {simulationMode && simScale !== 1 && (
                <span className="ml-2 font-mono" style={{ color: '#818cf8' }}>
                  · {realLoad}% → {simLoad}% load
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Flow toggle */}
          <button
            onClick={() => setShowFlow(f => !f)}
            title={showFlow ? 'Pause flow animation' : 'Resume flow animation'}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
              showFlow
                ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                : 'border-base-border bg-base-elevated text-text-dim hover:text-gray-900 shadow-sm',
            )}
          >
            {showFlow ? <Eye size={11} /> : <EyeOff size={11} />}
            {showFlow ? 'Flow On' : 'Flow Off'}
          </button>

          {/* Collapse */}
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="w-8 h-8 rounded-lg border border-base-border bg-base-elevated shadow-sm flex items-center justify-center text-text-dim hover:text-gray-900 transition-colors"
          >
            {panelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div className="p-4 space-y-3">

          {/* ── Campus utilization bar ───────────────────────────────────── */}
          <div className="flex items-center gap-3 px-0.5">
            <span className="text-text-dim text-[10px] w-[72px] flex-shrink-0 font-mono uppercase tracking-wide">
              Current Load
            </span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width:      `${utilPct}%`,
                  background: `linear-gradient(90deg, rgba(2,132,199,0.5), ${flowCol})`,
                  boxShadow:  `0 0 8px ${flowCol}55`,
                }}
              />
            </div>
            <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: flowCol }}>
              {Math.round(totalLoad).toLocaleString()} kW
            </span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: `${flowCol}14`,
                color:       flowCol,
                border:     `1px solid ${flowCol}30`,
              }}
            >
              {utilPct}%
            </span>
          </div>

          {/* ── Flow canvas ──────────────────────────────────────────────── */}
          <div
            className="relative w-full rounded-xl overflow-hidden shadow-inner"
            style={{
              height:     280,
              background: '#0F172A',
              border:     '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <EnergyFlowCanvas buildings={displayBuildings} active={showFlow} />
          </div>

          {/* ── Legend ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 border-t border-dark-border/60">
            <span className="text-text-dim text-[10px] font-semibold uppercase tracking-wider">
              Legend
            </span>

            {[
              { color: '#0284C7', label: 'Normal flow (< 65%)'  },
              { color: '#EA580C', label: 'High load (65–85%)'   },
              { color: '#DB2777', label: 'Overload (> 85%)'     },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-text-dim">
                <span
                  className="w-6 h-0.5 rounded-full flex-shrink-0"
                  style={{ background: color, boxShadow: `0 0 4px ${color}80` }}
                />
                {label}
              </span>
            ))}

            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-text-dim">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'rgba(2,132,199,0.65)' }}
              />
              Particle speed &amp; count ∝ load
            </span>
          </div>

          {/* Building quick-reference row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {displayBuildings.map(b => {
              const pct = Math.min(100, Math.round((b.currentLoad / b.capacity) * 100))
              const col = loadColor(pct)
              return (
                <div
                  key={b.id}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border"
                  style={{
                    background:   `${col}08`,
                    borderColor:  `${col}25`,
                  }}
                >
                  <span
                    className="text-[8px] font-bold font-mono"
                    style={{ color: col }}
                  >
                    {b.shortName}
                  </span>
                  <div className="w-full h-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: col }}
                    />
                  </div>
                  <span className="text-[8px] font-mono" style={{ color: col }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Sim mode note */}
          {simulationMode && (
            <p className="text-[10px] text-center pt-0.5" style={{ color: '#818cf8' }}>
              Showing <strong style={{ color: '#818cf8' }}>simulated</strong> energy
              distribution — flow reflects the projected load after applying
            </p>
          )}
        </div>
      )}
    </div>
  )
}
