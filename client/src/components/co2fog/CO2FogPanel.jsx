/**
 * NeuraGrid — CO₂ Fog Panel
 *
 * Displays all 6 campus buildings as compact cards with animated fog/haze
 * overlays driven by each building's CO₂ ppm reading.
 *
 * Visual language (distinct from AirflowVisualization's coloured tint):
 *   • Soft white-blue fog blobs (FogCanvas) drift rightward, pushed out by
 *     ventilation — the speed of dispersal is directly tied to the vent slider
 *   • Badge (CLEAR / HAZE / DENSE FOG) reflects CO₂ threshold spec
 *   • Per-card ppm readout + delta from the safe threshold (800 ppm)
 *
 * Simulation mode
 * ───────────────
 *   When active, CO₂ values are projected N ticks ahead using projectCo2()
 *   with the simulated ventilation level, giving a preview of how the fog
 *   will look after the operator applies the new settings.
 *   The ventilation passed to each FogCanvas also switches to the simulated
 *   value so the dispersal speed matches the projected conditions.
 *
 * Controls
 * ────────
 *   "Show Air Quality" toggle — pauses canvas animation (tint overlay stays)
 *   Collapse arrow            — hides panel body without unmounting
 *
 * Data sources
 * ────────────
 *   buildings          → b.co2 (ppm), b.temperature, b.status
 *   controls           → ventilation (real)
 *   simulatedControls  → ventilation (sim)
 *   simulationMode     → flag
 */

import React, { useState, useMemo } from 'react'
import {
  Wind, ChevronDown, ChevronUp,
  Eye, EyeOff, FlaskConical, ArrowRight,
} from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import FogCanvas from './FogCanvas'
import {
  fogIntensity, co2FogBadge, projectCo2,
  CO2_THRESHOLDS, CO2_FOG_GRADIENT_CSS,
} from './fogUtils'
import clsx from 'clsx'

// ─── Campus CO₂ summary helper ────────────────────────────────────────────────
function campusBadge(avgCo2) {
  if (avgCo2 >= CO2_THRESHOLDS.HAZE)  return { label: 'DENSE FOG', color: '#DB2777' }
  if (avgCo2 >= CO2_THRESHOLDS.CLEAR) return { label: 'HAZY',      color: '#EA580C' }
  return                                     { label: 'CLEAR AIR', color: '#059669' }
}

// ─── Tiny fog-density indicator icon ─────────────────────────────────────────
function FogDensityDots({ intensity }) {
  const dots = 3
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: dots }, (_, i) => {
        const filled = intensity > i / dots
        return (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: filled ? 'rgba(200,218,240,0.85)' : 'rgba(0,0,0,0.08)',
              boxShadow:  filled ? '0 0 3px rgba(200,218,240,0.6)' : 'none',
            }}
          />
        )
      })}
    </span>
  )
}

// ─── Single building card ─────────────────────────────────────────────────────
function BuildingFogCard({
  building: b,
  ventilation,
  isSimMode,
  displayCo2,
  projCo2,
  showFog,
}) {
  const badge    = co2FogBadge(displayCo2)
  const intens   = fogIntensity(displayCo2, ventilation)
  const ppmDelta = displayCo2 - CO2_THRESHOLDS.CLEAR   // vs safe threshold
  const isAlert  = b.status === 'critical' || b.status === 'warning'

  // Subtle border glow that scales with fog intensity
  const borderAlpha = 0.25 + intens * 0.45
  const borderColor = intens > 0.5
    ? `rgba(255,107,53,${borderAlpha})`
    : intens > 0.15
    ? `rgba(251,191,36,${borderAlpha})`
    : `${b.color ?? '#334155'}40`

  return (
    <div
      className="relative rounded-xl overflow-hidden flex-shrink-0"
      style={{
        height:     132,
        background: 'rgba(0,0,0,0.03)',
        border:     `1px solid ${borderColor}`,
        boxShadow:  intens > 0.3
          ? `0 0 12px rgba(255,107,53,${(intens * 0.15).toFixed(3)})`
          : 'none',
        transition: 'border-color 1.5s ease, box-shadow 1.5s ease',
      }}
    >
      {/* ── Fog canvas — drifting blob animation ──────────────────────── */}
      <FogCanvas
        co2={displayCo2}
        ventilation={ventilation}
        active={showFog}
      />

      {/* ── Additional CSS tint layer — very subtle background haze ──── */}
      {intens > 0.05 && (
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background: `radial-gradient(ellipse at 50% 50%,
              rgba(200,215,240,${(intens * 0.06).toFixed(4)}) 0%,
              rgba(200,215,240,${(intens * 0.03).toFixed(4)}) 55%,
              transparent 85%)`,
            transition: 'background 1.8s ease',
          }}
        />
      )}

      {/* ── Info overlay ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 p-2.5 flex flex-col justify-between pointer-events-none">

        {/* Top: shortname badge + CO₂ severity chip */}
        <div className="flex items-start justify-between gap-1">
          <span
            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: `${b.color ?? '#00f5ff'}22`,
              color:       b.color ?? '#00f5ff',
              border:     `1px solid ${b.color ?? '#00f5ff'}40`,
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

        {/* Fog density dots indicator (mid-card) */}
        <div className="flex justify-center">
          <FogDensityDots intensity={intens} />
        </div>

        {/* Bottom: building name + readings */}
        <div>
          <p className="text-gray-900 text-[10px] font-semibold leading-tight mb-1 truncate">
            {b.name}
          </p>

          {/* CO₂ readout — shows projected value in sim mode */}
          {isSimMode && Math.abs(projCo2 - (b.co2 ?? 600)) >= 5 ? (
            <div className="flex items-center gap-1 text-[9px] mb-1">
              <span className="text-text-dim font-mono">{b.co2 ?? 600}</span>
              <ArrowRight size={8} className="text-text-dim opacity-50 flex-shrink-0" />
              <span className="font-mono font-bold" style={{ color: badge.color }}>
                {projCo2} ppm
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[9px] mb-1">
              <span className="font-mono font-bold" style={{ color: badge.color }}>
                {displayCo2} ppm
              </span>
              {ppmDelta > 0 ? (
                <span className="font-mono text-[8px]" style={{ color: badge.color }}>
                  +{ppmDelta}
                </span>
              ) : (
                <span className="font-mono text-[8px] text-text-dim">
                  −{Math.abs(ppmDelta)}
                </span>
              )}
            </div>
          )}

          {/* Mini CO₂ intensity bar */}
          <div className="h-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width:      `${Math.min(100, ((displayCo2 - 400) / (1400 - 400)) * 100)}%`,
                background: badge.color,
                boxShadow:  `0 0 4px ${badge.color}80`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Legend gradient bar ──────────────────────────────────────────────────────
