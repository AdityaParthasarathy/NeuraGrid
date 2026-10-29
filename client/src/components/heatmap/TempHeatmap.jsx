/**
 * NeuraGrid — Temperature Heatmap Panel
 *
 * Renders all 6 campus buildings as compact cards, each carrying:
 *   • Smooth radial-gradient overlay coloured by the building's current
 *     temperature (blue → green → orange → red; CSS-transition for no flicker)
 *   • Projected overlay when Simulation Mode is active (colour reflects where
 *     the temperature will be ~5 ticks after applying the sim setpoint)
 *   • Per-building temperature badge, °C / °F dual readout, delta-from-comfort
 *   • Mini thermometer progress bar (14–34 °C scale, coloured to match overlay)
 *
 * Controls
 * ─────────
 *   "Show Heatmap" toggle — shows / hides the colour overlay (badges + bars stay)
 *   Collapse arrow        — hides the panel body without unmounting
 *
 * Data
 * ────
 *   buildings           → b.temperature (°F), b.id, b.status from EnergyContext
 *   controls.temperature → current AC setpoint (°C)
 *   simulatedControls   → sim setpoint when sim mode active
 *   simulationMode      → drives badge + projected-colour logic
 *
 * Airflow Integration (req 9)
 * ───────────────────────────
 *   When ventilation is high the tick loop already lerps building temperatures
 *   toward the setpoint faster (ventCost term in EnergyContext).  The heatmap
 *   reads the live b.temperature value so this effect is automatically visible.
 *   In Sim Mode the projection factor is reduced (÷ 1 + ventFactor * 0.4) to
 *   reflect that high airflow speeds up temperature convergence.
 */

import React, { useState, useMemo } from 'react'
import {
  Thermometer, ChevronDown, ChevronUp, Eye, EyeOff,
  FlaskConical, ArrowRight, AlertTriangle,
} from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import {
  tempColorRgb, tempOverlayStyle, tempBadgeInfo,
  projectTemp, TEMP_GRADIENT_CSS,
} from './heatmapUtils'
import clsx from 'clsx'

// ─── Comfort zone reference ───────────────────────────────────────────────────
const COMFORT_C   = 24     // reference comfort point (°C)
const TEMP_MIN_C  = 14     // min on the thermometer bar scale
const TEMP_MAX_C  = 34     // max on the thermometer bar scale

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Mini horizontal thermometer bar — progress on a 14–34 °C scale */
function ThermoBar({ tempC, projC, isSimMode }) {
  const pct     = Math.min(100, Math.max(0, ((tempC - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C)) * 100))
  const projPct = Math.min(100, Math.max(0, ((projC  - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C)) * 100))
  const { r, g, b } = tempColorRgb(isSimMode ? projC : tempC)

  return (
    <div className="mt-1.5">
      <div
        className="relative h-1 rounded-full overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.05)' }}
      >
        {/* Actual temperature fill */}
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width:      `${pct}%`,
            background: `rgba(${r},${g},${b},0.55)`,
            transition: 'width 1s ease, background 1.2s ease',
          }}
        />
        {/* Projected temperature marker (sim mode) */}
        {isSimMode && projPct !== pct && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2.5 rounded-full"
            style={{
              left:       `${projPct}%`,
              background: `rgba(${r},${g},${b},0.9)`,
              boxShadow:  `0 0 4px rgba(${r},${g},${b},0.8)`,
              transition: 'left 1s ease',
              transform:  'translateX(-50%) translateY(-50%)',
            }}
          />
        )}
      </div>
      {/* Scale labels */}
      <div className="flex justify-between text-[7px] text-text-dim mt-0.5 opacity-60">
        <span>{TEMP_MIN_C}°C</span>
        <span>{COMFORT_C}°C ✓</span>
        <span>{TEMP_MAX_C}°C</span>
      </div>
    </div>
  )
}

