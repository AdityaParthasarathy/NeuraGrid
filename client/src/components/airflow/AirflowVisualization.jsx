/**
 * NeuraGrid — Airflow Visualization Panel
 *
 * Shows all 6 campus buildings as compact cards, each with:
 *   • Canvas particle animation (AirflowCanvas) — fresh-air particles flowing
 *     left→right, density/speed driven by the ventilation slider
 *   • CO₂ zone tint overlay — green → yellow → red based on ppm, visually
 *     "cleared" as ventilation rises even before the tick resets the reading
 *   • Inline metrics (CO₂ ppm, load %)
 *
 * Controls:
 *   "Show Airflow" toggle — starts/stops the canvas animation; the tint overlay
 *     remains so air-quality info is always accessible
 *   Collapse arrow — hides the entire panel body
 *
 * Data sources:
 *   buildings          → per-building co2, currentLoad, capacity from EnergyContext
 *   controls           → ventilation slider (real state)
 *   simulatedControls  → ventilation slider when simulation mode is active
 *   simulationMode     → badge shown when active
 */

import React, { useState } from 'react'
import {
  Wind, ChevronDown, ChevronUp, Eye, EyeOff,
  FlaskConical,
} from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import AirflowCanvas, { co2OverlayStyle } from './AirflowCanvas'
import clsx from 'clsx'

// ─── CO₂ severity helpers ─────────────────────────────────────────────────────
function co2Badge(ppm) {
  if (ppm > 980) return { label: 'CRITICAL', color: '#DB2777' }
  if (ppm > 800) return { label: 'ELEVATED', color: '#EA580C' }
  if (ppm > 600) return { label: 'MODERATE', color: '#f97316' }
  return          { label: 'GOOD',     color: '#059669' }
}