function CO2ScaleLegend() {
  // Scale: pct = (ppm − 400) / (1200 − 400) × 100
  //   600 ppm → 25 %  |  800 ppm → 50 %  |  980 ppm → 72.5 %  |  1200 ppm → 100 %
  const markers = [
    { pct: 0,    label: '400',  sub: 'Ambient'   },
    { pct: 25,   label: '600',  sub: 'Fog starts' },
    { pct: 50,   label: '800',  sub: 'HAZE ↑'    },
    { pct: 72,   label: '980',  sub: 'DENSE ↑'   },
    { pct: 100,  label: '1200', sub: 'Max'        },
  ]
  return (
    <div className="pt-3 border-t border-dark-border/60">
      <div
        className="w-full rounded-full relative"
        style={{ height: 7, background: CO2_FOG_GRADIENT_CSS }}
      >
        {markers.map(m => (
          <div
            key={m.pct}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${m.pct}%`, background: 'rgba(0,0,0,0.25)' }}
          />
        ))}
      </div>
      <div className="relative mt-1" style={{ height: 28 }}>
        {markers.map(m => (
          <div
            key={m.pct}
            className="absolute flex flex-col items-center"
            style={{
              left:      `${m.pct}%`,
              transform: m.pct === 0   ? 'translateX(0)'
                       : m.pct === 100 ? 'translateX(-100%)'
                       : 'translateX(-50%)',
            }}
          >
            <span className="text-[8px] text-text-dim font-mono leading-none">{m.label}</span>
            {m.sub && (
              <span className="text-[7px] text-text-dim/60 leading-none mt-0.5">{m.sub}</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-text-dim text-[9px] mt-0.5 flex items-center gap-1.5">
        <span
          className="w-3 h-1.5 rounded-full inline-block flex-shrink-0 opacity-60"
          style={{ background: 'rgba(200,218,240,0.8)' }}
        />
        Fog blobs drift rightward — dispersal speed ∝ ventilation level
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CO2FogPanel() {
  const {
    buildings,
    controls,
    simulationMode,
    simulatedControls,
  } = useEnergy()

  // Active ventilation level (sim or real)
  const activeControls  = simulationMode && simulatedControls ? simulatedControls : controls
  const ventilation     = activeControls.ventilation
  const realVentilation = controls.ventilation
  const simVentilation  = simulatedControls?.ventilation ?? realVentilation

  // In simulation mode: project each building's CO₂ to show future fog state
  const displayBuildings = useMemo(() => {
    if (!simulationMode || !simulatedControls) return buildings
    return buildings.map(b => ({
      ...b,
      _projCo2: projectCo2(b.co2 ?? 600, simVentilation),
    }))
  }, [buildings, simulationMode, simulatedControls, simVentilation])

  const [panelOpen, setPanelOpen] = useState(true)
  const [showFog,   setShowFog]   = useState(true)

  // Campus-wide CO₂ average (display values — projected in sim mode)
  const avgCo2 = useMemo(() => {
    const vals = displayBuildings.map(b =>
      simulationMode && b._projCo2 != null ? b._projCo2 : (b.co2 ?? 600)
    )
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
  }, [displayBuildings, simulationMode])

  const { label: campusLabel, color: campusColor } = campusBadge(avgCo2)

  // Count buildings at each tier using the calibrated thresholds
  // HAZE = >= 800 ppm, DENSE = >= 980 ppm (within EnergyContext's 380–1200 range)
  const hazeCnt  = displayBuildings.filter(b => {
    const ppm = simulationMode && b._projCo2 != null ? b._projCo2 : (b.co2 ?? 600)
    return ppm >= CO2_THRESHOLDS.CLEAR && ppm < CO2_THRESHOLDS.DENSE
  }).length
  const denseCnt = displayBuildings.filter(b => {
    const ppm = simulationMode && b._projCo2 != null ? b._projCo2 : (b.co2 ?? 600)
    return ppm >= CO2_THRESHOLDS.DENSE
  }).length

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
              background: `${campusColor}12`,
              border:     `1px solid ${campusColor}30`,
            }}
          >
            <Wind size={14} style={{ color: campusColor }} />
          </div>

          {/* Title */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              CO₂ Air Quality
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
              Campus avg&nbsp;
              <span className="font-mono font-bold" style={{ color: campusColor }}>
                {avgCo2} ppm
              </span>
              &nbsp;·&nbsp;
              <span style={{ color: campusColor }}>{campusLabel}</span>
              {hazeCnt > 0 && (
                <span className="ml-2" style={{ color: '#EA580C' }}>
                  · {hazeCnt} hazy
                </span>
              )}
              {denseCnt > 0 && (
                <span className="ml-2" style={{ color: '#DB2777' }}>
                  · {denseCnt} dense fog
                </span>
              )}
              {simulationMode && simVentilation !== realVentilation && (
                <span className="ml-2 font-mono" style={{ color: '#7C3AED' }}>
                  · vent {realVentilation}%
                  <ArrowRight size={9} className="inline mx-0.5 opacity-60" />
                  {simVentilation}%
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fog toggle */}
          <button
            onClick={() => setShowFog(f => !f)}
            title={showFog ? 'Hide fog animation' : 'Show fog animation'}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
              showFog
                ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                : 'border-base-border bg-base-elevated text-text-dim hover:text-gray-900 shadow-sm',
            )}
          >
            {showFog ? <Eye size={11} /> : <EyeOff size={11} />}
            {showFog ? 'Fog On' : 'Fog Off'}
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
        <div className="p-4 space-y-4">

          {/* ── Campus CO₂ bar ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-0.5">
            <span className="text-text-dim text-[10px] w-[72px] flex-shrink-0 font-mono uppercase tracking-wide">
              Avg CO₂
            </span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width:      `${Math.min(100, ((avgCo2 - 400) / (1400 - 400)) * 100)}%`,
                  background: `linear-gradient(90deg, rgba(5,150,105,0.5), ${campusColor})`,
                  boxShadow:  `0 0 8px ${campusColor}55`,
                }}
              />
            </div>
            <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: campusColor }}>
              {avgCo2} ppm
            </span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: `${campusColor}14`,
                color:       campusColor,
                border:     `1px solid ${campusColor}30`,
              }}
            >
              {campusLabel}
            </span>
          </div>

          {/* ── Building cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {displayBuildings.map(b => {
              const realCo2    = b.co2 ?? 600
              const projCo2Val = b._projCo2 ?? realCo2
              const displayCo2 = simulationMode && b._projCo2 != null
                ? projCo2Val
                : realCo2
              return (
                <BuildingFogCard
                  key={b.id}
                  building={b}
                  ventilation={ventilation}
                  isSimMode={simulationMode && !!simulatedControls}
                  displayCo2={displayCo2}
                  projCo2={projCo2Val}
                  showFog={showFog}
                />
              )
            })}
          </div>

          {/* ── Legend ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 border-t border-base-border/60">
            <span className="text-text-dim text-[10px] font-semibold uppercase tracking-wider">
              Legend
            </span>
            {[
              { bg: '#059669', label: 'Clear  (< 600 ppm)'    },
              { bg: '#f97316', label: 'Light haze (600–800)'  },
              { bg: '#EA580C', label: 'Haze   (800–980 ppm)'  },
              { bg: '#DB2777', label: 'Dense  (> 980 ppm)'    },
            ].map(({ bg, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-text-dim">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: bg, boxShadow: `0 0 4px ${bg}88` }}
                />
                {label}
              </span>
            ))}
            {/* Fog blob indicator */}
            <span className="flex items-center gap-1.5 text-[10px] text-text-dim ml-auto">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  background: 'radial-gradient(circle, rgba(200,218,240,0.7) 0%, transparent 80%)',
                  border:     '1px solid rgba(200,218,240,0.3)',
                }}
              />
              Fog blobs ∝ CO₂ intensity
            </span>
          </div>

          {/* CO₂ ppm scale */}
          <CO2ScaleLegend />

          {/* Sim mode note */}
          {simulationMode && (
            <p className="text-[10px] text-center pt-0.5" style={{ color: '#7C3AED' }}>
              Overlay shows{' '}
              <strong style={{ color: '#7C3AED' }}>projected</strong> CO₂ ~25 s
              after applying ventilation {simVentilation}%.
              {simVentilation > realVentilation && (
                <> Higher airflow will disperse the fog faster.</>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