/** Single building heatmap card */
function BuildingHeatCard({ building: b, setpointC, simSetpointC, isSimMode, showHeatmap, ventilation }) {
  // Null-safe: b.temperature may be undefined on the very first render before
  // EnergyContext's tick runs.  Fall back to 75 °F (≈ 24 °C) which is neutral.
  const tempF  = b.temperature ?? 75
  const tempC  = +((tempF - 32) * (5 / 9)).toFixed(1)

  // Projected temperature 5 ticks ahead, with airflow acceleration credit:
  // high ventilation helps the AC reach setpoint faster → tighter projection
  const ticksAhead = isSimMode ? Math.round(5 - (ventilation / 100) * 1.5) : 5
  const { projC }  = isSimMode
    ? projectTemp(tempF, simSetpointC, b.id, ticksAhead)
    : { projC: tempC }

  const displayC   = isSimMode ? projC : tempC          // colour source
  const badge      = tempBadgeInfo(displayC)
  const overlay    = tempOverlayStyle(displayC, showHeatmap)
  const deltaC     = +(tempC - COMFORT_C).toFixed(1)
  const isAlert    = b.status === 'critical' || b.status === 'warning'
  const { r, g, b: bBlue } = tempColorRgb(displayC)

  return (
    <div
      className="relative rounded-xl overflow-hidden flex-shrink-0"
      style={{
        height:     148,
        background: 'rgba(0,0,0,0.03)',
        border:     isAlert
          ? `1px solid rgba(${r},${g},${bBlue},0.55)`
          : `1px solid ${b.color}28`,
        // Subtle pulsing glow on warning/critical buildings
        boxShadow:  isAlert
          ? `0 0 12px rgba(${r},${g},${bBlue},0.18)`
          : 'none',
        transition: 'border-color 1.2s ease, box-shadow 1.2s ease',
      }}
    >
      {/* ── Heatmap gradient overlay ────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={overlay}
      />

      {/* ── Second layer: subtle top-edge heat "bloom" (convection visual) */}
      {showHeatmap && displayC > 26 && (
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height:     '40%',
            background: `linear-gradient(180deg, rgba(${r},${g},${bBlue},0.10) 0%, transparent 100%)`,
            transition: 'opacity 1.2s ease',
          }}
        />
      )}

      {/* ── Info overlay ────────────────────────────────────────────────── */}
      <div className="absolute inset-0 p-2.5 flex flex-col justify-between pointer-events-none">

        {/* Top: shortName badge + temperature zone chip */}
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

        {/* Alert icon if building is in warning/critical state */}
        {isAlert && (
          <div className="flex justify-center">
            <AlertTriangle size={12} style={{ color: badge.color, opacity: 0.6 }} />
          </div>
        )}

        {/* Bottom: building name + temperatures + bar */}
        <div>
          <p className="text-gray-900 text-[10px] font-semibold leading-tight mb-1 truncate">
            {b.name}
          </p>

          {/* Temperature readout */}
          {isSimMode && Math.abs(projC - tempC) >= 0.2 ? (
            // Sim mode: show current → projected
            <div className="flex items-center gap-1 text-[9px] mb-0.5">
              <span className="text-text-dim font-mono">{tempC}°C</span>
              <ArrowRight size={8} className="text-text-dim opacity-50 flex-shrink-0" />
              <span className="font-mono font-bold" style={{ color: badge.color }}>
                {projC}°C
              </span>
              <span className="text-text-dim ml-auto font-mono">
                {tempF.toFixed(1)}°F
              </span>
            </div>
          ) : (
            // Live mode: °C  ·  °F  ·  delta
            <div className="flex items-center justify-between text-[9px] mb-0.5">
              <span className="font-mono font-bold" style={{ color: badge.color }}>
                {tempC}°C
              </span>
              <span className="text-text-dim font-mono">
                {tempF.toFixed(1)}°F
              </span>
              <span
                className="font-mono text-[8px]"
                style={{ color: Math.abs(deltaC) < 2 ? '#4ade80' : badge.color }}
              >
                {deltaC > 0 ? `+${deltaC}` : deltaC}°
              </span>
            </div>
          )}

          {/* Thermometer bar */}
          <ThermoBar tempC={tempC} projC={projC} isSimMode={isSimMode} />
        </div>
      </div>
    </div>
  )
}

