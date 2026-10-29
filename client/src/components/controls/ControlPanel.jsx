/**
 * NeuraGrid — Real-Time Environment Control Panel
 * Supports two modes:
 *   LIVE    — slider changes feed directly into the 5s tick
 *   SIM     — changes go to a preview state; Apply commits / Cancel discards
 *
 * Simulation mode is also triggered automatically when the user clicks
 * "Simulate" on an alert recommendation (via AlertContext → enableSimulation).
 */
import React, { useEffect, useState, useMemo } from 'react'
import {
  X, Wind, Thermometer, Zap, RotateCcw,
  SlidersHorizontal, TrendingDown, TrendingUp,
  Minus, AlertTriangle, CheckCircle2, FlaskConical,
  ArrowRight, Play, StopCircle, Beaker,
} from 'lucide-react'
import { useEnergy } from '../../context/EnergyContext'
import { useAlerts } from '../../context/AlertContext'
import SmartActions from './SmartActions'
import clsx from 'clsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(val, min, max) { return ((val - min) / (max - min)) * 100 }

function delta(real, sim, unit = '', invert = false) {
  const diff     = sim - real
  const pctChg   = real !== 0 ? ((diff / Math.abs(real)) * 100).toFixed(1) : '0'
  const improved = invert ? diff > 0 : diff < 0
  const color    = improved ? '#059669' : diff === 0 ? '#64748B' : '#DB2777'
  const arrow    = diff < 0 ? '↓' : diff > 0 ? '↑' : '—'
  return { diff, pctChg, improved, color, arrow, label: `${arrow}${Math.abs(+pctChg)}%` }
}

// ─── Predicted impact (mathematical preview, no tick required) ────────────────
function calcPrediction(realControls, simControls, buildings, metrics) {
  // Load: exact multiplier ratio relative to real
  const realMult = (realControls.energyLoad / 75) * (1 + (24 - realControls.temperature) * 0.025)
  const simMult  = (simControls.energyLoad  / 75) * (1 + (24 - simControls.temperature)  * 0.025)
  const loadRatio = simMult / Math.max(0.01, realMult)
  const simLoad   = Math.round(metrics.totalConsumption * loadRatio)

  // CO₂: project ventilation bias over ~10 ticks (~50 s real time)
  const avgCo2     = Math.round(buildings.reduce((s, b) => s + (b.co2 ?? 600), 0) / buildings.length)
  const realBias   = (50 - realControls.ventilation) / 50 * 8
  const simBias    = (50 - simControls.ventilation)  / 50 * 8
  const co2Delta   = (simBias - realBias) * 10  // 10 ticks ahead
  const simCo2     = Math.max(380, Math.round(avgCo2 + co2Delta))

  // Temp: setpoint diff × convergence factor (~60% in next few ticks)
  const avgTempF  = +(buildings.reduce((s, b) => s + (b.temperature ?? 75), 0) / buildings.length).toFixed(1)
  const realSetF  = realControls.temperature * 9 / 5 + 32
  const simSetF   = simControls.temperature  * 9 / 5 + 32
  const simTempF  = +(avgTempF + (simSetF - realSetF) * 0.6).toFixed(1)
  const simTempC  = +((simTempF - 32) * 5 / 9).toFixed(1)

  return {
    load: { real: metrics.totalConsumption, sim: simLoad },
    co2:  { real: avgCo2, sim: simCo2 },
    temp: { real: avgTempF, sim: simTempF, simC: simTempC },
  }
}