// ─── Ventilation intensity label + colour ─────────────────────────────────────
function ventLevel(v) {
  if (v > 70) return { label: 'High',   color: '#059669' }
  if (v > 40) return { label: 'Medium', color: '#EA580C' }
  return              { label: 'Low',   color: '#DB2777' }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AirflowVisualization() {
  const {
    buildings,
    controls,
    simulationMode,
    simulatedControls,
  } = useEnergy()

  // Use sim controls when active, real controls otherwise
  const activeControls = simulationMode && simulatedControls ? simulatedControls : controls
  const ventilation    = activeControls.ventilation

  const [panelOpen,   setPanelOpen]   = useState(true)
  const [showAirflow, setShowAirflow] = useState(true)

  const { label: vLabel, color: vColor } = ventLevel(ventilation)

  return (
    <div
      className="rounded-2xl overflow-hidden border border-base-border shadow-sm"
      style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-border">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(2,132,199,0.10)', border: '1px solid rgba(2,132,199,0.25)' }}>
            <Wind size={14} className="text-accent-blue" style={{ animation: showAirflow ? 'spin 8s linear infinite' : 'none' }} />
          </div>

          {/* Title */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              Airflow Visualization
              {simulationMode && (
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#7C3AED', border: '1px solid rgba(99,102,241,0.28)' }}
                >
                  <FlaskConical size={8} className="inline mr-0.5" />
                  SIMULATION
                </span>
              )}
            </h3>
            <p className="text-text-dim text-xs mt-0.5">
              Campus ventilation ·&nbsp;
              <span className="font-mono font-bold" style={{ color: vColor }}>{ventilation}%</span>
              &nbsp;·&nbsp;
              <span style={{ color: vColor }}>{vLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Airflow particles toggle */}
          <button
            onClick={() => setShowAirflow(a => !a)}
            title={showAirflow ? 'Hide airflow particles' : 'Show airflow particles'}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
              showAirflow
                ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                : 'border-base-border bg-base-elevated text-text-dim hover:text-gray-900 shadow-sm',
            )}
          >
            {showAirflow ? <Eye size={11} /> : <EyeOff size={11} />}
            {showAirflow ? 'Airflow On' : 'Airflow Off'}
          </button>

          {/* Panel collapse */}
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="w-8 h-8 rounded-lg border border-base-border bg-base-elevated shadow-sm flex items-center justify-center text-text-dim hover:text-gray-900 transition-colors"
          >
            {panelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* ── Body (collapsible) ───────────────────────────────────────────────── */}
      {panelOpen && (
        <div className="p-4 space-y-4">

          {/* ── Campus-wide ventilation bar ──────────────────────────────────── */}
          <div className="flex items-center gap-3 px-0.5">
            <span className="text-text-dim text-[10px] w-[72px] flex-shrink-0 font-mono uppercase tracking-wide">
              Vent. level
            </span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:      `${ventilation}%`,
                  background: `linear-gradient(90deg, rgba(2,132,199,0.4), ${vColor})`,
                  boxShadow:  `0 0 8px ${vColor}55`,
                }}
              />
            </div>
            <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: vColor }}>
              {ventilation}%
            </span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${vColor}14`, color: vColor, border: `1px solid ${vColor}30` }}
            >
              {vLabel}
            </span>
          </div>

          {/* ── Building cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {buildings.map(b => {
              const co2ppm    = b.co2 ?? 600
              const loadPct   = Math.round((b.currentLoad / b.capacity) * 100)
              const badge     = co2Badge(co2ppm)
              const overlay   = co2OverlayStyle(co2ppm, ventilation)
              const statusCol = b.status === 'critical' ? '#DB2777'
                              : b.status === 'warning'  ? '#EA580C' : '#059669'

              return (
                <div
                  key={b.id}
                  className="relative rounded-xl overflow-hidden flex-shrink-0"
                  style={{
                    height:     132,
                    background: `rgba(0,0,0,0.03)`,
                    border:     `1px solid ${b.color}28`,
                  }}
                >
                  {/* CO₂ zone tint — separate div so it transitions independently */}
                  <div
                    className="absolute inset-0 pointer-events-none rounded-xl"
                    style={overlay}
                  />

                  {/* Airflow canvas — particles only, controlled by toggle */}
                  <AirflowCanvas
                    ventilation={ventilation}
                    co2={co2ppm}
                    active={showAirflow}
                  />

                  {/* UI overlay — sits above canvas, pointer-events none */}
                  <div className="absolute inset-0 p-2.5 flex flex-col justify-between pointer-events-none">

                    {/* Top row: shortname badge + CO₂ severity chip */}
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: `${b.color}22`,
                          color:       b.color,
                          border:     `1px solid ${b.color}40`,
                        }}
                      >
                        {b.shortName}
                      </span>
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: `${badge.color}18`,
                          color:       badge.color,
                          border:     `1px solid ${badge.color}35`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Bottom section: name + readings + load bar */}
                    <div>
                      <p className="text-gray-900 text-[10px] font-semibold leading-tight mb-1.5 truncate">
                        {b.name}
                      </p>

                      {/* Readings row */}
                      <div className="flex items-center justify-between text-[9px] mb-1">
                        <span style={{ color: badge.color }}>
                          {co2ppm} ppm
                        </span>
                        <span className="text-text-dim font-mono">
                          {b.temperature?.toFixed(1) ?? '--'}°F
                        </span>
                        <span style={{ color: statusCol }}>
                          {loadPct}%
                        </span>
                      </div>

                      {/* Mini load bar */}
                      <div className="h-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width:     `${loadPct}%`,
                            background: statusCol,
                            boxShadow: `0 0 4px ${statusCol}80`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Legend ────────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 border-t border-base-border/60">
            <span className="text-text-dim text-[10px] font-semibold uppercase tracking-wider">
              Legend
            </span>

            {/* CO₂ tint legend */}
            {[
              { color: '#059669', label: 'Good air  (< 600 ppm)'     },
              { color: '#EA580C', label: 'Elevated  (600–980 ppm)'   },
              { color: '#DB2777', label: 'Critical  (> 980 ppm)'     },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-text-dim">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: color, boxShadow: `0 0 4px ${color}88` }}
                />
                {label}
              </span>
            ))}

            {/* Particle legend */}
            <span className="flex items-center gap-1.5 text-[10px] text-text-dim ml-auto">
              <span
                className="w-5 h-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(0,210,255,0.7)', boxShadow: '0 0 4px rgba(0,210,255,0.5)' }}
              />
              Fresh airflow particles (speed ∝ ventilation)
            </span>
          </div>

          {/* Sim-mode note */}
          {simulationMode && (
            <p className="text-[10px] text-text-dim text-center pt-0.5" style={{ color: '#7C3AED' }}>
              Showing <strong style={{ color: '#7C3AED' }}>simulated</strong> ventilation level —
              airflow will look like this after applying
            </p>
          )}
        </div>
      )}
    </div>
  )
}