/** Horizontal colour scale legend with temperature markers */
function ColorScaleLegend() {
  const markers = [
    { pct: 0,   label: '14°C', sub: 'Cold'    },
    { pct: 25,  label: '20°C', sub: 'Cool'    },
    { pct: 42,  label: '24°C', sub: 'Optimal' },
    { pct: 62,  label: '27°C', sub: 'Warm'    },
    { pct: 80,  label: '30°C', sub: 'Hot'     },
    { pct: 100, label: '34°C+',sub: 'Danger'  },
  ]

  return (
    <div className="pt-3 border-t border-dark-border/60">
      {/* Gradient bar */}
      <div
        className="w-full rounded-full relative"
        style={{ height: 7, background: TEMP_GRADIENT_CSS }}
      >
        {/* Marker ticks */}
        {markers.map(m => (
          <div
            key={m.pct}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${m.pct}%`, background: 'rgba(0,0,0,0.25)' }}
          />
        ))}
      </div>

      {/* Labels */}
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
            <span className="text-[7px] text-text-dim/60 leading-none mt-0.5">{m.sub}</span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-text-dim text-[9px] mt-1 flex items-center gap-1.5">
        <span
          className="w-3 h-1.5 rounded-full inline-block flex-shrink-0"
          style={{ background: 'rgba(100,200,100,0.7)' }}
        />
        Comfort zone 20–26°C shown in green · each building has unique thermal offset
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TempHeatmap() {
  const {
    buildings,
    controls,
    simulationMode,
    simulatedControls,
  } = useEnergy()

  // Active controls: use simulated when sim mode is on
  const activeControls  = simulationMode && simulatedControls ? simulatedControls : controls
  const setpointC       = controls.temperature                  // real setpoint
  const simSetpointC    = simulatedControls?.temperature ?? setpointC
  const ventilation     = activeControls.ventilation

  const [panelOpen,   setPanelOpen]   = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)

  // Campus-wide average temperature (for header display)
  const avgTempF = useMemo(
    () => +(buildings.reduce((s, b) => s + (b.temperature ?? 75), 0) / buildings.length).toFixed(1),
    [buildings],
  )
  const avgTempC = +((avgTempF - 32) * (5 / 9)).toFixed(1)
  const { label: avgLabel, color: avgColor } = tempBadgeInfo(avgTempC)

  // Setpoint change indicator (for sim mode)
  const setpointDelta = +(simSetpointC - setpointC).toFixed(1)

  return (
    <div
      className="rounded-2xl overflow-hidden border border-dark-border"
      style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-border">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${avgColor}12`, border: `1px solid ${avgColor}30` }}
          >
            <Thermometer size={14} style={{ color: avgColor }} />
          </div>

          {/* Title + live stats */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              Temperature Heatmap
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
              <span className="font-mono font-bold" style={{ color: avgColor }}>
                {avgTempC}°C
              </span>
              <span className="text-text-dim"> ({avgTempF}°F)</span>
              &nbsp;·&nbsp;
              <span style={{ color: avgColor }}>{avgLabel}</span>
              {/* Sim mode setpoint change indicator */}
              {simulationMode && setpointDelta !== 0 && (
                <span className="ml-2" style={{ color: '#818cf8' }}>
                  · Setpoint&nbsp;
                  <span className="font-mono">{setpointC}°C</span>
                  <ArrowRight size={9} className="inline mx-0.5 opacity-60" />
                  <span className="font-mono font-bold">{simSetpointC}°C</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Heatmap overlay toggle */}
          <button
            onClick={() => setShowHeatmap(h => !h)}
            title={showHeatmap ? 'Hide temperature overlay' : 'Show temperature overlay'}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
              showHeatmap
                ? 'text-gray-900'
                : 'border-dark-border bg-dark-elevated text-text-dim hover:text-gray-900',
            )}
            style={showHeatmap ? {
              borderColor: `${avgColor}40`,
              background:  `${avgColor}12`,
              color:        avgColor,
            } : {}}
          >
            {showHeatmap ? <Eye size={11} /> : <EyeOff size={11} />}
            {showHeatmap ? 'Heatmap On' : 'Heatmap Off'}
          </button>

          {/* Panel collapse */}
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="w-8 h-8 rounded-lg border border-dark-border bg-dark-elevated flex items-center justify-center text-text-dim hover:text-gray-900 transition-colors"
          >
            {panelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div className="p-4 space-y-4">

          {/* ── Setpoint bar ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-0.5">
            <span className="text-text-dim text-[10px] w-[72px] flex-shrink-0 font-mono uppercase tracking-wide">
              AC Setpoint
            </span>

            {/* Scale bar: 16–32 °C range (slider limits) */}
            <div
              className="flex-1 h-1.5 rounded-full relative overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.07)' }}
            >
              {/* Comfort zone band */}
              <div
                className="absolute top-0 h-full"
                style={{
                  left:       `${((20 - 16) / (32 - 16)) * 100}%`,
                  width:      `${((26 - 20) / (32 - 16)) * 100}%`,
                  background: 'rgba(52,199,110,0.20)',
                }}
              />
              {/* Setpoint marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2.5 rounded-full"
                style={{
                  left:       `${((setpointC - 16) / (32 - 16)) * 100}%`,
                  transform:  'translateX(-50%) translateY(-50%)',
                  background: avgColor,
                  boxShadow:  `0 0 6px ${avgColor}80`,
                  transition: 'left 0.5s ease, background 1.2s ease',
                }}
              />
              {/* Simulated setpoint marker */}
              {simulationMode && simSetpointC !== setpointC && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2 rounded-full opacity-60"
                  style={{
                    left:      `${((simSetpointC - 16) / (32 - 16)) * 100}%`,
                    transform: 'translateX(-50%) translateY(-50%)',
                    background: '#818cf8',
                    transition: 'left 0.5s ease',
                  }}
                />
              )}
            </div>

            <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: avgColor }}>
              {simulationMode && simSetpointC !== setpointC
                ? <>{setpointC}→<span style={{ color: '#818cf8' }}>{simSetpointC}</span>°C</>
                : <>{setpointC}°C</>
              }
            </span>

            {/* Comfort zone label */}
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(52,199,110,0.12)', color: '#4ade80', border: '1px solid rgba(52,199,110,0.25)' }}
            >
              20–26°C ✓
            </span>
          </div>

          {/* ── Building cards grid ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {buildings.map(b => (
              <BuildingHeatCard
                key={b.id}
                building={b}
                setpointC={setpointC}
                simSetpointC={simSetpointC}
                isSimMode={simulationMode && !!simulatedControls}
                showHeatmap={showHeatmap}
                ventilation={ventilation}
              />
            ))}
          </div>

          {/* ── Colour scale legend ──────────────────────────────────────────── */}
          <ColorScaleLegend />

          {/* ── Simulation mode note ─────────────────────────────────────────── */}
          {simulationMode && (
            <p
              className="text-[10px] text-center pt-0.5"
              style={{ color: '#818cf8' }}
            >
              Overlay shows&nbsp;
              <strong style={{ color: '#818cf8' }}>projected</strong>
              &nbsp;temperature ~25 s after applying the simulated setpoint.
              {ventilation > 70 && (
                <> High ventilation ({ventilation}%) accelerates convergence.</>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