// ─── Custom slider track + thumb ─────────────────────────────────────────────
function SliderTrack({ value, min, max, onChange, color, dimmed = false }) {
  const p = pct(value, min, max)
  return (
    <div className="relative h-6 flex items-center select-none">
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full pointer-events-none transition-all duration-75"
        style={{ width: `${p}%`, background: dimmed ? `${color}44` : `linear-gradient(90deg, ${color}55, ${color})` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ring-2 ring-base-card pointer-events-none transition-[left] duration-75"
        style={{
          left:       `calc(${p}% - 8px)`,
          background: dimmed ? `${color}88` : color,
          boxShadow:  dimmed ? 'none' : `0 0 10px ${color}90, 0 0 20px ${color}40`,
        }}
      />
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        style={{ height: '24px' }}
      />
    </div>
  )
}

// ─── Slider card ──────────────────────────────────────────────────────────────
function SliderCard({ icon: Icon, label, value, min, max, unit, color, effect,
  metricLabel, metricValue, trend, onChange, simMode, realValue }) {

  const p        = pct(value, min, max)
  const isHigh   = p > 70
  const isLow    = p < 30
  const lvlLabel = isHigh ? 'HIGH' : isLow ? 'LOW' : 'MED'
  const lvlBg    = isHigh ? `${color}20` : isLow ? 'rgba(219,39,119,0.12)' : 'rgba(0,0,0,0.04)'
  const lvlColor = isHigh ? color : isLow ? '#DB2777' : '#64748B'
  const changed  = simMode && realValue !== undefined && value !== realValue

  return (
    <div
      className="rounded-xl p-4 space-y-3 transition-all"
      style={{
        background: simMode ? 'rgba(99,102,241,0.06)' : 'rgba(0,0,0,0.03)',
        border:     simMode
          ? `1px solid rgba(99,102,241,0.22)`
          : `1px solid rgba(0,0,0,0.07)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
            <Icon size={13} style={{ color }} />
          </div>
          <span className="text-gray-900 text-xs font-semibold">{label}</span>
          {changed && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(99,102,241,0.20)', color: '#818cf8' }}>
              MODIFIED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: lvlBg, color: lvlColor }}>{lvlLabel}</span>
          <span className="font-mono font-bold text-base leading-none" style={{ color }}>
            {Number.isInteger(value) ? value : value.toFixed(1)}
            <span className="text-xs font-normal ml-0.5 opacity-70">{unit}</span>
          </span>
        </div>
      </div>

      {/* Real value ghost when in sim mode and changed */}
      {changed && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-text-dim">Real:</span>
          <span className="font-mono text-text-dim line-through">{realValue}{unit}</span>
          <ArrowRight size={9} className="text-text-dim" />
          <span className="font-mono font-bold" style={{ color }}>{Number.isInteger(value) ? value : value.toFixed(1)}{unit}</span>
        </div>
      )}

      {/* Scale min/max */}
      <div className="flex justify-between text-[9px] text-text-dim px-0.5">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>

      {/* Slider */}
      <SliderTrack value={value} min={min} max={max} onChange={onChange} color={color} dimmed={false} />

      {/* Effect description */}
      <p className="text-text-dim text-[10px] leading-relaxed">{effect}</p>

      {/* Live metric */}
      <div className="flex items-center justify-between rounded-lg px-3 py-1.5"
        style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <span className="text-text-dim text-[10px]">{metricLabel}</span>
        <div className="flex items-center gap-1.5">
          {trend === 'down' && <TrendingDown size={10} style={{ color: '#059669' }} />}
          {trend === 'up'   && <TrendingUp   size={10} style={{ color: '#DB2777' }} />}
          {trend === 'flat' && <Minus         size={10} className="text-text-dim"  />}
          <span className="font-mono text-[11px] font-bold" style={{ color }}>{metricValue}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Predicted Impact table (shown in sim mode) ───────────────────────────────
function ImpactTable({ prediction }) {
  const { load, co2, temp } = prediction

  const rows = [
    {
      label: 'Current Load',
      real:  `${load.real.toLocaleString()} kW`,
      sim:   `${load.sim.toLocaleString()} kW`,
      ...delta(load.real, load.sim),
    },
    {
      label: 'Avg CO₂',
      real:  `${co2.real} ppm`,
      sim:   `${co2.sim} ppm`,
      ...delta(co2.real, co2.sim),
    },
    {
      label: 'Avg Temp',
      real:  `${temp.real}°F`,
      sim:   `${temp.sim}°F (${temp.simC}°C)`,
      ...delta(temp.real, temp.sim),
    },
  ]

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)' }}>
      {/* Table header */}
      <div className="grid grid-cols-4 px-3 py-2 border-b text-[9px] font-bold text-text-dim tracking-wider uppercase"
        style={{ borderColor: 'rgba(99,102,241,0.20)', background: 'rgba(99,102,241,0.08)' }}>
        <span>Metric</span>
        <span className="text-right">Current</span>
        <span className="text-right">Predicted</span>
        <span className="text-right">Change</span>
      </div>

      {rows.map(row => (
        <div key={row.label}
          className="grid grid-cols-4 px-3 py-2 border-b last:border-0 items-center"
          style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
          <span className="text-text-dim text-[10px]">{row.label}</span>
          <span className="text-right text-[10px] text-text-dim font-mono">{row.real}</span>
          <span className="text-right text-[11px] font-bold font-mono" style={{ color: row.color }}>{row.sim}</span>
          <div className="flex items-center justify-end gap-1">
            {row.improved
              ? <CheckCircle2 size={9} style={{ color: '#059669' }} />
              : row.diff === 0
                ? <Minus size={9} className="text-text-dim" />
                : <AlertTriangle size={9} style={{ color: '#DB2777' }} />
            }
            <span className="text-[10px] font-bold font-mono" style={{ color: row.color }}>
              {row.label === 'Avg Temp' ? `${row.arrow}${Math.abs(row.diff).toFixed(1)}°F` : row.label}
              {row.label !== 'Avg Temp' ? row.label : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Simpler flat rows for the impact table
function ImpactRow({ label, real, sim, better, unit }) {
  const numDiff  = sim - real
  const improved = better === 'lower' ? numDiff < 0 : numDiff > 0
  const pctChg   = real !== 0 ? Math.abs((numDiff / real) * 100).toFixed(1) : '0'
  const arrow    = numDiff < 0 ? '↓' : numDiff > 0 ? '↑' : '—'
  const color    = improved ? '#059669' : numDiff === 0 ? '#64748B' : '#DB2777'

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0"
      style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
      <span className="text-text-dim text-[10px] w-24">{label}</span>
      <span className="text-text-dim text-[10px] font-mono">{real}{unit}</span>
      <ArrowRight size={10} className="text-text-dim opacity-50" />
      <span className="font-bold text-[11px] font-mono" style={{ color }}>{sim}{unit}</span>
      <span className="text-[10px] font-bold font-mono w-16 text-right" style={{ color }}>
        {arrow}{pctChg}%
        {improved && <CheckCircle2 size={8} className="inline ml-1" style={{ color }} />}
      </span>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function ControlPanel({ open, onClose }) {
  const {
    controls, setControl, resetControls,
    simulationMode, simulatedControls,
    enableSimulation, applySimulation, cancelSimulation,
    buildings, metrics,
  } = useEnergy()
  const { alerts } = useAlerts()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) setTimeout(() => setVisible(true), 10)
    else setVisible(false)
  }, [open])

  // ── All hooks must be called before any early return ──────────────────────
  // Active controls: sim values when in sim mode, real otherwise
  const active    = simulationMode && simulatedControls ? simulatedControls : controls
  const isSimMode = simulationMode && !!simulatedControls

  // Predicted impact — useMemo must be here (before early return) per Rules of Hooks
  const prediction = useMemo(
    () => calcPrediction(controls, active, buildings, metrics),
    [controls, active, buildings, metrics]
  )
  // ─────────────────────────────────────────────────────────────────────────

  if (!open && !visible) return null

  // Plain derivations (not hooks — safe after early return)
  const avgCo2   = Math.round(buildings.reduce((s, b) => s + (b.co2 ?? 650), 0) / buildings.length)
  const avgTempF = +(buildings.reduce((s, b) => s + (b.temperature ?? 75), 0) / buildings.length).toFixed(1)
  const avgTempC = +((avgTempF - 32) * 5 / 9).toFixed(1)

  const co2Trend  = active.ventilation > 65 ? 'down' : active.ventilation < 45 ? 'up' : 'flat'
  const tempTrend = active.temperature < 22 ? 'up'   : active.temperature > 26 ? 'down' : 'flat'
  const loadTrend = active.energyLoad  < 60 ? 'down' : active.energyLoad  > 85 ? 'up'  : 'flat'

  const showPrediction = isSimMode && (
    active.ventilation !== controls.ventilation ||
    active.temperature !== controls.temperature ||
    active.energyLoad  !== controls.energyLoad
  )

  const fixableAlerts = alerts.filter(a =>
    a.status === 'active' && ['co2_critical', 'temp_spike', 'overloaded'].includes(a.type)
  )
  const isChanged = active.ventilation !== 60 || active.temperature !== 24 || active.energyLoad !== 75

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-[1001] flex flex-col overflow-hidden"
        style={{
          width:          'min(440px, 100vw)',
          background:     'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(24px)',
          borderLeft:     isSimMode
            ? '1px solid rgba(99,102,241,0.35)'
            : '1px solid rgba(0,0,0,0.08)',
          boxShadow: isSimMode
            ? '-20px 0 60px rgba(99,102,241,0.15), -4px 0 0 rgba(99,102,241,0.40)'
            : '-4px 0 24px rgba(0,0,0,0.08)',
          transform:  visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >

        {/* ── Simulation mode banner ───────────────────────────────── */}
        {isSimMode && (
          <div
            className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.08))', borderBottom: '1px solid rgba(99,102,241,0.28)' }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#818cf8', boxShadow: '0 0 8px #818cf8' }} />
            <div className="flex-1">
              <p className="text-[11px] font-bold" style={{ color: '#818cf8' }}>SIMULATION MODE ACTIVE</p>
              <p className="text-text-dim text-[10px]">Live system unchanged — previewing adjustments only</p>
            </div>
            <FlaskConical size={16} style={{ color: '#818cf8' }} />
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={isSimMode
                ? { background: 'rgba(99,102,241,0.20)', border: '1px solid rgba(99,102,241,0.40)' }
                : { background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.30)' }}
            >
              <SlidersHorizontal size={14} style={{ color: isSimMode ? '#818cf8' : '#7C3AED' }} />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-sm">
                {isSimMode ? 'Simulation Preview' : 'Environment Controls'}
              </h2>
              <p className="text-text-dim text-[11px]">
                {isSimMode ? 'Adjust sliders to model changes · apply when ready' : 'Manual override · affects all 6 buildings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSimMode && (
              <button
                onClick={() => enableSimulation()}
                title="Preview changes without affecting the live system"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-90"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.30)', color: '#818cf8' }}
              >
                <FlaskConical size={10} />
                Simulate
              </button>
            )}
            {isSimMode && isChanged && (
              <button
                onClick={resetControls}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-text-dim hover:text-gray-900 transition-colors"
                style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.10)' }}
              >
                <RotateCcw size={10} />
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-black/5 border border-base-border flex items-center justify-center text-text-dim hover:text-gray-900 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Apply / Cancel (sim mode only) ───────────────────────── */}
        {isSimMode && (
          <div className="px-4 py-3 flex gap-2 flex-shrink-0 border-b border-base-border">
            <button
              onClick={() => { applySimulation(); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.35), rgba(5,150,105,0.20))', border: '1px solid rgba(5,150,105,0.45)' }}
            >
              <CheckCircle2 size={13} style={{ color: '#059669' }} />
              Apply Changes
            </button>
            <button
              onClick={cancelSimulation}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'rgba(219,39,119,0.10)', border: '1px solid rgba(219,39,119,0.28)', color: '#DB2777' }}
            >
              <StopCircle size={13} />
              Cancel
            </button>
          </div>
        )}

        {/* ── Predicted Impact (sim mode, when changed) ────────────── */}
        {showPrediction && (
          <div className="px-4 pt-3 pb-1 flex-shrink-0 space-y-2">
            <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#818cf8' }}>
              Predicted Impact — ~50 s after apply
            </p>
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(99,102,241,0.22)', background: 'rgba(255,255,255,0.65)' }}>
              <div className="grid grid-cols-4 px-3 py-2 border-b text-[9px] font-bold text-text-dim tracking-wider uppercase"
                style={{ borderColor: 'rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.08)' }}>
                <span>Metric</span>
                <span className="text-right">Now</span>
                <span className="text-right">After</span>
                <span className="text-right">Δ</span>
              </div>

              {[
                { label: 'Load',    real: prediction.load.real, sim: prediction.load.sim, unit: ' kW',  better: 'lower', fmt: v => v.toLocaleString() },
                { label: 'Avg CO₂', real: prediction.co2.real,  sim: prediction.co2.sim,  unit: ' ppm', better: 'lower', fmt: v => v.toString() },
                { label: 'Avg Temp',real: prediction.temp.real, sim: prediction.temp.sim,  unit: '°F',  better: 'lower', fmt: v => v.toFixed(1) },
              ].map(row => {
                const diff     = row.sim - row.real
                const improved = diff < 0  // lower is better for all three
                const pctC     = row.real  ? Math.abs((diff / row.real) * 100).toFixed(1) : '0'
                const arrow    = diff < 0  ? '↓' : diff > 0 ? '↑' : '—'
                const color    = improved  ? '#059669' : diff === 0 ? '#64748B' : '#DB2777'
                return (
                  <div key={row.label} className="grid grid-cols-4 px-3 py-2 border-b last:border-0 items-center"
                    style={{ borderColor: 'rgba(99,102,241,0.10)' }}>
                    <span className="text-text-dim text-[10px]">{row.label}</span>
                    <span className="text-right text-[10px] text-text-dim font-mono">{row.fmt(row.real)}{row.unit}</span>
                    <span className="text-right text-[11px] font-bold font-mono" style={{ color }}>{row.fmt(row.sim)}{row.unit}</span>
                    <div className="flex items-center justify-end gap-0.5">
                      {improved
                        ? <CheckCircle2 size={8} style={{ color }} />
                        : diff !== 0 && <AlertTriangle size={8} style={{ color }} />
                      }
                      <span className="text-[10px] font-bold font-mono" style={{ color }}>{arrow}{pctC}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Scrollable slider area ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* ── One-click smart actions ─────────────────────────────── */}
          <SmartActions />

          {/* Section divider */}
          <div className="h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />

          {/* Alert banner */}
          {fixableAlerts.length > 0 && !isSimMode && (
            <div className="rounded-xl px-3.5 py-2.5 flex items-start gap-3"
              style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.22)' }}>
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#EA580C' }} />
              <p className="text-[10px] leading-relaxed" style={{ color: '#EA580C' }}>
                {fixableAlerts.length} fixable alert{fixableAlerts.length > 1 ? 's' : ''} — use sliders or click <strong>Simulate</strong> to preview fixes first.
              </p>
            </div>
          )}

          {/* Ventilation */}
          <SliderCard
            icon={Wind} label="Ventilation Level"
            value={active.ventilation} min={0} max={100} unit="%" color="#0284C7"
            effect="Increasing airflow flushes CO₂ campus-wide. Above 80% will auto-resolve CO₂ alerts within a few ticks. Each step above 60% draws slight extra fan power."
            metricLabel="Avg Campus CO₂" metricValue={`${avgCo2} ppm`} trend={co2Trend}
            onChange={v => setControl('ventilation', v)}
            simMode={isSimMode} realValue={isSimMode ? controls.ventilation : undefined}
          />

          {/* Temperature */}
          <SliderCard
            icon={Thermometer} label="Temperature Setpoint"
            value={active.temperature} min={16} max={32} unit="°C" color="#EA580C"
            effect="Colder setpoints increase AC load (+2.5%/°C below 24°C). Each building has a unique thermal offset from the campus setpoint."
            metricLabel="Avg Campus Temp" metricValue={`${avgTempF}°F / ${avgTempC}°C`} trend={tempTrend}
            onChange={v => setControl('temperature', v)}
            simMode={isSimMode} realValue={isSimMode ? controls.temperature : undefined}
          />

          {/* Energy Load */}
          <SliderCard
            icon={Zap} label="Energy Usage"
            value={active.energyLoad} min={0} max={100} unit="%" color="#7C3AED"
            effect="Scales total campus load proportionally vs the 75% baseline. Use during demand-response events to shed load instantly."
            metricLabel="Current Load" metricValue={`${metrics.totalConsumption.toLocaleString()} kW`} trend={loadTrend}
            onChange={v => setControl('energyLoad', v)}
            simMode={isSimMode} realValue={isSimMode ? controls.energyLoad : undefined}
          />

          {/* Summary + Active Overrides */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p className="text-[10px] font-bold text-text-dim tracking-wider uppercase">Live Campus Summary</p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Avg CO₂',    value: `${avgCo2} ppm`,                     color: '#0284C7', warn: avgCo2  > 850 },
                { label: 'Avg Temp',   value: `${avgTempF}°F`,                      color: '#EA580C', warn: avgTempF > 78 },
                { label: 'Current Load', value: `${metrics.totalConsumption.toLocaleString()} kW`, color: '#7C3AED', warn: metrics.totalConsumption > 2000 },
                { label: 'Solar Gen',  value: `${metrics.solarGeneration} kW`,      color: '#059669', warn: false },
              ].map(({ label, value, color, warn }) => (
                <div key={label} className="rounded-lg px-3 py-2"
                  style={{ background: warn ? `${color}12` : 'rgba(0,0,0,0.03)', border: `1px solid ${warn ? color + '30' : 'rgba(0,0,0,0.05)'}` }}>
                  <p className="text-text-dim text-[9px]">{label}</p>
                  <p className="font-mono font-bold text-xs mt-0.5" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Active overrides */}
            {isChanged && (
              <div className="rounded-lg px-3 py-2.5"
                style={{
                  background: isSimMode ? 'rgba(99,102,241,0.10)' : 'rgba(167,139,250,0.08)',
                  border:     isSimMode ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(167,139,250,0.20)',
                }}>
                <p className="text-[9px] font-bold tracking-wider mb-1.5"
                  style={{ color: isSimMode ? '#818cf8' : '#7C3AED' }}>
                  {isSimMode ? 'SIMULATED OVERRIDES' : 'ACTIVE OVERRIDES'}
                </p>
                <div className="space-y-1 text-[10px] text-text-dim">
                  {active.ventilation !== 60 && (
                    <p className="flex justify-between">
                      <span>Ventilation</span>
                      <span className="font-mono font-bold" style={{ color: '#0284C7' }}>
                        {active.ventilation}% {active.ventilation > 60 ? '↑ CO₂ reducing' : '↓ CO₂ rising'}
                      </span>
                    </p>
                  )}
                  {active.temperature !== 24 && (
                    <p className="flex justify-between">
                      <span>Temp Setpoint</span>
                      <span className="font-mono font-bold" style={{ color: '#EA580C' }}>
                        {active.temperature}°C {active.temperature < 24 ? '↑ AC load' : '↓ AC load'}
                      </span>
                    </p>
                  )}
                  {active.energyLoad !== 75 && (
                    <p className="flex justify-between">
                      <span>Energy Cap</span>
                      <span className="font-mono font-bold" style={{ color: '#7C3AED' }}>
                        {active.energyLoad}% {active.energyLoad < 75 ? '↓ load shed' : '↑ load boost'}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-t border-base-border flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <div className={clsx('w-1.5 h-1.5 rounded-full', isSimMode ? 'bg-indigo-400 animate-pulse' : 'bg-accent-green animate-pulse-slow')} />
            {isSimMode ? 'Simulating · live system frozen' : 'Effects applied every 5s tick'}
          </div>
          {isChanged && !isSimMode && (
            <button onClick={resetControls}
              className="text-[11px] text-text-dim hover:text-accent-purple transition-colors flex items-center gap-1">
              <RotateCcw size={10} />Reset defaults
            </button>
          )}
          {isSimMode && (
            <button onClick={cancelSimulation}
              className="text-[11px] hover:opacity-80 transition-opacity flex items-center gap-1"
              style={{ color: '#DB2777' }}>
              <StopCircle size={10} />Exit simulation
            </button>
          )}
        </div>

      </div>
    </>
  )
}
